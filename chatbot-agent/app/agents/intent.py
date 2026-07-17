"""
Intent Classifier — classifies user questions into analysis intents.
Pure pattern matching, zero AI needed.
"""
import re
from typing import Tuple

INTENTS = {
    "greeting":      r"^(hi+|hello|hey|howdy|good\s*(morning|evening|afternoon)|how are you)\W*$",
    "thanks":        r"^(thanks?|thank you|great|ok|okay|got it|nice|cool|perfect|awesome)\W*$",
    "help":          r"\b(help|what can you|what do you|capabilities|how do you work)\b",
    "summary":       r"\b(summary|overview|describe|about.*data|tell me|explain|everything|recap|full picture)\b",
    "schema":        r"\b(column|field|schema|structure|what.*have|what.*contain|data type)\b",
    "trend":         r"\b(trend|over time|monthly|weekly|daily|growth|increase|decrease|change|timeline|by month|by year|by quarter)\b",
    "correlation":   r"\b(correlat|relationship|related|impact|affect|depend|linear|association)\b",
    "distribution":  r"\b(distribut|spread|histogram|frequency|range|variance|std|standard deviation)\b",
    "outlier":       r"\b(outlier|anomaly|unusual|abnormal|spike|drop|weird|exceptional|extreme)\b",
    "forecast":      r"\b(forecast|predict|future|next month|projection|estimate|expected|will be)\b",
    "filter":        r"\b(where|only|specific|filter|find.*with|show.*where|records.*with)\b",
    "rank":          r"\b(rank|ranking|order|sorted|top \d|second|third|position|first|last)\b",
    "percentage":    r"\b(percent|share|portion|proportion|breakdown|ratio|contribution|pie)\b",
    "pivot":         r"\b(pivot|cross.*tab|matrix|by.*and.*by|crosstab)\b",
    "recommendation":r"\b(recommend|suggest|advice|improve|strategy|should|focus|action|what.*do|best course)\b",
    "visualization": r"\b(chart|graph|plot|visualize|show|draw|display|bar|pie|line|scatter|histogram|box|area)\b",
    "comparison":    r"\b(compare|versus|vs|between|difference|better|worse|contrast|against)\b",
    "highest":       r"\b(highest|most|maximum|max|top|best|greatest|largest|leading|dominant|more)\b",
    "lowest":        r"\b(lowest|least|minimum|min|bottom|worst|smallest|fewest|weakest|less)\b",
    "average":       r"\b(average|avg|mean|typical|per record|each)\b",
    "total":         r"\b(total|sum|overall|combined|grand total|aggregate|how much)\b",
    "count":         r"\b(how many|count|number of|records|entries|rows|instances)\b",
    "missing":       r"\b(missing|null|empty|nan|incomplete|blank)\b",
    "unique":        r"\b(unique|distinct|different|variety|categories)\b",
    "followup":      r"\b(and|also|as well|what about|how about|now show|instead|only for|filter by|narrow|refine)\b",
}

# Priority order — more specific first
PRIORITY = [
    "greeting","thanks","help","missing","unique","schema",
    "trend","forecast","correlation","distribution","outlier","pivot",
    "recommendation","visualization","followup",
    "comparison","percentage","rank","filter",
    "highest","lowest","average","total","count","summary",
]

def detect_intent(message: str) -> str:
    q = message.lower().strip()
    for intent in PRIORITY:
        if re.search(INTENTS[intent], q, re.IGNORECASE):
            return intent
    return "summary"

def detect_chart_type(message: str, has_date: bool, num_count: int, cat_count: int) -> str | None:
    """Auto-select best chart type based on query + data structure."""
    q = message.lower()

    # Explicit chart request
    for chart in ["line","bar","pie","histogram","scatter","box","area"]:
        if chart in q: return chart

    # Smart auto-selection
    if re.search(r"\b(trend|over time|monthly|weekly|growth|timeline)\b", q) and has_date:
        return "line"
    if re.search(r"\b(share|portion|percent|proportion|pie|composition)\b", q) and cat_count > 0:
        return "pie"
    if re.search(r"\b(distribut|spread|frequency|histogram)\b", q):
        return "histogram"
    if re.search(r"\b(correlat|relationship|vs|scatter)\b", q) and num_count >= 2:
        return "scatter"
    if re.search(r"\b(outlier|box|range|spread)\b", q):
        return "box"
    if re.search(r"\b(cumulative|area|accumulate)\b", q):
        return "area"
    if cat_count > 0 and num_count > 0:
        return "bar"  # default for comparisons
    return None
