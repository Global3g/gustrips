/**
 * Perceptual hash (pHash) — stub.
 *
 * Real implementation pending. The engine uses pHash to dedupe photos that
 * look the same but have different file bytes (re-saved, slightly cropped,
 * etc.). For now we produce a stable 64-bit hex digest derived from a string
 * input, which is enough to keep the API contract typed and the upstream
 * code shape correct.
 */

/**
 * Compute a stable 64-bit hex digest from an arbitrary input string.
 *
 * This is NOT a perceptual hash — it's a placeholder that mimics the shape
 * (16 hex chars, lowercase) so wiring/tests can proceed.
 */
export function computePerceptualHashStub(input: string): string {
  // FNV-1a 64-bit (split into two 32-bit halves to stay within JS number range).
  // Output: 16-character lowercase hex string.
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
 * Placeholder for the real pHash-from-bitmap implementation.
 *
 * Will eventually:
 *  1. Decode `file` to an ImageBitmap.
 *  2. Resize to 32x32 grayscale.
 *  3. DCT, take top-left 8x8, compare to median, produce 64-bit hash.
 */
export async function computePerceptualHash(file: File): Promise<string> {
  return computePerceptualHashStub(
    `${file.name}:${file.size}:${file.lastModified}`,
  );
}

/**
 * Hamming distance between two hex-encoded perceptual hashes of equal length.
 * Returns -1 if hashes have mismatched lengths.
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
