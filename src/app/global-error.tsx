'use client';

/**
 * Global error boundary for the App Router. This catches errors that
 * happen above the regular `error.tsx` (e.g. in the root layout itself)
 * and is the only place Sentry can hook into React rendering errors
 * at the very top of the tree.
 *
 * Must render its own `<html>` / `<body>` because the broken layout
 * is no longer in the tree.
 */

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: 'global-error.tsx' },
    });
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#fafafa',
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div style={{ maxWidth: '420px', textAlign: 'center' }}>
            <p
              style={{
                fontSize: '12px',
                letterSpacing: '0.08em',
                color: '#6b7280',
                textTransform: 'uppercase',
                margin: '0 0 12px',
                fontWeight: 500,
              }}
            >
              Error crítico
            </p>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: '#111827',
                margin: '0 0 16px',
              }}
            >
              La aplicación no pudo cargar
            </h1>
            <p style={{ color: '#4b5563', margin: '0 0 32px', fontSize: '14px' }}>
              {error.message || 'Error inesperado al inicializar.'}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#111827',
                color: 'white',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
            {error.digest && (
              <p
                style={{
                  fontSize: '11px',
                  color: '#9ca3af',
                  marginTop: '32px',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                }}
              >
                ref: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
