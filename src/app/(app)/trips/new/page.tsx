'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, PencilLine, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTrips } from '@/hooks/useTrips';
import { useToast } from '@/context/ToastContext';
import TripForm from '@/components/trips/TripForm';
import TripFromPhotosFlow from '@/features/tripshistory/components/TripFromPhotosFlow';
import { ROUTES } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';

type CreationMode = 'photos' | 'manual';

export default function NewTripPage() {
  const router = useRouter();
  const { trips, createTrip } = useTrips();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Photos is the recommended path now — empty trips with a long form are
  // a worse experience than uploading 30 photos and getting a populated trip.
  const [mode, setMode] = useState<CreationMode>('photos');

  // Same reasoning as /trips/[tripId]/layout — router.back() is unreliable
  // when there's no usable history. Always go to the dashboard.
  const handleBack = () => {
    router.push(ROUTES.app.dashboard);
  };

  const handleSubmit = async (data: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    description?: string;
    status: 'planning' | 'active' | 'completed' | 'cancelled';
    coverImage?: string | null;
    travelerIds?: string[];
  }) => {
    try {
      setLoading(true);
      const isFirstTrip = trips.length === 0;
      const tripId = await createTrip({
        title: data.title,
        destination: data.destination,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description || '',
        status: data.status,
        coverImage: data.coverImage ?? null,
        travelerIds: data.travelerIds || [],
      });

      if (isFirstTrip) {
        toast('🎉 ¡Tu primer viaje está listo! Ahora agrega tu itinerario', 'success');
      } else {
        toast('Viaje creado exitosamente', 'success');
      }
      router.push(ROUTES.app.trip(tripId));
    } catch (err) {
      console.error('Error al crear viaje:', err);
      toast('Error al crear el viaje', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3"
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="Volver"
          className="w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors border border-white/[0.06]"
        >
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </button>
        <div>
          <h1 className="text-white text-2xl font-bold">Nuevo viaje</h1>
          <p className="text-white/55 text-sm">Elegí cómo querés empezar</p>
        </div>
      </motion.div>

      {/* Mode chooser */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <ModeCard
          active={mode === 'photos'}
          onClick={() => setMode('photos')}
          icon={Camera}
          iconBg="from-amber-400/30 to-rose-500/20"
          iconBorder="border-amber-400/30"
          iconColor="text-amber-300"
          eyebrow="Recomendado"
          title="Desde fotos"
          description="Subí fotos del viaje y armamos los días, eventos y portada por vos."
        />
        <ModeCard
          active={mode === 'manual'}
          onClick={() => setMode('manual')}
          icon={PencilLine}
          iconBg="from-blue-400/25 to-violet-500/20"
          iconBorder="border-blue-400/25"
          iconColor="text-blue-300"
          title="Desde cero"
          description="Cargá título, destino, fechas y construí el itinerario a mano."
        />
      </motion.div>

      {/* Body — plain <div>, not <motion.div>. framer-motion wrappers
          swallow drag pointer events on descendants, which kills the
          drop zone inside PhotoSelector. */}
      <div key={mode}>
        {mode === 'photos' ? (
          <TripFromPhotosFlow onSwitchToManual={() => setMode('manual')} />
        ) : (
          <TripForm onSubmit={handleSubmit} loading={loading} />
        )}
      </div>
    </div>
  );
}

/* ─── Mode card ───────────────────────────────────── */

interface ModeCardProps {
  active: boolean;
  onClick: () => void;
  icon: typeof Camera;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  eyebrow?: string;
  title: string;
  description: string;
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  iconBg,
  iconBorder,
  iconColor,
  eyebrow,
  title,
  description,
}: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'group relative text-left rounded-2xl p-4 sm:p-5 border transition-all duration-200',
        active
          ? 'border-amber-300/40 bg-gradient-to-br from-amber-500/10 via-rose-500/8 to-amber-400/10 shadow-lg shadow-amber-500/10'
          : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.15]',
      )}
    >
      {eyebrow && (
        <span
          className={classNames(
            'absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border',
            active
              ? 'bg-amber-400/15 text-amber-200 border-amber-400/30'
              : 'bg-white/[0.04] text-amber-300/80 border-amber-400/20',
          )}
        >
          <Sparkles className="w-3 h-3" />
          {eyebrow}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div
          className={classNames(
            'shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br border flex items-center justify-center',
            iconBg,
            iconBorder,
          )}
        >
          <Icon className={classNames('w-5 h-5', iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={classNames(
              'font-bold text-base sm:text-lg leading-tight',
              active ? 'text-white' : 'text-white/90 group-hover:text-white',
            )}
          >
            {title}
          </h3>
          <p className="text-white/55 text-xs sm:text-sm mt-1 leading-snug">
            {description}
          </p>
        </div>
      </div>
      {/* Selected indicator */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-10 rounded-r-full bg-gradient-to-b from-amber-300 to-rose-400"
        />
      )}
    </button>
  );
}
