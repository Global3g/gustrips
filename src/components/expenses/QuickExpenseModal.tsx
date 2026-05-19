'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useExpenses } from '@/hooks/useExpenses';
// This modal is only opened from inside `/trips/[tripId]/*` (EventCard +
// PendingExpensesBanner), so the TripDataProvider is guaranteed to be in the
// tree. Using the context avoids a duplicate `useTrip(tripId)` listener.
import { useTripFromContext as useTrip } from '@/context/TripDataContext';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useToast } from '@/context/ToastContext';
import { CURRENCIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/config/constants';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { classNames, getInitials } from '@/lib/utils/helpers';
import { Receipt, Loader2, DollarSign, Ban } from 'lucide-react';
import type { ExpenseCategory, PaymentMethod, TripEvent } from '@/types';

interface QuickExpenseModalProps {
  open: boolean;
  onClose: () => void;
  tripId: string;
  event: TripEvent;
  onCreated?: () => void;
}

export default function QuickExpenseModal({ open, onClose, tripId, event, onCreated }: QuickExpenseModalProps) {
  const { user } = useAuth();
  const { addTripExpense } = useExpenses(tripId);
  const { trip } = useTrip();
  const { travelers: allTravelers } = useGlobalTravelers();
  const { toast } = useToast();

  const tripTravelers = useMemo(() => {
    const ids = trip?.travelerIds || [];
    return allTravelers.filter((t) => ids.includes(t.id));
  }, [allTravelers, trip?.travelerIds]);

  const defaultCurrency = event.currency || trip?.budgetCurrency || 'MXN';
  const initialAmount = event.cost > 0 ? String(event.cost) : '';
  const initialCategory = (event.type as ExpenseCategory) || 'misc';
  const initialDescription = event.title || '';

  const [amount, setAmount] = useState(initialAmount);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [category, setCategory] = useState<ExpenseCategory>(initialCategory);
  const [description, setDescription] = useState(initialDescription);
  const [date, setDate] = useState(event.date || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidBy, setPaidBy] = useState('');
  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [pointsUsed, setPointsUsed] = useState('');
  const [equivalentValue, setEquivalentValue] = useState('');
  const [realValueCurrency, setRealValueCurrency] = useState(defaultCurrency);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(initialAmount);
      setCurrency(defaultCurrency);
      setCategory(initialCategory);
      setDescription(initialDescription);
      setDate(event.date || new Date().toISOString().split('T')[0]);
      setPaymentMethod('cash');
      setNotes('');
      setPointsUsed('');
      setEquivalentValue('');
      setRealValueCurrency(defaultCurrency);
      if (tripTravelers.length > 0) {
        setPaidBy(tripTravelers[0].id);
        setSplitBetween(tripTravelers.map((t) => t.id));
      } else {
        setPaidBy('');
        setSplitBetween([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event.id]);

  const toggleSplit = (id: string) => {
    setSplitBetween((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const submitExpense = async (overrides?: { amount?: number; notes?: string; description?: string }) => {
    const amt = overrides?.amount ?? parseFloat(amount);
    // Allow 0 (event didn't happen / was free → savings) but not negative or NaN
    if (amt === undefined || Number.isNaN(amt) || amt < 0) {
      toast('Ingresa un monto válido', 'error');
      return;
    }
    const desc = (overrides?.description ?? description).trim();
    if (!desc) {
      toast('Agrega una descripción', 'error');
      return;
    }
    if (!paidBy) {
      toast('Selecciona quien pagó', 'error');
      return;
    }
    if (splitBetween.length === 0) {
      toast('Selecciona al menos un viajero', 'error');
      return;
    }
    if (!user) {
      toast('Usuario no autenticado', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const noteValue = overrides?.notes !== undefined ? overrides.notes : notes.trim();
      await addTripExpense({
        tripId,
        eventId: event.id,
        description: desc,
        amount: amt,
        currency,
        category,
        paidBy,
        splitBetween,
        date,
        notes: noteValue || undefined,
        paymentMethod,
        pointsUsed: paymentMethod === 'points' ? Number(pointsUsed) || undefined : undefined,
        equivalentValue: paymentMethod === 'points' ? Number(equivalentValue) || undefined : undefined,
        realValueCurrency: paymentMethod === 'points' ? realValueCurrency : undefined,
        settled: false,
        createdBy: user.uid,
      });
      toast(amt === 0 ? 'Marcado como ahorrado' : 'Gasto agregado al evento', 'success');
      onCreated?.();
      onClose();
    } catch (err) {
      console.error('Error agregando gasto:', err);
      toast('Error al agregar el gasto', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => submitExpense();
  const handleMarkSkipped = () => submitExpense({
    amount: 0,
    notes: 'No se realizó — ahorrado',
    description: description.trim() || event.title,
  });

  const titleSlot = (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#047857', boxShadow: '0 0 0 1px rgba(16,185,129,0.3)' }}
      >
        <Receipt className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-gray-900 font-semibold text-base sm:text-lg leading-tight truncate">
          Agregar gasto real
        </h3>
        <p className="text-[11px] text-gray-500 mt-0.5 truncate">
          Vinculado a: {event.title}
        </p>
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} titleSlot={titleSlot} size="lg">
      <div className="space-y-4">
        {/* Amount + Currency */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Monto</label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2.5 text-base font-semibold tabular-nums rounded-lg border border-gray-200 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Moneda</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 outline-none"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Descripcion</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. Cena en restaurante"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 outline-none"
          />
        </div>

        {/* Category + Date */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 outline-none"
            >
              {Object.entries(EXPENSE_CATEGORIES).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 outline-none"
            />
          </div>
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Metodo de pago</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 outline-none"
          >
            {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Points fields (only when method is 'points') */}
        {paymentMethod === 'points' && (
          <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-violet-50 border border-violet-200">
            <div>
              <label className="block text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-1">Puntos usados</label>
              <input
                type="number"
                value={pointsUsed}
                onChange={(e) => setPointsUsed(e.target.value)}
                placeholder="0"
                className="w-full px-2 py-1.5 text-xs rounded border border-violet-200 bg-white outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-1">Valor real</label>
              <input
                type="number"
                value={equivalentValue}
                onChange={(e) => setEquivalentValue(e.target.value)}
                placeholder="0.00"
                className="w-full px-2 py-1.5 text-xs rounded border border-violet-200 bg-white outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-1">Moneda real</label>
              <select
                value={realValueCurrency}
                onChange={(e) => setRealValueCurrency(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded border border-violet-200 bg-white outline-none focus:border-violet-400"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Paid by */}
        {tripTravelers.length > 0 && (
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Pagado por</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {tripTravelers.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPaidBy(t.id)}
                  className={classNames(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all',
                    paidBy === t.id
                      ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400/30'
                      : 'bg-white border-gray-200 hover:border-gray-300',
                  )}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                    style={{ backgroundColor: t.avatarColor || '#6366f1' }}
                  >
                    {getInitials(t.fullName)}
                  </span>
                  <span className="text-xs font-medium text-gray-700 truncate">{t.fullName.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Split between */}
        {tripTravelers.length > 1 && (
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">
              Dividir entre ({splitBetween.length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tripTravelers.map((t) => {
                const active = splitBetween.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleSplit(t.id)}
                    className={classNames(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all',
                      active
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300',
                    )}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                      style={{ backgroundColor: active ? (t.avatarColor || '#6366f1') : '#9ca3af' }}
                    >
                      {getInitials(t.fullName)}
                    </span>
                    <span className="text-[11px] font-semibold">{t.fullName.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Detalles adicionales..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 outline-none resize-none"
          />
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-gray-200 space-y-2">
          {/* Skip / savings shortcut */}
          {event.cost > 0 && (
            <button
              type="button"
              onClick={handleMarkSkipped}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-60"
            >
              <Ban className="w-4 h-4" />
              No se realizó — ahorrado
            </button>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              icon={submitting ? Loader2 : Receipt}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {submitting ? 'Guardando...' : 'Agregar gasto'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
