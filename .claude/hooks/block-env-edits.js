/* PreToolUse hook: block edits to .env files (Firebase keys / secrets).
 * Exit 2 = block the tool call and feed the message back to Claude.
 * Anything unexpected → exit 0 (never block by accident). */
let raw = '';
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw || '{}');
    const p =
      input?.tool_input?.file_path ||
      input?.tool_input?.path ||
      '';
    const base = String(p).split('/').pop() || '';
    // Match .env, .env.local, .env.production, etc. (but allow .env.example).
    if (/^\.env(\.|$)/.test(base) && base !== '.env.example') {
      console.error(
        `Bloqueado: ${base} contiene secretos (claves de Firebase, etc.). ` +
        `Editalo a mano si de verdad hace falta; el asistente no debe tocarlo.`,
      );
      process.exit(2);
    }
  } catch {
    /* fall through — never block on parse errors */
  }
  process.exit(0);
});
