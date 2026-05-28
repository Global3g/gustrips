import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacidad · GusTrips',
  description: 'Cómo manejamos tu información personal y de viajes.',
};

const LAST_UPDATED = '2026-05-22';

export default function PrivacyPage() {
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
          Política de privacidad
        </p>
        <h1 className="text-hero mb-3">Tus viajes son tuyos.</h1>
        <p className="text-footnote" style={{ color: 'var(--pillar-ink-soft)' }}>
          Última actualización: {LAST_UPDATED}
        </p>

        <div className="prose prose-neutral max-w-none mt-10 space-y-6 text-base leading-relaxed">
          <Section title="Qué guardamos">
            <p>
              GusTrips guarda únicamente lo que vos ingresás para organizar tus viajes:
              itinerarios, fotos, gastos, contactos de viaje y documentos que decidas subir.
              No vendemos tu data ni la usamos para entrenar modelos.
            </p>
          </Section>

          <Section title="Dónde vive tu información">
            <p>
              Tus datos viajan a través de Firebase (Google Cloud) en US-central1 y se
              almacenan ahí. La conexión usa TLS 1.3 de tu dispositivo al servidor. Las
              fotos se guardan en Firebase Storage; los datos estructurados, en Firestore.
            </p>
            <p>
              Los documentos que subís a la sección de Documentos están detrás de un gate
              biométrico opcional (Face ID / Touch ID / WebAuthn) que podés activar en
              Configuración.
            </p>
          </Section>

          <Section title="Quién puede verla">
            <ul className="list-disc pl-6 space-y-1">
              <li>Vos — siempre.</li>
              <li>
                Personas que invites a un viaje específico — solo ven ese viaje y solo
                con el rol que les diste (lector, editor, propietario).
              </li>
              <li>
                Nadie de GusTrips ve tu data salvo que pidas soporte y autorices
                explícitamente acceso temporal.
              </li>
            </ul>
          </Section>

          <Section title="Cookies y tracking">
            <p>
              Usamos cookies estrictamente técnicas (sesión + preferencias). No usamos
              cookies de tracking publicitario. No tenemos Google Analytics ni Meta Pixel.
            </p>
          </Section>

          <Section title="Tus derechos">
            <ul className="list-disc pl-6 space-y-1">
              <li>Exportar todos tus datos en JSON desde Configuración → Exportar.</li>
              <li>Eliminar tu cuenta y todos tus viajes desde Configuración → Eliminar cuenta.</li>
              <li>Pedir que dejemos de procesar algún dato específico escribiendo a soporte.</li>
            </ul>
          </Section>

          <Section title="Cumplimiento">
            <p>
              GusTrips opera bajo los principios del GDPR (UE) y CCPA (California). Si
              vivís en jurisdicciones con reglas particulares, escribinos y respetamos
              los derechos locales que correspondan.
            </p>
          </Section>

          <Section title="Cambios">
            <p>
              Si cambiamos algo importante en esta política te avisamos por email y dentro
              de la app antes de que entre en vigor.
            </p>
          </Section>

          <Section title="Contacto">
            <p>
              ¿Dudas, pedido de export, baja? Escribinos: <code>privacy@gustrips.app</code>
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="text-editorial text-2xl mb-2"
        style={{ color: 'var(--pillar-ink)' }}
      >
        {title}
      </h2>
      <div style={{ color: 'var(--pillar-ink-soft)' }}>{children}</div>
    </section>
  );
}
