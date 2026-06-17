# Latest deployment trigger comment
import os
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'
import time
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from data_loader import (
    load_from_file,
    load_from_huggingface,
    load_from_reddit,
    reddit_api_status,
)
from predictor import predict_posts, group_by_user
from cache_manager import (
    load_cache,
    start_build_async,
    sample_users,
    cache_stats,
    BASE_DIR as CACHE_BASE,
)

app = FastAPI(
    title="Mental Health Monitor API",
    description="Analyze Reddit posts for mental health distress signals.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    """Auto-load prediction cache from disk if it exists."""
    load_cache()


# ── shared pipeline ────────────────────────────────────────────────────────
def _run_pipeline(posts: list[dict], meta: dict, is_manual: bool = False) -> dict:
    start   = time.time()
    scored  = predict_posts(posts, is_manual=is_manual)
    users   = group_by_user(scored)
    elapsed = round(time.time() - start, 2)
    return {
        **meta,
        "total_posts_analyzed":  len(scored),
        "total_users":           len(users),
        "analysis_time_seconds": elapsed,
        "users":                 users,
    }


# ── health ─────────────────────────────────────────────────────────────────
@app.get("/")
def health():
    return {"status": "ok", "message": "Mental Health Monitor API 🟢"}


# ── reddit API status ───────────────────────────────────────────────────────
@app.get("/reddit/status")
def get_reddit_status():
    return reddit_api_status()


# ══════════════════════════════════════════════════════════════════════════════
# CACHE — pre-computed predictions from local dataset
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/cache/status")
def get_cache_status():
    """Returns whether the prediction cache is built and its statistics."""
    return cache_stats()

@app.post("/cache/reload")
def reload_cache_endpoint():
    """Hot-reloads the predictions_cache.json file into memory."""
    success = load_cache()
    if success:
        return {"message": "Cache reloaded successfully"}
    raise HTTPException(status_code=500, detail="Failed to reload cache")

class BuildRequest(BaseModel):
    filename: str = "dataset_5000.csv"  # 5k rows for RAM safety


@app.post("/cache/build")
def trigger_cache_build(req: BuildRequest):
    """
    Triggers a background build of the prediction cache from a local CSV.
    Returns immediately; poll /cache/status for progress.
    """
    import os
    stats = cache_stats()
    if stats["build_progress"]["running"]:
        raise HTTPException(status_code=409, detail="Cache build already in progress.")

    csv_path = os.path.join(CACHE_BASE, "datasets", req.filename)
    if not os.path.exists(csv_path):
        # list available
        avail = os.listdir(os.path.join(CACHE_BASE, "datasets"))
        raise HTTPException(
            status_code=404,
            detail=f"File not found: {req.filename}. Available: {avail}"
        )

    start_build_async(csv_path)
    return {"message": f"Cache build started for '{req.filename}'.", "file": csv_path}


@app.get("/dashboard/sample")
def get_dashboard_sample(
    n: int = 20,
    risk: str = None,
):
    """
    Returns N random users from the pre-computed cache.
    Optional ?risk=High|Medium|Low to filter.
    """
    stats = cache_stats()
    if not stats["ready"]:
        raise HTTPException(
            status_code=503,
            detail="Prediction cache not built yet. POST /cache/build first."
        )

    users = sample_users(n=n, risk_filter=risk)
    return {
        "source":        "cache",
        "sample_size":   len(users),
        "total_in_cache":stats["total_users"],
        "total_posts":   stats["total_posts"],
        "built_at":      stats["built_at"],
        "users":         users,
    }


@app.get("/dashboard/all")
def get_all_users():
    """Returns all users in the cache (for exporting reports)."""
    from cache_manager import _cache, _lock
    stats = cache_stats()
    if not stats["ready"]:
        raise HTTPException(status_code=503, detail="Cache not ready.")
    
    with _lock:
        users = _cache.get("users", [])
    
    # Sort: High -> Medium -> Low
    order = {"High": 0, "Medium": 1, "Low": 2}
    users_sorted = sorted(users, key=lambda u: order.get(u["risk_level"], 3))
    
    return {
        "source": "cache",
        "total_users": len(users_sorted),
        "users": users_sorted
    }


@app.get("/cache/user/{username}")
def get_cache_user(username: str):
    """Returns a single user's data from the pre-computed cache."""
    from cache_manager import _cache, _lock
    stats = cache_stats()
    if not stats["ready"]:
        raise HTTPException(status_code=503, detail="Prediction cache not built yet.")
    
    with _lock:
        users = _cache.get("users", [])
    
    for u in users:
        if u["username"] == username:
            return u
            
    raise HTTPException(status_code=404, detail="User not found in cache.")


# ── available local datasets ────────────────────────────────────────────────
@app.get("/datasets/list")
def list_datasets():
    import os
    ds_dir = os.path.join(CACHE_BASE, "datasets")
    files  = [f for f in os.listdir(ds_dir) if f.endswith(".csv")]
    return {"files": files}


# ══════════════════════════════════════════════════════════════════════════════
# MODE 1 — CSV Upload
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/analyze/csv")
async def analyze_csv(file: UploadFile = File(...)):
    """
    Accepts CSV or Excel (.xlsx, .xls) file uploads.
    Column names are flexible — loader auto-detects them.
    """
    if not file.filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .csv, .xlsx, or .xls files are accepted.")

    contents = await file.read()
    try:
        posts = load_from_file(contents, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _run_pipeline(posts, {"source": "file_upload", "filename": file.filename})


# ══════════════════════════════════════════════════════════════════════════════
# MODE 2 — HuggingFace Dataset
# ══════════════════════════════════════════════════════════════════════════════
class HFRequest(BaseModel):
    subreddit: str = None   # optional keyword filter e.g. "depression"
    limit: int = 200


# ══════════════════════════════════════════════════════════════════════════════
# MODE 4 — Manual Text Entry
# ══════════════════════════════════════════════════════════════════════════════
class ManualPost(BaseModel):
    username: str
    post_text: str
    timestamp: str = None   # ISO string or Unix int as string


class ManualRequest(BaseModel):
    posts: list[ManualPost]


@app.post("/analyze/dataset")
def analyze_dataset(req: HFRequest):
    """
    Streams solomonk/reddit_mental_health_posts from HuggingFace.
    Optionally filter by subreddit keyword.
    """
    try:
        posts = load_from_huggingface(
            subreddit_filter=req.subreddit,
            limit=req.limit,
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _run_pipeline(posts, {
        "source":    "huggingface",
        "dataset":   "solomonk/reddit_mental_health_posts",
        "subreddit": req.subreddit or "all",
    })


# ══════════════════════════════════════════════════════════════════════════════
# MODE 3 — Reddit Live API
# ══════════════════════════════════════════════════════════════════════════════
class RedditRequest(BaseModel):
    subreddit: str
    limit: int = 100


@app.post("/analyze/reddit")
def analyze_reddit(req: RedditRequest):
    """
    Fetches live posts via Reddit API (PRAW).
    Requires REDDIT_* credentials in .env to be active.
    """
    try:
        posts = load_from_reddit(req.subreddit, req.limit)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return _run_pipeline(posts, {
        "source":    "reddit_api",
        "subreddit": req.subreddit,
    })


# ══════════════════════════════════════════════════════════════════════════════
# MODE 4 — Manual Text
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/analyze/manual")
def analyze_manual(req: ManualRequest):
    """
    Accepts a list of posts directly as JSON.
    Each post: { username, post_text, timestamp (optional) }
    """
    import time
    posts = [
        {
            "username":  p.username.strip() or "anonymous",
            "post_text": p.post_text.strip()[:1000],
            "timestamp": p.timestamp or str(int(time.time())),
        }
        for p in req.posts
        if p.post_text.strip()
    ]
    if not posts:
        raise HTTPException(status_code=400, detail="No valid posts provided.")

    return _run_pipeline(posts, {"source": "manual", "post_count": len(posts)}, is_manual=True)


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)