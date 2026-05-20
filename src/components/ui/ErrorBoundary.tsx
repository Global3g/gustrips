'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Render error caught:', error, errorInfo);
    // Forward to Sentry. No-op if the DSN env var is missing.
    Sentry.captureException(error, {
      tags: { boundary: 'ErrorBoundary' },
      contexts: {
        react: { componentStack: errorInfo.componentStack ?? null },
      },
    });
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <div
            className="rounded-2xl p-8 max-w-md w-full text-center space-y-5"
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-gray-900 text-xl font-semibold">
                Algo salio mal
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Ocurrio un error inesperado. Intenta recargar la pagina.
              </p>
            </div>

            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 text-sm font-medium transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
