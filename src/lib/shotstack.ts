/**
 * Shotstack helpers — Trip Reel video generation.
 *
 * Wraps the Shotstack v1 API for building, submitting, and polling
 * render jobs. The UI never talks to Shotstack directly; both API
 * routes (POST /api/generate-reel and GET /api/generate-reel/status/[id])
 * import from this module so the timeline-building logic stays in one
 * place.
 *
 * If `SHOTSTACK_API_KEY` is not set, the submit/poll functions throw a
 * `MissingKey` error so the route can fall back to mock mode for local
 * development without leaking the lack-of-key to the client.
 *
 * Docs: https://shotstack.io/docs/api/
 */

const SHOTSTACK_ENDPOINT = 'https://api.shotstack.io/v1';

/* ─── Types ────────────────────────────────────────── */

export type ReelMusic = 'chill' | 'upbeat' | 'cinematic';
export type ReelAspect = '1:1' | '9:16';
export type ReelStyle = 'cinematic' | 'vibrant' | 'slow';

export interface ReelPhoto {
  url: string;
  caption?: string;
  date: string;
}

export interface BuildReelOptions {
  photos: ReelPhoto[];
  music: ReelMusic;
  aspect: ReelAspect;
  style: ReelStyle;
  tripTitle: string;
  destination?: string;
  dateRange?: string;
}

/** Shotstack timeline edit JSON. Loose typing — the API accepts more
 *  than we use, and we don't need to mirror their whole schema. */
export interface ShotstackEdit {
  timeline: {
    background: string;
    soundtrack?: { src: string; effect?: string };
    tracks: Array<{
      clips: Array<Record<string, unknown>>;
    }>;
  };
  output: {
    format: 'mp4';
    resolution: 'sd' | 'hd' | '1080';
    aspectRatio?: '1:1' | '9:16' | '16:9' | '4:5';
    fps?: number;
  };
}

export interface SubmitResult {
  id: string;
}

export interface PollResult {
  status: ShotstackStatus;
  url?: string;
  error?: string;
}

/** Lifecycle states Shotstack reports for a render. */
export type ShotstackStatus =
  | 'queued'
  | 'fetching'
  | 'rendering'
  | 'saving'
  | 'done'
  | 'failed';

export class MissingKeyError extends Error {
  constructor() {
    super('SHOTSTACK_API_KEY is not set');
    this.name = 'MissingKeyError';
  }
}

/* ─── Music library ────────────────────────────────────
 * Public stock-audio URLs. These need to be CORS-accessible MP3s that
 * Shotstack's render workers can fetch — Mixkit's CDN works well for
 * this purpose and is royalty-free. Swap any of these out by editing
 * the map below; no other code needs to change.
 */

export const MUSIC_LIBRARY: Record<ReelMusic, { url: string; label: string; description: string }> = {
  chill: {
    url: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
    label: 'Chill',
    description: 'Tech-house relajado, ideal para playas y atardeceres',
  },
  upbeat: {
    url: 'https://assets.mixkit.co/music/preview/mixkit-summer-fun-13.mp3',
    label: 'Upbeat',
    description: 'Energía positiva para ciudad y aventura',
  },
  cinematic: {
    url: 'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3',
    label: 'Cinematic',
    description: 'Épico y emocional, perfecto para paisajes',
  },
};

/* ─── Style presets ───────────────────────────────────
 * Each style controls how long each photo lingers on screen and which
 * camera effect we layer on top. Shotstack supports a small set of
 * presets (`zoomIn`, `zoomOut`, `slideLeft`, `slideRight`, `slideUp`,
 * `slideDown`); we map our high-level vibe names onto rotations of
 * those for visual variety.
 */

interface StylePreset {
  /** Seconds each clip stays on screen. */
  clipDuration: number;
  /** Seconds the fade-in/out transition lasts. */
  transitionDuration: number;
  /** Effects cycled through across clips. */
  effects: Array<'zoomIn' | 'zoomOut' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown'>;
  /** Transition name on each clip (Shotstack supports `fade`, `wipe`, etc). */
  transitionIn: string;
  transitionOut: string;
}

const STYLE_PRESETS: Record<ReelStyle, StylePreset> = {
  cinematic: {
    clipDuration: 2.5,
    transitionDuration: 0.5,
    effects: ['zoomIn', 'zoomOut', 'slideLeft', 'slideRight'],
    transitionIn: 'fade',
    transitionOut: 'fade',
  },
  vibrant: {
    clipDuration: 1.8,
    transitionDuration: 0.3,
    effects: ['zoomIn', 'slideLeft', 'slideUp', 'slideDown'],
    transitionIn: 'fade',
    transitionOut: 'fade',
  },
  slow: {
    clipDuration: 3.5,
    transitionDuration: 0.8,
    effects: ['zoomIn', 'zoomOut'],
    transitionIn: 'fade',
    transitionOut: 'fade',
  },
};

/* ─── Edit-builder ────────────────────────────────────── */

/**
 * Build a Shotstack edit JSON from the user's selections.
 *
 * Produces two tracks: image clips with Ken-Burns-style effects on the
 * lower track plus a soundtrack pulled from {@link MUSIC_LIBRARY}. A
 * title card is prepended showing `tripTitle` + optional destination /
 * date range; captions are rendered as text overlays on the clips that
 * have them.
 */
export function buildReelEdit(opts: BuildReelOptions): ShotstackEdit {
  const { photos, music, aspect, style, tripTitle, destination, dateRange } = opts;
  const preset = STYLE_PRESETS[style];
  const titleDuration = 2.0;

  const titleClip: Record<string, unknown> = {
    asset: {
      type: 'title',
      text: tripTitle,
      style: 'minimal',
      color: '#ffffff',
      size: 'large',
      background: 'transparent',
      position: 'center',
    },
    start: 0,
    length: titleDuration,
    transition: { in: preset.transitionIn, out: preset.transitionOut },
  };

  // Subtitle card with destination + date range, played alongside the title.
  const subtitleText = [destination, dateRange].filter(Boolean).join(' · ');
  const subtitleClip: Record<string, unknown> | null = subtitleText
    ? {
        asset: {
          type: 'title',
          text: subtitleText,
          style: 'minimal',
          color: '#ffffff',
          size: 'small',
          background: 'transparent',
          position: 'bottom',
        },
        start: 0,
        length: titleDuration,
        transition: { in: preset.transitionIn, out: preset.transitionOut },
      }
    : null;

  // Image clips: each photo gets clipDuration on screen with a cycling
  // Ken Burns effect. The fade transitions overlap slightly via
  // Shotstack's built-in `transition` block.
  const clips: Array<Record<string, unknown>> = [];
  let cursor = titleDuration;
  photos.forEach((photo, idx) => {
    const effect = preset.effects[idx % preset.effects.length];
    clips.push({
      asset: {
        type: 'image',
        src: photo.url,
      },
      start: cursor,
      length: preset.clipDuration,
      effect,
      fit: 'cover',
      transition: { in: preset.transitionIn, out: preset.transitionOut },
    });
    cursor += preset.clipDuration;
  });

  // Caption overlays on a separate track so they sit on top of the
  // image clips without fighting them for layout.
  const captionClips: Array<Record<string, unknown>> = [];
  let captionCursor = titleDuration;
  photos.forEach((photo) => {
    if (photo.caption && photo.caption.trim()) {
      captionClips.push({
        asset: {
          type: 'title',
          text: photo.caption.trim(),
          style: 'subtitle',
          color: '#ffffff',
          size: 'medium',
          background: '#000000',
          position: 'bottom',
        },
        start: captionCursor + 0.2,
        length: Math.max(preset.clipDuration - 0.4, 0.8),
        transition: { in: 'fade', out: 'fade' },
      });
    }
    captionCursor += preset.clipDuration;
  });

  const tracks: ShotstackEdit['timeline']['tracks'] = [];

  // Top track: title + captions.
  const overlayClips: Array<Record<string, unknown>> = [titleClip];
  if (subtitleClip) overlayClips.push(subtitleClip);
  overlayClips.push(...captionClips);
  tracks.push({ clips: overlayClips });

  // Bottom track: image clips.
  tracks.push({ clips });

  return {
    timeline: {
      background: '#000000',
      soundtrack: {
        src: MUSIC_LIBRARY[music].url,
        effect: 'fadeInFadeOut',
      },
      tracks,
    },
    output: {
      format: 'mp4',
      resolution: 'hd',
      aspectRatio: aspect,
      fps: 25,
    },
  };
}

/* ─── Network calls ───────────────────────────────────── */

function requireKey(): string {
  const key = process.env.SHOTSTACK_API_KEY;
  if (!key) throw new MissingKeyError();
  return key;
}

/** POST the edit JSON to Shotstack and return the render id. */
export async function submitRender(edit: ShotstackEdit): Promise<SubmitResult> {
  const key = requireKey();
  const res = await fetch(`${SHOTSTACK_ENDPOINT}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
    },
    body: JSON.stringify(edit),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { response?: { message?: string }; message?: string })?.response?.message ||
      (data as { message?: string })?.message ||
      `Shotstack ${res.status}`;
    throw new Error(msg);
  }
  const id = (data as { response?: { id?: string } })?.response?.id;
  if (!id) throw new Error('Shotstack respondió sin id');
  return { id };
}

/** Poll a single render once. The caller decides cadence — we don't
 *  loop here so the API route can return promptly and let the client
 *  drive the polling interval. */
export async function pollRender(id: string): Promise<PollResult> {
  const key = requireKey();
  const res = await fetch(`${SHOTSTACK_ENDPOINT}/render/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { 'x-api-key': key },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { response?: { message?: string }; message?: string })?.response?.message ||
      (data as { message?: string })?.message ||
      `Shotstack ${res.status}`;
    throw new Error(msg);
  }
  const resp = (data as { response?: { status?: ShotstackStatus; url?: string; error?: string } }).response;
  return {
    status: (resp?.status as ShotstackStatus) || 'queued',
    url: resp?.url,
    error: resp?.error,
  };
}
