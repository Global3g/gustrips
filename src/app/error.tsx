'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
    // Forward to Sentry (no-op if NEXT_PUBLIC_SENTRY_DSN is not set).
    Sentry.captureException(error, {
      tags: { boundary: 'app/error.tsx' },
      contexts: { digest: { digest: error.digest ?? null } },
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-neutral-500 mb-3">
          Algo salió mal
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900 mb-4">
          Tuvimos un problema cargando esta página
        </h1>
        <p className="text-neutral-600 mb-8 text-sm">
          {error.message || 'Error inesperado. Intenta de nuevo en un momento.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-white border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-100 transition-colors"
          >
            Ir al dashboard
          </Link>
        </div>
        {error.digest && (
          <p className="text-xs text-neutral-400 mt-8 font-mono">ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
