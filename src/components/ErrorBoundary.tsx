'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Componente crasheado:', error, info.componentStack);
    // Punto de integración futura con Sentry:
    // Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-gray-950 text-white p-8 gap-4">
          <div className="h-16 w-16 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-3xl">
            ⚠️
          </div>
          <h2 className="text-xl font-black">Algo ha fallado</h2>
          <p className="text-sm text-gray-400 text-center max-w-sm">
            {this.state.error?.message || 'Error inesperado en la interfaz.'}
          </p>
          <button
            onClick={this.resetError}
            className="px-6 py-2 bg-white text-black font-bold rounded-xl hover:scale-105 transition-all"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
