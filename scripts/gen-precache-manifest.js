/**
 * Post-build: enumerate every immutable build asset under `.next/static` and
 * write a precache manifest the service worker reads on install. Without this
 * the SW could only precache the chunks linked from /dashboard, so any page
 * the user hadn't opened online failed offline. Precaching the full set means
 * every route's code is available offline after a single online launch.
 *
 * The output is best-effort: if `.next/static` doesn't exist (e.g. running
 * before a build) we still write an empty manifest so the SW's fetch never
 * 404s into a console error. The SW also tolerates a missing manifest.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STATIC_DIR = path.join(ROOT, '.next', 'static');
const OUT = path.join(ROOT, 'public', 'sw-precache-manifest.json');

/** Recursively collect JS/CSS files under dir, returned as posix sub-paths. */
function walk(dir, base = '') {
  let out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out = out.concat(walk(abs, rel));
    } else if (/\.(js|css|woff2?)$/i.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

function main() {
  const files = walk(STATIC_DIR);
  // `.next/static/<x>` is served at `/_next/static/<x>`.
  const assets = files.map((f) => `/_next/static/${f}`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: assets.length,
    assets,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(manifest));
  // eslint-disable-next-line no-console
  console.log(`[gen-precache] wrote ${assets.length} assets to public/sw-precache-manifest.json`);
}

main();
