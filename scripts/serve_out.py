"""Static file server for out/ that understands Next.js prefetch filenames.

Next emits segment payloads as directories:
  out/man-utd/matches/__next.$d$club/matches/__PAGE__.txt
but requests them flat, dot-joined:
  /man-utd/matches/__next.$d$club.matches.__PAGE__.txt

This server maps any `__next.<seg1>.<seg2>...<name>.txt` request to
`__next.<seg1>/<seg2>/.../<name>.txt` when the flat path doesn't exist.
Usage: python scripts/serve_out.py [port]   (default 3002)
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3002


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = super().translate_path(unquote(urlsplit(path).path))
        if not os.path.exists(p) and "__next." in p:
            head, _, rest = p.partition("__next.")
            # rest like "$d$club.matches.__PAGE__.txt"; parts joined by '.'
            parts = rest.split(".")
            if len(parts) > 2 and parts[-1] in ("txt", "json", "ico", "png"):
                cand = os.path.join(
                    head + "__next." + parts[0],
                    *parts[1:-2],
                    parts[-2] + "." + parts[-1],
                )
                if os.path.exists(cand):
                    return cand
        return p

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(__file__), "..", "out"))
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
