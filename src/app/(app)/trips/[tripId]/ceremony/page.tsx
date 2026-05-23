'use client';

/**
 * Closing Ceremony — a single-screen, full-bleed animated montage that
 * plays once when the trip has just ended. Pulls everything from the
 * existing trip context (no new Firestore listeners) and writes back a
 * single `ceremonyShownAt` field on the trip when the user finishes.
 *
 * Flow
 * ----
 *   1. Tu viaje a {destination}        3s    fade in over hero photo
 *   2. X días                          4s    counted-up days
 *   3. X fotos · Y eventos · Z km      4s    stat triplet
 *   4. Top 3 photos                    5s    cross-fade slideshow
 *   5. Diary text from peak day        5s    longest entry, italic
 *   6. Llevate este recuerdo + buttons      indefinite until user acts
 *
 * Each step is built from <CeremonyStep>, which owns the auto-advance
 * timer + framer-motion enter/exit. Tap-to-skip works on every step.
 *
 * Why the diary subscription lives here
 * -------------------------------------
 * Diary entries are NOT part of TripDataContext (they live on a sub-
 * collection that very few pages need). The ceremony only mounts when
 * the trip has ended, so the single onSnapshot we open here is short-
 * lived and only fires once per user per trip.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, BookOpen, X } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

import {
  useTripFromContext as useTrip,
  useEventsFromContext as useEvents,
  useAlbumFromContext as useAlbum,
} from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import { useTripDiary } from '@/hooks/useTripDiary';
import CeremonyStep from '@/components/ceremony/CeremonyStep';
import type { AlbumPhoto, TripEvent } from '@/types';

/* ─── Helpers (duplicated tiny utilities to avoid widening shared modules) */

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ─── Small visual helpers ───────────────────────────── */

/**
 * Counts up from 0 to `to` in `durationMs`. Used for the "X días" step so
 * the number feels earned rather than just printed.
 */
function useCountUp(to: number, durationMs: number, active: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    if (to <= 0) {
      setValue(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const progress = Math.min(1, (t - start) / durationMs);
      // Ease-out cubic — feels like a soft landing on the final number.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(to * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs, active]);
  return value;
}

/* ─── Step duration constants (ms) ───────────────────── */
const D_INTRO = 3000;
const D_DAYS = 4000;
const D_STATS = 4000;
const D_PHOTOS = 5000;
const D_DIARY = 5000;

export default function CeremonyPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { trip, updateTrip } = useTrip();
  const { events } = useEvents();
  const { albumPhotos: rawAlbumPhotos } = useAlbum();
  const { entries: diaryEntries } = useTripDiary(tripId);
  const { toast } = useToast();

  // Skip soft-deleted photos in every count + slide — matching the recap.
  const albumPhotos = useMemo(
    () => rawAlbumPhotos.filter((p) => !p.deletedAt),
    [rawAlbumPhotos],
  );

  // 0..5 maps to the six scenes; 5 is the final "Llevate este recuerdo" card.
  const [stepIndex, setStepIndex] = useState(0);
  // When we've already persisted ceremonyShownAt for this run, skip the
  // duplicate write on close. The state lives outside of the step index
  // because the user can finish via several different exit paths.
  const [marked, setMarked] = useState(false);

  /* ─── Derived stats ──────────────────────────────────── */

  const stats = useMemo(() => {
    let totalDays = 0;
    if (trip?.startDate && trip?.endDate) {
      try {
        totalDays =
          Math.max(
            0,
            differenceInDays(parseISO(trip.endDate), parseISO(trip.startDate)),
          ) + 1;
      } catch {
        totalDays = 0;
      }
    }

    // Photos count mirrors the recap: album + extra event-attached URLs not
    // already present in the album set. Keeps the headline consistent.
    const albumUrls = new Set(albumPhotos.map((p) => p.url));
    let extraEventPhotos = 0;
    for (const ev of events) {
      for (const url of ev.photos ?? []) {
        if (!albumUrls.has(url)) extraEventPhotos += 1;
      }
    }
    const totalPhotos = albumPhotos.length + extraEventPhotos;

    const orderedGeo = [...events]
      .filter(
        (e): e is TripEvent & { latitude: number; longitude: number } =>
          typeof e.latitude === 'number' && typeof e.longitude === 'number',
      )
      .sort((a, b) => {
        const da = `${a.date} ${a.startTime || ''}`;
        const db = `${b.date} ${b.startTime || ''}`;
        return da.localeCompare(db);
      });
    let kmTraveled = 0;
    for (let i = 1; i < orderedGeo.length; i++) {
      const a = orderedGeo[i - 1];
      const b = orderedGeo[i];
      kmTraveled += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
    }

    return {
      totalDays,
      totalPhotos,
      totalEvents: events.length,
      kmTraveled,
    };
  }, [trip?.startDate, trip?.endDate, events, albumPhotos]);

  // Top 3 photos: prefer favorites + captioned, fall back to most recent.
  const topPhotos: AlbumPhoto[] = useMemo(() => {
    const ranked = [...albumPhotos].sort((a, b) => {
      const af = a.favorite ? 2 : 0;
      const bf = b.favorite ? 2 : 0;
      const ac = a.caption?.trim() ? 1 : 0;
      const bc = b.caption?.trim() ? 1 : 0;
      const ascore = af + ac;
      const bscore = bf + bc;
      if (ascore !== bscore) return bscore - ascore;
      const at = a.uploadedAt ? Date.parse(a.uploadedAt) : 0;
      const bt = b.uploadedAt ? Date.parse(b.uploadedAt) : 0;
      return bt - at;
    });
    return ranked.slice(0, 3);
  }, [albumPhotos]);

  // Diary text from the most memorable day — pick the longest entry.
  // Falls back to empty string, in which case we skip step 5 visually.
  const diaryText = useMemo(() => {
    if (diaryEntries.length === 0) return '';
    let best = diaryEntries[0];
    for (const e of diaryEntries) {
      if ((e.content?.length ?? 0) > (best.content?.length ?? 0)) {
        best = e;
      }
    }
    return (best.content || '').trim();
  }, [diaryEntries]);

  // Hero photo for the intro step — prefer the trip cover, fall back to the
  // first album photo. Used as a faded, zoomed backdrop.
  const heroPhoto =
    trip?.coverImage || albumPhotos[0]?.fullUrl || albumPhotos[0]?.url || null;

  // Cross-fade slideshow cursor for step 4.
  const [photoCursor, setPhotoCursor] = useState(0);
  useEffect(() => {
    if (stepIndex !== 3 || topPhotos.length <= 1) return;
    // 3 photos in 5s ≈ 1.6s per photo with a small overlap. Use 1500ms.
    const id = window.setInterval(() => {
      setPhotoCursor((c) => (c + 1) % topPhotos.length);
    }, 1500);
    return () => window.clearInterval(id);
  }, [stepIndex, topPhotos.length]);

  /* ─── Persist & exit ─────────────────────────────────── */

  const markShown = useCallback(async () => {
    if (marked || !trip) return;
    setMarked(true);
    try {
      await updateTrip({ ceremonyShownAt: new Date().toISOString() });
    } catch (err) {
      // Non-fatal: if the write fails the user will simply see the
      // ceremony again next time the recap loads. We don't want to
      // block their exit on a network hiccup.
      console.warn('[Ceremony] Failed to persist ceremonyShownAt', err);
    }
  }, [marked, trip, updateTrip]);

  // When the user reaches the final card, persist immediately so even if
  // they close the tab without clicking a button the field is set.
  useEffect(() => {
    if (stepIndex === 5) {
      void markShown();
    }
  }, [stepIndex, markShown]);

  const handleClose = useCallback(async () => {
    await markShown();
    router.push(`/trips/${tripId}/recap`);
  }, [markShown, router, tripId]);

  const handleOpenBook = useCallback(async () => {
    await markShown();
    router.push(`/trips/${tripId}/photos/book`);
  }, [markShown, router, tripId]);

  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const base = window.location.origin;
      const token = trip?.shareToken;
      const link = token
        ? `${base}/trips/${tripId}/recap?token=${token}`
        : `${base}/trips/${tripId}/recap`;
      await navigator.clipboard.writeText(link);
      toast('Link copiado', 'success');
    } catch {
      toast('No se pudo copiar el link', 'error');
    }
  }, [trip?.shareToken, tripId, toast]);

  /* ─── Step 2 counter ─────────────────────────────────── */
  // Run the count-up only while the days step is active.
  const daysShown = useCountUp(stats.totalDays, D_DAYS - 600, stepIndex === 1);

  /* ─── Render ─────────────────────────────────────────── */

  if (!trip) {
    return (
      <div className="fixed inset-0 z-[80] mode-memories flex items-center justify-center bg-[#1a0f08] text-amber-100/80 text-sm">
        Preparando la ceremonia…
      </div>
    );
  }

  // Stat formatting kept simple — large numbers use thousands separator.
  const fmt = (n: number) =>
    n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

  return (
    <div
      className="mode-memories fixed inset-0 z-[80] overflow-hidden"
      // The ceremony lives "over" the trip layout but inherits the
      // memories palette. The deep cocoa-on-gold gradient evokes a
      // theatre fade-out without crushing contrast on the white text.
      style={{
        background:
          'radial-gradient(circle at 30% 20%, #2a1608 0%, #1a0f08 45%, #0b0604 100%)',
      }}
    >
      {/* Persistent skip button — top-right. Always available. */}
      <button
        type="button"
        onClick={() => {
          void handleClose();
        }}
        aria-label="Cerrar ceremonia"
        className="absolute top-4 right-4 z-[90] w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Progress dots — gives the user a sense of how many beats are left. */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[85] flex items-center gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={
              'h-1.5 rounded-full transition-all duration-300 ' +
              (i === stepIndex
                ? 'w-6 bg-amber-300'
                : i < stepIndex
                  ? 'w-3 bg-amber-300/60'
                  : 'w-3 bg-white/15')
            }
          />
        ))}
      </div>

      {/* ─── Step 1: hero intro ─── */}
      <CeremonyStep
        active={stepIndex === 0}
        durationMs={D_INTRO}
        onComplete={() => setStepIndex(1)}
        background={
          heroPhoto ? (
            <motion.div
              key="hero-bg"
              initial={{ scale: 1.08, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.55 }}
              transition={{ duration: 4, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroPhoto}
                alt=""
                className="w-full h-full object-cover"
                style={{ filter: 'saturate(0.9) brightness(0.7)' }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at center, transparent 30%, rgba(11,6,4,0.85) 100%)',
                }}
              />
            </motion.div>
          ) : null
        }
      >
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.32em] text-amber-200/85 mb-5">
          Tu viaje a
        </p>
        <h1
          className="text-5xl sm:text-7xl font-black tracking-tight text-white leading-[1.05]"
          style={{
            fontFamily: 'var(--font-fraunces), Georgia, serif',
            letterSpacing: '-0.02em',
            textShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}
        >
          {trip.destination || trip.title}
        </h1>
      </CeremonyStep>

      {/* ─── Step 2: days counter ─── */}
      <CeremonyStep
        active={stepIndex === 1}
        durationMs={D_DAYS}
        onComplete={() => setStepIndex(2)}
      >
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.32em] text-amber-200/85 mb-4">
          Estuviste fuera
        </p>
        <div className="flex items-end justify-center gap-4">
          <motion.span
            className="text-[7rem] sm:text-[12rem] font-black tabular-nums leading-none text-white"
            style={{
              fontFamily: 'var(--font-fraunces), Georgia, serif',
              textShadow: '0 8px 40px rgba(200,144,42,0.35)',
            }}
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          >
            {daysShown}
          </motion.span>
          <span className="text-2xl sm:text-4xl text-amber-200/80 mb-3 sm:mb-6 font-light">
            {stats.totalDays === 1 ? 'día' : 'días'}
          </span>
        </div>
      </CeremonyStep>

      {/* ─── Step 3: stat triplet ─── */}
      <CeremonyStep
        active={stepIndex === 2}
        durationMs={D_STATS}
        onComplete={() => setStepIndex(3)}
      >
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.32em] text-amber-200/85 mb-8">
          En números
        </p>
        <div className="grid grid-cols-3 gap-6 sm:gap-12 max-w-2xl mx-auto">
          <StatTriplet
            value={fmt(stats.totalPhotos)}
            label={stats.totalPhotos === 1 ? 'foto' : 'fotos'}
            delay={0.05}
          />
          <StatTriplet
            value={fmt(stats.totalEvents)}
            label={stats.totalEvents === 1 ? 'evento' : 'eventos'}
            delay={0.25}
          />
          <StatTriplet
            value={fmt(Math.round(stats.kmTraveled))}
            label="km"
            delay={0.45}
          />
        </div>
      </CeremonyStep>

      {/* ─── Step 4: photo slideshow ─── */}
      <CeremonyStep
        active={stepIndex === 3}
        durationMs={D_PHOTOS}
        onComplete={() => setStepIndex(4)}
      >
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.32em] text-amber-200/85 mb-6">
          Momentos
        </p>
        <div className="relative w-full max-w-md mx-auto aspect-[4/5] rounded-3xl overflow-hidden border border-amber-200/15 shadow-[0_30px_60px_rgba(0,0,0,0.6)]">
          {topPhotos.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-amber-200/60 text-sm">
              Sin fotos todavía
            </div>
          )}
          <AnimatePresence mode="popLayout">
            {topPhotos.length > 0 && (
              <motion.div
                key={topPhotos[photoCursor]?.url ?? photoCursor}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className="absolute inset-0"
              >
                <Image
                  src={
                    topPhotos[photoCursor]?.fullUrl ||
                    topPhotos[photoCursor]?.url ||
                    ''
                  }
                  alt={topPhotos[photoCursor]?.caption || 'Foto del viaje'}
                  fill
                  sizes="(max-width: 640px) 90vw, 400px"
                  className="object-cover"
                  unoptimized
                  priority
                />
                {topPhotos[photoCursor]?.caption && (
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                    <p className="text-sm text-white/95 font-medium text-left">
                      {topPhotos[photoCursor]!.caption}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CeremonyStep>

      {/* ─── Step 5: diary text ─── */}
      <CeremonyStep
        active={stepIndex === 4}
        durationMs={D_DIARY}
        onComplete={() => setStepIndex(5)}
      >
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.32em] text-amber-200/85 mb-6">
          Tu día más memorable
        </p>
        {diaryText ? (
          <blockquote
            className="text-xl sm:text-3xl text-white/95 leading-snug max-w-2xl mx-auto"
            style={{
              fontFamily: 'var(--font-fraunces), Georgia, serif',
              fontStyle: 'italic',
              letterSpacing: '-0.01em',
            }}
          >
            <span className="text-amber-300/80 text-4xl sm:text-5xl leading-none align-top mr-1">
              “
            </span>
            {/* Truncate ultra-long entries so the screen still breathes. */}
            {diaryText.length > 320
              ? `${diaryText.slice(0, 320).trimEnd()}…`
              : diaryText}
            <span className="text-amber-300/80 text-4xl sm:text-5xl leading-none align-top ml-1">
              ”
            </span>
          </blockquote>
        ) : (
          <p className="text-base sm:text-lg text-amber-100/70 italic">
            Todavía no escribiste tu diario… pero la próxima vez, anotalo.
          </p>
        )}
      </CeremonyStep>

      {/* ─── Step 6: takeaway + CTAs ─── */}
      <CeremonyStep
        active={stepIndex === 5}
        // The final card waits indefinitely; the user picks an exit path.
        // Use a very long timer just so the contract holds; tap-to-close
        // is handled by the explicit buttons below.
        durationMs={10 * 60 * 1000}
        onComplete={() => void handleClose()}
      >
        <div
          // Stop the CeremonyStep tap-to-advance from firing when the user
          // clicks a button (otherwise the click bubbles up to the wrapper
          // and triggers handleClose immediately).
          onClick={(e) => e.stopPropagation()}
          className="cursor-default space-y-8"
        >
          <div className="space-y-3">
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.32em] text-amber-200/85">
              Para siempre
            </p>
            <h2
              className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight"
              style={{
                fontFamily: 'var(--font-fraunces), Georgia, serif',
                letterSpacing: '-0.02em',
              }}
            >
              Llevate este recuerdo
            </h2>
            <p className="text-sm sm:text-base text-amber-100/70 max-w-md mx-auto">
              Armá tu photobook, compartilo, y guardalo cuando quieras
              revivirlo.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void handleOpenBook()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 font-bold text-sm shadow-lg shadow-amber-500/30 transition-shadow min-w-[180px] justify-center"
            >
              <BookOpen className="w-4 h-4" />
              Ver photobook
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm transition-colors min-w-[180px] justify-center"
            >
              <Share2 className="w-4 h-4" />
              Compartir
            </button>
            <button
              type="button"
              onClick={() => void handleClose()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-transparent hover:bg-white/5 border border-white/15 text-white/85 font-semibold text-sm transition-colors min-w-[120px] justify-center"
            >
              Cerrar
            </button>
          </div>
        </div>
      </CeremonyStep>
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────── */

function StatTriplet({
  value,
  label,
  delay,
}: {
  value: string;
  label: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut', delay }}
      className="flex flex-col items-center"
    >
      <span
        className="text-4xl sm:text-6xl font-black tabular-nums text-white leading-none"
        style={{
          fontFamily: 'var(--font-fraunces), Georgia, serif',
          textShadow: '0 4px 18px rgba(200,144,42,0.25)',
        }}
      >
        {value}
      </span>
      <span className="mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80">
        {label}
      </span>
    </motion.div>
  );
}
