"""
Analysis Engine — ALL computation using Pandas + DuckDB.
Zero AI calculations. Returns verified structured data.
"""
import re
import pandas as pd
import numpy as np
import duckdb
from typing import Optional, Any


def _fmt(v):
    if v is None or (isinstance(v, float) and np.isnan(v)): return "N/A"
    if isinstance(v, (int, np.integer)): return f"{int(v):,}"
    if isinstance(v, float):
        if abs(v) >= 1e9: return f"{v/1e9:.2f}B"
        if abs(v) >= 1e6: return f"{v/1e6:.2f}M"
        if abs(v) >= 1e3: return f"{v/1e3:.1f}K"
        return f"{v:,.2f}"
    return str(v)


# ── Schema Detection ──────────────────────────────────────────────────────────
def detect_schema(df: pd.DataFrame) -> dict:
    num_cols, cat_cols, date_cols = [], [], []
    col_types = {}
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            num_cols.append(col); col_types[col] = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            date_cols.append(col); col_types[col] = "date"
        else:
            # Try datetime parse
            try:
                parsed = pd.to_datetime(df[col].dropna().head(20), infer_datetime_format=True, errors="coerce")
                if parsed.notna().mean() > 0.7:
                    date_cols.append(col); col_types[col] = "date"
                    continue
            except: pass
            cat_cols.append(col); col_types[col] = "categorical"
    return {
        "columns": list(df.columns),
        "num_cols": num_cols,
        "cat_cols": cat_cols,
        "date_cols": date_cols,
        "col_types": col_types,
        "row_count": len(df),
        "null_counts": df.isna().sum().to_dict(),
    }


# ── Column Finder — fuzzy match ───────────────────────────────────────────────
def find_column(query: str, columns: list) -> Optional[str]:
    q = query.lower().replace(" ","").replace("_","")
    for col in columns:
        cn = col.lower().replace(" ","").replace("_","")
        if cn == q or cn in q or q in cn: return col
    # word-level
    words = re.sub(r"[^a-z0-9\s]", " ", query.lower()).split()
    for word in words:
        if len(word) < 2: continue
        for col in columns:
            cn = col.lower().replace("_"," ")
            if word in cn or cn.startswith(word): return col
    return None


def find_num_col(query: str, num_cols: list) -> Optional[str]:
    return find_column(query, num_cols) or (num_cols[0] if num_cols else None)

def find_cat_col(query: str, cat_cols: list) -> Optional[str]:
    return find_column(query, cat_cols) or (cat_cols[0] if cat_cols else None)

def find_date_col(query: str, date_cols: list) -> Optional[str]:
    return find_column(query, date_cols) or (date_cols[0] if date_cols else None)


# ── DuckDB query helper ───────────────────────────────────────────────────────
def run_sql(df: pd.DataFrame, sql: str) -> pd.DataFrame:
    conn = duckdb.connect()
    conn.register("df", df)
    return conn.execute(sql).fetchdf()


# ── Core Analysis Functions ───────────────────────────────────────────────────
def dataset_summary(df: pd.DataFrame, schema: dict) -> dict:
    stats = {}
    for col in schema["num_cols"]:
        vals = df[col].dropna()
        if not len(vals): continue
        stats[col] = {
            "total":  round(float(vals.sum()), 2),
            "mean":   round(float(vals.mean()), 2),
            "median": round(float(vals.median()), 2),
            "std":    round(float(vals.std()), 2),
            "min":    round(float(vals.min()), 2),
            "max":    round(float(vals.max()), 2),
            "count":  int(vals.count()),
        }
    date_range = None
    if schema["date_cols"]:
        try:
            dc = schema["date_cols"][0]
            dates = pd.to_datetime(df[dc], errors="coerce").dropna()
            if len(dates):
                date_range = {"from": str(dates.min().date()), "to": str(dates.max().date()), "column": dc}
        except: pass
    return {
        "rows": len(df), "columns": len(df.columns),
        "num_cols": schema["num_cols"], "cat_cols": schema["cat_cols"],
        "date_cols": schema["date_cols"], "missing": int(df.isna().sum().sum()),
        "duplicates": int(df.duplicated().sum()),
        "numeric_stats": stats, "date_range": date_range,
    }


def group_aggregate(df: pd.DataFrame, group_col: str, value_col: str, agg: str = "sum", top_n: int = None) -> list:
    sql = f"""
        SELECT "{group_col}" as name,
               {agg.upper()}("{value_col}") as value,
               COUNT(*) as count,
               AVG("{value_col}") as avg_val
        FROM df
        WHERE "{group_col}" IS NOT NULL AND "{value_col}" IS NOT NULL
        GROUP BY "{group_col}"
        ORDER BY value DESC
    """
    result = run_sql(df, sql)
    total = float(result["value"].sum())
    records = []
    for _, row in result.iterrows():
        records.append({
            "name": str(row["name"]),
            "value": round(float(row["value"]), 2),
            "value_fmt": _fmt(row["value"]),
            "pct": round(float(row["value"]) / total * 100, 1) if total else 0,
            "count": int(row["count"]),
            "avg": round(float(row["avg_val"]), 2),
        })
    return records[:top_n] if top_n else records


def count_by_group(df: pd.DataFrame, group_col: str) -> list:
    sql = f"""
        SELECT "{group_col}" as name, COUNT(*) as count
        FROM df WHERE "{group_col}" IS NOT NULL
        GROUP BY "{group_col}" ORDER BY count DESC
    """
    result = run_sql(df, sql)
    total = int(result["count"].sum())
    return [{"name": str(r["name"]), "count": int(r["count"]),
             "pct": round(int(r["count"])/total*100, 1)} for _, r in result.iterrows()]


def monthly_trend(df: pd.DataFrame, date_col: str, value_col: str) -> list:
    df2 = df.copy()
    df2["__date"] = pd.to_datetime(df2[date_col], errors="coerce")
    df2 = df2.dropna(subset=["__date"])
    df2["__period"] = df2["__date"].dt.to_period("M")
    result = run_sql(df2, f"""
        SELECT CAST(__period AS VARCHAR) as period,
               SUM("{value_col}") as value,
               COUNT(*) as count
        FROM df2
        GROUP BY __period ORDER BY __period
    """)
    rows = [{"period": str(r["period"]), "value": round(float(r["value"]), 2), "count": int(r["count"])}
            for _, r in result.iterrows()]
    if len(rows) >= 2:
        first, last = rows[0]["value"], rows[-1]["value"]
        change = round((last - first) / first * 100, 1) if first != 0 else None
        for r in rows: r["overall_change_pct"] = change
    return rows


def descriptive_stats(df: pd.DataFrame, col: str) -> dict:
    vals = df[col].dropna()
    if not len(vals): return {"error": "No valid data"}
    return {
        "column": col, "count": int(len(vals)),
        "mean": round(float(vals.mean()), 2), "median": round(float(vals.median()), 2),
        "std": round(float(vals.std()), 2), "var": round(float(vals.var()), 2),
        "min": round(float(vals.min()), 2), "max": round(float(vals.max()), 2),
        "q1": round(float(vals.quantile(0.25)), 2), "q3": round(float(vals.quantile(0.75)), 2),
        "skew": round(float(vals.skew()), 3), "kurtosis": round(float(vals.kurtosis()), 3),
    }


def outlier_detection(df: pd.DataFrame, col: str) -> dict:
    vals = df[col].dropna()
    if len(vals) < 10: return {"error": "Need at least 10 records"}
    q1, q3 = vals.quantile(0.25), vals.quantile(0.75)
    iqr = q3 - q1
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    outliers = df[(df[col] < lower) | (df[col] > upper)]
    return {
        "column": col, "total_rows": len(df), "outlier_count": len(outliers),
        "outlier_pct": round(len(outliers)/len(df)*100, 1),
        "lower_bound": round(float(lower), 2), "upper_bound": round(float(upper), 2),
        "outlier_values": sorted(outliers[col].round(2).tolist())[:20],
    }


def correlation_matrix(df: pd.DataFrame, num_cols: list) -> list:
    sub = df[num_cols].dropna()
    if len(sub) < 2 or len(num_cols) < 2: return []
    corr = sub.corr()
    result = []
    for i, c1 in enumerate(num_cols):
        for j, c2 in enumerate(num_cols):
            if i < j:
                r_val = round(float(corr.loc[c1, c2]), 3)
                strength = "Strong" if abs(r_val) > 0.7 else "Moderate" if abs(r_val) > 0.4 else "Weak"
                result.append({"col1": c1, "col2": c2, "r": r_val, "strength": strength,
                                "direction": "positive" if r_val > 0 else "negative"})
    return sorted(result, key=lambda x: abs(x["r"]), reverse=True)


def missing_value_analysis(df: pd.DataFrame) -> list:
    results = []
    for col in df.columns:
        null_count = int(df[col].isna().sum())
        if null_count > 0:
            results.append({
                "column": col, "missing": null_count,
                "pct": round(null_count / len(df) * 100, 1),
                "dtype": str(df[col].dtype),
            })
    return sorted(results, key=lambda x: x["missing"], reverse=True)


def top_n_rows(df: pd.DataFrame, value_col: str, n: int = 10, ascending: bool = False) -> list:
    sorted_df = df.sort_values(value_col, ascending=ascending).head(n)
    return sorted_df.to_dict("records")


def filter_dataframe(df: pd.DataFrame, col: str, value: Any, op: str = "eq") -> pd.DataFrame:
    ops = {
        "eq": df[col] == value,
        "gt": df[col] > value,
        "lt": df[col] < value,
        "gte": df[col] >= value,
        "lte": df[col] <= value,
        "contains": df[col].astype(str).str.contains(str(value), case=False, na=False),
    }
    return df[ops.get(op, df[col] == value)]


def unique_values(df: pd.DataFrame, col: str) -> dict:
    vals = df[col].dropna()
    unique = vals.unique().tolist()
    return {
        "column": col, "unique_count": len(unique),
        "total_count": len(vals),
        "values": [str(v) for v in sorted(unique)[:50]],
    }
