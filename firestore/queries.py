import logging
from typing import Optional
import statistics

from config import (
    SUBJECTS_COLLECTION,
    ALL_FIELDS,
    COMPARE_FIELDS,
    DISPLAYED_FIELDS,
)
from firestore.cache import TTLCache

_cache = TTLCache(ttl=600)

logger = logging.getLogger(__name__)


def _filter_doc(doc_data: dict) -> dict:
    return {k: doc_data.get(k) for k in ALL_FIELDS}


def _serialize(value):
    if hasattr(value, "isoformat"):          # datetime / date
        return value.isoformat()
    if hasattr(value, "_seconds"):           # Firestore Timestamp
        import datetime
        return datetime.datetime.utcfromtimestamp(value._seconds).isoformat()
    return value


def _serialize_doc(doc_data: dict) -> dict:
    return {k: _serialize(v) for k, v in doc_data.items()}


class ResultsQuery:

    def __init__(self, db):
        self.db = db

    def get_all_subjects(
        self,
        sort_by: str = "subject_id",
        order: str = "asc",
        limit: int = 100,
    ) -> list[dict]:
        cache_key = f"subjects:{sort_by}:{order}:{limit}"
        cached = _cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit: %s", cache_key)
            return cached

        from google.cloud.firestore_v1 import Query

        direction = Query.ASCENDING if order == "asc" else Query.DESCENDING

        col_ref = self.db.collection(SUBJECTS_COLLECTION)

        # Only request the fields we need (reduces egress)
        col_ref = col_ref.select(ALL_FIELDS)

        if sort_by in ALL_FIELDS:
            col_ref = col_ref.order_by(sort_by, direction=direction)

        col_ref = col_ref.limit(limit)

        docs = col_ref.stream()
        results = []
        for doc in docs:
            data = _filter_doc(doc.to_dict())
            data["_doc_id"] = doc.id          # always include the Firestore doc ID
            results.append(_serialize_doc(data))

        _cache.set(cache_key, results)   # inherits 10 min default
        logger.debug("Cache set: %s (%d docs)", cache_key, len(results))
        return results

    def get_subject(self, subject_id: str) -> Optional[dict]:
        cache_key = f"subject:{subject_id}"
        cached = _cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit: %s", cache_key)
            return cached

        doc_ref = self.db.document(SUBJECTS_COLLECTION, subject_id)
        doc     = doc_ref.get()

        if not doc.exists:
            col_ref = self.db.collection(SUBJECTS_COLLECTION)
            query   = col_ref.where("subject_id", "==", subject_id).limit(1)
            docs    = list(query.stream())
            if not docs:
                return None
            doc = docs[0]

        data = _filter_doc(doc.to_dict())
        data["_doc_id"] = doc.id
        result = _serialize_doc(data)
        _cache.set(cache_key, result, ttl=1800)
        logger.debug("Cache set: %s", cache_key)
        return result

    def get_subjects_batch(self, subject_ids: list[str]) -> list[dict]:
        results = []
        for sid in subject_ids:
            result = self.get_subject(sid)
            if result:
                results.append(result)
            else:
                logger.warning("Subject not found: %s", sid)
        return results

    def get_aggregate_stats(self) -> dict:
        cache_key = "aggregate_stats"
        cached = _cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit: %s", cache_key)
            return cached

        numeric_fields = [
            k for k in COMPARE_FIELDS
            if DISPLAYED_FIELDS[k]["fmt"] in ("number", "percent")
        ]

        col_ref = self.db.collection(SUBJECTS_COLLECTION).select(numeric_fields)
        docs    = col_ref.stream()

        buckets: dict[str, list] = {f: [] for f in numeric_fields}

        for doc in docs:
            data = doc.to_dict()
            for field in numeric_fields:
                val = data.get(field)
                if val is not None:
                    try:
                        buckets[field].append(float(val))
                    except (TypeError, ValueError):
                        pass

        stats = {}
        for field, values in buckets.items():
            if not values:
                continue
            stats[field] = {
                "label": DISPLAYED_FIELDS[field]["label"],
                "unit":  DISPLAYED_FIELDS[field]["unit"],
                "count": len(values),
                "mean":  round(statistics.mean(values), 2),
                "min":   round(min(values), 2),
                "max":   round(max(values), 2),
                "stdev": round(statistics.stdev(values), 2) if len(values) > 1 else 0,
            }

        _cache.set(cache_key, stats, ttl=1800)
        logger.debug("Cache set: %s", cache_key)
        return stats

    @staticmethod
    def clear_cache():
        _cache.clear()

    @staticmethod
    def cache_stats() -> dict:
        return _cache.stats()
