'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookHeart,
  Sparkles,
  ArrowRight,
  Loader2,
  Plus,
  ChevronRight,
  CalendarDays,
  Image as ImageIcon,
  MapPin,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useStoriesList } from '@/features/tripshistory/hooks/useStoriesList';
import { deleteStory } from '@/features/tripshistory/api/endpoints';
import { useToast } from '@/context/ToastContext';
import type { Story, StoryStatus } from '@/features/tripshistory/types';

/**
 * Top-level Tripshistory page.
 *
 * Lists every story the current user owns — both stories tied to an
 * existing trip and standalone stories (reconstructions from photos
 * that aren't yet a Trip). Groups them by lifecycle stage so the user
 * can pick up where they left off.
 */
export default function TripshistoryIndexPage() {
  const { stories, loading, error, refetch } = useStoriesList();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (storyId: string) => {
    try {
      setDeletingId(storyId);
      await deleteStory(storyId);
      toast('Historia borrada', 'success');
      await refetch();
    } catch (err) {
      console.error('Error deleting story:', err);
      toast('No pudimos borrar la historia', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const inProgress = stories.filter(
    (s) => s.status !== 'ready' && s.status !== 'finalized',
  );
  const ready = stories.filter(
    (s) => s.status === 'ready' || s.status === 'finalized',
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Hero CTA */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#1a1230] via-[#2a1640] to-[#3a1f55] p-6 sm:p-8 shadow-2xl shadow-black/30 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-fuchsia-500/15 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/10 rounded-full translate-y-24 -translate-x-24 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
            <BookHeart className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
              Tripshistory
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight max-w-xl">
            Reconstruí cualquier viaje pasado desde tus fotos
          </h1>
          <p className="mt-3 text-white/75 text-sm sm:text-base max-w-xl leading-relaxed">
            ¿Tenés 3000 fotos de Italia 2023 y nada cargado? Subilas acá y el
            motor arma los días, detecta los eventos y te hace las preguntas
            justas para terminar la historia.
          </p>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Link
              href="/tripshistory/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-shadow"
            >
              <Sparkles className="w-4 h-4" />
              Reconstruir un viaje pasado
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-amber-300 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-rose-100">
          <p className="font-semibold mb-1">No pudimos cargar tus historias.</p>
          <p className="text-sm text-rose-200/80">{error.message}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && stories.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400/30 to-rose-500/30 border border-white/[0.08] flex items-center justify-center mb-3">
            <BookHeart className="w-7 h-7 text-amber-200" />
          </div>
          <h3 className="text-white font-bold text-lg">
            Todavía no armaste ninguna historia.
          </h3>
          <p className="mt-1 text-white/60 text-sm">
            Empezá con un viaje pasado o desde la ficha de un viaje existente.
          </p>
        </motion.div>
      )}

      {/* En proceso */}
      {!loading && inProgress.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white/55 text-xs font-bold uppercase tracking-[0.14em]">
              En proceso
            </h2>
            <Link
              href="/tripshistory/new"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 hover:text-amber-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva
            </Link>
          </div>
          <ul className="space-y-2.5">
            {inProgress.map((story, idx) => (
              <StoryListItem
                key={story.id}
                story={story}
                index={idx}
                onDelete={handleDelete}
                deleting={deletingId === story.id}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Listas */}
      {!loading && ready.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-white/55 text-xs font-bold uppercase tracking-[0.14em]">
            Listas
          </h2>
          <ul className="space-y-2.5">
            {ready.map((story, idx) => (
              <StoryListItem
                key={story.id}
                story={story}
                index={idx}
                onDelete={handleDelete}
                deleting={deletingId === story.id}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ─── List item ─────────────────────────────────────── */

const STATUS_LABEL: Record<StoryStatus, string> = {
  draft: 'Borrador',
  analyzing: 'Analizando',
  questioning: 'Respondiendo preguntas',
  ready: 'Lista',
  finalized: 'Finalizada',
};

const STATUS_CLASS: Record<StoryStatus, string> = {
  draft: 'bg-white/[0.06] text-white/70 border-white/[0.08]',
  analyzing: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  questioning: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
  ready: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  finalized: 'bg-violet-500/15 text-violet-200 border-violet-400/30',
};

interface StoryListItemProps {
  story: Story;
  index: number;
  onDelete: (storyId: string) => Promise<void>;
  deleting: boolean;
}

function StoryListItem({ story, index, onDelete, deleting }: StoryListItemProps) {
  // If the story is already linked to a trip, deep-link into the trip's
  // tripshistory route; otherwise use the standalone route.
  const href = story.tripId
    ? `/trips/${story.tripId}/tripshistory/${story.id}`
    : `/tripshistory/${story.id}`;
  const photoCount = story.photoCount ?? 0;
  const dayCount = story.dayCount ?? 0;
  const eventCount = story.eventCount ?? 0;

  const [confirm, setConfirm] = useState(false);

  // Auto-cancel the primed delete after 6 s so a stray click can't sit primed.
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 6000);
    return () => clearTimeout(t);
  }, [confirm]);

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 * index, ease: 'easeOut' }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.14] transition-colors overflow-hidden"
    >
      <div className="flex items-center gap-3 p-4">
        <Link href={href} className="flex items-center gap-4 flex-1 min-w-0 group">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400/30 to-rose-500/30 border border-white/[0.08] flex items-center justify-center">
            <BookHeart className="w-5 h-5 text-amber-200" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-bold text-base truncate">
                {story.title?.trim() || 'Historia sin título'}
              </h3>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_CLASS[story.status]}`}
              >
                {STATUS_LABEL[story.status]}
              </span>
              {!story.tripId && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30">
                  Sin viaje
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
              <span className="inline-flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
              </span>
              {dayCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {dayCount} {dayCount === 1 ? 'día' : 'días'}
                </span>
              )}
              {eventCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {eventCount} {eventCount === 1 ? 'evento' : 'eventos'}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors shrink-0" />
        </Link>

        {/* Borrar — confirmación inline */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirm(true);
          }}
          disabled={deleting || confirm}
          aria-label="Borrar historia"
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl text-rose-300/85 hover:text-rose-200 bg-rose-500/[0.04] hover:bg-rose-500/[0.12] border border-rose-500/[0.12] hover:border-rose-400/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="border-t border-rose-500/20 bg-rose-500/[0.05]"
          >
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-start gap-1.5 text-[12px] text-rose-100/95 flex-1 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-300" />
                <span>
                  ¿Borrar esta historia? Se eliminan días, eventos, preguntas y
                  fotos asociadas. No afecta al viaje en GusTrips.
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDelete(story.id)}
                  disabled={deleting}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-lg shadow-rose-500/30 transition-all disabled:opacity-60"
                >
                  {deleting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white/85 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
