/**
 * Content-based fingerprinting for album photos.
 *
 * We hash the raw bytes of the user-selected file with SHA-256 before any
 * compression / resizing happens, so re-uploading the exact same file twice
 * (the most common duplicate case — user re-picks the same photo from their
 * camera roll) reliably yields the same fingerprint. The hash is stored as
 * `contentHash` on the photo's Firestore doc and used by the upload UI to
 * warn the user before queueing a duplicate.
 *
 * Limitations (documented so we don't promise more than we deliver):
 *   - A photo edited / re-encoded by another app will produce a different
 *     SHA-256. For those near-duplicates we'd need a perceptual hash (pHash)
 *     — out of scope for this iteration.
 *   - HEIC files converted on the client (via `normalizeImageFile`) get
 *     hashed BEFORE the conversion so the fingerprint is stable even when
 *     a future Safari version starts decoding HEIC natively.
 */

/** Compute the SHA-256 of a File / Blob and return it as a hex string. */
export async function computeFileHash(file: Blob): Promise<string> {
  // SubtleCrypto wants the full ArrayBuffer; for very large files this
  // means ~50 MB in memory briefly. That's fine for a single photo —
  // we cap uploads at 30 MB in the HEIC fallback path already.
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  // Convert ArrayBuffer → hex string.
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Compute hashes for an array of files in parallel. Returns a list aligned
 * with the input — entry [i] is the hash of files[i]. If hashing a single
 * file fails (e.g. crypto.subtle is unavailable), that entry is `null`
 * rather than throwing so the caller can still proceed with the upload.
 */
export async function computeFileHashes(files: File[]): Promise<(string | null)[]> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return files.map(() => null);
  }
  return Promise.all(
    files.map(async (f) => {
      try {
        return await computeFileHash(f);
      } catch (err) {
        console.warn('[photoHash] hash failed for file', f.name, err);
        return null;
      }
    }),
  );
}
