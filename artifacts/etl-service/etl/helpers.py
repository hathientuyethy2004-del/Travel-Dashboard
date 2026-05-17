"""
helpers.py — Pure utility functions shared across ETL modules.
No database or config dependencies.
"""
import time
import random
import uuid
import difflib
from datetime import datetime, timezone

NAME_MATCH_THRESHOLD = 0.45

VALIDATION_RULES = {
    "missing_location": lambda d: not d.get("location") or not d["location"].get("lat"),
    "missing_name_and_google": lambda d: (
        (not d.get("name") or d.get("name", "").lower() in ("unknown", ""))
        and not d.get("has_google_data")
    ),
    "duplicate_in_silver": lambda d: False,
}


def _with_retry(fn, max_retries: int = 3, base_delay: float = 2.0):
    """Call fn() with exponential backoff on failure. Raises last exception if all retries fail."""
    last_error = None
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt) + random.uniform(0, 1.0)
                time.sleep(delay)
    raise last_error


def _name_similarity(a: str, b: str) -> float:
    """Return similarity ratio between two names (0.0–1.0) using SequenceMatcher."""
    a = a.lower().strip()
    b = b.lower().strip()
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def _best_google_match(osm_name: str, candidates: list) -> tuple:
    """
    From a list of Google Place candidates, find the best name match.
    Returns (best_candidate, best_ratio). Returns (None, 0.0) if no candidates.
    """
    best_match = None
    best_ratio = 0.0
    for candidate in candidates[:5]:
        ratio = _name_similarity(osm_name, candidate.get("name", ""))
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = candidate
    return best_match, best_ratio


def _make_run_id(job_type: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    suffix = uuid.uuid4().hex[:6]
    return f"{job_type}_{ts}_{suffix}"
