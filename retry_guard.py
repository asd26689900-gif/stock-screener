"""health 失敗後的自動重試守門員 — 6 小時內只允許重試一次，避免無限觸發排程"""
import os, sys, requests, plog
from datetime import datetime, timedelta, timezone

URL = os.environ.get("SUPABASE_URL", "")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def _emit(retry):
    print(f"RETRY={retry}")
    out = os.environ.get("GITHUB_OUTPUT", "")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"retry={retry}\n")
    sys.exit(0)

if not URL or not KEY:
    _emit(0)

H = {"apikey": KEY, "Authorization": "Bearer " + KEY}
cut = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
try:
    r = requests.get(f"{URL}/rest/v1/execution_log",
                     params={"select": "id,started_at", "job": "eq.retry",
                             "started_at": f"gte.{cut}",
                             "order": "started_at.desc", "limit": "1"},
                     headers=H, timeout=20)
    if r.json():
        print("6 小時內已重試過，跳過")
        _emit(0)
except Exception as e:
    print(f"守門員查詢失敗: {e}")
    _emit(0)

job = plog.start("retry")
plog.finish(job, detail={"triggered_by": "health", "at": datetime.now(timezone.utc).isoformat()})
plog.done(job)
_emit(1)
