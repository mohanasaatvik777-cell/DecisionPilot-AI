"""
Gemini Explainer — uses Gemini to explain ONLY pre-computed backend results.
Gemini NEVER calculates. It ONLY formats/explains verified facts.
"""
import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

_api_key = os.getenv("GEMINI_API_KEY", "")
_client = None
_model_id = "gemini-2.5-flash"

if _api_key and _api_key.startswith("AIza"):
    _client = genai.Client(api_key=_api_key)


# ── Strict grounded system prompt ────────────────────────────────────────────
SYSTEM_PROMPT = """You are an AI Business Data Analyst assistant.

CRITICAL RULES — NEVER BREAK:
1. Answer ONLY using the VERIFIED DATA section below. Never invent or estimate values.
2. If the answer is not in VERIFIED DATA, say exactly: "I could not find that information in the available dataset."
3. Never perform calculations — all numbers come from pre-computed backend results.
4. Respond in professional Markdown: ## headings, bullet points, tables.
5. Format numbers: commas for thousands (1,234), abbreviations (1.2K, 3.5M).
6. Reference actual column names from the dataset.
7. End every analytical response with 3 follow-up questions using actual column names.
8. Never expose raw JSON, SQL, code, or internal implementation details.
9. If VERIFIED DATA shows an error, explain what went wrong and suggest alternatives.
10. Keep responses concise and business-focused.

RESPONSE FORMAT:
## [Direct Answer]

**Key Findings:**
• [finding with exact number from data]
• [finding with exact number from data]

**Insights:**
[Plain English business meaning]

**Recommendation:** (only if genuinely useful)
[Action based on data]

**Would you like to know:**
- [follow-up 1 using actual column names]
- [follow-up 2]
- [follow-up 3]
"""


def build_context(results: dict, schema: dict, intent: str, question: str) -> str:
    schema_text = (
        f"Dataset: {schema.get('row_count','?'):,} rows, {len(schema.get('columns',[]))} columns\n"
        f"Numeric: {', '.join(schema.get('num_cols',[]))}\n"
        f"Categorical: {', '.join(schema.get('cat_cols',[]))}\n"
        f"Date: {', '.join(schema.get('date_cols',[]))}\n"
    )
    results_json = json.dumps(results, indent=2, default=str)
    if len(results_json) > 7000:
        results_json = results_json[:7000] + "\n... [truncated]"
    return (
        f"DATASET SCHEMA:\n{schema_text}\n"
        f"ANALYSIS INTENT: {intent}\n\n"
        f"VERIFIED DATA (ONLY use these numbers):\n{results_json}\n\n"
        f"USER QUESTION: {question}"
    )


async def explain(question: str, results: dict, schema: dict,
                  intent: str, history: list) -> str | None:
    if not _client:
        return None  # fall back to local

    history_text = ""
    if history:
        history_text = "\nCONVERSATION HISTORY:\n"
        for h in history[-5:]:
            role = "User" if h.get("role") == "user" else "Assistant"
            history_text += f"{role}: {h.get('content','')[:300]}\n"

    context = build_context(results, schema, intent, question)
    full_prompt = f"{SYSTEM_PROMPT}\n\n{context}{history_text}"

    try:
        response = _client.models.generate_content(
            model=_model_id,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                top_p=0.8,
                top_k=20,
                max_output_tokens=2048,
            )
        )
        text = response.text.strip()
        return text if text else None
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower():
            raise  # let caller handle quota
        return None
