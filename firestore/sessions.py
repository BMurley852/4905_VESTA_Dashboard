"""
firestore/sessions.py — Query and parse the newData collection.

Each document in newData is a flat dict with encoded field names:
  {session_num}_{room_code}{round_num}_{item_type}_{property}

e.g. 1_Bd1_E0_name  → session 1, Bedroom round 1, Event 0, field "name"
     2_LR_Start_bal → session 2, Living Room, start balance
     4_K_T2_amt     → session 4, Kitchen, session-level transaction 2, amount
"""

import re
import datetime
import logging
from typing import Optional

from firestore.cache import TTLCache

# Session data changes rarely — cache aggressively.
# Call POST /api/cache/clear to force a refresh after new data is uploaded.
_cache = TTLCache(ttl=1800)   # 30 min default

logger = logging.getLogger(__name__)

COLLECTION = "newData"

ROOM_NAMES = {
    "Bd": "Bedroom",
    "LR": "Living Room",
    "Ba": "Bathroom",
    "K":  "Kitchen",
}

ROOM_ORDER = {"Bd": 1, "LR": 2, "Ba": 3, "K": 4}

# Matches: session_num, room_code, round_num (may be empty), item_token, property
_KEY_RE = re.compile(
    r'^(\d+)_([A-Za-z]+)(\d*)_(Start|End|BUY|[ET]\d+)_(\w+)$'
)


def _serialize(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "_seconds"):
        return datetime.datetime.utcfromtimestamp(value._seconds).isoformat()
    return value


def _parse_doc(doc_id: str, raw: dict) -> dict:
    """Convert the flat Firestore dict into a structured session object."""
    sessions: dict[str, dict] = {}

    for key, raw_val in raw.items():
        val = _serialize(raw_val)
        m = _KEY_RE.match(key)
        if not m:
            continue

        sess_num, room, round_num, item, prop = m.groups()

        if room not in sessions:
            sessions[room] = {
                "num":       int(sess_num),
                "room_code": room,
                "room_name": ROOM_NAMES.get(room, room),
                "start_bal": None, "end_bal": None,
                "start_time": None, "end_time": None,
                "rounds": {},          # round_id → {buy, events, transactions}
                "extra_events": {},    # session-level events (no round number)
                "extra_txns": {},      # session-level transactions
            }

        s = sessions[room]

        if item == "Start":
            if prop == "bal":  s["start_bal"]  = val
            if prop == "time": s["start_time"] = val

        elif item == "End":
            if prop == "bal":  s["end_bal"]  = val
            if prop == "time": s["end_time"] = val

        elif item == "BUY":
            rid = f"{room}{round_num}" if round_num else room
            s["rounds"].setdefault(rid, {"id": rid, "buy": {}, "events": {}, "txns": {}})
            s["rounds"][rid]["buy"][prop] = val

        elif item.startswith("E"):
            if round_num:
                rid = f"{room}{round_num}"
                s["rounds"].setdefault(rid, {"id": rid, "buy": {}, "events": {}, "txns": {}})
                s["rounds"][rid]["events"].setdefault(item, {})
                s["rounds"][rid]["events"][item][prop] = val
            else:
                s["extra_events"].setdefault(item, {})
                s["extra_events"][item][prop] = val

        elif item.startswith("T"):
            if round_num:
                rid = f"{room}{round_num}"
                s["rounds"].setdefault(rid, {"id": rid, "buy": {}, "events": {}, "txns": {}})
                s["rounds"][rid]["txns"].setdefault(item, {})
                s["rounds"][rid]["txns"][item][prop] = val
            else:
                s["extra_txns"].setdefault(item, {})
                s["extra_txns"][item][prop] = val

    # Assemble ordered result
    result_sessions = []
    for room_code, s in sorted(sessions.items(), key=lambda x: ROOM_ORDER.get(x[0], 99)):
        rounds = []
        for rid in sorted(s["rounds"]):
            r = s["rounds"][rid]
            events = [v for _, v in sorted(r["events"].items())]
            txns   = [v for _, v in sorted(r["txns"].items())]
            rounds.append({"id": rid, "buy": r["buy"] or None, "events": events, "transactions": txns})

        # Session-level items (no round) appended as a trailing entry
        extra_events = [v for _, v in sorted(s["extra_events"].items())]
        extra_txns   = [v for _, v in sorted(s["extra_txns"].items())]
        if extra_events or extra_txns:
            rounds.append({"id": None, "buy": None, "events": extra_events, "transactions": extra_txns})

        # Compute per-room score summary
        all_events = [e for r in rounds for e in r["events"]]
        all_txns   = [t for r in rounds for t in r["transactions"]]
        evt_score  = sum(int(e.get("pnt", 0)) for e in all_events)
        txn_score  = sum(int(t.get("pnt", 0)) for t in all_txns)

        incomplete = s["end_bal"] is None or s["end_time"] is None

        result_sessions.append({
            "num":        s["num"],
            "room_code":  room_code,
            "room_name":  s["room_name"],
            "start_bal":  s["start_bal"],
            "end_bal":    s["end_bal"],
            "start_time": s["start_time"],
            "end_time":   s["end_time"],
            "incomplete": incomplete,
            "score": {
                "events_correct": evt_score, "events_total": len(all_events),
                "txns_correct":   txn_score, "txns_total":   len(all_txns),
            },
            "rounds": rounds,
        })

    return {
        "_doc_id": doc_id,
        "user_id": raw.get("0_User_Id"),
        "email":   raw.get("0_Email"),
        "sessions": result_sessions,
    }


class SessionsQuery:
    def __init__(self, db):
        self.db = db

    def search(self, q: str) -> list[dict]:
        """
        Search newData by email prefix or exact user_id.
        Returns lightweight summary records (no full round data).
        Results cached for 10 min keyed on the query string.
        """
        cache_key = f"session_search:{q}"
        cached = _cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit: %s", cache_key)
            return cached

        col = self.db.collection(COLLECTION)
        results = {}

        # Prefix match on email (backticks required for fields starting with a digit)
        email_docs = col.where("`0_Email`", ">=", q).where("`0_Email`", "<=", q + "\uf8ff").limit(20).stream()
        for doc in email_docs:
            d = doc.to_dict()
            results[doc.id] = {"_doc_id": doc.id, "email": d.get("0_Email"), "user_id": d.get("0_User_Id")}

        # Exact match on user_id
        uid_docs = col.where("`0_User_Id`", "==", q).limit(10).stream()
        for doc in uid_docs:
            d = doc.to_dict()
            results[doc.id] = {"_doc_id": doc.id, "email": d.get("0_Email"), "user_id": d.get("0_User_Id")}

        result_list = list(results.values())
        _cache.set(cache_key, result_list, ttl=600)   # 10 min — searches may reflect new data sooner
        logger.debug("Cache set: %s (%d results)", cache_key, len(result_list))
        return result_list

    def get_session(self, doc_id: str) -> Optional[dict]:
        """Fetch and parse a single newData document. Cached for 30 min."""
        cache_key = f"session:{doc_id}"
        cached = _cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit: %s", cache_key)
            return cached

        doc = self.db.document(COLLECTION, doc_id).get()
        if not doc.exists:
            return None

        result = _parse_doc(doc.id, doc.to_dict())
        _cache.set(cache_key, result)   # inherits 30 min default
        logger.debug("Cache set: %s", cache_key)
        return result

    @staticmethod
    def clear_cache():
        """Flush all cached session query results."""
        _cache.clear()

    @staticmethod
    def cache_stats() -> dict:
        return _cache.stats()
