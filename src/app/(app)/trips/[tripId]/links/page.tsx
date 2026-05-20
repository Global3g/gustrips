'use client';

import { ExternalLink } from 'lucide-react';
import QuickLinks from '@/components/trips/QuickLinks';

export default function LinksPage() {
  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Quick Links</h1>
          <p className="text-gray-400 text-sm">Sitios utiles para planificar tu viaje</p>
        </div>
        <ExternalLink className="w-5 h-5 text-gray-200" />
      </div>

      {/* Links organizados por categoria */}
      <QuickLinks />
    </div>
  );
}
