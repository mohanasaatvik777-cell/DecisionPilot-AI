"""
Local Responder — generates accurate Markdown responses WITHOUT any AI API.
Uses pre-computed backend data. Never hallucinates.
"""
import json


def _fmt(v):
    if v is None: return "N/A"
    try:
        n = float(v)
        if abs(n) >= 1e9: return f"{n/1e9:.2f}B"
        if abs(n) >= 1e6: return f"{n/1e6:.2f}M"
        if abs(n) >= 1e3: return f"{n/1e3:.1f}K"
        return f"{n:,.2f}"
    except: return str(v)


def _pct(v, total):
    try: return f"{float(v)/float(total)*100:.1f}%"
    except: return "0%"


def _followups(num_cols, cat_cols, date_cols):
    lines = ["\n---\n**Would you like to know:**"]
    if cat_cols and num_cols:
        lines.append(f"- Which {cat_cols[0]} has the highest {num_cols[0]}?")
    if len(num_cols) > 1:
        lines.append(f"- Average {num_cols[1]}?")
    if date_cols:
        lines.append("- Show the trend over time?")
    else:
        lines.append("- Any unusual values in the data?")
    lines.append("- Business recommendations?")
    return "\n".join(lines)


def build_response(intent: str, results: dict, schema: dict, message: str) -> str:
    num_cols  = schema.get("num_cols", [])
    cat_cols  = schema.get("cat_cols", [])
    date_cols = schema.get("date_cols", [])
    row_count = schema.get("row_count", 0)
    fu = _followups(num_cols, cat_cols, date_cols)

    # ── Dataset Summary ───────────────────────────────────────────────────
    if "dataset_summary" in results and intent in ("summary", "schema", "greeting"):
        s = results["dataset_summary"]
        md = f"## 📊 Dataset Summary\n\n"
        md += f"- **Records:** {s.get('rows', row_count):,}\n"
        md += f"- **Columns:** {s.get('columns', len(schema.get('columns',[])))}\n"
        if num_cols: md += f"- **Numeric:** {', '.join(num_cols)}\n"
        if cat_cols: md += f"- **Categorical:** {', '.join(cat_cols)}\n"
        if date_cols: md += f"- **Date:** {', '.join(date_cols)}\n"
        if s.get("date_range"):
            dr = s["date_range"]
            md += f"- **Date range:** {dr['from']} → {dr['to']}\n"
        if s.get("missing"): md += f"- **Missing values:** {s['missing']:,}\n"
        stats = s.get("numeric_stats", {})
        if stats:
            md += "\n### Key Metrics\n| Column | Total | Average | Min | Max |\n|---|---|---|---|---|\n"
            for col, st in list(stats.items())[:5]:
                md += f"| **{col}** | {_fmt(st['total'])} | {_fmt(st['mean'])} | {_fmt(st['min'])} | {_fmt(st['max'])} |\n"
        return md + fu

    # ── Group Aggregate (highest/lowest/compare/percentage) ───────────────
    if "group_aggregate" in results:
        data = results["group_aggregate"]
        if not data:
            return "No data found for this grouping. Please check column names.\n" + fu
        total = sum(d.get("value", 0) for d in data)
        q = message.lower()
        is_lowest = any(w in q for w in ["lowest","least","minimum","min","bottom","worst","fewest","less"])
        is_pct    = any(w in q for w in ["percent","share","portion","breakdown","pie"])
        is_avg    = any(w in q for w in ["average","avg","mean","per"])

        if is_pct:
            md = "## 🥧 Percentage Breakdown\n\n"
            md += "| Category | Value | Share |\n|---|---|---|\n"
            for d in data:
                md += f"| **{d['name']}** | {_fmt(d['value'])} | **{d.get('pct',0):.1f}%** |\n"
            top3_pct = sum(d.get("pct",0) for d in data[:3])
            md += f"\nTop 3 account for **{top3_pct:.1f}%** of total."
        elif is_lowest:
            target = data[-1]
            md = f"## 📉 Lowest {'Average' if is_avg else 'Total'}\n\n"
            md += f"**{target['name']}** — **{_fmt(target['value'])}** ({target.get('pct',0):.1f}%)\n\n"
            md += "### All Ranked (Lowest First)\n| Rank | Category | Value | Share |\n|---|---|---|---|\n"
            for i, d in enumerate(reversed(data)):
                md += f"| {i+1} | **{d['name']}** | {_fmt(d['value'])} | {d.get('pct',0):.1f}% |\n"
        else:
            target = data[0]
            md = f"## 🏆 {'Average' if is_avg else 'Total'} by Category\n\n"
            md += f"**{target['name']}** leads with **{_fmt(target['value'])}** ({target.get('pct',0):.1f}%)\n\n"
            md += "### Rankings\n| Rank | Category | Value | Share | Records |\n|---|---|---|---|---|\n"
            for i, d in enumerate(data[:15]):
                md += f"| {i+1} | **{d['name']}** | {_fmt(d['value'])} | {d.get('pct',0):.1f}% | {d['count']} |\n"
            if len(data) > 15: md += f"*...and {len(data)-15} more*\n"
            if len(data) >= 2:
                gap = data[0]['value'] - data[-1]['value']
                md += f"\n**{data[0]['name']}** leads **{data[-1]['name']}** by {_fmt(gap)}."
        return md + fu

    # ── Count by Group ────────────────────────────────────────────────────
    if "count_by_group" in results:
        data = results["count_by_group"]
        total = sum(d['count'] for d in data)
        md = "## 📋 Record Count by Category\n\n"
        md += "| Category | Records | Share |\n|---|---|---|\n"
        for d in data:
            md += f"| **{d['name']}** | {d['count']:,} | {d.get('pct',0):.1f}% |\n"
        md += f"\n**Total: {total:,} records**"
        return md + fu

    # ── Monthly Trend ─────────────────────────────────────────────────────
    if "monthly_trend" in results:
        data = results["monthly_trend"]
        if not data: return "No date data found for trend analysis." + fu
        vals = [d["value"] for d in data]
        change = data[0].get("overall_change_pct", "N/A")
        peak = max(data, key=lambda x: x["value"])
        low  = min(data, key=lambda x: x["value"])
        dir_emoji = "📈" if isinstance(change, (int,float)) and change >= 0 else "📉"
        md = f"## {dir_emoji} Trend Analysis\n\n"
        md += f"Overall change: **{change}%** across **{len(data)} periods**\n\n"
        md += "### Monthly Values\n| Period | Value |\n|---|---|\n"
        for d in data[-12:]:
            md += f"| {d['period']} | {_fmt(d['value'])} |\n"
        md += f"\n- 📈 **Peak:** {peak['period']} — {_fmt(peak['value'])}\n"
        md += f"- 📉 **Low:** {low['period']} — {_fmt(low['value'])}\n"
        avg = sum(vals)/len(vals) if vals else 0
        md += f"- 📊 **Average per period:** {_fmt(avg)}\n"
        return md + fu

    # ── Descriptive Stats ─────────────────────────────────────────────────
    if "descriptive_stats" in results:
        s = results["descriptive_stats"]
        col = s.get("column","metric")
        md = f"## 📊 Statistics — {col}\n\n"
        md += "| Metric | Value |\n|---|---|\n"
        for k,label in [("count","Records"),("mean","Mean (Average)"),("median","Median"),
                         ("std","Std Deviation"),("min","Minimum"),("max","Maximum"),
                         ("q1","Q1 (25%)"),("q3","Q3 (75%)")]:
            if k in s: md += f"| **{label}** | {_fmt(s[k])} |\n"
        return md + fu

    # ── Outliers ──────────────────────────────────────────────────────────
    if "outlier_detection" in results:
        o = results["outlier_detection"]
        col = o.get("column","")
        md = f"## ⚠️ Outlier Analysis — {col}\n\n"
        if o.get("outlier_count", 0) == 0:
            md += f"✅ **No outliers** detected in **{col}**. All values are within normal range.\n"
        else:
            md += f"Found **{o['outlier_count']} outliers** ({o.get('outlier_pct',0):.1f}% of data)\n\n"
            md += f"- **Normal range:** {_fmt(o.get('lower_bound'))} to {_fmt(o.get('upper_bound'))}\n"
            vals = o.get("outlier_values", [])
            if vals:
                md += f"- **Outlier values:** {', '.join(_fmt(v) for v in vals[:8])}\n"
        return md + fu

    # ── Correlation ───────────────────────────────────────────────────────
    if "correlation_matrix" in results:
        data = results["correlation_matrix"]
        if not data: return "Need at least 2 numeric columns for correlation." + fu
        md = "## 🔗 Correlation Analysis\n\n"
        md += "| Column 1 | Column 2 | Correlation | Strength |\n|---|---|---|---|\n"
        for d in data:
            md += f"| **{d['col1']}** | **{d['col2']}** | {d['r']} | {d['strength']} {d['direction']} |\n"
        strong = [d for d in data if abs(d["r"]) > 0.7]
        if strong:
            md += f"\n🔗 **Strongest:** {strong[0]['col1']} ↔ {strong[0]['col2']} (r={strong[0]['r']})"
        return md + fu

    # ── Missing Values ────────────────────────────────────────────────────
    if "missing_value_analysis" in results:
        data = results["missing_value_analysis"]
        if not data: return "✅ **No missing values** found in the dataset!" + fu
        md = "## 🔍 Missing Values Report\n\n"
        md += "| Column | Missing | Percentage |\n|---|---|---|\n"
        for d in data:
            md += f"| **{d['column']}** | {d['missing']:,} | {d['pct']:.1f}% |\n"
        return md + fu

    # ── Top N ─────────────────────────────────────────────────────────────
    if "top_n_rows" in results:
        data = results["top_n_rows"]
        if not data: return "No data found." + fu
        first_row = data[0] if data else {}
        cols = list(first_row.keys())[:6]
        md = f"## 🏆 Top {len(data)} Records\n\n"
        md += "| " + " | ".join(f"**{c}**" for c in cols) + " |\n"
        md += "|" + "---|"*len(cols) + "\n"
        for row in data:
            md += "| " + " | ".join(str(row.get(c,"")) for c in cols) + " |\n"
        return md + fu

    # ── Unique Values ─────────────────────────────────────────────────────
    if "unique_values" in results:
        u = results["unique_values"]
        md = f"## 🔖 Unique Values — {u.get('column','')}\n\n"
        md += f"**{u.get('unique_count',0):,}** unique values out of **{u.get('total_count',0):,}** records\n\n"
        vals = u.get("values", [])
        if vals:
            md += "**Values:** " + ", ".join(f"`{v}`" for v in vals[:20])
            if len(vals) > 20: md += f" *(+{len(vals)-20} more)*"
        return md + fu

    # ── Default ───────────────────────────────────────────────────────────
    md = f"## 📊 Analysis Result\n\nDataset: **{row_count:,} records**\n"
    if num_cols: md += f"- Numeric: {', '.join(num_cols)}\n"
    if cat_cols: md += f"- Categorical: {', '.join(cat_cols)}\n"
    md += "\nTry: *\"summary\"*, *\"highest X by Y\"*, *\"trend over time\"*, *\"recommendations\"*"
    return md
