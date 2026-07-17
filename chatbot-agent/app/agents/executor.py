"""
Executor — runs the analysis plan against the DataFrame.
All math is done here. Gemini never computes numbers.
"""
import pandas as pd
from app.analysis.engine import (
    dataset_summary, group_aggregate, count_by_group,
    monthly_trend, descriptive_stats, outlier_detection,
    correlation_matrix, missing_value_analysis, top_n_rows,
    unique_values,
)

FN_MAP = {
    "dataset_summary":       lambda df, schema, **kw: dataset_summary(df, schema),
    "group_aggregate":       lambda df, schema, **kw: group_aggregate(df, **kw),
    "count_by_group":        lambda df, schema, **kw: count_by_group(df, **kw),
    "monthly_trend":         lambda df, schema, **kw: monthly_trend(df, **kw),
    "descriptive_stats":     lambda df, schema, **kw: descriptive_stats(df, **kw),
    "outlier_detection":     lambda df, schema, **kw: outlier_detection(df, **kw),
    "correlation_matrix":    lambda df, schema, **kw: correlation_matrix(df, **kw),
    "missing_value_analysis":lambda df, schema, **kw: missing_value_analysis(df),
    "top_n_rows":            lambda df, schema, **kw: top_n_rows(df, **kw),
    "unique_values":         lambda df, schema, **kw: unique_values(df, **kw),
}


def execute_plan(df: pd.DataFrame, schema: dict, steps: list) -> dict:
    results = {}
    for step in steps:
        fn_name = step["fn"]
        args    = {k: v for k, v in step.get("args", {}).items()}
        fn = FN_MAP.get(fn_name)
        if not fn:
            results[fn_name] = {"error": f"Unknown function: {fn_name}"}
            continue
        try:
            result = fn(df, schema, **args)
            results[fn_name] = result
        except Exception as e:
            results[fn_name] = {"error": str(e)}
    return results


def verify_results(results: dict) -> dict:
    """Sanitise computed results — remove NaN, deduplicate."""
    import math
    clean = {}
    for k, v in results.items():
        if isinstance(v, list):
            seen, deduped = set(), []
            for item in v:
                if isinstance(item, dict):
                    key = item.get("name", item.get("period", id(item)))
                    if key not in seen:
                        seen.add(key)
                        deduped.append({
                            k2: (None if isinstance(v2, float) and math.isnan(v2) else v2)
                            for k2, v2 in item.items()
                        })
                else:
                    deduped.append(item)
            clean[k] = deduped
        elif isinstance(v, dict):
            clean[k] = {
                k2: (None if isinstance(v2, float) and math.isnan(v2) else v2)
                for k2, v2 in v.items()
            }
        else:
            clean[k] = v
    return clean
