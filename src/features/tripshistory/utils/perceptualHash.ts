/**
 * Perceptual hash (pHash) implementation.
 *
 * Pipeline:
 *  1. Decode `file` to an HTMLImageElement (via object URL).
 *  2. Draw to a 32x32 grayscale canvas.
 *  3. Run a 2D DCT, take the top-left 8x8 (skip the DC term).
 *  4. Threshold against the median -> 64-bit hash -> 16 lowercase hex chars.
 *  5. Compute a Laplacian-variance blur score on the same grayscale buffer.
 *
 * For HEIC inputs the caller is expected to normalize via `heic2any` first.
 */

import { isHeicFile, normalizeImageFile } from '@/lib/heic';

const SIZE = 32;        // input size for DCT (32x32)
const HASH_SIDE = 8;    // top-left 8x8 of DCT coefficients
const HASH_BITS = HASH_SIDE * HASH_SIDE; // 64

/* ─── Image decoding ───────────────────────────────── */

interface DecodedImage {
  width: number;
  height: number;
  /** Grayscale 32x32 buffer (0..255). */
  gray: Float32Array;
}

async function loadHTMLImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load timed out'));
    }, 30_000);
    img.onload = () => {
      clearTimeout(timeout);
      // Keep URL alive long enough to draw; revoke on next tick.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    img.src = url;
  });
}

async function decodeToGrayscale(file: File): Promise<{
  img: HTMLImageElement;
  decoded: DecodedImage;
}> {
  const working: File = isHeicFile(file) ? await normalizeImageFile(file) : file;
  const img = await loadHTMLImage(working);

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const gray = new Float32Array(SIZE * SIZE);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // ITU-R BT.601 luma
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  return {
    img,
    decoded: {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      gray,
    },
  };
}

/* ─── DCT ───────────────────────────────────────────── */

// Precompute the DCT-II cosine matrix once per process.
let _cosCache: Float32Array | null = null;
function getCosMatrix(): Float32Array {
  if (_cosCache) return _cosCache;
  const m = new Float32Array(SIZE * SIZE);
  for (let k = 0; k < SIZE; k++) {
    for (let n = 0; n < SIZE; n++) {
      m[k * SIZE + n] = Math.cos(((2 * n + 1) * k * Math.PI) / (2 * SIZE));
    }
  }
  _cosCache = m;
  return m;
}

/**
 * 2D Type-II DCT computed via two 1D passes. Returns a SIZE*SIZE buffer of
 * coefficients in row-major order. We only care about the top-left HASH_SIDE
 * x HASH_SIDE subblock, but computing the whole grid is simpler and still
 * cheap at SIZE=32.
 */
function dct2d(input: Float32Array): Float32Array {
  const cos = getCosMatrix();
  const temp = new Float32Array(SIZE * SIZE);
  const out = new Float32Array(SIZE * SIZE);

  // Rows -> columns DCT pass.
  for (let y = 0; y < SIZE; y++) {
    for (let k = 0; k < SIZE; k++) {
      let sum = 0;
      for (let n = 0; n < SIZE; n++) {
        sum += input[y * SIZE + n] * cos[k * SIZE + n];
      }
      temp[y * SIZE + k] = sum;
    }
  }
  // Columns DCT pass.
  for (let x = 0; x < SIZE; x++) {
    for (let k = 0; k < SIZE; k++) {
      let sum = 0;
      for (let n = 0; n < SIZE; n++) {
        sum += temp[n * SIZE + x] * cos[k * SIZE + n];
      }
      out[k * SIZE + x] = sum;
    }
  }
  return out;
}

/* ─── Hash + blur ───────────────────────────────────── */

function buildPHashFromDct(dct: Float32Array): string {
  // Pull top-left 8x8, skipping DC (0,0) for the median calc — the standard
  // pHash trick. We still emit 64 bits total; the DC bit just compares to the
  // same median as the rest.
  const block: number[] = [];
  for (let y = 0; y < HASH_SIDE; y++) {
    for (let x = 0; x < HASH_SIDE; x++) {
      block.push(dct[y * SIZE + x]);
    }
  }
  // Median excludes the DC term (first element).
  const tail = block.slice(1).slice().sort((a, b) => a - b);
  const median = tail[Math.floor(tail.length / 2)];

  // Pack into a 64-bit value as 16 hex chars (high-bit-first).
  let hex = '';
  for (let nibble = 0; nibble < HASH_BITS / 4; nibble++) {
    let v = 0;
    for (let b = 0; b < 4; b++) {
      const idx = nibble * 4 + b;
      v = (v << 1) | (block[idx] > median ? 1 : 0);
    }
    hex += v.toString(16);
  }
  return hex;
}

/**
 * Laplacian variance on the 32x32 grayscale buffer, normalized to ~0..1.
 *
 * Laplacian kernel:
 *   0  1  0
 *   1 -4  1
 *   0  1  0
 *
 * Higher variance = more edges = sharper image. The normalization constant
 * is empirical: typical sharp phone photos land around variance 800-2500 at
 * 32x32, blurry ones <200. We clamp into 0..1 by dividing by 1500.
 */
function blurScoreFromGray(gray: Float32Array): number {
  let mean = 0;
  let count = 0;
  const lap = new Float32Array(SIZE * SIZE);
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const i = y * SIZE + x;
      const v =
        -4 * gray[i] +
        gray[i - 1] +
        gray[i + 1] +
        gray[i - SIZE] +
        gray[i + SIZE];
      lap[i] = v;
      mean += v;
      count++;
    }
  }
  mean /= count || 1;
  let variance = 0;
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const i = y * SIZE + x;
      const d = lap[i] - mean;
      variance += d * d;
    }
  }
  variance /= count || 1;
  // Empirical normalization: clamp into [0..1].
  const norm = Math.min(1, Math.max(0, variance / 1500));
  return Number(norm.toFixed(4));
}

/* ─── Public API ───────────────────────────────────── */

export interface PerceptualHashResult {
  phash: string;
  blurScore: number;
  width: number;
  height: number;
}

/**
 * Decode the image, compute a 64-bit pHash (16 hex chars) and a Laplacian
 * blur score in [0..1]. Also surfaces the natural dimensions so callers
 * don't need to decode the image twice.
 *
 * Throws if the image cannot be decoded (e.g. corrupt file, unsupported
 * codec on this browser). Callers should treat that as "skip pHash, keep
 * the rest of the metadata".
 */
export async function computePerceptualHash(
  file: File,
): Promise<PerceptualHashResult> {
  const { decoded } = await decodeToGrayscale(file);
  const dct = dct2d(decoded.gray);
  return {
    phash: buildPHashFromDct(dct),
    blurScore: blurScoreFromGray(decoded.gray),
    width: decoded.width,
    height: decoded.height,
  };
}

/**
 * Legacy stub kept for any caller that wants a deterministic-ish hex from a
 * cheap string input (filename + size + lastModified). Used as a fallback
 * when the real pHash fails (e.g. tab is background and getImageData throws).
 */
export function computePerceptualHashStub(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  const hi = h1.toString(16).padStart(8, '0');
  const lo = h2.toString(16).padStart(8, '0');
  return `${hi}${lo}`;
}

/**
 * Hamming distance between two hex-encoded perceptual hashes of equal length.
 * Returns -1 if hashes have mismatched lengths or contain non-hex chars.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return -1;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = parseInt(a[i], 16);
    const bi = parseInt(b[i], 16);
    if (Number.isNaN(ai) || Number.isNaN(bi)) return -1;
    let xor = ai ^ bi;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}
