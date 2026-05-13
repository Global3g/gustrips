/**
 * HEIC/HEIF detection + conversion to JPEG.
 *
 * Apple Photos exports in HEIC by default. Browsers (except Safari on Apple
 * devices) can't decode HEIC into <canvas>, so the existing compression
 * pipeline silently fails on those files. We detect HEIC up-front and convert
 * to JPEG using `heic2any`, which is loaded dynamically to keep it out of the
 * initial bundle (~700 KB gzipped including libheif-js).
 */

const HEIC_EXTENSIONS = ['.heic', '.heif'];
const HEIC_MIME_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

/**
 * Cheap MIME / extension hint. Used as a *hint* only — phones often share
 * photos with a .heic extension that already carry JPEG bytes (and vice
 * versa), so we always confirm via magic bytes before paying the heic2any
 * import + decode cost.
 */
export function isHeicFile(file: File | Blob & { name?: string; type?: string }): boolean {
  const type = (file.type || '').toLowerCase();
  if (HEIC_MIME_TYPES.includes(type)) return true;
  const name = ('name' in file && typeof file.name === 'string' ? file.name : '').toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Inspect the first ~16 bytes to confirm a HEIF container. HEIF files start
 * with an `ftyp` box whose major brand is in a known set (heic, heix, mif1,
 * msf1, heim, heis, hevc, hevx, avif). JPEGs start with `FF D8 FF`. PNGs with
 * `89 50 4E 47`. This catches the common case where iOS share intents rename
 * a JPEG to .heic — we'd otherwise hand it to libheif and get the
 * "Could not parse HEIF file" log spam plus a rejection.
 */
async function isActuallyHeif(file: Blob): Promise<boolean> {
  try {
    const head = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(head);
    if (bytes.length < 12) return false;
    // Quick negative checks: JPEG / PNG signatures rule out HEIF.
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return false;
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return false;
    }
    // 'ftyp' at offset 4.
    if (
      bytes[4] !== 0x66 ||
      bytes[5] !== 0x74 ||
      bytes[6] !== 0x79 ||
      bytes[7] !== 0x70
    ) {
      return false;
    }
    // Major brand at offset 8..12, e.g. "heic".
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    const heifBrands = new Set([
      'heic', 'heix', 'mif1', 'msf1', 'heim', 'heis', 'hevc', 'hevx', 'avif',
    ]);
    return heifBrands.has(brand);
  } catch {
    return false;
  }
}

/**
 * Suppress the noisy "Could not parse HEIF file" / "libheif: ..." messages
 * that libheif-js (inside heic2any) writes straight to console.{log,error}
 * from the WASM module, bypassing any try/catch. We only filter that exact
 * family of messages; everything else flows through normally. The wrapper is
 * scoped per-call so it auto-restores even if the conversion throws.
 */
const HEIF_NOISE_RE = /(could not parse heif file|libheif|^heif:)/i;
async function runQuietly<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof console === 'undefined') return fn();
  const originalLog = console.log;
  const originalErr = console.error;
  const originalWarn = console.warn;
  const filter = (orig: (...a: unknown[]) => void) =>
    (...args: unknown[]): void => {
      const first = args[0];
      if (typeof first === 'string' && HEIF_NOISE_RE.test(first)) return;
      orig(...args);
    };
  console.log = filter(originalLog) as typeof console.log;
  console.error = filter(originalErr) as typeof console.error;
  console.warn = filter(originalWarn) as typeof console.warn;
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalErr;
    console.warn = originalWarn;
  }
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const mod = (await import('heic2any')) as unknown as {
    default?: (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>;
  } & ((opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>);
  const heic2any = mod.default ?? mod;
  const out = await runQuietly(() =>
    heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 }),
  );
  const blob = Array.isArray(out) ? out[0] : out;
  if (!blob) throw new Error('HEIC conversion produced no output');
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg') || 'photo.jpg';
  return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
}

/**
 * Server-side HEIC → JPEG converter used as a fallback when the in-browser
 * libheif can't handle the file (HEVC 10-bit, common on iPhone 12+).
 */
const HEIC_SERVER_URL =
  'https://us-central1-gustrips-a317e.cloudfunctions.net/heicToJpeg';

async function convertHeicViaServer(file: File): Promise<File> {
  // Auth: we need a Firebase ID token. Import lazily so this helper stays
  // usable in non-auth contexts too.
  const { getClientAuth } = await import('@/lib/firebase/client');
  const user = getClientAuth().currentUser;
  if (!user) throw new Error('Not signed in — cannot reach server HEIC converter');
  const token = await user.getIdToken();

  const res = await fetch(HEIC_SERVER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Server HEIC conversion failed: ${res.status} ${text}`);
  }
  const jpegBlob = await res.blob();
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg') || 'photo.jpg';
  return new File([jpegBlob], newName, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
}

/**
 * Convert HEIF/HEIC → JPEG when applicable. Otherwise returns the file as-is.
 *
 * Strategy:
 *   1. If the hint says HEIC but the bytes aren't actually HEIF, skip work.
 *   2. Try in-browser conversion via heic2any (fast, no round-trip).
 *   3. If heic2any throws (HEVC 10-bit is the usual cause), fall back to a
 *      Firebase Function that runs the full libheif on the server. Slower
 *      but handles every iPhone codec we've seen.
 *   4. If the server conversion also fails, return the original file and
 *      let the downstream canvas decode produce the visible error.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  const reallyHeif = await isActuallyHeif(file);
  if (!reallyHeif) return file;
  try {
    return await convertHeicToJpeg(file);
  } catch (clientErr) {
    if (typeof console !== 'undefined' && typeof console.info === 'function') {
      console.info('[heic] browser conversion failed, trying server', clientErr);
    }
    try {
      return await convertHeicViaServer(file);
    } catch (serverErr) {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[heic] server conversion also failed', serverErr);
      }
      return file;
    }
  }
}
