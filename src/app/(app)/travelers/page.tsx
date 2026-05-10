'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Phone,
  Plane,
  AlertTriangle,
  Search,
  Cake,
  CalendarDays,
  Copy,
  Check,
  X,
  Heart,
  IdCard,
  Stamp,
  ShieldAlert,
  ChevronDown,
  Eye,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { format, parseISO, differenceInDays, differenceInYears, addYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useTrips } from '@/hooks/useTrips';
import { useToast } from '@/context/ToastContext';
import GlobalTravelerForm from '@/components/travelers/GlobalTravelerForm';
import { classNames, getInitials } from '@/lib/utils/helpers';
import type { GlobalTraveler, Trip } from '@/types';

/* ─── Doc status helpers ─── */

type DocStatus = 'valid' | 'warning' | 'expired' | 'none';

/**
 * Many countries reject a passport with under 6 months of remaining validity
 * on the day of travel. We surface the warning at 7 months so there's a
 * full month to act before that threshold becomes a problem mid-trip.
 */
const PASSPORT_WARNING_DAYS = 210; // ~7 months

function getDocStatus(expiry?: string): DocStatus {
  if (!expiry) return 'none';
  try {
    const expiryDate = parseISO(expiry);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (expiryDate < now) return 'expired';
    const days = differenceInDays(expiryDate, now);
    if (days <= PASSPORT_WARNING_DAYS) return 'warning';
    return 'valid';
  } catch {
    return 'none';
  }
}

function daysUntilExpiry(expiry?: string): number | null {
  if (!expiry) return null;
  try {
    const d = parseISO(expiry);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return differenceInDays(d, now);
  } catch {
    return null;
  }
}

function expiryCountdownLabel(expiry?: string): string | null {
  const days = daysUntilExpiry(expiry);
  if (days === null) return null;
  if (days < 0) return `Venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Vence hoy';
  if (days < 60) return `Quedan ${days} día${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  return `Quedan ~${months} mes${months === 1 ? '' : 'es'} (${days}d)`;
}

const STATUS_THEME: Record<DocStatus, { dot: string; text: string; bg: string; border: string; label: string }> = {
  valid: { dot: 'bg-emerald-400', text: 'text-emerald-200', bg: 'bg-emerald-500/10', border: 'border-emerald-300/30', label: 'Vigente' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-200', bg: 'bg-amber-500/10', border: 'border-amber-300/30', label: 'Por vencer' },
  expired: { dot: 'bg-rose-400', text: 'text-rose-200', bg: 'bg-rose-500/10', border: 'border-rose-300/30', label: 'Vencido' },
  none: { dot: 'bg-white/25', text: 'text-white/40', bg: 'bg-white/[0.04]', border: 'border-white/[0.08]', label: 'Sin registrar' },
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  yo: 'Yo',
  esposa: 'Esposa',
  esposo: 'Esposo',
  hijo: 'Hijo/a',
  padre: 'Padre',
  madre: 'Madre',
  hermano: 'Hermano/a',
  amigo: 'Amigo/a',
  otro: 'Otro',
};

const FAMILY_RELATIONS = new Set(['yo', 'esposa', 'esposo', 'hijo', 'padre', 'madre', 'hermano']);

/* ─── Date helpers ─── */

function formatLongDate(iso?: string): string | null {
  if (!iso) return null;
  try {
    return format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

function nextBirthday(dob?: string): { date: Date; daysAway: number; turning: number } | null {
  if (!dob) return null;
  try {
    const birth = parseISO(dob);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (next < today) next = addYears(next, 1);
    const daysAway = differenceInDays(next, today);
    const turning = differenceInYears(next, birth);
    return { date: next, daysAway, turning };
  } catch {
    return null;
  }
}

function age(dob?: string): number | null {
  if (!dob) return null;
  try {
    return differenceInYears(new Date(), parseISO(dob));
  } catch {
    return null;
  }
}

/* ─── CopyField: label + value + copy icon ─── */

interface CopyFieldProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** Mono-spaced for IDs/numbers */
  mono?: boolean;
}

function CopyField({ icon: Icon, label, value, mono }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Fallback for non-secure contexts
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      } catch {
        // Give up silently — clipboard simply isn't available.
      }
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group/copy w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition px-3 py-2 flex items-center gap-2.5"
      title={`Copiar ${label}`}
    >
      {Icon && (
        <span className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-white/55" />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[10px] uppercase tracking-[0.16em] font-bold text-white/40 leading-none">
          {label}
        </span>
        <span
          className={classNames(
            'block mt-1 text-sm text-white/90 truncate',
            mono ? 'font-mono tracking-wider' : 'font-medium',
          )}
        >
          {value}
        </span>
      </span>
      <span className="flex-shrink-0">
        {copied ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300">
            <Check className="w-3.5 h-3.5" /> Copiado
          </span>
        ) : (
          <Copy className="w-3.5 h-3.5 text-white/30 group-hover/copy:text-white/70 transition" />
        )}
      </span>
    </button>
  );
}

/* ─── Doc photo / PDF lightbox ─── */

interface DocLightboxState {
  url: string;
  label: string;
}

function isPdfUrl(url: string): boolean {
  // Firebase download URLs put the path in the query, so check both.
  // Falls back to false on malformed URLs.
  try {
    return /\.pdf(?:$|[?&#])/i.test(url) || /%2F[^?]*\.pdf/i.test(url);
  } catch {
    return false;
  }
}

function DocLightbox({ state, onClose }: { state: DocLightboxState | null; onClose: () => void }) {
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, onClose]);

  const isPdf = state ? isPdfUrl(state.url) : false;

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          key="doc-lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex flex-col"
          onClick={onClose}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 text-white/90 text-sm">
            <span className="font-medium truncate">{state.label}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={state.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir original
              </a>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
            {isPdf ? (
              <iframe
                src={state.url}
                title={state.label}
                className="w-full h-full bg-white"
              />
            ) : (
              <TransformWrapper minScale={0.5} maxScale={6} centerOnInit>
                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '100%' }}
                  contentStyle={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.url}
                    alt={state.label}
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                </TransformComponent>
              </TransformWrapper>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Document status pill (with countdown + warning hint) ─── */

interface DocStatusPillProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  status: DocStatus;
  countdown: string | null;
  warningHint?: string;
  /** When set, shows a "Ver" button that opens the photo in the lightbox. */
  photoUrl?: string;
  onView?: () => void;
}

function DocStatusPill({
  icon: Icon,
  label,
  status,
  countdown,
  warningHint,
  photoUrl,
  onView,
}: DocStatusPillProps) {
  const theme = STATUS_THEME[status];
  return (
    <div
      className={classNames(
        'rounded-xl border px-3 py-2',
        theme.bg,
        theme.border,
      )}
    >
      <div className="flex items-center gap-2">
        <span className={classNames('w-1.5 h-1.5 rounded-full flex-shrink-0', theme.dot)} />
        <Icon className={classNames('w-3.5 h-3.5', theme.text)} />
        <span className={classNames('text-[11px] font-bold uppercase tracking-wider', theme.text)}>
          {label}
        </span>
        <span className={classNames('text-[11px] font-bold ml-auto', theme.text)}>
          {theme.label}
          {countdown && (
            <span className={classNames('ml-1.5 font-medium opacity-90 normal-case')}>
              · {countdown}
            </span>
          )}
        </span>
        {photoUrl && onView && (
          <button
            type="button"
            onClick={onView}
            className={classNames(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition',
              'bg-white/[0.07] border-white/[0.12] text-white/85 hover:bg-white/[0.14] hover:text-white',
            )}
            title={`Ver foto de ${label.toLowerCase()}`}
          >
            <Eye className="w-3 h-3" />
            Ver
          </button>
        )}
      </div>
      {warningHint && (
        <div className={classNames('text-[10px] mt-1 leading-snug pl-6', theme.text, 'opacity-90')}>
          {warningHint}
        </div>
      )}
    </div>
  );
}

/* ─── Document thumbnail (image or PDF placeholder) ─── */

function DocThumb({ url, label, onOpen }: { url: string; label: string; onOpen: () => void }) {
  const isPdf = isPdfUrl(url);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative aspect-[3/2] rounded-xl overflow-hidden border border-white/[0.08] hover:border-amber-300/40 transition group"
    >
      {isPdf ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-rose-500/15 to-amber-500/10 text-white/80">
          <FileText className="w-7 h-7 text-rose-200" />
          <span className="text-[10px] font-bold uppercase tracking-wider">PDF</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
      )}
      <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
        {label}
      </span>
    </button>
  );
}

/* ─── Skeleton ─── */

function TravelersSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl p-5 bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.08] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-white/[0.08] rounded animate-pulse" />
              <div className="h-3 w-24 bg-white/[0.05] rounded animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Traveler Card (dark glass) ─── */

interface CardProps {
  traveler: GlobalTraveler;
  index: number;
  trips: Trip[];
  onEdit: () => void;
  onDelete: () => void;
  onOpenPhoto: (state: DocLightboxState) => void;
}

function TravelerCard({ traveler, index, trips, onEdit, onDelete, onOpenPhoto }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const passportStatus = getDocStatus(traveler.passportExpiry);
  const visaStatus = getDocStatus(traveler.visaExpiry);
  const avatarColor = traveler.avatarColor || '#3b82f6';
  const relationship = traveler.relationship
    ? RELATIONSHIP_LABELS[traveler.relationship] || traveler.relationship
    : null;

  const tripStats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const linked = trips.filter((t) => t.travelerIds?.includes(traveler.id));
    const completed = linked.filter((t) => t.endDate < todayStr).length;
    const next = linked
      .filter((t) => t.startDate >= todayStr)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    return { total: linked.length, completed, next };
  }, [trips, traveler.id]);

  const bday = nextBirthday(traveler.dateOfBirth);
  const yearsOld = age(traveler.dateOfBirth);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.04 }}
      className="relative rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02] backdrop-blur-md overflow-hidden hover:border-white/15 transition-colors"
      style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 0 30px ${avatarColor}10` }}
    >
      {/* Decorative orb */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none opacity-30 blur-3xl"
        style={{ background: avatarColor }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}aa)`,
              boxShadow: `0 6px 24px ${avatarColor}55`,
            }}
          >
            <span className="text-white font-black text-base tracking-wide">
              {getInitials(traveler.fullName)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-lg leading-tight truncate">
              {traveler.fullName}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {relationship && (
                <span
                  className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: `${avatarColor}22`,
                    color: avatarColor,
                    border: `1px solid ${avatarColor}44`,
                  }}
                >
                  {relationship}
                </span>
              )}
              {yearsOld !== null && (
                <span className="inline-flex items-center text-[10px] font-bold text-white/55 bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-full">
                  {yearsOld} años
                </span>
              )}
              {traveler.nationality && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/55 bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-full">
                  <Globe className="w-2.5 h-2.5" />
                  {traveler.nationality}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-amber-200 hover:bg-amber-500/10 transition"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-rose-300 hover:bg-rose-500/10 transition"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider font-bold text-white/40 leading-none">
              Viajes
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <Plane className="w-3 h-3 text-amber-300" />
              <span className="text-white font-black text-sm tabular-nums">{tripStats.total}</span>
              {tripStats.completed > 0 && (
                <span className="text-white/40 text-[10px] tabular-nums">
                  · {tripStats.completed} hechos
                </span>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider font-bold text-white/40 leading-none">
              Próximo viaje
            </div>
            <div className="text-sm font-bold text-white/90 mt-1.5 truncate">
              {tripStats.next ? tripStats.next.title : <span className="text-white/35">—</span>}
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider font-bold text-white/40 leading-none">
              Cumple
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <Cake className="w-3 h-3 text-pink-300" />
              {bday ? (
                <span className="text-white text-sm font-bold tabular-nums">
                  {bday.daysAway === 0 ? '¡Hoy!' : `${bday.daysAway}d`}
                </span>
              ) : (
                <span className="text-white/35 text-sm">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Document status pills with expiry countdown */}
        <div className="flex flex-col gap-1.5 mb-4">
          <DocStatusPill
            icon={IdCard}
            label="Pasaporte"
            status={passportStatus}
            countdown={expiryCountdownLabel(traveler.passportExpiry)}
            warningHint={
              passportStatus === 'warning'
                ? 'Renueva antes: muchos países exigen 6 meses de vigencia.'
                : undefined
            }
            photoUrl={traveler.passportPhotoUrl}
            onView={
              traveler.passportPhotoUrl
                ? () =>
                    onOpenPhoto({
                      url: traveler.passportPhotoUrl!,
                      label: `${traveler.fullName} · Pasaporte`,
                    })
                : undefined
            }
          />
          <DocStatusPill
            icon={Stamp}
            label="Visa"
            status={visaStatus}
            countdown={expiryCountdownLabel(traveler.visaExpiry)}
            photoUrl={traveler.visaPhotoUrl}
            onView={
              traveler.visaPhotoUrl
                ? () =>
                    onOpenPhoto({
                      url: traveler.visaPhotoUrl!,
                      label: `${traveler.fullName} · Visa`,
                    })
                : undefined
            }
          />
        </div>

        {/* Expand/collapse data */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] transition text-xs font-bold text-white/75"
        >
          <span className="inline-flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-amber-300" />
            Datos para check-in (tap para copiar)
          </span>
          <ChevronDown
            className={classNames('w-4 h-4 transition-transform', expanded && 'rotate-180')}
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="copy-grid"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3">
                <CopyField icon={Users} label="Nombre completo" value={traveler.fullName} />
                {traveler.dateOfBirth && (
                  <CopyField
                    icon={Cake}
                    label="Fecha de nacimiento"
                    value={traveler.dateOfBirth}
                    mono
                  />
                )}
                {traveler.nationality && (
                  <CopyField icon={Globe} label="Nacionalidad" value={traveler.nationality} />
                )}
                {traveler.phone && <CopyField icon={Phone} label="Teléfono" value={traveler.phone} />}

                {/* Passport block */}
                {(traveler.passportNumber || traveler.passportCountry || traveler.passportExpiry) && (
                  <div className="sm:col-span-2 mt-1">
                    <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/40 mb-1.5 flex items-center gap-1.5">
                      <IdCard className="w-3 h-3" /> Pasaporte
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {traveler.passportNumber && (
                        <CopyField label="Número" value={traveler.passportNumber} mono />
                      )}
                      {traveler.passportCountry && (
                        <CopyField label="País emisor" value={traveler.passportCountry} />
                      )}
                      {traveler.passportExpiry && (
                        <CopyField
                          label="Expira"
                          value={formatLongDate(traveler.passportExpiry) || traveler.passportExpiry}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Visa block */}
                {(traveler.visaType || traveler.visaCountry || traveler.visaExpiry) && (
                  <div className="sm:col-span-2 mt-1">
                    <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/40 mb-1.5 flex items-center gap-1.5">
                      <Stamp className="w-3 h-3" /> Visa
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {traveler.visaType && <CopyField label="Tipo" value={traveler.visaType} />}
                      {traveler.visaCountry && (
                        <CopyField label="País" value={traveler.visaCountry} />
                      )}
                      {traveler.visaExpiry && (
                        <CopyField
                          label="Expira"
                          value={formatLongDate(traveler.visaExpiry) || traveler.visaExpiry}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Emergency block */}
                {(traveler.emergencyContact || traveler.emergencyPhone) && (
                  <div className="sm:col-span-2 mt-1">
                    <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/40 mb-1.5 flex items-center gap-1.5">
                      <Heart className="w-3 h-3" /> Contacto de emergencia
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {traveler.emergencyContact && (
                        <CopyField label="Nombre" value={traveler.emergencyContact} />
                      )}
                      {traveler.emergencyPhone && (
                        <CopyField label="Teléfono" value={traveler.emergencyPhone} mono />
                      )}
                    </div>
                  </div>
                )}

                {/* Preferences (no copy needed but useful at-a-glance) */}
                {(traveler.seatPreference || traveler.dietaryRestrictions) && (
                  <div className="sm:col-span-2 mt-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/40 mb-1.5">
                      Preferencias
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-white/80">
                      {traveler.seatPreference && (
                        <span>Asiento: <strong className="text-white/95">{traveler.seatPreference}</strong></span>
                      )}
                      {traveler.dietaryRestrictions && (
                        <span>Dieta: <strong className="text-white/95">{traveler.dietaryRestrictions}</strong></span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Document photos / PDFs */}
              {(traveler.passportPhotoUrl || traveler.visaPhotoUrl) && (
                <div className="grid grid-cols-2 gap-2 pt-3">
                  {traveler.passportPhotoUrl && (
                    <DocThumb
                      url={traveler.passportPhotoUrl}
                      label="Pasaporte"
                      onOpen={() =>
                        onOpenPhoto({
                          url: traveler.passportPhotoUrl!,
                          label: `${traveler.fullName} · Pasaporte`,
                        })
                      }
                    />
                  )}
                  {traveler.visaPhotoUrl && (
                    <DocThumb
                      url={traveler.visaPhotoUrl}
                      label="Visa"
                      onOpen={() =>
                        onOpenPhoto({
                          url: traveler.visaPhotoUrl!,
                          label: `${traveler.fullName} · Visa`,
                        })
                      }
                    />
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─── Page ─── */

type FilterMode = 'all' | 'family' | 'friends' | 'others' | 'alerts';

export default function TravelersPage() {
  const { travelers, loading, addTraveler, updateTraveler, deleteTraveler } = useGlobalTravelers();
  const { trips } = useTrips();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingTraveler, setEditingTraveler] = useState<GlobalTraveler | null>(null);
  const [deletingTraveler, setDeletingTraveler] = useState<GlobalTraveler | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [docLightbox, setDocLightbox] = useState<DocLightboxState | null>(null);

  /* Stats */
  const stats = useMemo(() => {
    let alerts = 0;
    let validPassports = 0;
    let nextBday: { name: string; daysAway: number; date: Date } | null = null;
    for (const t of travelers) {
      const ps = getDocStatus(t.passportExpiry);
      const vs = getDocStatus(t.visaExpiry);
      if (ps === 'expired' || ps === 'warning' || vs === 'expired' || vs === 'warning') alerts++;
      if (ps === 'valid') validPassports++;
      const bd = nextBirthday(t.dateOfBirth);
      if (bd && (!nextBday || bd.daysAway < nextBday.daysAway)) {
        nextBday = { name: t.fullName, daysAway: bd.daysAway, date: bd.date };
      }
    }
    return { total: travelers.length, alerts, validPassports, nextBday };
  }, [travelers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return travelers.filter((t) => {
      if (q) {
        const haystack = [
          t.fullName,
          t.relationship,
          t.nationality,
          t.passportNumber,
          t.passportCountry,
          t.visaType,
          t.visaCountry,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filter === 'family') return !!t.relationship && FAMILY_RELATIONS.has(t.relationship);
      if (filter === 'friends') return t.relationship === 'amigo';
      if (filter === 'others') return !t.relationship || t.relationship === 'otro';
      if (filter === 'alerts') {
        const ps = getDocStatus(t.passportExpiry);
        const vs = getDocStatus(t.visaExpiry);
        return ps === 'expired' || ps === 'warning' || vs === 'expired' || vs === 'warning';
      }
      return true;
    });
  }, [travelers, search, filter]);

  const handleSave = async (data: Omit<GlobalTraveler, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingTraveler) {
        await updateTraveler(editingTraveler.id, data);
        toast('Viajero actualizado', 'success');
      } else {
        await addTraveler(data);
        toast('Viajero agregado', 'success');
      }
      setShowForm(false);
      setEditingTraveler(null);
    } catch (err) {
      console.error('Error al guardar viajero:', err);
      toast('Error al guardar el viajero', 'error');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingTraveler) return;
    try {
      setDeleting(true);
      await deleteTraveler(deletingTraveler.id);
      toast('Viajero eliminado', 'success');
      setDeletingTraveler(null);
    } catch (err) {
      console.error('Error al eliminar viajero:', err);
      toast('Error al eliminar el viajero', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filterChips: { id: FilterMode; label: string; count?: number }[] = [
    { id: 'all', label: 'Todos', count: stats.total },
    { id: 'family', label: 'Familia' },
    { id: 'friends', label: 'Amigos' },
    { id: 'others', label: 'Otros' },
    { id: 'alerts', label: 'Con alertas', count: stats.alerts },
  ];

  return (
    <div className="space-y-6">
      {/* ── Hero / header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02] backdrop-blur-md p-6 overflow-hidden"
      >
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-bold text-amber-300/80">
              <Users className="w-3 h-3" /> Tu grupo
            </span>
            <h1 className="text-white text-3xl sm:text-4xl font-black tracking-tight mt-2">
              Viajeros
            </h1>
            <p className="text-white/55 text-sm mt-1.5 max-w-md">
              Toda la info de tus compañeros — pasaporte, visa, contacto — lista para copiar al hacer check-in.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingTraveler(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-900/30 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Agregar viajero
          </button>
        </div>

        {/* Stats row */}
        {stats.total > 0 && (
          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-white/40">Total</div>
              <div className="text-white font-black text-2xl tabular-nums mt-1">{stats.total}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300/80">
                Pasaportes vigentes
              </div>
              <div className="text-white font-black text-2xl tabular-nums mt-1">
                {stats.validPassports}
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-rose-300/80">Alertas</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-white font-black text-2xl tabular-nums">{stats.alerts}</span>
                {stats.alerts > 0 && <AlertTriangle className="w-4 h-4 text-rose-300" />}
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-pink-300/80">
                Próximo cumple
              </div>
              {stats.nextBday ? (
                <div className="mt-1">
                  <div className="text-white font-bold text-sm truncate">{stats.nextBday.name}</div>
                  <div className="text-white/55 text-[11px] font-medium">
                    {stats.nextBday.daysAway === 0 ? '¡Hoy!' : `en ${stats.nextBday.daysAway} días`}
                  </div>
                </div>
              ) : (
                <div className="text-white/35 text-sm mt-1">—</div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Alerts banner ── */}
      {stats.alerts > 0 && filter !== 'alerts' && (
        <motion.button
          type="button"
          onClick={() => setFilter('alerts')}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-2xl border border-rose-300/30 bg-rose-500/10 backdrop-blur-sm px-4 py-3 flex items-center gap-3 text-left hover:bg-rose-500/15 transition"
        >
          <span className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-300/30 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-4 h-4 text-rose-200" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-rose-50 font-bold text-sm">
              {stats.alerts} viajero{stats.alerts === 1 ? '' : 's'} con documentos por revisar
            </div>
            <div className="text-rose-200/70 text-xs">
              Pasaporte o visa vencidos / próximos a vencer (6 meses). Tap para filtrar.
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-rose-200/70 -rotate-90" />
        </motion.button>
      )}

      {/* ── Search + filters ── */}
      {!loading && travelers.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, número de pasaporte, país…"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/35 outline-none focus:border-amber-300/40 focus:bg-white/[0.06] transition"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterChips.map((chip) => {
              const active = filter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={classNames(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border',
                    active
                      ? 'bg-amber-500/15 border-amber-300/40 text-amber-100'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/70 hover:bg-white/[0.07]',
                  )}
                >
                  {chip.label}
                  {typeof chip.count === 'number' && (
                    <span
                      className={classNames(
                        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] tabular-nums font-bold',
                        active ? 'bg-amber-100/20 text-amber-100' : 'bg-white/[0.06] text-white/55',
                      )}
                    >
                      {chip.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <TravelersSkeleton />}

      {/* ── Empty state ── */}
      {!loading && travelers.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md text-center py-16 px-6"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/30 to-violet-500/20 flex items-center justify-center mx-auto mb-5 border border-white/10">
            <Users className="w-10 h-10 text-amber-200" />
          </div>
          <h3 className="text-white font-bold text-xl mb-2">Sin viajeros registrados</h3>
          <p className="text-white/55 text-sm mb-6 max-w-md mx-auto">
            Agrega a las personas con las que viajas. Tendrás su pasaporte, visa y contactos a un tap de copiar
            la próxima vez que llenes un check-in.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingTraveler(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-900/30 transition"
          >
            <Plus className="w-4 h-4" />
            Agregar tu primer viajero
          </button>
        </motion.div>
      )}

      {/* ── No-results state (after filter) ── */}
      {!loading && travelers.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] text-center py-10 px-6">
          <CalendarDays className="w-8 h-8 text-white/35 mx-auto mb-2" />
          <p className="text-white/70 text-sm">Ningún viajero coincide con el filtro.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
            className="mt-3 text-xs font-bold text-amber-200 hover:text-amber-100 underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ── Cards grid ── */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((traveler, index) => (
            <TravelerCard
              key={traveler.id}
              traveler={traveler}
              index={index}
              trips={trips}
              onEdit={() => {
                setEditingTraveler(traveler);
                setShowForm(true);
              }}
              onDelete={() => setDeletingTraveler(traveler)}
              onOpenPhoto={setDocLightbox}
            />
          ))}
        </div>
      )}

      {/* ── Form Modal ── */}
      {showForm && (
        <GlobalTravelerForm
          open={showForm}
          onClose={() => {
            setShowForm(false);
            setEditingTraveler(null);
          }}
          onSave={handleSave}
          initialData={editingTraveler ?? undefined}
        />
      )}

      {/* ── Delete confirm modal (dark glass overlay) ── */}
      <AnimatePresence>
        {deletingTraveler && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !deleting && setDeletingTraveler(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-sm rounded-3xl border border-white/[0.1] bg-gradient-to-br from-[#1a2a44] to-[#0f1d33] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-300/30 flex items-center justify-center mb-3">
                <Trash2 className="w-5 h-5 text-rose-200" />
              </div>
              <h3 className="text-white font-bold text-lg mb-1.5">Eliminar viajero</h3>
              <p className="text-white/65 text-sm mb-5">
                ¿Eliminar a <strong className="text-white">{deletingTraveler.fullName}</strong>? Esto
                no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingTraveler(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-full text-sm font-bold text-white/85 bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.08] transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-full text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Doc photo lightbox ── */}
      <DocLightbox state={docLightbox} onClose={() => setDocLightbox(null)} />
    </div>
  );
}
