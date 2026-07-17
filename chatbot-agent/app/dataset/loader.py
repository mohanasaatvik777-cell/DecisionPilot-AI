"""
Dataset loader — reads CSV, Excel, JSON into a pandas DataFrame.
Automatically detects schema and semantic column roles.
"""
import io
import json
import pandas as pd
import numpy as np
from typing import Optional

# ── Semantic role aliases (no hardcoding — all matched via substring / alias lists) ──
ROLE_ALIASES = {
    "revenue":   ["revenue","sales","income","turnover","net sales","gross sales","amount","total amount","invoice amount","sale amount","earning"],
    "profit":    ["profit","margin","net profit","gross profit","net income","operating profit","ebitda","gain"],
    "cost":      ["cost","expense","expenditure","cogs","spending","outflow","overhead"],
    "quantity":  ["qty","quantity","units","count","volume","items","pieces","ordered","sold"],
    "price":     ["price","rate","unit price","selling price","mrp","fare","fee","charge"],
    "discount":  ["discount","rebate","reduction","off","promo"],
    "tax":       ["tax","vat","gst","duty"],
    "customer":  ["customer","client","buyer","consumer","account","user","member"],
    "product":   ["product","item","sku","goods","article","service","offering","description"],
    "category":  ["category","segment","type","class","group","division","genre","dept","department"],
    "region":    ["region","territory","zone","area","district"],
    "country":   ["country","nation","location country"],
    "state":     ["state","province","county","prefecture"],
    "city":      ["city","town","municipality","locale"],
    "date":      ["date","time","period","month","year","day","week","quarter","timestamp","created","ordered","shipped"],
    "order_id":  ["order","invoice","transaction","receipt","bill","booking","reference","id","no","number"],
}

def _detect_role(col_name: str) -> Optional[str]:
    """Map a column name to a semantic role without hardcoding."""
    c = col_name.lower().replace("_", " ").replace("-", " ").strip()
    for role, aliases in ROLE_ALIASES.items():
        for alias in aliases:
            if alias in c or c in alias:
                return role
    return None

def load_dataframe(file_bytes: bytes, filename: str) -> pd.DataFrame:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "csv":
        df = pd.read_csv(io.BytesIO(file_bytes))
    elif ext in ("xlsx", "xls"):
        df = pd.read_excel(io.BytesIO(file_bytes))
    elif ext == "json":
        df = pd.read_json(io.BytesIO(file_bytes))
    else:
        raise ValueError(f"Unsupported file type: {ext}")
    df.columns = [str(c).strip() for c in df.columns]
    return df

def analyze_schema(df: pd.DataFrame) -> dict:
    """Full schema detection — types, roles, quality metrics."""
    schema = {}
    for col in df.columns:
        series = df[col]
        dtype  = str(series.dtype)
        null_c = int(series.isna().sum())
        uniq_c = int(series.nunique())

        # Detect actual type
        if pd.api.types.is_numeric_dtype(series):
            col_type = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(series):
            col_type = "date"
        else:
            # Try to parse as date
            try:
                parsed = pd.to_datetime(series.dropna().head(20), infer_datetime_format=True, errors="coerce")
                if parsed.notna().mean() > 0.7:
                    col_type = "date"
                else:
                    col_type = "categorical"
            except Exception:
                col_type = "categorical"

        role = _detect_role(col)
        sample = [str(v) for v in series.dropna().head(5).tolist()]

        schema[col] = {
            "dtype":      dtype,
            "col_type":   col_type,
            "role":       role,
            "null_count": null_c,
            "null_pct":   round(null_c / len(df) * 100, 1) if len(df) else 0,
            "unique":     uniq_c,
            "sample":     sample,
        }
    return schema

def get_column_by_role(schema: dict, role: str) -> Optional[str]:
    """Return first column with the given semantic role."""
    for col, info in schema.items():
        if info.get("role") == role:
            return col
    return None

def get_columns_by_type(schema: dict, col_type: str) -> list:
    return [c for c, info in schema.items() if info.get("col_type") == col_type]
