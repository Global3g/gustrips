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

export function isHeicFile(file: File | Blob & { name?: string; type?: string }): boolean {
  const type = (file.type || '').toLowerCase();
  if (HEIC_MIME_TYPES.includes(type)) return true;
  // Some browsers report empty/octet-stream for HEIC — fall back to extension.
  const name = ('name' in file && typeof file.name === 'string' ? file.name : '').toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Convert a HEIC/HEIF blob to a JPEG File. The output preserves the original
 * filename with the extension swapped to `.jpg`. Quality 0.92 — the upload
 * pipeline re-compresses afterwards, so we don't lose much by being generous.
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  // heic2any is a CJS module exporting the callable directly. Webpack interop
  // exposes it under `.default`, but the TS types describe the bare function.
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
 * If the file is HEIC/HEIF, convert it to JPEG; otherwise return as-is. Safe
 * to call on every upload path — the dynamic import only triggers when
 * conversion is actually needed.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  return convertHeicToJpeg(file);
}
