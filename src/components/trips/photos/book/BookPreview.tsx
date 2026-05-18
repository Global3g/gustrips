'use client';

import { useMemo } from 'react';
import type { Trip, TripEvent, AlbumPhoto } from '@/types';
import type { PhotoBookSize, PhotoBookStyle } from '@/lib/utils/exportPhotoBookPdf';

/* ─── Theme tokens (kept in sync with exportPhotoBookPdf themes) ────────── */

interface PreviewTheme {
  background: string;
  paper: string;
  ink: string;
  inkSoft: string;
  accent: string;
  titleFont: string;
  bodyFont: string;
  sepiaFilter: string;
  decorative: boolean;
}

function getPreviewTheme(style: PhotoBookStyle): PreviewTheme {
  switch (style) {
    case 'magazine':
      return {
        background: '#ffffff',
        paper: '#f8f8f8',
        ink: '#0f0f0f',
        inkSoft: '#5a5a5a',
        accent: '#e84150',
        titleFont: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        bodyFont: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        sepiaFilter: 'none',
        decorative: false,
      };
    case 'vintage':
      return {
        background: '#f5ebd7',
        paper: '#fcf4e0',
        ink: '#3c2814',
        inkSoft: '#785a3c',
        accent: '#965020',
        titleFont: '"Times New Roman", Times, serif',
        bodyFont: '"Times New Roman", Times, serif',
        sepiaFilter: 'sepia(0.6) contrast(0.95) saturate(0.85)',
        decorative: true,
      };
    case 'editorial':
    default:
      return {
        background: '#fdfaf6',
        paper: '#ffffff',
        ink: '#1e1e23',
        inkSoft: '#73737d',
        accent: '#b4643c',
        titleFont: '"Times New Roman", Times, serif',
        bodyFont: '"Times New Roman", Times, serif',
        sepiaFilter: 'none',
        decorative: true,
      };
  }
}

/* ─── Page shells (HTML facsimile of the PDF layout) ────────────────────── */

interface PageProps {
  theme: PreviewTheme;
  size: PhotoBookSize;
  label: string;
  children: React.ReactNode;
}

function PageShell({ theme, size, label, children }: PageProps) {
  // Match the aspect ratios from the PDF: A4 is 210:297, square is 1:1.
  const aspect = size === 'square' ? '1 / 1' : '210 / 297';
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative rounded-md overflow-hidden shadow-lg shadow-black/40 ring-1 ring-white/10"
        style={{
          width: '100%',
          maxWidth: size === 'square' ? '180px' : '160px',
          aspectRatio: aspect,
          background: theme.background,
          color: theme.ink,
          fontFamily: theme.bodyFont,
        }}
      >
        {children}
      </div>
      <span className="mt-2 text-[10px] uppercase tracking-wider text-white/45 font-semibold">
        {label}
      </span>
    </div>
  );
}

/* ─── Individual page facsimiles ────────────────────────────────────────── */

function CoverFacsimile({
  trip,
  hero,
  theme,
  size,
}: {
  trip: Trip;
  hero?: AlbumPhoto;
  theme: PreviewTheme;
  size: PhotoBookSize;
}) {
  return (
    <PageShell theme={theme} size={size} label="Portada">
      <div
        className="absolute inset-0 flex flex-col"
        style={{ padding: '8px' }}
      >
        <div
          className="text-center text-[7px] font-bold tracking-wider"
          style={{ color: theme.accent }}
        >
          PHOTO BOOK
        </div>
        {theme.decorative && (
          <div className="flex justify-center gap-0.5 mt-0.5">
            <span className="block w-0.5 h-0.5 rounded-full" style={{ background: theme.accent }} />
            <span className="block w-1 h-1 rounded-full" style={{ background: theme.accent }} />
            <span className="block w-0.5 h-0.5 rounded-full" style={{ background: theme.accent }} />
          </div>
        )}
        <div
          className="mt-2 flex-1 rounded-sm overflow-hidden"
          style={{ background: theme.paper, filter: theme.sepiaFilter }}
        >
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero.url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
        <div className="mt-2 text-center">
          <div
            className="font-bold leading-tight truncate"
            style={{
              fontFamily: theme.titleFont,
              color: theme.ink,
              fontSize: size === 'square' ? '11px' : '12px',
            }}
            title={trip.title}
          >
            {trip.title}
          </div>
          <div
            className="text-[7px] mt-0.5"
            style={{ color: theme.inkSoft }}
          >
            {trip.destination || ''}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function IntroFacsimile({
  trip,
  theme,
  size,
  stats,
}: {
  trip: Trip;
  theme: PreviewTheme;
  size: PhotoBookSize;
  stats: { photos: number; cities: number };
}) {
  return (
    <PageShell theme={theme} size={size} label="Intro">
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        {theme.decorative && (
          <div
            className="w-full border-t opacity-50 mb-3"
            style={{ borderColor: theme.inkSoft }}
          />
        )}
        <div
          className="italic text-[9px]"
          style={{ color: theme.accent, fontFamily: theme.titleFont }}
        >
          Una historia
        </div>
        <div
          className="mt-2 text-[7px] leading-snug"
          style={{ color: theme.ink }}
        >
          {`Un viaje${trip.destination ? ` a ${trip.destination}` : ''} con ${stats.photos} ${
            stats.photos === 1 ? 'foto' : 'fotos'
          }${stats.cities > 0 ? `, ${stats.cities} ${stats.cities === 1 ? 'ciudad' : 'ciudades'}` : ''}.`}
        </div>
        {theme.decorative && (
          <div
            className="w-full border-t opacity-50 mt-3"
            style={{ borderColor: theme.inkSoft }}
          />
        )}
      </div>
    </PageShell>
  );
}

function SpreadFacsimile({
  event,
  photos,
  theme,
  size,
  index,
}: {
  event: TripEvent;
  photos: AlbumPhoto[];
  theme: PreviewTheme;
  size: PhotoBookSize;
  index: number;
}) {
  const hero = photos[0];
  const thumbs = photos.slice(1, 4);
  return (
    <PageShell theme={theme} size={size} label={`Día ${index + 1}`}>
      <div className="absolute inset-0 flex flex-col p-2">
        <div
          className="text-[6px] font-bold uppercase tracking-wider"
          style={{ color: theme.accent }}
        >
          {(event.city || event.location?.split(',')[0] || '').slice(0, 24)}
        </div>
        <div
          className="font-bold leading-tight truncate mt-0.5"
          style={{
            fontFamily: theme.titleFont,
            color: theme.ink,
            fontSize: '9px',
          }}
          title={event.title}
        >
          {event.title}
        </div>
        <div
          className="flex-1 mt-1.5 rounded-sm overflow-hidden"
          style={{ background: theme.paper, filter: theme.sepiaFilter }}
        >
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero.url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
        {thumbs.length > 0 && (
          <div className="mt-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${thumbs.length}, minmax(0,1fr))` }}>
            {thumbs.map((p, i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-sm overflow-hidden"
                style={{ background: theme.paper, filter: theme.sepiaFilter }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ClosingFacsimile({
  theme,
  size,
  stats,
}: {
  theme: PreviewTheme;
  size: PhotoBookSize;
  stats: { photos: number; cities: number; days: number };
}) {
  return (
    <PageShell theme={theme} size={size} label="Cierre">
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <div
          className="font-bold"
          style={{
            fontFamily: theme.titleFont,
            color: theme.ink,
            fontSize: '10px',
          }}
        >
          El viaje en números
        </div>
        <div className="mt-2 space-y-1 text-[8px]" style={{ color: theme.inkSoft }}>
          <div>Ciudades: {stats.cities}</div>
          <div>Fotos: {stats.photos}</div>
          <div>Días: {stats.days}</div>
        </div>
        <div
          className="mt-3 italic text-[8px]"
          style={{ color: theme.accent, fontFamily: theme.titleFont }}
        >
          Cada foto, un instante guardado.
        </div>
      </div>
    </PageShell>
  );
}

/* ─── Public component ─────────────────────────────────────────────────── */

interface BookPreviewProps {
  trip: Trip;
  events: TripEvent[];
  albumPhotos: AlbumPhoto[];
  size: PhotoBookSize;
  style: PhotoBookStyle;
}

export default function BookPreview({
  trip,
  events,
  albumPhotos,
  size,
  style,
}: BookPreviewProps) {
  const theme = getPreviewTheme(style);

  const groups = useMemo(() => {
    const linked: { event: TripEvent; photos: AlbumPhoto[] }[] = [];
    const sortedEvents = [...events].sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
    for (const ev of sortedEvents) {
      const evPhotos = albumPhotos.filter((p) => p.eventId === ev.id);
      if (evPhotos.length > 0) linked.push({ event: ev, photos: evPhotos });
    }
    return linked;
  }, [events, albumPhotos]);

  const stats = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      const head = (ev.city || ev.location?.split(',')[0] || '').trim().toLowerCase();
      if (head) set.add(head);
    }
    let days = 0;
    if (trip.startDate && trip.endDate) {
      const startMs = Date.parse(trip.startDate);
      const endMs = Date.parse(trip.endDate);
      if (!isNaN(startMs) && !isNaN(endMs)) {
        days = Math.max(0, Math.round((endMs - startMs) / 86400000)) + 1;
      }
    }
    return { cities: set.size, photos: albumPhotos.length, days };
  }, [trip.startDate, trip.endDate, events, albumPhotos.length]);

  // Only render the first handful of spreads so the preview stays responsive
  // even on trips with dozens of events. The PDF still gets all of them.
  const spreadsToShow = groups.slice(0, 4);
  const totalPages = 2 + groups.length + 1; // cover, intro, spreads, closing (map skipped in preview count)

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <CoverFacsimile trip={trip} hero={albumPhotos[0]} theme={theme} size={size} />
        <IntroFacsimile trip={trip} theme={theme} size={size} stats={stats} />
        {spreadsToShow.map((g, i) => (
          <SpreadFacsimile
            key={g.event.id}
            event={g.event}
            photos={g.photos}
            theme={theme}
            size={size}
            index={i}
          />
        ))}
        <ClosingFacsimile theme={theme} size={size} stats={stats} />
      </div>
      {groups.length > spreadsToShow.length && (
        <p className="mt-3 text-[11px] text-white/45 text-center">
          + {groups.length - spreadsToShow.length} páginas más en el PDF.
        </p>
      )}
      <p className="mt-2 text-[11px] text-white/40 text-center">
        Total aproximado: {totalPages} {totalPages === 1 ? 'página' : 'páginas'}.
      </p>
    </div>
  );
}
