// Flatten Next.js RSC prefetch payload dirs in out/ for static hosting.
//
// Next emits segment payloads as directories:
//   out/man-utd/matches/__next.$d$club/matches/__PAGE__.txt
// but the client requests them flat, dot-joined:
//   /man-utd/matches/__next.$d$club.matches.__PAGE__.txt
// (serve_out.py translates the same request back to the directory form).
//
// For every "__next.*" directory not nested inside another "__next.*"
// directory, each file under it at relative path a/b/name.ext is copied to
//   <parent>/__next.<X>.a.b.name.ext
// The original directories are kept. Existing flat files are skipped.
// Runs automatically via the package.json "postbuild" script.
// Usage: node scripts/flatten_prefetch.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out");

let written = 0;

async function copyFlat(dir, base) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await copyFlat(p, base);
    } else if (e.isFile()) {
      const rel = path.relative(base.dir, p).split(path.sep).join(".");
      const flat = path.join(base.parent, `${base.name}.${rel}`);
      try {
        await fs.copyFile(p, flat, fs.constants.COPYFILE_EXCL);
        written += 1;
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
      }
    }
  }
}

async function walk(root, insideNext = false) {
  for (const e of await fs.readdir(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(root, e.name);
    if (!insideNext && e.name.startsWith("__next.")) {
      await copyFlat(p, { parent: root, name: e.name, dir: p });
    } else {
      await walk(p, insideNext || e.name.startsWith("__next."));
    }
  }
}

await walk(OUT);
console.log(`flatten_prefetch: wrote ${written} flat files under ${OUT}`);
