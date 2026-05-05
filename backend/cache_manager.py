"""
cache_manager.py
Handles pre-computed prediction cache from the local dataset CSV.

Flow:
  1. build_cache(csv_path)  → runs full pipeline once, saves predictions_cache.json
  2. load_cache()           → loads the JSON file into memory
  3. sample_users(n)        → returns N random users from in-memory cache
  4. cache_stats()          → summary numbers for the /cache/status endpoint
"""

import os
import json
import random
import threading

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(BASE_DIR, "predictions_cache.json")

# In-memory store (loaded once at startup or after build)
_cache: dict = {
    "users":       [],   # list of user-summary dicts (from group_by_user)
    "total_posts": 0,
    "built_at":    None,
    "source_file": None,
}

_build_progress: dict = {
    "running":    False,
    "processed":  0,
    "total":      0,
    "error":      None,
}

_lock = threading.Lock()


# ── Load ─────────────────────────────────────────────────────────────────────
def load_cache() -> bool:
    """Try to load predictions_cache.json into memory. Returns True if loaded."""
    global _cache
    if not os.path.exists(CACHE_FILE):
        return False
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        with _lock:
            _cache = data
        print(f"[cache] Loaded {len(data['users'])} users from cache.")
        return True
    except Exception as e:
        print(f"[cache] Failed to load cache: {e}")
        return False


# ── Build ─────────────────────────────────────────────────────────────────────
def build_cache(csv_path: str, batch_size: int = 50):
    """
    Runs the full prediction pipeline on csv_path in batches.
    Saves results to predictions_cache.json and loads into memory.
    This is meant to run in a background thread.
    """
    global _cache, _build_progress

    import pandas as pd
    from data_loader import load_from_csv
    from predictor import predict_posts, group_by_user

    with _lock:
        _build_progress = {"running": True, "processed": 0, "total": 0, "error": None}

    try:
        print(f"[cache] Starting build from: {csv_path}")
        with open(csv_path, "rb") as f:
            raw = f.read()

        posts = load_from_csv(raw, os.path.basename(csv_path))
        total = len(posts)
        print(f"[cache] {total} valid posts to process")

        with _lock:
            _build_progress["total"] = total

        # Process in batches to keep memory manageable
        all_scored = []
        for i in range(0, total, batch_size):
            batch = posts[i : i + batch_size]
            scored = predict_posts(batch)
            all_scored.extend(scored)
            with _lock:
                _build_progress["processed"] = len(all_scored)
            print(f"[cache] Progress: {len(all_scored)}/{total}")

        users    = group_by_user(all_scored)
        new_cache = {
            "users":       users,
            "total_posts": total,
            "built_at":    pd.Timestamp.now().isoformat(),
            "source_file": os.path.basename(csv_path),
        }

        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(new_cache, f, ensure_ascii=False, default=str)
        print(f"[cache] Saved cache → {CACHE_FILE}")

        with _lock:
            _cache = new_cache
            _build_progress["running"] = False

    except Exception as e:
        print(f"[cache] Build error: {e}")
        with _lock:
            _build_progress["running"] = False
            _build_progress["error"]   = str(e)


def start_build_async(csv_path: str):
    """Kick off build_cache in a background thread."""
    t = threading.Thread(target=build_cache, args=(csv_path,), daemon=True)
    t.start()


# ── Sample ────────────────────────────────────────────────────────────────────
def sample_users(n: int = 20, risk_filter: str = None) -> list[dict]:
    """
    Return N random users from the in-memory cache.
    Optional risk_filter: 'High' | 'Medium' | 'Low'
    """
    with _lock:
        pool = _cache.get("users", [])

    if not pool:
        return []

    if risk_filter and risk_filter in ("High", "Medium", "Low"):
        pool = [u for u in pool if u["risk_level"] == risk_filter]

    n = min(n, len(pool))
    sample = random.sample(pool, n)

    # Sort: High first, then Medium, then Low
    order = {"High": 0, "Medium": 1, "Low": 2}
    sample.sort(key=lambda u: order.get(u["risk_level"], 3))
    return sample


# ── Stats ─────────────────────────────────────────────────────────────────────
def cache_stats() -> dict:
    with _lock:
        users = _cache.get("users", [])
        progress = dict(_build_progress)

    high   = sum(1 for u in users if u["risk_level"] == "High")
    medium = sum(1 for u in users if u["risk_level"] == "Medium")
    low    = sum(1 for u in users if u["risk_level"] == "Low")

    return {
        "ready":        len(users) > 0,
        "total_users":  len(users),
        "total_posts":  _cache.get("total_posts", 0),
        "built_at":     _cache.get("built_at"),
        "source_file":  _cache.get("source_file"),
        "risk_breakdown": {"high": high, "medium": medium, "low": low},
        "build_progress": progress,
    }
