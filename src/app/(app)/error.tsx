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
    // Surface the FULL error in console so a minified production trace is
    // still actionable (browser DevTools applies source maps when available).
    console.error('[(app)/error] message:', error.message);
    console.error('[(app)/error] digest:', error.digest);
    console.error('[(app)/error] stack:', error.stack);
    console.error('[(app)/error] full error object:', error);
    Sentry.captureException(error, {
      tags: { boundary: '(app)/error.tsx' },
      contexts: { digest: { digest: error.digest ?? null } },
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-8">
      <div className="max-w-2xl w-full">
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">
          No pudimos cargar esta sección
        </h2>
        <p className="text-neutral-600 mb-4 text-sm">
          {error.message || 'Algo falló al cargar tus datos.'}
        </p>
        {error.digest && (
          <p className="text-neutral-400 mb-4 text-xs font-mono">
            digest: {error.digest}
          </p>
        )}
        <details className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3">
          <summary className="cursor-pointer text-xs font-medium text-red-900 hover:text-red-700 select-none">
            Detalles tecnicos
          </summary>
          <pre className="mt-2 text-[10px] text-red-900 whitespace-pre-wrap break-all font-mono">
            {error.stack || error.message}
          </pre>
        </details>
        <div className="flex items-center gap-3">
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
