"""排程執行日誌（Phase 0 可靠度）— 用 REST 寫 Supabase，避免每個腳本 import supabase-py"""
import os
from datetime import datetime, timezone

_FINISHED = set()

def _client():
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        return None
    return url, key

def start(job):
    c = _client()
    if not c:
        return None
    url, key = c
    try:
        import requests
        r = requests.post(url + "/rest/v1/execution_log", headers={
            "apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json",
            "Prefer": "return=representation",
        }, json={"job": job, "status": "running"}, timeout=20)
        if r.status_code == 201:
            return r.json()[0]["id"]
    except Exception:
        pass
    return None

def finish(job_id, detail=None, error=None, status="success"):
    c = _client()
    if not c or not job_id:
        return
    url, key = c
    try:
        import requests
        payload = {"status": status,
                   "finished_at": datetime.now(timezone.utc).isoformat(),
                   "detail": detail or {}, "error": error}
        requests.patch(url + "/rest/v1/execution_log?id=eq." + str(job_id), headers={
            "apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }, json=payload, timeout=20)
    except Exception:
        pass

def mark_failed_if_unfinished(job_id):
    """atexit 用：正常結束（finish 已呼叫）就不動；異常/提早退出則標 failed"""
    if job_id and job_id not in _FINISHED:
        finish(job_id, error="script ended without normal completion", status="failed")

def done(job_id):
    _FINISHED.add(job_id)
