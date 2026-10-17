"""Playwright browser session for Cloudflare-protected scraping.

Strategy (per AGENTS.md): navigate once to a page on the target origin, wait out
any "Just a moment..." challenge, then do same-origin
fetch(url, {credentials:'include'}) via page.evaluate for every target URL.
"""

import random
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

CHALLENGE_MARKERS = ("just a moment", "challenge-platform", "cf-chl", "attention required")


class RateLimited(Exception):
    def __init__(self, status):
        self.status = status
        super().__init__(f"HTTP {status}")


class ChallengeHit(Exception):
    pass


class BrowserSession:
    def __init__(self, headless=True, delay=3.0, jitter=1.5, log=print):
        self.headless = headless
        self.delay = delay
        self.jitter = jitter
        self.log = log
        self._pw = sync_playwright().start()
        # Bundled Chromium (headless AND headed) fails Cloudflare's managed
        # challenge; real Chrome with a persistent profile passes in ~9s and
        # keeps cf_clearance across runs. Requires Chrome installed.
        profile = Path(__file__).resolve().parent / "state" / "chrome-profile"
        profile.mkdir(parents=True, exist_ok=True)
        self._browser = None  # persistent context owns the process
        self._context = self._pw.chromium.launch_persistent_context(
            str(profile),
            headless=headless,
            channel="chrome",
            args=["--disable-blink-features=AutomationControlled"],
            viewport={"width": 1366, "height": 900},
            locale="en-US",
        )
        self._page = (
            self._context.pages[0] if self._context.pages
            else self._context.new_page()
        )
        self._page.set_default_timeout(60000)
        self._origin = None  # origin currently cleared for
        self._last_fetch = 0.0

    # -- lifecycle ---------------------------------------------------------
    def close(self):
        try:
            self._context.close()
        finally:
            self._pw.stop()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    # -- origin / challenge handling --------------------------------------
    @staticmethod
    def _origin_of(url):
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}"

    def _looks_challenged(self):
        try:
            title = (self._page.title() or "").lower()
        except Exception:
            title = ""
        if any(m in title for m in CHALLENGE_MARKERS):
            return True
        try:
            body = self._page.evaluate("document.body ? document.body.innerText.slice(0,2000) : ''") or ""
        except Exception:
            return True
        return any(m in body.lower() for m in CHALLENGE_MARKERS)

    def _wait_challenge(self, timeout_ms=45000):
        deadline = time.time() + timeout_ms / 1000
        time.sleep(2)
        while time.time() < deadline:
            if not self._looks_challenged():
                return True
            time.sleep(1.5)
        return False

    def ensure_origin(self, url, attempts=3):
        """Navigate to url's origin so Cloudflare sets its cookie."""
        origin = self._origin_of(url)
        for i in range(attempts):
            try:
                self._page.goto(url, wait_until="domcontentloaded", timeout=60000)
            except Exception as e:
                self.log(f"  nav error {e}; retry {i+1}")
                time.sleep(5 * (i + 1))
                continue
            if self._wait_challenge():
                self._origin = origin
                return True
            self.log(f"  challenge not cleared on {url} (attempt {i+1})")
        return False

    # -- fetching ----------------------------------------------------------
    def _pace(self):
        wait = self.delay + random.random() * self.jitter - (time.time() - self._last_fetch)
        if wait > 0:
            time.sleep(wait)
        self._last_fetch = time.time()

    def fetch(self, url, binary=False):
        """Same-origin fetch through the page. Returns (status, body_text)."""
        self._pace()
        if self._origin != self._origin_of(url):
            if not self.ensure_origin(url):
                raise ChallengeHit()
        result = self._page.evaluate(
            """async (u) => {
                try {
                    const r = await fetch(u, {credentials: 'include'});
                    const t = await r.text();
                    return {status: r.status, body: t};
                } catch (e) {
                    return {status: -1, body: String(e)};
                }
            }""",
            url,
        )
        status, body = result["status"], result["body"]
        head = body[:500].lower()
        if status in (403, 429):
            raise RateLimited(status)
        if status == -1 or "just a moment" in head or "attention required" in head:
            raise ChallengeHit()
        return status, body

    def navigate(self, url, wait_expr=None, tries=3):
        """Full page navigation (for JS-rendered pages like understat).
        wait_expr: JS expression that must become truthy (poll, max 30s)."""
        backoff = 5.0
        for i in range(tries):
            self._page.goto(url, wait_until="domcontentloaded", timeout=60000)
            if self._looks_challenged():
                self._wait_challenge()
            if not wait_expr:
                self._origin = self._origin_of(url)
                return True
            deadline = time.time() + 30
            while time.time() < deadline:
                try:
                    if self._page.evaluate(f"() => !!({wait_expr})"):
                        self._origin = self._origin_of(url)
                        return True
                except Exception:
                    pass
                time.sleep(1)
            self.log(f"  wait_expr timeout on {url} (attempt {i+1})")
            time.sleep(backoff)
            backoff *= 2
        raise ChallengeHit()

    def fetch_retries(self, url, tries=5):
        """fetch with exponential backoff; refreshes the CF cookie on challenge."""
        backoff = 5.0
        for i in range(tries):
            try:
                return self.fetch(url)
            except RateLimited as e:
                self.log(f"  {e.status} on {url}; backoff {backoff:.0f}s")
                time.sleep(backoff + random.random() * 3)
                backoff *= 2
                self._origin = None  # force re-navigation next time
            except ChallengeHit:
                self.log(f"  challenge hit on {url}; re-navigating (backoff {backoff:.0f}s)")
                time.sleep(backoff)
                backoff *= 2
                self._origin = None
                if not self.ensure_origin(url):
                    continue
        raise RateLimited("exhausted")
