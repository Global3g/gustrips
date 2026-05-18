'use client';

/**
 * TextEditor — text fields for the active page. Only the fields the active
 * layout actually renders are shown (e.g. text-only has no caption input).
 */

import { memo } from 'react';
import { LAYOUTS } from '@/lib/photobook/layouts';
import type { BookPage, LayoutId, TextZoneKind } from '@/lib/photobook/types';

type Field = TextZoneKind;

interface TextEditorProps {
  page: BookPage;
  onChange: (field: Field, value: string) => void;
}

const FIELD_META: Record<Field, { label: string; multiline?: boolean; placeholder: string }> = {
  title: { label: 'Título', placeholder: 'Día 1, Ciudad nueva, …' },
  subtitle: { label: 'Subtítulo', placeholder: 'Destino · fechas' },
  caption: { label: 'Descripción', placeholder: 'Una línea sobre el momento' },
  body: { label: 'Cuerpo', multiline: true, placeholder: 'Escribí libremente…' },
  date: { label: 'Fecha', placeholder: '2026-05-16' },
  location: { label: 'Lugar', placeholder: 'Ciudad, País' },
};

function TextEditorImpl({ page, onChange }: TextEditorProps) {
  const layout: LayoutId = page.layoutId;
  const def = LAYOUTS[layout];

  // Build the set of fields used by this layout. Always allow date and
  // location as "metadata" fields even if the layout doesn't render them
  // visibly — they're part of the page's identity and may be used by the
  // PDF generator (e.g. running header) in future iterations.
  const visibleKinds = new Set<TextZoneKind>(def.textZones.map((z) => z.kind));
  const fields: Field[] = [];
  if (visibleKinds.has('title')) fields.push('title');
  if (visibleKinds.has('subtitle')) fields.push('subtitle');
  if (visibleKinds.has('caption')) fields.push('caption');
  if (visibleKinds.has('body')) fields.push('body');
  // Date and location only when the layout actually shows them (currently
  // none do explicitly, but keep them as collapsible "metadata" inputs).
  fields.push('date');
  fields.push('location');

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field) => {
        const meta = FIELD_META[field];
        const value = (page[field] as string | undefined) ?? '';
        if (meta.multiline) {
          return (
            <label key={field} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">
                {meta.label}
              </span>
              <textarea
                value={value}
                onChange={(e) => onChange(field, e.target.value)}
                placeholder={meta.placeholder}
                rows={4}
                className="w-full px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-amber-300/40 resize-y"
              />
            </label>
          );
        }
        return (
          <label key={field} className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">
              {meta.label}
            </span>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(field, e.target.value)}
              placeholder={meta.placeholder}
              className="w-full px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-amber-300/40"
            />
          </label>
        );
      })}
    </div>
  );
}

export default memo(TextEditorImpl);
