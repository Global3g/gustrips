'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FileSearch, CalendarDays, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/constants';

const FEATURES = [
  {
    icon: FileSearch,
    title: 'Scanner IA',
    description:
      'Escanea tus confirmaciones y la IA las organiza automaticamente.',
    color: '#3b82f6',
  },
  {
    icon: CalendarDays,
    title: 'Itinerario visual',
    description:
      'Ve tu viaje dia por dia con fotos del destino de fondo.',
    color: '#8b5cf6',
  },
  {
    icon: Wallet,
    title: 'Presupuesto compartido',
    description:
      'Controla gastos, divide cuentas y maneja multiples monedas.',
    color: '#22c55e',
  },
] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.push(ROUTES.app.dashboard);
    }
  }, [isAuthenticated, router]);

  if (loading || isAuthenticated) return null;

  return (
    <div className="min-h-screen min-h-dvh bg-gradient-to-br from-gray-50 via-white to-red-50/30 flex flex-col">
      {/* ─── Hero ─────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-6 py-16 sm:py-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-4xl mx-auto text-center"
        >
          {/* Logo */}
          <motion.div variants={itemVariants} className="mb-8">
            <Image
              src="/logo.png"
              alt="GusTrips"
              width={1399}
              height={752}
              priority
              className="h-28 sm:h-36 w-auto mx-auto"
            />
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight mb-4"
          >
            Todo tu viaje, en orden.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Organiza vuelos, hoteles, tours, documentos y presupuesto en un solo
            lugar. Con inteligencia artificial.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
          >
            <Link
              href={ROUTES.register}
              className="w-full sm:w-auto inline-flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white font-semibold text-lg px-8 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-600/25 active:scale-[0.97]"
            >
              Crear cuenta gratis
            </Link>
            <Link
              href={ROUTES.login}
              className="w-full sm:w-auto inline-flex items-center justify-center border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-semibold text-lg px-8 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]"
            >
              Iniciar sesion
            </Link>
          </motion.div>

          {/* ─── Features ───────────────────────────────── */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  variants={itemVariants}
                  className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-left hover:shadow-lg transition-shadow duration-300"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: `${feature.color}15` }}
                  >
                    <Icon
                      className="w-6 h-6"
                      style={{ color: feature.color }}
                    />
                  </div>
                  <h3 className="text-gray-900 text-lg font-bold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </main>

      {/* ─── Footer ───────────────────────────────────── */}
      <footer className="py-8 text-center">
        <p className="text-gray-400 text-sm">
          GusTrips. Todo tu viaje, en orden.
        </p>
      </footer>
    </div>
  );
}
