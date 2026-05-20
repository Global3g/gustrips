'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[(app)/error]', error);
    Sentry.captureException(error, {
      tags: { boundary: '(app)/error.tsx' },
      contexts: { digest: { digest: error.digest ?? null } },
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h2 className="text-xl font-semibold text-neutral-900 mb-3">
          No pudimos cargar esta sección
        </h2>
        <p className="text-neutral-600 mb-6 text-sm">
          {error.message || 'Algo falló al cargar tus datos.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg bg-white border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-100 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
