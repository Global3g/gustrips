'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  Command,
  MapPin,
  CalendarDays,
  Receipt,
  Camera,
  FileText,
  Wallet,
  Map as MapIcon,
  Users,
  CheckSquare,
  ExternalLink,
  Plane,
  ArrowRight,
} from 'lucide-react';
import { useTrips } from '@/hooks/useTrips';
import { useTrip } from '@/hooks/useTrip';
import { useEvents } from '@/hooks/useEvents';
import { useExpenses } from '@/hooks/useExpenses';
import { useAlbum } from '@/hooks/useAlbum';
import { ROUTES, EVENT_TYPES } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';
import type { EventType } from '@/types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type ResultKind = 'trip' | 'event' | 'expense' | 'photo' | 'section' | 'action';

interface PaletteResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
  href: string;
  iconKey?: string; // for events: EventType
  // section accent color
  accent: string; // tailwind text class, e.g. 'text-emerald-300'
  badge?: string; // e.g. 'Viaje', 'Evento'
}

const KIND_LABEL: Record<ResultKind, string> = {
  trip: 'Viaje',
  event: 'Evento',
  expense: 'Gasto',
  photo: 'Foto',
  section: 'Sección',
  action: 'Acción',
};

const KIND_GROUP_ORDER: ResultKind[] = ['action', 'section', 'trip', 'event', 'expense', 'photo'];
const KIND_GROUP_LABEL: Record<ResultKind, string> = {
  action: 'Acciones rápidas',
  section: 'Secciones',
  trip: 'Viajes',
  event: 'Eventos',
  expense: 'Gastos',
  photo: 'Fotos',
};

function getTripIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/trips\/([^/]+)/);
  if (!match) return null;
  if (match[1] === 'new') return null;
  return match[1];
}

function fuzzyIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function score(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 100;
  if (h.startsWith(n)) return 80;
  const idx = h.indexOf(n);
  return idx >= 0 ? 60 - idx : -1;
}

function getEventIcon(type: EventType) {
  // Lucide icons we use in the palette: Plane, MapPin, CalendarDays
  switch (type) {
    case 'flight':
      return Plane;
    case 'hotel':
    case 'restaurant':
    case 'activity':
    case 'transport':
    case 'car_rental':
    case 'cruise':
    default:
      return CalendarDays;
  }
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tripIdInPath = getTripIdFromPath(pathname);

  const { trips } = useTrips();
  // Always call these hooks; they handle empty tripId by no-op
  const { trip: currentTrip } = useTrip(tripIdInPath || '');
  const { events } = useEvents(tripIdInPath || '');
  const { expenses } = useExpenses(tripIdInPath || '');
  const { albumPhotos } = useAlbum(tripIdInPath || '', currentTrip);

  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
      // autofocus shortly after mount
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const results = useMemo<PaletteResult[]>(() => {
    const q = query.trim();
    const out: PaletteResult[] = [];

    // ── Quick actions (always available) ──
    const actions: PaletteResult[] = [
      {
        id: 'action-dashboard',
        kind: 'action',
        title: 'Ir al Dashboard',
        subtitle: 'Mis Viajes',
        href: ROUTES.app.dashboard,
        accent: 'text-amber-300',
        badge: KIND_LABEL.action,
      },
      {
        id: 'action-new-trip',
        kind: 'action',
        title: 'Nuevo Viaje',
        subtitle: 'Crear un viaje',
        href: ROUTES.app.newTrip,
        accent: 'text-emerald-300',
        badge: KIND_LABEL.action,
      },
    ];
    actions.forEach((a) => {
      const s = q ? Math.max(score(a.title, q), score(a.subtitle || '', q)) : 1;
      if (s >= 0) out.push(a);
    });

    // ── Section navigation (when inside a trip) ──
    if (tripIdInPath) {
      const sections: { title: string; href: string; accent: string }[] = [
        { title: 'General', href: ROUTES.app.trip(tripIdInPath), accent: 'text-blue-300' },
        { title: 'Documentos', href: ROUTES.app.documents(tripIdInPath), accent: 'text-violet-300' },
        { title: 'Presupuesto', href: ROUTES.app.budget(tripIdInPath), accent: 'text-emerald-300' },
        { title: 'Gastos', href: ROUTES.app.expenses(tripIdInPath), accent: 'text-orange-300' },
        { title: 'Itinerario', href: ROUTES.app.itinerary(tripIdInPath), accent: 'text-cyan-300' },
        { title: 'Mapa', href: ROUTES.app.map(tripIdInPath), accent: 'text-sky-300' },
        { title: 'Fotos', href: `${ROUTES.app.trip(tripIdInPath)}/photos`, accent: 'text-amber-300' },
        { title: 'Viajeros', href: ROUTES.app.members(tripIdInPath), accent: 'text-amber-300' },
        { title: 'Checklist', href: ROUTES.app.checklist(tripIdInPath), accent: 'text-cyan-300' },
        { title: 'Links', href: `${ROUTES.app.trip(tripIdInPath)}/links`, accent: 'text-rose-300' },
      ];
      sections.forEach((sec, idx) => {
        const s = q ? score(sec.title, q) : 1;
        if (s >= 0) {
          out.push({
            id: `section-${idx}`,
            kind: 'section',
            title: sec.title,
            subtitle: currentTrip?.title || 'Este viaje',
            href: sec.href,
            accent: sec.accent,
            badge: KIND_LABEL.section,
          });
        }
      });
    }

    // ── Trips (always searchable) ──
    trips.forEach((t) => {
      const titleScore = q ? score(t.title, q) : 1;
      const destScore = q ? score(t.destination || '', q) : 0;
      const best = Math.max(titleScore, destScore);
      if (best >= 0) {
        out.push({
          id: `trip-${t.id}`,
          kind: 'trip',
          title: t.title,
          subtitle: t.destination || '',
          href: ROUTES.app.trip(t.id),
          accent: 'text-blue-300',
          badge: KIND_LABEL.trip,
        });
      }
    });

    // ── Inside-trip data (events, expenses, photos) only when query present ──
    if (tripIdInPath && q.length > 0) {
      events.forEach((ev) => {
        if (!fuzzyIncludes(ev.title || '', q) && !fuzzyIncludes(ev.location || '', q)) return;
        out.push({
          id: `event-${ev.id}`,
          kind: 'event',
          title: ev.title || EVENT_TYPES[ev.type]?.label || 'Evento',
          subtitle: [ev.date, ev.location].filter(Boolean).join(' · '),
          href: `${ROUTES.app.itinerary(tripIdInPath)}?day=${encodeURIComponent(ev.date)}`,
          iconKey: ev.type,
          accent: 'text-cyan-300',
          badge: KIND_LABEL.event,
        });
      });

      expenses.forEach((ex) => {
        if (!fuzzyIncludes(ex.description || '', q)) return;
        out.push({
          id: `expense-${ex.id}`,
          kind: 'expense',
          title: ex.description || 'Gasto',
          subtitle: `${ex.amount} ${ex.currency}`,
          href: ROUTES.app.expenses(tripIdInPath),
          accent: 'text-orange-300',
          badge: KIND_LABEL.expense,
        });
      });

      albumPhotos.forEach((ph, idx) => {
        if (!fuzzyIncludes(ph.caption || '', q)) return;
        out.push({
          id: `photo-${idx}-${ph.url}`,
          kind: 'photo',
          title: ph.caption || 'Foto',
          subtitle: ph.date || '',
          href: `${ROUTES.app.trip(tripIdInPath)}/photos`,
          accent: 'text-amber-300',
          badge: KIND_LABEL.photo,
        });
      });
    }

    // Group + sort within group by title score (when query)
    const grouped = KIND_GROUP_ORDER.flatMap((kind) => {
      const items = out.filter((r) => r.kind === kind);
      if (!q) return items;
      return items
        .map((r) => ({ r, s: Math.max(score(r.title, q), score(r.subtitle || '', q)) }))
        .sort((a, b) => b.s - a.s)
        .map((x) => x.r);
    });

    return grouped;
  }, [query, trips, events, expenses, albumPhotos, tripIdInPath, currentTrip]);

  // Reset highlight when results shrink
  useEffect(() => {
    if (highlighted >= results.length) setHighlighted(0);
  }, [results.length, highlighted]);

  // Keyboard nav inside palette
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => (results.length === 0 ? 0 : (h + 1) % results.length));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => (results.length === 0 ? 0 : (h - 1 + results.length) % results.length));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const target = results[highlighted];
        if (target) {
          router.push(target.href);
          onClose();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, results, highlighted, onClose, router]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-result-index="${highlighted}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted]);

  // Build group blocks for rendering with proper indices
  const groups = useMemo(() => {
    const map = new Map<ResultKind, { kind: ResultKind; items: { r: PaletteResult; index: number }[] }>();
    results.forEach((r, index) => {
      if (!map.has(r.kind)) map.set(r.kind, { kind: r.kind, items: [] });
      map.get(r.kind)!.items.push({ r, index });
    });
    return KIND_GROUP_ORDER
      .map((k) => map.get(k))
      .filter((g): g is { kind: ResultKind; items: { r: PaletteResult; index: number }[] } => !!g && g.items.length > 0);
  }, [results]);

  function activate(href: string) {
    router.push(href);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onMouseDown={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-label="Paleta de comandos"
            className="relative mt-[15vh] sm:mt-[20vh] w-[calc(100vw-2rem)] max-w-[600px] bg-[#0d1b2e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Search */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <Search className="w-4 h-4 text-white/50 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tripIdInPath
                    ? 'Buscar viajes, eventos, gastos, fotos…'
                    : 'Buscar viajes y acciones…'
                }
                className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/35 focus:outline-none"
                aria-label="Buscar"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-white/50 bg-white/[0.06] border border-white/10 rounded">
                <Command className="w-3 h-3" /> K
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
              {groups.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-white/45">
                  Sin resultados
                </div>
              )}

              {groups.map((group) => (
                <div key={group.kind} className="mb-1">
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                    {KIND_GROUP_LABEL[group.kind]}
                  </div>
                  {group.items.map(({ r, index }) => {
                    const isHighlighted = index === highlighted;
                    let LeadingIcon: React.ComponentType<{ className?: string }> = ArrowRight;
                    if (r.kind === 'trip') LeadingIcon = MapPin;
                    else if (r.kind === 'event') LeadingIcon = getEventIcon((r.iconKey as EventType) || 'misc');
                    else if (r.kind === 'expense') LeadingIcon = Receipt;
                    else if (r.kind === 'photo') LeadingIcon = Camera;
                    else if (r.kind === 'section') {
                      switch (r.title) {
                        case 'Documentos': LeadingIcon = FileText; break;
                        case 'Presupuesto': LeadingIcon = Wallet; break;
                        case 'Gastos': LeadingIcon = Receipt; break;
                        case 'Itinerario': LeadingIcon = CalendarDays; break;
                        case 'Mapa': LeadingIcon = MapIcon; break;
                        case 'Fotos': LeadingIcon = Camera; break;
                        case 'Viajeros': LeadingIcon = Users; break;
                        case 'Checklist': LeadingIcon = CheckSquare; break;
                        case 'Links': LeadingIcon = ExternalLink; break;
                        case 'General':
                        default: LeadingIcon = MapPin; break;
                      }
                    } else if (r.kind === 'action') {
                      LeadingIcon = ArrowRight;
                    }

                    return (
                      <button
                        key={r.id}
                        type="button"
                        data-result-index={index}
                        onMouseEnter={() => setHighlighted(index)}
                        onClick={() => activate(r.href)}
                        className={classNames(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          isHighlighted ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                        )}
                      >
                        <span
                          className={classNames(
                            'inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.04] border border-white/10 shrink-0',
                            r.accent,
                          )}
                        >
                          <LeadingIcon className="w-3.5 h-3.5" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13.5px] font-medium text-white/95 truncate">
                            {r.title}
                          </span>
                          {r.subtitle && (
                            <span className="block text-[11.5px] text-white/45 truncate">
                              {r.subtitle}
                            </span>
                          )}
                        </span>
                        {r.badge && (
                          <span
                            className={classNames(
                              'text-[10px] font-bold uppercase tracking-wider shrink-0',
                              r.accent,
                            )}
                          >
                            {r.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-white/10 text-[10.5px] text-white/45">
              <span className="inline-flex items-center gap-2">
                <span>↑ ↓ navegar</span>
                <span>·</span>
                <span>↵ seleccionar</span>
                <span>·</span>
                <span>esc cerrar</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1">
                <Command className="w-3 h-3" /> K
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
