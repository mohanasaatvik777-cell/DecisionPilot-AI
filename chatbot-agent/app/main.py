"""
FastAPI AI Data Analyst Agent — port 7000
Full pipeline: Intent → Plan → Compute (Pandas+DuckDB) → Verify → Explain (Gemini)
"""
import os, uuid
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from app.dataset.loader import load_dataframe, analyze_schema
from app.agents.intent import detect_intent, detect_chart_type
from app.agents.planner import create_plan
from app.agents.executor import execute_plan, verify_results
from app.agents.gemini_explainer import explain
from app.agents.local_responder import build_response
from app.memory.session_store import (
    create_session, get_session, add_message,
    update_memory, reset_session,
)

app = FastAPI(title="AI Data Analyst Agent v2", version="3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ── Quota flag ────────────────────────────────────────────────────────────────
_gemini_quota_hit = False
_gemini_reset_at  = 0

def _can_use_gemini():
    import time
    global _gemini_quota_hit, _gemini_reset_at
    if not _gemini_quota_hit: return True
    if time.time() > _gemini_reset_at:
        _gemini_quota_hit = False; return True
    return False

def _mark_quota(retry_sec=65):
    import time
    global _gemini_quota_hit, _gemini_reset_at
    _gemini_quota_hit = True
    _gemini_reset_at  = time.time() + retry_sec


# ── Upload ────────────────────────────────────────────────────────────────────
@app.post("/agent/upload")
async def upload(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        df     = load_dataframe(contents, file.filename)
        schema = analyze_schema(df)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse: {e}")

    sid = str(uuid.uuid4())
    create_session(sid, df, schema, file.filename)

    from app.analysis.engine import dataset_summary
    summary = dataset_summary(df, schema)
    return {
        "session_id": sid, "filename": file.filename,
        "rows": summary["rows"], "columns": summary["columns"],
        "schema": schema, "summary": summary,
        "message": f"✅ '{file.filename}' loaded — {summary['rows']:,} rows, {summary['columns']} columns."
    }


# ── Ask ───────────────────────────────────────────────────────────────────────
class AskRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    conversation_history: Optional[list] = []

@app.post("/agent/ask")
async def ask(req: AskRequest):
    message = req.message.strip()
    if not message:
        raise HTTPException(400, "message required")

    if not req.session_id or not get_session(req.session_id):
        return {
            "reply": (
                "## 👋 Hi! I'm your AI Data Analyst\n\n"
                "Please upload a dataset (CSV, Excel, or JSON) to get started.\n\n"
                "I can answer questions about:\n"
                "- Totals, averages, rankings\n- Trends over time\n"
                "- Comparisons & correlations\n- Outliers & anomalies\n"
                "- Business recommendations"
            ),
            "source": "local", "intent": "greeting",
        }

    session = get_session(req.session_id)
    df, schema, memory = session["df"], session["schema"], session["memory"]
    history = req.conversation_history or session["history"]

    add_message(req.session_id, "user", message)

    # ── Step 1: Intent ────────────────────────────────────────────────────
    intent = detect_intent(message)

    # Handle greetings/thanks locally — no analysis needed
    if intent in ("greeting", "thanks", "help"):
        num_cols = schema.get("num_cols",[])
        cat_cols = schema.get("cat_cols",[])
        date_cols= schema.get("date_cols",[])
        fn = session.get("filename", "your dataset")
        if intent == "greeting":
            reply = (
                f"## 👋 Hi! I'm your AI Data Analyst\n\n"
                f"Dataset **\"{fn}\"** — **{schema.get('row_count',0):,} records** loaded.\n\n"
                + (f"📊 **Metrics:** {', '.join(num_cols[:5])}\n" if num_cols else "")
                + (f"🏷️ **Categories:** {', '.join(cat_cols[:4])}\n" if cat_cols else "")
                + (f"📅 **Dates:** {date_cols[0]}\n" if date_cols else "")
                + "\n**Ask me anything about your data!**"
            )
        else:
            reply = f"You're welcome! 😊 Ask me anything about **\"{fn}\"**."
        add_message(req.session_id, "assistant", reply)
        return {"reply": reply, "source": "local", "intent": intent}

    # ── Step 2: Plan ──────────────────────────────────────────────────────
    plan = create_plan(message, intent, schema, memory)

    # Clarification needed
    if plan.get("needs_clarification"):
        reply = f"## ℹ️ Clarification Needed\n\n{plan['clarification']}\n\n**Available columns:** {', '.join(schema.get('columns',[]))}"
        add_message(req.session_id, "assistant", reply)
        return {"reply": reply, "source": "local", "intent": intent}

    # ── Step 3: Execute ───────────────────────────────────────────────────
    raw_results = execute_plan(df, schema, plan["steps"])
    verified    = verify_results(raw_results)

    # ── Step 4: Update memory ─────────────────────────────────────────────
    if plan.get("target_num"): update_memory(req.session_id, "last_num_col",  plan["target_num"])
    if plan.get("target_cat"): update_memory(req.session_id, "last_cat_col",  plan["target_cat"])
    if plan.get("chart_hint"): update_memory(req.session_id, "last_chart",     plan["chart_hint"])
    update_memory(req.session_id, "last_intent",  intent)
    update_memory(req.session_id, "last_results", verified)

    # ── Step 5: Explain ───────────────────────────────────────────────────
    reply, source = None, "local"

    if _can_use_gemini():
        try:
            reply = await explain(message, verified, schema, intent, history)
            if reply: source = "gemini"
        except Exception as e:
            msg = str(e)
            if "429" in msg or "quota" in msg.lower():
                _mark_quota(70)
                print(f"[AGENT] Gemini quota hit — local engine for 70s")
            else:
                print(f"[AGENT] Gemini error: {msg[:100]}")

    if not reply:
        reply = build_response(intent, verified, schema, message)

    add_message(req.session_id, "assistant", reply)
    return {
        "reply": reply, "source": source, "intent": intent,
        "chart_hint": plan.get("chart_hint"),
        "steps": [s["fn"] for s in plan["steps"]],
    }


# ── Reset ─────────────────────────────────────────────────────────────────────
@app.post("/agent/reset/{session_id}")
async def reset(session_id: str):
    reset_session(session_id)
    return {"message": "Conversation reset"}


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/agent/health")
async def health():
    return {"status": "ok", "service": "AI Data Analyst Agent v3", "gemini_quota_hit": _gemini_quota_hit}
