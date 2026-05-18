'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Download,
  Loader2,
  BookOpen,
  ShoppingBag,
} from 'lucide-react';
import { useTrip } from '@/hooks/useTrip';
import { useAlbum } from '@/hooks/useAlbum';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/context/ToastContext';
import type {
  PhotoBookSize,
  PhotoBookStyle,
} from '@/lib/utils/exportPhotoBookPdf';

// The preview is pure HTML/CSS, but lazy-loading it keeps the route shell
// tiny and avoids paying for it on first contentful paint.
const BookPreview = dynamic(
  () => import('@/components/trips/photos/book/BookPreview'),
  { ssr: false, loading: () => null },
);
const StyleSelector = dynamic(
  () => import('@/components/trips/photos/book/StyleSelector'),
  { ssr: false, loading: () => null },
);

const SIZE_OPTIONS: { id: PhotoBookSize; label: string; sub: string }[] = [
  { id: 'a4', label: 'A4', sub: '210 × 297 mm' },
  { id: 'square', label: 'Cuadrado', sub: '200 × 200 mm' },
];

export default function PhotoBookPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { trip } = useTrip(tripId);
  const { events } = useEvents(tripId);
  const { albumPhotos } = useAlbum(tripId, trip);
  const { toast } = useToast();

  const [size, setSize] = useState<PhotoBookSize>('a4');
  const [style, setStyle] = useState<PhotoBookStyle>('editorial');
  const [isExporting, setIsExporting] = useState(false);

  /* Trip is required before any UI makes sense. */
  const isReady = !!trip;

  /* Pre-compute whether there's enough content to make a meaningful book. */
  const hasContent = useMemo(() => {
    if (!trip) return false;
    const linkedPhotos = albumPhotos.filter((p) =>
      events.some((e) => e.id === p.eventId),
    );
    return linkedPhotos.length > 0 || albumPhotos.length > 0;
  }, [trip, albumPhotos, events]);

  const handleExport = async () => {
    if (!trip) return;
    setIsExporting(true);
    try {
      const { exportAndDownloadPhotoBookPdf } = await import(
        '@/lib/utils/exportPhotoBookPdf'
      );
      await exportAndDownloadPhotoBookPdf({
        trip,
        albumPhotos,
        events,
        options: { size, style },
      });
      toast('Photo book descargado', 'success');
    } catch (err) {
      console.error('Photo book export failed:', err);
      toast('Error al generar el photo book', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isReady) {
    return <div className="p-6 text-white/70 text-sm">Cargando…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-16">
      {/* Dark glass stage — the trip layout uses a light pastel background;
          without this wrapper the white-on-white controls are invisible. */}
      <div
        className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30 p-5 sm:p-7 space-y-6"
        style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
      >
      {/* ─── Top bar ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => router.push(`/trips/${tripId}/photos`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/85 hover:text-white text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a fotos
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || !hasContent}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-zinc-900 font-bold text-sm shadow-lg shadow-amber-500/20 transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isExporting ? 'Generando…' : 'Descargar PDF'}
        </button>
      </div>

      {/* ─── Header ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] shadow-xl shadow-black/30 bg-gradient-to-br from-[#0d1b2e] via-[#1e3a5f] to-[#28406a] p-5 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-300 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-zinc-900" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/80">
              Photo Book
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black text-white leading-tight">
              {trip.title}
            </h1>
            <p className="mt-1 text-sm text-white/65">
              Armá un libro PDF con las fotos del viaje y elegí el estilo.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Options ─── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Size selector */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-3">
            Tamaño
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {SIZE_OPTIONS.map((opt) => {
              const active = opt.id === size;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSize(opt.id)}
                  className={
                    'p-3 rounded-xl border text-left transition-colors ' +
                    (active
                      ? 'bg-gradient-to-br from-amber-400/20 to-rose-500/15 border-amber-300/50 ring-1 ring-amber-300/40'
                      : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07]')
                  }
                >
                  <div
                    className={
                      'text-sm font-semibold ' +
                      (active ? 'text-white' : 'text-white/90')
                    }
                  >
                    {opt.label}
                  </div>
                  <div className="text-[11px] text-white/55 mt-0.5">{opt.sub}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Style selector */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-3">
            Estilo
          </h2>
          <StyleSelector value={style} onChange={setStyle} />
        </section>
      </div>

      {/* ─── Preview ─── */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/70">
            Vista previa
          </h2>
          <span className="text-[11px] text-white/40">
            Aproximada. El PDF final usa fotos en alta resolución.
          </span>
        </div>

        {hasContent ? (
          <BookPreview
            trip={trip}
            events={events}
            albumPhotos={albumPhotos}
            size={size}
            style={style}
          />
        ) : (
          <div className="text-center py-12 text-white/55 text-sm">
            Agregá fotos al viaje para poder armar un photo book.
          </div>
        )}
      </section>

      {/* ─── Print-on-demand teaser (no real backend yet) ─── */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-transparent p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-amber-200" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200/80">
              Próximamente
            </p>
            <p className="mt-1 text-sm text-white font-semibold">
              Pedí tu libro impreso de tapa dura
            </p>
            <p className="mt-1 text-[13px] text-white/65">
              Recibí en tu casa una versión física en papel mate de calidad,
              tapa dura, encuadernado profesional.{' '}
              <span className="text-amber-200 font-semibold">
                Desde $40 USD
              </span>
              . Avisanos si te interesa para sumarte a la lista de espera.
            </p>
            <button
              type="button"
              disabled
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 text-xs font-semibold cursor-not-allowed"
            >
              Próximamente
            </button>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
