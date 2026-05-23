'use client';

/**
 * Renders children only when the biometric gate is unlocked. Otherwise
 * shows a friendly enrollment / unlock screen. Drop-in wrapper for any
 * sensitive section.
 *
 * Usage:
 *   <BiometricGate sectionLabel="Documentos">
 *     <DocumentsView />
 *   </BiometricGate>
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import { useBiometricLock } from '@/hooks/useBiometricLock';

interface Props {
  sectionLabel: string;
  children: React.ReactNode;
}

export default function BiometricGate({ sectionLabel, children }: Props) {
  const lock = useBiometricLock();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-prompt for unlock when the credential is already registered.
  // Users coming from a deep link don't need to tap "unlock" first.
  useEffect(() => {
    if (lock.status === 'registered' && !busy) {
      void handleUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock.status]);

  if (lock.isUnlocked) return <>{children}</>;

  async function handleEnable() {
    setBusy(true);
    setError(null);
    const res = await lock.enable();
    setBusy(false);
    if (!res.ok && res.reason !== 'cancelled') setError(reasonToCopy(res.reason));
  }

  async function handleUnlock() {
    setBusy(true);
    setError(null);
    const res = await lock.unlock();
    setBusy(false);
    if (!res.ok && res.reason !== 'cancelled') setError(reasonToCopy(res.reason));
  }

  // Status-specific copy
  const isFirstTime = lock.status === 'available';
  const cta = isFirstTime ? 'Activar bloqueo biométrico' : 'Desbloquear con tu huella / Face ID';
  const handler = isFirstTime ? handleEnable : handleUnlock;

  return (
    <div className="mode-planning min-h-[60vh] flex items-center justify-center px-4">
      <div
        className="max-w-md w-full rounded-3xl border p-8 text-center"
        style={{
          background: 'var(--pillar-surface)',
          borderColor: 'var(--pillar-rule)',
        }}
      >
        <div
          className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6"
          style={{ background: 'var(--pillar-accent)', color: 'white' }}
        >
          {isFirstTime ? <ShieldCheck className="w-7 h-7" /> : <KeyRound className="w-7 h-7" />}
        </div>

        <p className="text-eyebrow mb-2" style={{ color: 'var(--pillar-accent)' }}>
          {sectionLabel}
        </p>

        <h2 className="text-editorial text-2xl mb-3" style={{ color: 'var(--pillar-ink)' }}>
          {isFirstTime
            ? `Protegé tus documentos con tu huella o Face ID`
            : `Confirmá que sos vos`}
        </h2>

        <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--pillar-ink-soft)' }}>
          {isFirstTime
            ? 'Antes de mostrar pasaportes, boletos y reservas, vamos a pedir tu autenticación biométrica. Lo configuramos una sola vez en este dispositivo.'
            : 'Apenas autentiques con tu huella, Face ID o Windows Hello, podés ver tus documentos.'}
        </p>

        {error && (
          <div
            className="mb-4 rounded-lg p-3 text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handler}
          disabled={busy || lock.status === 'unsupported'}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
          style={{
            background: 'var(--pillar-accent)',
            color: 'white',
            minWidth: 240,
          }}
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {cta}
        </button>

        {lock.status === 'unsupported' && (
          <p className="mt-4 text-xs" style={{ color: 'var(--pillar-ink-soft)' }}>
            Tu navegador no soporta WebAuthn. Probá Safari, Chrome o Edge actualizados.
          </p>
        )}
      </div>
    </div>
  );
}

function reasonToCopy(reason: string): string {
  switch (reason) {
    case 'NotAllowedError':
      return 'No pudimos confirmar tu identidad. Probá de nuevo.';
    case 'SecurityError':
      return 'La operación falló por seguridad. Asegurate de estar en HTTPS.';
    case 'NotSupportedError':
    case 'unsupported':
      return 'Este dispositivo o navegador no soporta WebAuthn.';
    case 'not-enrolled':
      return 'Todavía no activaste el bloqueo. Tocá "Activar".';
    default:
      return 'No pudimos completar la autenticación. Intentá de nuevo.';
  }
}
