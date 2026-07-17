"""
Analysis Planner — decides exactly what to compute for each intent.
Returns an execution plan with tool, arguments, and expected output.
"""
import re
from app.analysis.engine import find_num_col, find_cat_col, find_date_col


def create_plan(message: str, intent: str, schema: dict, memory: dict) -> dict:
    q = message.lower()
    num_cols  = schema.get("num_cols", [])
    cat_cols  = schema.get("cat_cols", [])
    date_cols = schema.get("date_cols", [])

    # Target column detection
    target_num  = find_num_col(q, num_cols)
    target_cat  = find_cat_col(q, cat_cols)
    target_date = find_date_col(q, date_cols)

    # Memory — inherit last cols for follow-ups
    if memory.get("last_num_col") and not find_num_col(q, num_cols):
        target_num = memory["last_num_col"]
    if memory.get("last_cat_col") and not find_cat_col(q, cat_cols):
        target_cat = memory["last_cat_col"]

    # Aggregation type
    agg = "mean" if re.search(r"\b(average|avg|mean|per|each|typical)\b", q) else "sum"
    top_n_match = re.search(r"\btop\s+(\d+)\b", q)
    top_n = int(top_n_match.group(1)) if top_n_match else None

    plan = {
        "intent": intent,
        "target_num": target_num,
        "target_cat": target_cat,
        "target_date": target_date,
        "agg": agg,
        "top_n": top_n,
        "steps": [],
        "chart_hint": None,
        "needs_clarification": False,
        "clarification": None,
    }

    # Map intent → analysis steps
    if intent in ("greeting", "thanks", "help"):
        plan["steps"] = []

    elif intent == "summary":
        plan["steps"] = [{"fn": "dataset_summary", "args": {}}]
        if target_cat and target_num:
            plan["steps"].append({"fn": "group_aggregate",
                                   "args": {"group_col": target_cat, "value_col": target_num, "agg": "sum", "top_n": 5}})
        plan["chart_hint"] = "bar" if target_cat and target_num else None

    elif intent == "schema":
        plan["steps"] = [{"fn": "dataset_summary", "args": {}}]

    elif intent in ("highest", "lowest"):
        if not num_cols:
            plan["needs_clarification"] = True
            plan["clarification"] = "I couldn't find any numeric columns. Please check your dataset."
        elif target_cat and target_num:
            plan["steps"] = [{"fn": "group_aggregate",
                               "args": {"group_col": target_cat, "value_col": target_num, "agg": agg,
                                        "top_n": top_n}}]
            plan["chart_hint"] = "bar"
        elif target_num:
            plan["steps"] = [{"fn": "descriptive_stats", "args": {"col": target_num}}]
        else:
            plan["steps"] = [{"fn": "dataset_summary", "args": {}}]

    elif intent == "comparison":
        if target_cat and target_num:
            plan["steps"] = [{"fn": "group_aggregate",
                               "args": {"group_col": target_cat, "value_col": target_num, "agg": agg}}]
            plan["chart_hint"] = "bar"
        elif len(num_cols) >= 2:
            plan["steps"] = [{"fn": "correlation_matrix", "args": {"num_cols": num_cols[:5]}}]
            plan["chart_hint"] = "scatter"

    elif intent == "total":
        nc = target_num or (num_cols[0] if num_cols else None)
        if nc:
            plan["steps"] = [{"fn": "descriptive_stats", "args": {"col": nc}}]
            if target_cat:
                plan["steps"].append({"fn": "group_aggregate",
                                       "args": {"group_col": target_cat, "value_col": nc, "agg": "sum"}})
                plan["chart_hint"] = "bar"

    elif intent == "average":
        nc = target_num or (num_cols[0] if num_cols else None)
        if nc:
            plan["steps"] = [{"fn": "descriptive_stats", "args": {"col": nc}}]
            if target_cat:
                plan["steps"].append({"fn": "group_aggregate",
                                       "args": {"group_col": target_cat, "value_col": nc, "agg": "mean"}})
                plan["chart_hint"] = "bar"

    elif intent == "count":
        cc = target_cat or (cat_cols[0] if cat_cols else None)
        if cc:
            plan["steps"] = [{"fn": "count_by_group", "args": {"group_col": cc}}]
            plan["chart_hint"] = "bar"
        else:
            plan["steps"] = [{"fn": "dataset_summary", "args": {}}]

    elif intent == "trend":
        if not date_cols:
            plan["needs_clarification"] = True
            plan["clarification"] = (
                f"I couldn't create a line chart because there is no date column. "
                f"{'A bar chart would better represent this comparison.' if cat_cols else 'Please upload a dataset with date/time data.'}"
            )
        elif target_num:
            plan["steps"] = [{"fn": "monthly_trend", "args": {"date_col": target_date or date_cols[0],
                                                                "value_col": target_num}}]
            plan["chart_hint"] = "line"

    elif intent == "distribution":
        nc = target_num or (num_cols[0] if num_cols else None)
        if nc:
            plan["steps"] = [{"fn": "descriptive_stats", "args": {"col": nc}}]
            plan["chart_hint"] = "histogram"

    elif intent == "correlation":
        if len(num_cols) < 2:
            plan["needs_clarification"] = True
            plan["clarification"] = "Need at least 2 numeric columns for correlation analysis."
        else:
            plan["steps"] = [{"fn": "correlation_matrix", "args": {"num_cols": num_cols[:6]}}]
            plan["chart_hint"] = "scatter"

    elif intent == "outlier":
        nc = target_num or (num_cols[0] if num_cols else None)
        if nc:
            plan["steps"] = [{"fn": "outlier_detection", "args": {"col": nc}}]
            plan["chart_hint"] = "box"

    elif intent == "percentage":
        if target_cat and target_num:
            plan["steps"] = [{"fn": "group_aggregate",
                               "args": {"group_col": target_cat, "value_col": target_num, "agg": "sum"}}]
            plan["chart_hint"] = "pie"

    elif intent == "rank":
        nc = target_num or (num_cols[0] if num_cols else None)
        n = top_n or 10
        if nc:
            plan["steps"] = [{"fn": "top_n_rows", "args": {"value_col": nc, "n": n}}]
            plan["chart_hint"] = "bar"

    elif intent == "missing":
        plan["steps"] = [{"fn": "missing_value_analysis", "args": {}}]

    elif intent == "unique":
        cc = target_cat or (cat_cols[0] if cat_cols else None)
        if cc:
            plan["steps"] = [{"fn": "unique_values", "args": {"col": cc}}]

    elif intent == "recommendation":
        plan["steps"] = [{"fn": "dataset_summary", "args": {}}]
        if target_cat and target_num:
            plan["steps"].append({"fn": "group_aggregate",
                                   "args": {"group_col": target_cat, "value_col": target_num, "agg": "sum"}})
        if len(num_cols) >= 2:
            plan["steps"].append({"fn": "correlation_matrix", "args": {"num_cols": num_cols[:4]}})
        plan["chart_hint"] = "bar" if target_cat and target_num else None

    elif intent == "followup":
        # Reuse previous intent with new filter if detected
        prev_intent = memory.get("last_intent", "summary")
        plan["steps"] = create_plan(message, prev_intent, schema, memory)["steps"]
        plan["chart_hint"] = memory.get("last_chart")

    else:
        plan["steps"] = [{"fn": "dataset_summary", "args": {}}]
        if target_cat and target_num:
            plan["steps"].append({"fn": "group_aggregate",
                                   "args": {"group_col": target_cat, "value_col": target_num, "agg": "sum", "top_n": 10}})
            plan["chart_hint"] = "bar"

    # Always add summary as baseline if empty
    if not plan["steps"]:
        plan["steps"] = [{"fn": "dataset_summary", "args": {}}]

    return plan
