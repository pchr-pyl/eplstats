"""Watchdog for run.py: restart the scraper when output goes silent.

run.py can wedge silently (a Playwright evaluate hangs during Cloudflare
challenge reloads — no OK/FAILED lines ever reach the log). This wrapper
spawns run.py, watches scripts/scrape/last-run.log for new lines, and kills
+ respawns the whole process tree if nothing appears for STALL seconds.

Usage:  python -X utf8 scripts/scrape/watchdog.py
Stop:   Ctrl+C, or delete tmp/scraper-stop
"""
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOG = ROOT / "scripts" / "scrape" / "last-run.log"
STOP = ROOT / "tmp" / "scraper-stop"
STATE = ROOT / "scripts" / "scrape" / "state" / "chrome-profile"
STALL = 600  # seconds without any new log line -> restart
CMD = [sys.executable, "-X", "utf8", "scripts/scrape/run.py", "--club", "all",
       "--types", "schedule,shooting,keeper,misc,players,keeper-squad"]


def kill_tree(proc):
    try:
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                       capture_output=True)
    except Exception:
        pass
    # kill leftover chrome bound to the scraper profile
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | "
             "Where-Object { $_.CommandLine -match 'chrome-profile' } | "
             "ForEach-Object { $_.ProcessId }"],
            capture_output=True, text=True, timeout=30)
        for pid in out.stdout.split():
            if pid.strip().isdigit():
                subprocess.run(["taskkill", "/PID", pid.strip(), "/F"],
                               capture_output=True)
    except Exception:
        pass
    for f in ("SingletonLock", "SingletonSocket", "SingletonCookie"):
        try:
            (STATE / f).unlink(missing_ok=True)
        except Exception:
            pass


def main():
    STOP.unlink(missing_ok=True)
    n = 0
    while not STOP.exists():
        n += 1
        print(f"[watchdog] spawn run #{n}", flush=True)
        logf = LOG.open("ab")
        proc = subprocess.Popen(CMD, cwd=ROOT, stdout=logf,
                                stderr=subprocess.STDOUT)
        last_size = LOG.stat().st_size if LOG.exists() else 0
        idle = 0
        while proc.poll() is None and not STOP.exists():
            time.sleep(15)
            size = LOG.stat().st_size if LOG.exists() else last_size
            if size > last_size:
                last_size, idle = size, 0
            else:
                idle += 15
            if idle >= STALL:
                print(f"[watchdog] silent {idle}s -> restart", flush=True)
                kill_tree(proc)
                time.sleep(10)
                break
        if proc.poll() is not None:
            print(f"[watchdog] run #{n} exited rc={proc.returncode}", flush=True)
            break
    print("[watchdog] stopped", flush=True)


if __name__ == "__main__":
    main()
