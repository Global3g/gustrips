'use client';

import { useState } from 'react';
import { Plus, CreditCard, Check } from 'lucide-react';
import { usePaymentCards } from '@/hooks/usePaymentCards';
import type { PaymentCardType } from '@/types';

interface CardPickerProps {
  /** Which kind of card to show/create — matches the chosen payment method. */
  type: PaymentCardType;
  value?: string;
  onChange: (cardId: string) => void;
}

/** Short human label for a card: "BBVA Oro ·6789". */
export function cardLabel(c: { alias: string; bank?: string; last4?: string }): string {
  const head = [c.bank, c.alias].filter(Boolean).join(' ') || c.alias;
  return c.last4 ? `${head} ·${c.last4}` : head;
}

/**
 * Pick which registered card paid an expense (or add a new one inline). Reads
 * the global wallet (usePaymentCards) and only shows cards of the matching
 * type so a credit payment can't accidentally be tagged to a debit card.
 */
export default function CardPicker({ type, value, onChange }: CardPickerProps) {
  const { cards, loading, addCard } = usePaymentCards();
  const matching = cards.filter((c) => c.type === type);

  const [adding, setAdding] = useState(false);
  const [alias, setAlias] = useState('');
  const [bank, setBank] = useState('');
  const [last4, setLast4] = useState('');
  const [saving, setSaving] = useState(false);

  const typeLabel = type === 'credit' ? 'crédito' : 'débito';

  const handleAdd = async () => {
    if (!alias.trim() || saving) return;
    setSaving(true);
    try {
      const id = await addCard({
        alias: alias.trim(),
        type,
        bank: bank.trim() || undefined,
        last4: last4.trim() || undefined,
      });
      onChange(id);
      setAlias('');
      setBank('');
      setLast4('');
      setAdding(false);
    } catch {
      /* surfaced by the form staying open */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">
        ¿Con qué tarjeta de {typeLabel}?
      </label>

      {loading ? (
        <div className="h-9 rounded-lg bg-gray-100 animate-pulse" />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {matching.map((c) => {
            const selected = c.id === value;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange(c.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                  selected
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.color || '#475569' }}
                />
                {cardLabel(c)}
                {selected && <Check className="w-3 h-3" />}
              </button>
            );
          })}

          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-emerald-300 hover:text-emerald-600 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva tarjeta
            </button>
          )}
        </div>
      )}

      {matching.length === 0 && !adding && !loading && (
        <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
          <CreditCard className="w-3 h-3" />
          Aún no diste de alta tarjetas de {typeLabel}. Agrega una y se guarda para todos tus viajes.
        </p>
      )}

      {adding && (
        <div className="mt-2 grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Alias (ej. BBVA Oro)"
            className="col-span-2 px-2 py-1.5 text-xs rounded border border-gray-200 bg-white outline-none focus:border-emerald-400"
            autoFocus
          />
          <input
            type="text"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="Banco (ej. BBVA)"
            className="px-2 py-1.5 text-xs rounded border border-gray-200 bg-white outline-none focus:border-emerald-400"
          />
          <input
            type="text"
            inputMode="numeric"
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Últimos 4"
            className="px-2 py-1.5 text-xs rounded border border-gray-200 bg-white outline-none focus:border-emerald-400"
          />
          <div className="col-span-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setAdding(false); setAlias(''); setBank(''); setLast4(''); }}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!alias.trim() || saving}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition"
            >
              {saving ? 'Guardando…' : 'Guardar tarjeta'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
