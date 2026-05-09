/**
 * Native share helper for individual photos using the Web Share API.
 *
 * Tries to share the photo as a File (so messaging apps embed the image
 * directly). Falls back to URL-only share on platforms that don't support
 * file sharing (mostly desktop). Returns a discriminated result so callers
 * can show appropriate UI for unsupported / cancelled / failed states.
 */

export interface SharePhotoOptions {
  url: string;
  caption?: string;
  tripTitle?: string;
  destination?: string;
  date?: string;
}

export interface SharePhotoResult {
  ok: boolean;
  reason?: 'unsupported' | 'cancelled' | 'failed' | 'no-files';
  error?: string;
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatDateLongEs(iso: string): string | null {
  // Expecting YYYY-MM-DD. Avoid `new Date('YYYY-MM-DD')` because that's
  // parsed as UTC and can shift days near midnight.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  return `${day} de ${MONTHS_ES[month - 1]} de ${year}`;
}

function buildShareText(opts: SharePhotoOptions): { title: string; text: string } {
  const primary = opts.caption || opts.tripTitle || opts.destination || 'Foto del viaje';
  const parts: string[] = [primary];

  if (opts.tripTitle && opts.tripTitle !== primary) {
    parts.push(opts.tripTitle);
  }
  if (opts.destination && opts.destination !== primary && opts.destination !== opts.tripTitle) {
    parts.push(opts.destination);
  }
  if (opts.date) {
    const longDate = formatDateLongEs(opts.date);
    if (longDate) parts.push(longDate);
  }

  return {
    title: opts.tripTitle || primary,
    text: parts.join(' — '),
  };
}

async function fetchAsFile(url: string): Promise<File | null> {
  try {
    const proxied = `/api/photo-proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxied);
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = blob.type || 'image/jpeg';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    return new File([blob], `foto.${ext}`, { type });
  } catch {
    return null;
  }
}

export async function sharePhoto(opts: SharePhotoOptions): Promise<SharePhotoResult> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return { ok: false, reason: 'unsupported' };
  }

  const { title, text } = buildShareText(opts);

  // Try to share the actual image file first.
  const file = await fetchAsFile(opts.url);
  if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title, text, files: [file] });
      return { ok: true };
    } catch (err) {
      const e = err as DOMException;
      if (e?.name === 'AbortError') {
        return { ok: false, reason: 'cancelled' };
      }
      // Fall through to URL-only share if file share rejected at runtime.
    }
  }

  // URL-only fallback.
  try {
    await navigator.share({ title, text, url: opts.url });
    return { ok: true };
  } catch (err) {
    const e = err as DOMException;
    if (e?.name === 'AbortError') {
      return { ok: false, reason: 'cancelled' };
    }
    return {
      ok: false,
      reason: 'failed',
      error: e?.message || 'Share failed',
    };
  }
}
