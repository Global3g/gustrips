'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookHeart,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { tripshistoryApi, TripshistoryError } from '@/features/tripshistory';

/**
 * Standalone "Case A" entry flow.
 *
 * Lets the user kick off a Tripshistory reconstruction without an
 * existing trip. Captures an optional title + approximate date range,
 * creates a Story with no tripId, and redirects to the wizard.
 */
export default function NewStandaloneStoryPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const approximateDates =
        startDate || endDate
          ? {
              ...(startDate ? { start: startDate } : {}),
              ...(endDate ? { end: endDate } : {}),
            }
          : undefined;

      const story = await tripshistoryApi.createStory({
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(approximateDates ? { approximateDates } : {}),
      });
      router.replace(`/tripshistory/${story.id}`);
    } catch (err) {
      const msg =
        err instanceof TripshistoryError
          ? err.message
          : 'No pudimos crear la historia. Intentá de nuevo en un momento.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center gap-3"
      >
        <Link
          href="/tripshistory"
          aria-label="Volver"
          className="w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center transition-colors text-white/80 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-white text-2xl font-bold">Reconstruir viaje pasado</h1>
          <p className="text-white/55 text-sm">
            Cargá unos datos básicos y empezá a subir las fotos.
          </p>
        </div>
      </motion.div>

      {/* Card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
        className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#1a1230] via-[#2a1640] to-[#3a1f55] p-6 sm:p-8 shadow-2xl shadow-black/30 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-fuchsia-500/15 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
            <BookHeart className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
              Nueva historia
            </span>
          </div>

          <h2 className="text-white font-black text-xl sm:text-2xl tracking-tight">
            Contanos un poco
          </h2>
          <p className="mt-1.5 text-white/65 text-sm">
            Todos los campos son opcionales — podés saltarlos y completarlos
            después con las preguntas del motor.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55 mb-1.5">
                Nombre del viaje
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Italia 2023"
                disabled={loading}
                className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/35 bg-white/[0.04] border border-white/[0.1] outline-none focus:border-amber-400/60 transition-colors disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55 mb-1.5">
                  Fecha inicio (aprox.)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl px-4 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.1] outline-none focus:border-amber-400/60 transition-colors disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/55 mb-1.5">
                  Fecha fin (aprox.)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl px-4 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.1] outline-none focus:border-amber-400/60 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-rose-300/90">{error}</p>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 disabled:opacity-60 disabled:cursor-not-allowed transition-shadow"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Comenzar
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <Link
                href="/tripshistory"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-semibold transition-colors"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </motion.section>
    </div>
  );
}
