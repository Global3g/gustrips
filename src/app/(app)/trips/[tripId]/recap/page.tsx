'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Wallet,
  Camera,
  Trophy,
  Calendar,
  Share2,
  Download,
  ArrowRight,
  Users,
  Coins,
  Loader2,
} from 'lucide-react';
import { differenceInDays, parseISO, isAfter } from 'date-fns';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useExpenses } from '@/hooks/useExpenses';
import { useAlbum } from '@/hooks/useAlbum';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { useMembers } from '@/hooks/useMembers';
import { useChecklist } from '@/hooks/useChecklist';
import { useToast } from '@/context/ToastContext';
import { EVENT_TYPES, ROUTES, DEFAULT_CURRENCY } from '@/config/constants';
import {
  classNames,
  formatCurrency,
  formatDateES,
  getInitials,
} from '@/lib/utils/helpers';
import { exportRecapPdf } from '@/lib/utils/exportRecapPdf';
import Particles from '@/components/ui/Particles';
import type { TripEvent, ExpenseCategory, AlbumPhoto } from '@/types';

/* ─── Helpers ──────────────────────────────────────── */

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

function cityFromEvent(ev: TripEvent): string {
  const explicit = ev.city?.trim();
  if (explicit) return explicit.toLowerCase();
  const head = ev.location?.split(',')[0]?.trim();
  return head ? head.toLowerCase() : '';
}

/* ─── Component ────────────────────────────────────── */

export default function TripRecapPage() {
  const params = useParams();
  const tripId = params.tripId as string;

  const { trip } = useTrip(tripId);
  const { events } = useEvents(tripId);
  const { expenses } = useExpenses(tripId);
  const { albumPhotos } = useAlbum(tripId, trip);
  const { travelers: globalTravelers } = useGlobalTravelers();
  const { members } = useMembers(tripId);
  // Checklist hook is invoked for parity with previous export plumbing; not used by the recap PDF.
  useChecklist(tripId);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const baseCurrency = trip?.budgetCurrency || DEFAULT_CURRENCY;
  const { convert } = useExchangeRates(baseCurrency);

  /* ─── Stats ─────────────────────────────────────── */

  const stats = useMemo(() => {
    if (!trip) {
      return {
        totalDays: 0,
        totalEvents: 0,
        totalPhotos: 0,
        totalSpent: 0,
        totalSavings: 0,
        daysVisited: 0,
        cities: 0,
        kmTraveled: 0,
        peakDay: null as { date: string; total: number } | null,
        topCategory: null as { category: ExpenseCategory; total: number } | null,
        topEvent: null as TripEvent | null,
        daysActive: 0,
        pacePercent: 0,
        topPhotos: [] as AlbumPhoto[],
      };
    }

    let totalDays = 0;
    try {
      totalDays =
        Math.max(
          0,
          differenceInDays(parseISO(trip.endDate), parseISO(trip.startDate)),
        ) + 1;
    } catch {
      totalDays = 0;
    }

    const totalEvents = events.length;

    // Photos: album + event.photos[] urls not in albumPhotos
    const albumUrls = new Set(albumPhotos.map((p) => p.url));
    let extraEventPhotos = 0;
    for (const ev of events) {
      const evPhotos = ev.photos ?? [];
      for (const url of evPhotos) {
        if (!albumUrls.has(url)) extraEventPhotos += 1;
      }
    }
    const totalPhotos = albumPhotos.length + extraEventPhotos;

    // Spending — exclude points; convert to base currency
    let totalSpent = 0;
    let totalSavings = 0;
    for (const exp of expenses) {
      if (exp.paymentMethod === 'points') {
        if (exp.equivalentValue && exp.equivalentValue > 0) {
          const fromCurrency = exp.realValueCurrency || exp.currency || baseCurrency;
          totalSavings += convert(exp.equivalentValue, fromCurrency, baseCurrency);
        }
      } else {
        totalSpent += convert(exp.amount, exp.currency || baseCurrency, baseCurrency);
      }
    }

    // Unique trip dates that have at least one event
    const datesWithEvents = new Set<string>();
    for (const ev of events) {
      if (ev.date) datesWithEvents.add(ev.date);
    }
    const daysVisited = datesWithEvents.size;

    // Unique cities
    const citySet = new Set<string>();
    for (const ev of events) {
      const city = cityFromEvent(ev);
      if (city) citySet.add(city);
    }
    const cities = citySet.size;

    // km — sum haversine across consecutive events with lat/lng (ordered by date+time)
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

    // Peak day — highest planned cost sum (events.cost)
    const dayCostMap = new Map<string, number>();
    for (const ev of events) {
      if (!ev.date) continue;
      const cost = typeof ev.cost === 'number' && ev.cost > 0 ? ev.cost : 0;
      if (cost <= 0) continue;
      const conv = convert(cost, ev.currency || baseCurrency, baseCurrency);
      dayCostMap.set(ev.date, (dayCostMap.get(ev.date) ?? 0) + conv);
    }
    let peakDay: { date: string; total: number } | null = null;
    for (const [date, total] of dayCostMap.entries()) {
      if (!peakDay || total > peakDay.total) peakDay = { date, total };
    }

    // Top expense category
    const categoryMap = new Map<ExpenseCategory, number>();
    for (const exp of expenses) {
      if (exp.paymentMethod === 'points') continue;
      const cat = exp.category ?? 'misc';
      const conv = convert(exp.amount, exp.currency || baseCurrency, baseCurrency);
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + conv);
    }
    let topCategory: { category: ExpenseCategory; total: number } | null = null;
    for (const [category, total] of categoryMap.entries()) {
      if (!topCategory || total > topCategory.total) topCategory = { category, total };
    }

    // Top event — most photos linked, fallback to highest cost
    let topEvent: TripEvent | null = null;
    let topEventPhotoCount = 0;
    for (const ev of events) {
      const linked = albumPhotos.filter((p) => p.eventId === ev.id).length;
      const own = ev.photos?.length ?? 0;
      const total = linked + own;
      if (total > topEventPhotoCount) {
        topEventPhotoCount = total;
        topEvent = ev;
      }
    }
    if (!topEvent) {
      let maxCost = -1;
      for (const ev of events) {
        const c = typeof ev.cost === 'number' ? ev.cost : 0;
        if (c > maxCost) {
          maxCost = c;
          topEvent = ev;
        }
      }
    }

    // Days active — start until min(today, endDate)
    let daysActive = 0;
    try {
      const start = parseISO(trip.startDate);
      const end = parseISO(trip.endDate);
      const today = new Date();
      const cap = isAfter(today, end) ? end : today;
      daysActive = Math.max(0, differenceInDays(cap, start)) + (isAfter(cap, start) || cap.getTime() === start.getTime() ? 1 : 0);
      if (daysActive > totalDays) daysActive = totalDays;
      if (daysActive < 0) daysActive = 0;
    } catch {
      daysActive = 0;
    }

    const planned = trip.budget && trip.budget > 0 ? trip.budget : 0;
    const pacePercent = planned > 0 ? (totalSpent / planned) * 100 : 0;

    // Top photos — caption first, then most recent uploadedAt
    const topPhotos = [...albumPhotos]
      .sort((a, b) => {
        const ac = a.caption && a.caption.trim().length > 0 ? 1 : 0;
        const bc = b.caption && b.caption.trim().length > 0 ? 1 : 0;
        if (ac !== bc) return bc - ac;
        const at = a.uploadedAt ? Date.parse(a.uploadedAt) : 0;
        const bt = b.uploadedAt ? Date.parse(b.uploadedAt) : 0;
        return bt - at;
      })
      .slice(0, 9);

    return {
      totalDays,
      totalEvents,
      totalPhotos,
      totalSpent,
      totalSavings,
      daysVisited,
      cities,
      kmTraveled,
      peakDay,
      topCategory,
      topEvent,
      daysActive,
      pacePercent,
      topPhotos,
    };
  }, [trip, events, expenses, albumPhotos, baseCurrency, convert]);

  /* ─── Trip travelers (resolve names) ─────────────── */

  const tripTravelerNames = useMemo(() => {
    if (!trip?.travelerIds) return [] as { id: string; name: string; color?: string }[];
    return trip.travelerIds.map((id) => {
      const t = globalTravelers.find((g) => g.id === id);
      return {
        id,
        name: t?.fullName || 'Viajero',
        color: t?.avatarColor,
      };
    });
  }, [trip?.travelerIds, globalTravelers]);

  /* ─── Actions ────────────────────────────────────── */

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    try {
      const token = trip?.shareToken;
      const base = window.location.origin;
      const link = token
        ? `${base}/trips/${tripId}/recap?token=${token}`
        : `${base}/trips/${tripId}/recap`;
      await navigator.clipboard.writeText(link);
      toast('Link copiado', 'success');
    } catch {
      toast('No se pudo copiar el link', 'error');
    }
  };

  const handleDownloadPdf = async () => {
    if (!trip || isExporting) return;
    setIsExporting(true);
    try {
      const topEventForExport = stats.topEvent
        ? (() => {
            const linked = albumPhotos.filter(
              (p) => p.eventId === stats.topEvent!.id,
            ).length;
            const own = stats.topEvent.photos?.length ?? 0;
            return {
              id: stats.topEvent.id,
              title: stats.topEvent.title,
              cost: stats.topEvent.cost,
              photoCount: linked + own,
            };
          })()
        : undefined;

      const topCategoryForExport = stats.topCategory
        ? {
            type: stats.topCategory.category,
            label:
              EVENT_TYPES[stats.topCategory.category]?.label ||
              stats.topCategory.category,
            total: stats.topCategory.total,
          }
        : undefined;

      await exportRecapPdf({
        trip,
        events,
        expenses,
        albumPhotos,
        members,
        travelers: globalTravelers,
        baseCurrency,
        totalSpent: stats.totalSpent,
        totalSavings: stats.totalSavings,
        pacePercent: stats.pacePercent,
        cities: stats.cities,
        kmTraveled: stats.kmTraveled,
        daysVisited: stats.daysVisited,
        topPhotos: stats.topPhotos,
        peakDayDate: stats.peakDay?.date,
        peakDaySpent: stats.peakDay?.total,
        topCategory: topCategoryForExport,
        topEvent: topEventForExport,
      });
      toast('PDF descargado', 'success');
    } catch {
      toast('Error al generar PDF', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  /* ─── Render ─────────────────────────────────────── */

  if (!trip) {
    return (
      <div className="p-6 text-white/70 text-sm">Cargando recap...</div>
    );
  }

  const subtitleParts: string[] = [];
  if (trip.destination) subtitleParts.push(trip.destination);
  if (trip.startDate && trip.endDate) {
    subtitleParts.push(
      `${formatDateES(trip.startDate)} — ${formatDateES(trip.endDate)}`,
    );
  }
  if (stats.totalDays > 0) {
    subtitleParts.push(`${stats.totalDays} ${stats.totalDays === 1 ? 'día' : 'días'}`);
  }

  const showSavings = stats.totalSavings > 0;

  return (
    <div className="p-3 sm:p-6 pb-32">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30"
        style={{
          background:
            'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)',
        }}
      >
        {/* Particles + ambient orbs */}
        <div className="absolute inset-0 opacity-50 pointer-events-none">
          <Particles count={32} />
        </div>
        <motion.div
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full blur-[80px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%)' }}
          animate={{ x: [0, 24, -16, 0], y: [0, 18, -8, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 -right-28 w-96 h-96 rounded-full blur-[90px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }}
          animate={{ x: [0, -22, 12, 0], y: [0, -14, 10, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full blur-[80px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14), transparent 70%)' }}
          animate={{ x: [0, 18, -12, 0], y: [0, -16, 8, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="relative z-10 p-5 sm:p-10 space-y-8">
          {/* ─── Hero ─────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                Tu viaje en
              </span>
            </div>
            <h1
              className="text-4xl sm:text-5xl font-black tracking-tight bg-clip-text text-transparent leading-tight"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #ffffff 0%, #cfe1ff 60%, #93c5fd 100%)',
                filter: 'drop-shadow(0 4px 24px rgba(147,197,253,0.25))',
              }}
            >
              {trip.title}
            </h1>
            {subtitleParts.length > 0 && (
              <p className="mt-4 text-sm sm:text-base text-white/70 font-medium">
                {subtitleParts.join(' · ')}
              </p>
            )}
          </motion.section>

          {/* ─── Big stat cards ────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className={classNames(
              'grid gap-3 sm:gap-4',
              showSavings ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2',
            )}
          >
            {/* Total gastado */}
            <StatCard
              icon={<Wallet className="w-5 h-5" />}
              accent="from-emerald-400 to-emerald-500"
              label="Total gastado"
              value={formatCurrency(stats.totalSpent, baseCurrency)}
              sub={
                trip.budget && trip.budget > 0
                  ? `${stats.pacePercent.toFixed(0)}% del presupuesto`
                  : 'sin presupuesto'
              }
            />
            {/* Eventos */}
            <StatCard
              icon={<Calendar className="w-5 h-5" />}
              accent="from-blue-400 to-blue-500"
              label="Eventos"
              value={stats.totalEvents.toString()}
              sub={`${stats.cities} ${stats.cities === 1 ? 'ciudad' : 'ciudades'} · ${stats.kmTraveled.toFixed(0)} km`}
            />
            {/* Fotos */}
            <StatCard
              icon={<Camera className="w-5 h-5" />}
              accent="from-amber-400 to-amber-500"
              label="Fotos"
              value={stats.totalPhotos.toString()}
              sub={`${stats.daysVisited} ${stats.daysVisited === 1 ? 'día documentado' : 'días documentados'}`}
            />
            {/* Ahorrado con puntos */}
            {showSavings && (
              <StatCard
                icon={<Coins className="w-5 h-5" />}
                accent="from-fuchsia-400 to-pink-500"
                label="Ahorrado con puntos"
                value={formatCurrency(stats.totalSavings, baseCurrency)}
                sub="Valor equivalente"
              />
            )}
          </motion.section>

          {/* ─── Top moments ───────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="space-y-2.5"
          >
            <SectionTitle icon={<Trophy className="w-4 h-4" />} text="Momentos top" />
            <div className="space-y-2">
              {stats.topCategory && (
                <MomentRow
                  iconBg="bg-orange-500/20 text-orange-300"
                  icon={<Trophy className="w-4 h-4" />}
                  title="Top categoría"
                  subtitle={EVENT_TYPES[stats.topCategory.category]?.label || stats.topCategory.category}
                  stat={formatCurrency(stats.topCategory.total, baseCurrency)}
                />
              )}
              {stats.peakDay && (
                <MomentRow
                  iconBg="bg-rose-500/20 text-rose-300"
                  icon={<Calendar className="w-4 h-4" />}
                  title="Día más caro"
                  subtitle={formatDateES(stats.peakDay.date)}
                  stat={formatCurrency(stats.peakDay.total, baseCurrency)}
                />
              )}
              {stats.topEvent && (
                <MomentRow
                  iconBg="bg-amber-500/20 text-amber-300"
                  icon={<Sparkles className="w-4 h-4" />}
                  title="Evento estrella"
                  subtitle={stats.topEvent.title}
                  stat={(() => {
                    const linked = albumPhotos.filter(
                      (p) => p.eventId === stats.topEvent!.id,
                    ).length;
                    const own = stats.topEvent.photos?.length ?? 0;
                    const total = linked + own;
                    if (total > 0) return `${total} ${total === 1 ? 'foto' : 'fotos'}`;
                    if (stats.topEvent.cost > 0) {
                      return formatCurrency(
                        stats.topEvent.cost,
                        stats.topEvent.currency || baseCurrency,
                      );
                    }
                    return '';
                  })()}
                />
              )}
              {!stats.topCategory && !stats.peakDay && !stats.topEvent && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center text-white/60 text-sm">
                  Aún no hay suficientes datos para destacar momentos.
                </div>
              )}
            </div>
          </motion.section>

          {/* ─── Photo highlights ───────────────────────── */}
          {stats.topPhotos.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="space-y-3"
            >
              <SectionTitle icon={<Camera className="w-4 h-4" />} text="Mejores fotos" />
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {stats.topPhotos.map((photo, i) => (
                  <Link
                    key={photo.url + i}
                    href={`/trips/${tripId}/photos`}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]"
                  >
                    <Image
                      src={photo.url}
                      alt={photo.caption || 'Foto del viaje'}
                      fill
                      sizes="(max-width: 640px) 33vw, 200px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      unoptimized
                    />
                    {photo.caption && (
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white font-medium line-clamp-2">
                          {photo.caption}
                        </p>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </motion.section>
          )}

          {/* ─── Travelers ─────────────────────────────── */}
          {tripTravelerNames.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="space-y-3"
            >
              <SectionTitle icon={<Users className="w-4 h-4" />} text="Viajeros" />
              <div className="flex flex-wrap gap-2">
                {tripTravelerNames.map((t) => (
                  <div
                    key={t.id}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm px-3 py-1.5"
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: t.color || '#6366f1' }}
                    >
                      {getInitials(t.name)}
                    </span>
                    <span className="text-[13px] text-white/90 font-medium">
                      {t.name}
                    </span>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* ─── Sticky-ish footer actions ─────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="pt-2"
          >
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3 flex flex-wrap items-center gap-2 justify-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-sm font-semibold text-white transition-colors"
                >
                  <Share2 className="w-4 h-4 text-amber-300" />
                  Compartir recap
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={isExporting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-amber-300" />
                  )}
                  {isExporting ? 'Generando PDF...' : 'Descargar PDF'}
                </button>
              </div>
              <Link
                href={ROUTES.app.itinerary(tripId)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/20 text-sm font-semibold text-amber-200 transition-colors"
              >
                Ver itinerario completo
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Subcomponents ────────────────────────────────── */

function StatCard({
  icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-5 overflow-hidden">
      <div
        className={classNames(
          'absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-30 bg-gradient-to-br',
          accent,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
            {label}
          </p>
          <p className="text-3xl font-black tabular-nums text-white">{value}</p>
          <p className="text-[12px] text-white/65">{sub}</p>
        </div>
        <div
          className={classNames(
            'w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br',
            accent,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function MomentRow({
  iconBg,
  icon,
  title,
  subtitle,
  stat,
}: {
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  stat: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 flex items-center gap-3">
      <div
        className={classNames(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          iconBg,
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
          {title}
        </p>
        <p className="text-[14px] font-semibold text-white truncate">
          {subtitle}
        </p>
      </div>
      {stat && (
        <p className="text-[14px] font-black tabular-nums text-white/95 whitespace-nowrap">
          {stat}
        </p>
      )}
    </div>
  );
}

function SectionTitle({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-amber-300">{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
        {text}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
    </div>
  );
}
