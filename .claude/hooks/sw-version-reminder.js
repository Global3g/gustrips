/* PostToolUse hook: after editing public/sw.js, remind to bump SW_VERSION
 * (otherwise users won't receive the update). Non-blocking — always exit 0. */
let raw = '';
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw || '{}');
    const p = String(input?.tool_input?.file_path || input?.tool_input?.path || '');
    if (p.endsWith('public/sw.js')) {
      console.error(
        '⚠️  Editaste public/sw.js — confirmá que bumpeaste SW_VERSION ' +
        '(si no, la actualización no le llega a los usuarios).',
      );
    }
  } catch {
    /* ignore */
  }
  process.exit(0);
});
