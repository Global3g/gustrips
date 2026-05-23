import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Lock, Shield, Cloud, KeyRound, FileX, AlertCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Seguridad · GusTrips',
  description: 'Cómo protegemos tus documentos, fotos y datos sensibles.',
};

export default function SecurityPage() {
  return (
    <div className="mode-planning max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 hover:underline"
        style={{ color: 'var(--pillar-accent)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al dashboard
      </Link>

      <div style={{ color: 'var(--pillar-ink)' }}>
        <p className="text-eyebrow mb-2" style={{ color: 'var(--pillar-accent)' }}>
          Seguridad
        </p>
        <h1 className="text-hero mb-3">Tu pasaporte digital, blindado.</h1>
        <p className="text-base leading-relaxed mt-4" style={{ color: 'var(--pillar-ink-soft)' }}>
          GusTrips guarda documentos sensibles (pasaportes, reservas, boarding passes).
          Te contamos en simple cómo los protegemos.
        </p>

        <div className="mt-12 grid sm:grid-cols-2 gap-5">
          <Tile
            icon={Lock}
            title="Cifrado en tránsito"
            body="Toda comunicación entre tu dispositivo y nuestros servidores usa TLS 1.3 con certificados emitidos por Let's Encrypt."
          />
          <Tile
            icon={Cloud}
            title="Cifrado en reposo"
            body="Firebase Storage y Firestore cifran tus archivos en disco con AES-256 manejado por Google Cloud."
          />
          <Tile
            icon={Shield}
            title="Reglas de seguridad"
            body="Firestore valida que cada lectura/escritura venga del dueño del viaje o un colaborador autorizado. Auditado y desplegado en producción."
          />
          <Tile
            icon={KeyRound}
            title="Bloqueo biométrico (opcional)"
            body="Los documentos sensibles pueden requerir Face ID / Touch ID / WebAuthn antes de mostrarse. Lo activás desde Configuración."
          />
          <Tile
            icon={FileX}
            title="Borrado real"
            body="Cuando eliminás un viaje o tu cuenta, los archivos se borran del Storage en menos de 24h. No hay 'soft delete' invisible."
          />
          <Tile
            icon={AlertCircle}
            title="Monitoreo de errores"
            body="Sentry rastrea errores técnicos sin acceder a tus datos personales. Tu UID se asocia al error solo para soporte, no para análisis comportamental."
          />
        </div>

        <div className="mt-14 pt-10 border-t" style={{ borderColor: 'var(--pillar-rule)' }}>
          <h2 className="text-editorial text-2xl mb-3" style={{ color: 'var(--pillar-ink)' }}>
            Lo que todavía no hacemos (honesto)
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed" style={{ color: 'var(--pillar-ink-soft)' }}>
            <li>Cifrado end-to-end (E2EE) de archivos — está en el roadmap.</li>
            <li>Compliance SOC2 — apuntado para 2027.</li>
            <li>2FA por TOTP — Google login ya cubre 2FA; agregar TOTP en email/pass está en cola.</li>
          </ul>
        </div>

        <div className="mt-14 pt-10 border-t" style={{ borderColor: 'var(--pillar-rule)' }}>
          <h2 className="text-editorial text-2xl mb-3" style={{ color: 'var(--pillar-ink)' }}>
            Reportar una vulnerabilidad
          </h2>
          <p className="text-base leading-relaxed" style={{ color: 'var(--pillar-ink-soft)' }}>
            Si encontraste algo, escribinos a <code>security@gustrips.app</code>. Te
            respondemos en 48h. No iniciamos acciones legales contra reportes hechos de
            buena fe (safe harbor).
          </p>
        </div>
      </div>
    </div>
  );
}

interface TileProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

function Tile({ icon: Icon, title, body }: TileProps) {
  return (
    <div
      className="rounded-2xl p-5 border"
      style={{
        background: 'var(--pillar-surface)',
        borderColor: 'var(--pillar-rule)',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: 'var(--pillar-accent)', color: 'white' }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-base font-semibold mb-1.5" style={{ color: 'var(--pillar-ink)' }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--pillar-ink-soft)' }}>
        {body}
      </p>
    </div>
  );
}
