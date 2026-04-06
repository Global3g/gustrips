'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plane, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/constants';
import { classNames } from '@/lib/utils/helpers';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle, isAuthenticated, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(ROUTES.app.dashboard);
    }
  }, [isAuthenticated, router]);

  if (authLoading) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push(ROUTES.app.dashboard);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesion';
      if (message.includes('invalid-credential') || message.includes('wrong-password')) {
        setError('Correo o contrasena incorrectos');
      } else if (message.includes('user-not-found')) {
        setError('No existe una cuenta con este correo');
      } else if (message.includes('too-many-requests')) {
        setError('Demasiados intentos. Intenta mas tarde');
      } else {
        setError('Error al iniciar sesion. Intenta de nuevo');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      await signInWithGoogle();
      router.push(ROUTES.app.dashboard);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (!message.includes('popup-closed-by-user')) {
        setError('Error al iniciar con Google');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto">
      <div className="glass rounded-2xl p-8 animate-auth-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 mb-4">
            <Plane className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">GusTrips</h1>
          <p className="text-white/50 text-sm mt-1">Organizador de Viajes</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/15 border border-red-400/30 rounded-xl px-4 py-3 mb-6">
            <p className="text-red-300 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-white/70 text-sm font-medium mb-1.5">
              Correo electronico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
              autoComplete="email"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/30 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-white/70 text-sm font-medium mb-1.5">
              Contrasena
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contrasena"
                required
                autoComplete="current-password"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/30 outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/30 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className={classNames(
              'bg-blue-600 hover:bg-blue-500 w-full rounded-xl py-3 text-white font-semibold transition-colors',
              (loading || googleLoading) && 'opacity-60 cursor-not-allowed',
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Iniciando...
              </span>
            ) : (
              'Iniciar Sesion'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/15" />
          <span className="text-white/30 text-xs uppercase tracking-wider">o</span>
          <div className="flex-1 h-px bg-white/15" />
        </div>

        {/* Google Button */}
        <div className="animate-auth-in-delay">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className={classNames(
              'bg-white/10 border border-white/20 hover:bg-white/15 w-full rounded-xl py-3 text-white font-medium transition-colors flex items-center justify-center gap-3',
              (loading || googleLoading) && 'opacity-60 cursor-not-allowed',
            )}
          >
            {googleLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Conectando...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuar con Google
              </>
            )}
          </button>
        </div>

        {/* Link to register */}
        <p className="text-center text-white/40 text-sm mt-6">
          No tienes cuenta?{' '}
          <Link href={ROUTES.register} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}
