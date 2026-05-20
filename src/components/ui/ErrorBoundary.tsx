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
  componentStack: string | null;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Render error caught:', error);
    // componentStack contains REAL component names even in production
    // builds. Surfacing it makes minified errors actionable.
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
    // Forward to Sentry. No-op if the DSN env var is missing.
    Sentry.captureException(error, {
      tags: { boundary: 'ErrorBoundary' },
      contexts: {
        react: { componentStack: errorInfo.componentStack ?? null },
      },
    });
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null, componentStack: null });
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const showDebug = this.state.error && this.state.componentStack;
      return (
        <div className="flex items-center justify-center min-h-[60vh] px-4 py-8">
          <div
            className="rounded-2xl p-6 max-w-2xl w-full space-y-4"
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-gray-900 text-lg font-semibold">
                  Algo salio mal
                </h2>
                <p className="text-gray-500 text-sm">
                  Ocurrio un error inesperado.
                </p>
              </div>
            </div>

            {showDebug && (
              <details className="text-left">
                <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900 select-none">
                  Detalles tecnicos (para reportar el bug)
                </summary>
                <div className="mt-2 space-y-2">
                  <pre className="text-[11px] bg-red-50 border border-red-200 text-red-900 p-2 rounded overflow-auto whitespace-pre-wrap">
                    {this.state.error?.message}
                  </pre>
                  <pre className="text-[10px] bg-gray-50 border border-gray-200 text-gray-700 p-2 rounded overflow-auto max-h-60 whitespace-pre-wrap font-mono">
                    {this.state.componentStack}
                  </pre>
                </div>
              </details>
            )}

            <div className="flex justify-end">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 text-sm font-medium transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
