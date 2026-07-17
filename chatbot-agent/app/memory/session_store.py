"""
Session store — keeps dataset + conversation memory in-process.
Each session identified by session_id string.
"""
import pandas as pd
from typing import Optional

_sessions: dict = {}

def create_session(session_id: str, df: pd.DataFrame, schema: dict, filename: str):
    _sessions[session_id] = {
        "df":       df,
        "schema":   schema,
        "filename": filename,
        "history":  [],
        "memory":   {},   # stores last_num_col, last_cat_col, last_results etc.
    }

def get_session(session_id: str) -> Optional[dict]:
    return _sessions.get(session_id)

def add_message(session_id: str, role: str, content: str):
    s = _sessions.get(session_id)
    if s:
        s["history"].append({"role": role, "content": content})
        if len(s["history"]) > 40:
            s["history"] = s["history"][-40:]

def update_memory(session_id: str, key: str, value):
    s = _sessions.get(session_id)
    if s:
        s["memory"][key] = value

def reset_session(session_id: str):
    if session_id in _sessions:
        _sessions[session_id]["history"] = []
        _sessions[session_id]["memory"]  = {}

def delete_session(session_id: str):
    _sessions.pop(session_id, None)

def list_sessions() -> list:
    return list(_sessions.keys())
