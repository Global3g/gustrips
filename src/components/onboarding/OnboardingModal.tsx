'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
  CalendarDays,
  Users,
  Wallet,
  CheckSquare,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { ROUTES } from '@/config/constants';

const STORAGE_KEY = 'gustrips-onboarded';

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Itinerario dia a dia',
    desc: 'Organiza vuelos, hoteles y actividades',
    color: '#3b82f6',
  },
  {
    icon: Users,
    title: 'Viajeros y documentos',
    desc: 'Pasaportes, boletos y mas en un solo lugar',
    color: '#8b5cf6',
  },
  {
    icon: Wallet,
    title: 'Presupuesto compartido',
    desc: 'Control de gastos por categoria y persona',
    color: '#22c55e',
  },
  {
    icon: CheckSquare,
    title: 'Checklist inteligente',
    desc: 'Tareas organizadas por fase del viaje',
    color: '#f59e0b',
  },
];

interface OnboardingModalProps {
  onDismiss?: () => void;
}

export default function OnboardingModal({ onDismiss }: OnboardingModalProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const alreadyOnboarded = localStorage.getItem(STORAGE_KEY);
    if (!alreadyOnboarded) {
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const handleCreateTrip = useCallback(() => {
    dismiss();
    router.push(ROUTES.app.newTrip);
  }, [dismiss, router]);

  const nextStep = useCallback(() => {
    if (step < 2) {
      setStep((prev) => prev + 1);
    }
  }, [step]);

  const prevStep = useCallback(() => {
    if (step > 0) {
      setStep((prev) => prev - 1);
    }
  }, [step]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative w-full max-w-md glass-heavy rounded-3xl overflow-hidden"
          >
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait">
                {/* Step 0: Welcome */}
                {step === 0 && (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="px-8 pt-10 pb-8 text-center"
                  >
                    {/* Icon with gradient bg */}
                    <div className="relative mx-auto mb-6 w-24 h-24">
                      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/30 to-cyan-400/20 blur-xl" />
                      <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <Plane className="w-12 h-12 text-white" />
                      </div>
                    </div>

                    <h2 className="text-gray-900 text-2xl font-bold mb-2">
                      Bienvenido a GusTrips
                    </h2>
                    <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                      Tu organizador de viajes personal. Planea cada detalle de tu proxima aventura.
                    </p>
                  </motion.div>
                )}

                {/* Step 1: Features */}
                {step === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="px-8 pt-8 pb-8"
                  >
                    <h3 className="text-gray-900 text-lg font-bold text-center mb-5">
                      Todo lo que necesitas
                    </h3>

                    <div className="space-y-3">
                      {FEATURES.map((feature, idx) => {
                        const FeatureIcon = feature.icon;
                        return (
                          <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.08, duration: 0.3 }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200"
                          >
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${feature.color}20` }}
                            >
                              <FeatureIcon
                                className="w-5 h-5"
                                style={{ color: feature.color }}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-gray-900 text-sm font-semibold">
                                {feature.title}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {feature.desc}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: CTA */}
                {step === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="px-8 pt-10 pb-8 text-center"
                  >
                    <div className="relative mx-auto mb-6 w-20 h-20">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-blue-400/20 blur-xl" />
                      <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                        <Compass className="w-10 h-10 text-white" />
                      </div>
                    </div>

                    <h3 className="text-gray-900 text-xl font-bold mb-2">
                      Listo para explorar?
                    </h3>
                    <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
                      Crea tu primer viaje y comienza a organizar cada momento de tu aventura.
                    </p>

                    <div className="space-y-3">
                      <button
                        onClick={handleCreateTrip}
                        className="w-full inline-flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors active:scale-[0.97]"
                      >
                        Crea tu primer viaje
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={dismiss}
                        className="w-full text-gray-400 hover:text-gray-600 text-sm font-medium py-2 transition-colors"
                      >
                        Explorar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation: dots + buttons */}
            <div className="px-8 pb-6 flex items-center justify-between">
              {/* Dot indicators */}
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    aria-label={`Paso ${i + 1}`}
                    className={`rounded-full transition-all duration-300 ${
                      i === step
                        ? 'w-6 h-2 bg-red-500'
                        : 'w-2 h-2 bg-gray-200 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>

              {/* Next / Skip */}
              {step < 2 ? (
                <button
                  onClick={nextStep}
                  className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-400 text-sm font-medium transition-colors"
                >
                  Siguiente
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
