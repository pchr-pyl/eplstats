"""Download club crests to public/logos/{slug}.png.

First choice: fbref tlogo CDN (transparent PNG).
Fallback: FotMob teamlogo (also transparent PNG), via --fotmob {slug}={id}
overrides in tmp/fotmob-ids.json if needed.
Reports size + source per club; requires >= 64px short side + alpha channel.
"""
import json
import struct
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "logos"
OUT.mkdir(parents=True, exist_ok=True)
VER = "202610022"  # cdn.ssref.net req version (from table.json)

FOTMOB_FILE = ROOT / "tmp" / "fotmob-ids.json"


def png_info(data: bytes):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w, h = struct.unpack(">II", data[16:24])
    bitdepth, colortype = data[24], data[25]
    has_alpha = colortype in (4, 6) or data.find(b"tRNS") > 0
    return w, h, has_alpha


def fetch(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read() if r.status == 200 else None
    except Exception as e:
        print(f"    fetch fail {url[-60:]}: {e}")
        return None


def main():
    clubs = json.loads((ROOT / "data" / "clubs.json").read_text(encoding="utf-8"))
    fotmob = json.loads(FOTMOB_FILE.read_text()) if FOTMOB_FILE.exists() else {}
    report = []
    for c in clubs:
        slug, fid = c["slug"], c["fbrefId"]
        dest = OUT / f"{slug}.png"
        data = fetch(f"https://cdn.ssref.net/req/{VER}/tlogo/fb/{fid}.png")
        info = png_info(data) if data else None
        source = "fbref"
        if not (info and info[2] and min(info[0], info[1]) >= 64):
            # fallback: FotMob
            tid = fotmob.get(slug)
            data = info = None
            if tid:
                data = fetch(
                    f"https://images.fotmob.com/image_resources/logo/teamlogo/{tid}.png"
                )
                info = png_info(data) if data else None
                source = "fotmob"
            if not (info and info[2] and min(info[0], info[1]) >= 64):
                report.append((slug, "MISSING", None))
                continue
        dest.write_bytes(data)
        report.append((slug, source, f"{info[0]}x{info[1]}"))
        print(f"  {slug}: {source} {info[0]}x{info[1]}")
    missing = [r for r in report if r[1] == "MISSING"]
    print(f"saved {len(report) - len(missing)}/{len(clubs)}; missing: {missing}")
    (ROOT / "tmp" / "logo-sources.json").write_text(
        json.dumps(report), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
