"""
data_loader.py
Unified data loading for all 3 input modes:
  Mode 1 — CSV Upload
  Mode 2 — HuggingFace Dataset (solomonk/reddit_mental_health_posts)
  Mode 3 — Reddit API (activates when .env credentials are present)
"""

import os
import io
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# ── shared column normalizer ───────────────────────────────────────────────
def _normalize(df: pd.DataFrame) -> list[dict]:
    """
    Whatever columns come in, map them to:
      { username, post_text, timestamp }
    and return as list of dicts.
    """
    col = {c.lower().strip(): c for c in df.columns}

    # username
    for candidate in ["username", "author", "user", "name"]:
        if candidate in col:
            df = df.rename(columns={col[candidate]: "username"})
            break
    else:
        df["username"] = "unknown_user"

    # post_text
    for candidate in ["post_text", "body", "selftext", "text", "content"]:
        if candidate in col:
            df = df.rename(columns={col[candidate]: "post_text"})
            break
    else:
        # try combining title + body
        has_title = "title" in col
        has_body  = any(c in col for c in ["body", "selftext"])
        if has_title and has_body:
            body_col = col.get("body") or col.get("selftext")
            df["post_text"] = (
                df[col["title"]].fillna("") + ". " + df[body_col].fillna("")
            )
        elif has_title:
            df["post_text"] = df[col["title"]].fillna("")
        else:
            raise ValueError(
                "Could not find a text column. "
                "Expected one of: post_text, body, selftext, text, content, title"
            )

    # timestamp
    for candidate in ["timestamp", "created_utc", "created", "time", "date"]:
        if candidate in col:
            df = df.rename(columns={col[candidate]: "timestamp"})
            break
    else:
        # fallback: generate fake sequential timestamps
        import time
        df["timestamp"] = int(time.time())

    # keep only what we need, drop nulls
    df = df[["username", "post_text", "timestamp"]].dropna(subset=["post_text"])
    df = df[df["post_text"].str.strip() != ""]
    df["post_text"] = df["post_text"].astype(str).str[:1000]  # cap for BERT
    df["username"]  = df["username"].astype(str).str.strip()
    df = df[~df["username"].isin(["[deleted]", "AutoModerator", "nan", ""])]

    return df.to_dict(orient="records")


# ══════════════════════════════════════════════════════════════════════════════
# MODE 1 — File Upload (CSV / Excel)
# ══════════════════════════════════════════════════════════════════════════════
def load_from_file(file_bytes: bytes, filename: str = "upload.csv") -> list[dict]:
    """
    Accepts raw file bytes (from FastAPI UploadFile).
    Supports .csv, .xlsx, and .xls formats.
    """
    fname = filename.lower()
    try:
        if fname.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif fname.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            raise ValueError(f"Unsupported file extension: {filename}. Use .csv, .xlsx, or .xls")
    except Exception as e:
        raise ValueError(f"Could not parse file: {e}")

    if df.empty:
        raise ValueError("The uploaded file is empty.")

    posts = _normalize(df)
    if not posts:
        raise ValueError("No valid rows found in file after cleaning.")

    print(f"[data_loader] File {filename}: loaded {len(posts)} posts")
    return posts


# ══════════════════════════════════════════════════════════════════════════════
# MODE 2 — HuggingFace Dataset
# ══════════════════════════════════════════════════════════════════════════════
def load_from_huggingface(
    subreddit_filter: str = None,
    limit: int = 100,
) -> list[dict]:
    """
    Directly streams CSV files from solomonk/reddit_mental_health_posts.
    Files available: adhd.csv, aspergers.csv, depression.csv, ocd.csv, ptsd.csv
    """
    base_url = "https://huggingface.co/datasets/solomonk/reddit_mental_health_posts/resolve/main"
    
    # Map filter to specific files
    mapping = {
        "adhd": "adhd.csv",
        "aspergers": "aspergers.csv",
        "depression": "depression.csv",
        "ocd": "ocd.csv",
        "ptsd": "ptsd.csv"
    }

    files_to_load = []
    if subreddit_filter:
        s_low = subreddit_filter.lower()
        for key, val in mapping.items():
            if key in s_low:
                files_to_load.append(val)
        
        # If no specific match, try loading all and filtering manually
        if not files_to_load:
            files_to_load = list(mapping.values())
    else:
        # Default: just load depression and ptsd for a balanced look
        files_to_load = ["depression.csv", "ptsd.csv"]

    all_rows = []
    for filename in files_to_load:
        url = f"{base_url}/{filename}"
        print(f"[data_loader] Streaming HF file: {filename} …")
        try:
            # Stream the CSV with pandas
            # chunksize helps keep memory low
            chunks = pd.read_csv(url, chunksize=100)
            for chunk in chunks:
                # Normalize inside the loop to save memory
                chunk_rows = _normalize(chunk)
                all_rows.extend(chunk_rows)
                if len(all_rows) >= limit:
                    break
            if len(all_rows) >= limit:
                break
        except Exception as e:
            print(f"[data_loader] Failed to load {filename}: {e}")
            continue

    if not all_rows:
        raise ValueError(f"No data could be streamed from HuggingFace.")

    # Trim to limit
    posts = all_rows[:limit]
    print(f"[data_loader] HuggingFace: loaded {len(posts)} posts total")
    return posts


# ══════════════════════════════════════════════════════════════════════════════
# MODE 3 — Reddit API
# ══════════════════════════════════════════════════════════════════════════════
def _reddit_credentials_present() -> bool:
    return all([
        os.getenv("REDDIT_CLIENT_ID"),
        os.getenv("REDDIT_CLIENT_SECRET"),
        os.getenv("REDDIT_USERNAME"),
        os.getenv("REDDIT_PASSWORD"),
    ])


def reddit_api_status() -> dict:
    """Returns whether Reddit API is configured and ready."""
    ready = _reddit_credentials_present()
    return {
        "available": ready,
        "message":   "Reddit API connected ✅" if ready
                     else "Reddit API credentials not configured. Add them to .env to activate.",
    }


def load_from_reddit(subreddit: str, limit: int = 100) -> list[dict]:
    """
    Fetches live posts from Reddit API using PRAW.
    Requires REDDIT_* env vars to be set.
    """
    if not _reddit_credentials_present():
        raise RuntimeError(
            "Reddit API credentials not found in environment. "
            "Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, "
            "REDDIT_USERNAME, REDDIT_PASSWORD in your .env file."
        )

    try:
        import praw
    except ImportError:
        raise RuntimeError("praw not installed. Run: pip install praw")

    reddit = praw.Reddit(
        client_id     = os.getenv("REDDIT_CLIENT_ID"),
        client_secret = os.getenv("REDDIT_CLIENT_SECRET"),
        username      = os.getenv("REDDIT_USERNAME"),
        password      = os.getenv("REDDIT_PASSWORD"),
        user_agent    = os.getenv("REDDIT_USER_AGENT", "mental-health-monitor/1.0"),
    )

    rows = []
    try:
        for submission in reddit.subreddit(subreddit).new(limit=limit):
            if not submission.author:
                continue
            username = str(submission.author)
            if username in ("[deleted]", "AutoModerator"):
                continue
            text = f"{submission.title}. {submission.selftext}".strip()
            if not text or text == ".":
                continue
            rows.append({
                "username":  username,
                "post_text": text[:1000],
                "timestamp": int(submission.created_utc),
            })
    except Exception as e:
        raise RuntimeError(f"Reddit API error for r/{subreddit}: {e}")

    if not rows:
        raise ValueError(f"No valid posts found in r/{subreddit}")

    print(f"[data_loader] Reddit API: loaded {len(rows)} posts from r/{subreddit}")
    return rows