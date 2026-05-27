---
name: ship
description: Release gustrips end-to-end — typecheck, build, commit, push to GitHub and deploy to Vercel production. Use when the user says "ship", "deploy", "subí esto", "publicá", etc.
---

# Ship gustrips

The full release flow for gustrips (Next.js 15 + Firebase, npm, Vercel). Run the steps in order; **stop and report** if any step fails — never deploy a red build.

1. **Typecheck** — `npm run typecheck`. Must pass.
2. **Build** — `npm run build`. Must pass. (This also regenerates `public/sw-precache-manifest.json` via the postbuild script.)
3. **Commit** — `git add -A && git commit -m "<conventional message>"`. End the message with:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
4. **Push to GitHub** — the assistant's shell SSH agent often starts empty. If `git push` fails with a key/connection error, load the key first and retry **with the sandbox disabled** (port 22):
   - `ssh-add ~/.ssh/id_ed25519`
   - `git push` (dangerouslyDisableSandbox)
   - If it still fails, tell the user to run `cd /Users/gusmac/gustrips && git push` in their **real macOS Terminal**.
5. **Deploy** — `vercel deploy --prod`. Capture output with `tail` (or full); **never pipe to `head`** — it can SIGPIPE-kill the build mid-way.
6. **Report** — commit hash, GitHub sync status, and the production alias (`gustrips.vercel.app`).

## Notes
- **Lint does NOT block the build** (`eslint.ignoreDuringBuilds: true`). Don't gate ship on lint.
- If you edited `public/sw.js`, confirm **`SW_VERSION` was bumped** — otherwise users won't get the update.
- Config-only changes (`.claude/`, `.mcp.json`, `scripts/`, docs) don't need a Vercel deploy — commit + push is enough.
