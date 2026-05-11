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

async function convertHeicToJpeg(file: File): Promise<File> {
  const mod = (await import('heic2any')) as unknown as {
    default?: (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>;
  } & ((opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>);
  const heic2any = mod.default ?? mod;
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(out) ? out[0] : out;
  if (!blob) throw new Error('HEIC conversion produced no output');
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg') || 'photo.jpg';
  return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
}

/**
 * Convert HEIF/HEIC → JPEG when applicable. Otherwise returns the file as-is.
 *
 * Robust against false-positive hints: we trust magic bytes over the
 * filename/mime. If hint says HEIC but bytes disagree, we skip conversion.
 * If the bytes look HEIF but heic2any fails for any reason (truncated,
 * unsupported codec, libheif transient error), we log once at debug level
 * and return the original file — downstream canvas decode will either
 * succeed (if it was actually a JPEG) or fail loudly there.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  const reallyHeif = await isActuallyHeif(file);
  if (!reallyHeif) return file;
  try {
    return await convertHeicToJpeg(file);
  } catch (err) {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[heic] conversion failed, falling back to original', err);
    }
    return file;
  }
}
