'use client';

/**
 * Fast Expense FAB — bottom-right floating button to capture an expense
 * with the absolute minimum of taps. Built for "estoy caminando, gasté
 * algo, lo anoto ya" — not for the full bookkeeping flow.
 *
 * Two-step flow:
 *   1. Tap FAB → bottom sheet with just AMOUNT (autofocus) + CATEGORY chips
 *      + optional 1-line description. Tap "Guardar" → expense saved
 *      with sensible defaults (today, trip currency, current user pays,
 *      everyone splits).
 *   2. After saving, sheet asks "¿lo agendamos también?" with a one-tap
 *      "Sí, agendar" → creates an event of the matching type with the
 *      same description, amount, today's date, and the current time. The
 *      user can also say "No, gracias" or "Editar antes" (opens the
 *      full event editor with the data pre-filled — out of scope for v1,
 *      we surface that as a future option).
 *
 * Why not extend QuickExpenseModal: QuickExpenseModal is bound to an
 * EXISTING event (it's the "log the real cost of this planned event"
 * flow). This component is the inverse — log a spontaneous expense AND
 * optionally generate the matching event.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  X,
  Loader2,
  Receipt,
  Check,
  Calendar as CalendarIcon,
  Camera,
  ImagePlus,
  Keyboard,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useExpenses } from '@/hooks/useExpenses';
import { useTripFromContext as useTrip, useEventsFromContext as useEvents } from '@/context/TripDataContext';
import { useToast } from '@/context/ToastContext';
import { EXPENSE_CATEGORIES, CURRENCIES } from '@/config/constants';
import type { ExpenseCategory, EventType, PaymentMethod } from '@/types';

/** Map every expense category to the event type we'd create from it. */
const EXPENSE_TO_EVENT_TYPE: Record<ExpenseCategory, EventType> = {
  flight: 'flight',
  hotel: 'hotel',
  car_rental: 'car_rental',
  activity: 'activity',
  restaurant: 'restaurant',
  transport: 'transport',
  cruise: 'cruise',
  // The "soft" categories don't map 1:1 to a logistics event type — we
  // record them as a generic Activity so they still show up on the
  // itinerary timeline.
  souvenirs: 'activity',
  snacks: 'activity',
  clothing: 'activity',
  fuel: 'transport',
  misc: 'activity',
};

/** Human-friendly suggested title when the user leaves description empty. */
const CATEGORY_DEFAULT_LABEL: Record<ExpenseCategory, string> = {
  flight: 'Vuelo',
  hotel: 'Hotel',
  car_rental: 'Renta de auto',
  activity: 'Actividad',
  restaurant: 'Comida',
  transport: 'Transporte',
  cruise: 'Crucero',
  souvenirs: 'Souvenir',
  snacks: 'Snack',
  clothing: 'Ropa',
  fuel: 'Combustible',
  misc: 'Gasto',
};

/** Categories to surface as primary chips. Order matters — most common first. */
const PRIMARY_CATEGORIES: ExpenseCategory[] = [
  'restaurant',
  'transport',
  'activity',
  'snacks',
  'shopping' as ExpenseCategory, // ignored at runtime, won't render
  'hotel',
  'souvenirs',
  'fuel',
  'misc',
];

interface Props {
  tripId: string;
}

type Step = 'choose' | 'scanning' | 'amount' | 'event-prompt' | 'pick-event';

interface SavedExpenseSummary {
  id: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
}

export default function FastExpenseFAB({ tripId }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('choose');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('restaurant');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [scanCurrency, setScanCurrency] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<SavedExpenseSummary | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const { user } = useAuth();
  const { trip } = useTrip();
  const { addTripExpense, updateExpense } = useExpenses(tripId);
  const { createEvent, events } = useEvents();
  const { toast } = useToast();
  const [linkingEventId, setLinkingEventId] = useState<string | null>(null);

  const currency = trip?.budgetCurrency || 'MXN';

  // Filter chips: keep the order, but only render the categories that
  // actually exist in EXPENSE_CATEGORIES (drops 'shopping' which is not
  // a real category — kept in the list for future-proofing).
  const visibleCategories = useMemo(
    () => PRIMARY_CATEGORIES.filter((c) => c in EXPENSE_CATEGORIES),
    [],
  );

  // Reset state every time the sheet opens so the next capture starts clean.
  // Opens on the "choose" step so the user picks photo vs manual first.
  useEffect(() => {
    if (!open) return;
    setStep('choose');
    setAmount('');
    setDescription('');
    setCategory('restaurant');
    setPaymentMethod('cash');
    setScanCurrency(null);
    setScanError(null);
    setSaved(null);
  }, [open]);

  // When we land on the manual amount step (either directly or after a scan),
  // pop the iOS numeric pad. After a scan the amount is pre-filled — focus
  // still lets the user adjust it without an extra tap.
  useEffect(() => {
    if (step !== 'amount') return;
    const t = setTimeout(() => amountInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [step]);

  const close = () => {
    if (submitting || creatingEvent || step === 'scanning') return;
    setOpen(false);
  };

  /**
   * Convert a File to a base64 string (no data: prefix). We need the raw
   * bytes for Gemini Vision; the route handler accepts mimeType separately.
   */
  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(',');
        const base64 = comma >= 0 ? result.slice(comma + 1) : result;
        resolve({ base64, mimeType: file.type || 'image/jpeg' });
      };
      reader.onerror = () => reject(new Error('No pude leer la imagen'));
      reader.readAsDataURL(file);
    });
  };

  const handleReceiptFile = async (file: File | null | undefined) => {
    if (!file) return;
    setStep('scanning');
    setScanError(null);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Error ${res.status}`);
      }
      const data = json.data || {};
      // Apply detected fields with safe fallbacks. Anything missing is left
      // as a default so the user only edits what's wrong.
      const detectedAmount = typeof data.amount === 'number'
        ? String(data.amount)
        : typeof data.amount === 'string'
          ? data.amount.replace(/[^0-9.]/g, '')
          : '';
      if (detectedAmount) setAmount(detectedAmount);
      if (typeof data.description === 'string' && data.description.trim()) {
        setDescription(data.description.trim());
      }
      if (typeof data.category === 'string' && data.category in EXPENSE_CATEGORIES) {
        setCategory(data.category as ExpenseCategory);
      }
      if (typeof data.currency === 'string' && CURRENCIES.includes(data.currency)) {
        setScanCurrency(data.currency);
      }
      if (typeof data.paymentMethod === 'string') {
        const allowed: PaymentMethod[] = ['cash', 'debit', 'credit', 'transfer', 'points', 'other'];
        if (allowed.includes(data.paymentMethod as PaymentMethod)) {
          setPaymentMethod(data.paymentMethod as PaymentMethod);
        }
      }
      setStep('amount');
    } catch (err) {
      console.error('[FastExpenseFAB] scan failed', err);
      setScanError(err instanceof Error ? err.message : 'No pude leer el ticket');
      // Drop back to the choose step so the user can retry or go manual.
      setStep('choose');
    }
  };

  const submitExpense = async () => {
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt < 0) {
      toast('Ingresá un monto válido', 'error');
      return;
    }
    if (!user) {
      toast('Iniciá sesión primero', 'error');
      return;
    }
    if (!trip) {
      toast('Cargando el viaje, intentá de nuevo', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Sensible defaults so we can save in one tap:
      //   - date: today
      //   - paidBy: current user
      //   - splitBetween: all travelers in the trip (falls back to user
      //     alone if travelerIds is empty)
      //   - payment method: cash (most common; user can edit later)
      const splitBetween =
        trip.travelerIds && trip.travelerIds.length > 0
          ? trip.travelerIds
          : [user.uid];
      const todayIso = new Date().toISOString().slice(0, 10);
      const finalDescription =
        description.trim() || CATEGORY_DEFAULT_LABEL[category];

      // The scan may have detected a different currency than the trip's
      // budget currency — use it if present (helps trips with mixed
      // currencies, e.g. a side spend in EUR on a USD-budgeted trip).
      const finalCurrency = scanCurrency || currency;

      const expenseId = await addTripExpense({
        tripId,
        description: finalDescription,
        amount: amt,
        currency: finalCurrency,
        category,
        paidBy: user.uid,
        splitBetween,
        date: todayIso,
        paymentMethod,
        settled: false,
        createdBy: user.uid,
      });

      setSaved({ id: expenseId, amount: amt, description: finalDescription, category });
      setStep('event-prompt');
    } catch (err) {
      console.error('[FastExpenseFAB] save failed', err);
      toast('Error al guardar el gasto', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const skipEvent = () => {
    toast('Gasto guardado', 'success');
    setOpen(false);
  };

  /**
   * Link the saved expense to an existing trip event. Updates the
   * expense doc with `eventId` and closes the sheet.
   */
  const linkToExistingEvent = async (eventId: string) => {
    if (!saved) return;
    setLinkingEventId(eventId);
    try {
      await updateExpense(saved.id, { eventId });
      toast('Gasto vinculado al evento', 'success');
      setOpen(false);
    } catch (err) {
      console.error('[FastExpenseFAB] link failed', err);
      toast('No pude vincular el gasto', 'error');
    } finally {
      setLinkingEventId(null);
    }
  };

  /**
   * Events to surface in the picker: a ±3-day window around today so the
   * user can attach a charge they're entering a couple of days late, or
   * a pre-paid expense for something a couple of days ahead. Sort puts
   * today first (most likely target), then upcoming chronological, then
   * past in reverse. Deleted events are filtered out.
   */
  const linkableEvents = useMemo(() => {
    const today = new Date();
    const toIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayIso = toIso(today);
    const allowed = new Set<string>();
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      allowed.add(toIso(d));
    }
    return (events || [])
      .filter((ev) => ev.date && allowed.has(ev.date))
      // @ts-expect-error — deletedAt isn't on the typed surface but
      // landing here from a stale snapshot would crash the picker.
      .filter((ev) => !ev.deletedAt)
      .sort((a, b) => {
        // today first; then future ascending; then past descending.
        const aIsToday = a.date === todayIso;
        const bIsToday = b.date === todayIso;
        if (aIsToday && !bIsToday) return -1;
        if (bIsToday && !aIsToday) return 1;
        const aIsFuture = a.date > todayIso;
        const bIsFuture = b.date > todayIso;
        if (aIsFuture !== bIsFuture) return aIsFuture ? -1 : 1;
        const cmp = aIsFuture ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
        if (cmp !== 0) return cmp;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
  }, [events]);

  const confirmEvent = async () => {
    if (!saved) {
      setOpen(false);
      return;
    }
    setCreatingEvent(true);
    try {
      const now = new Date();
      const todayIso = now.toISOString().slice(0, 10);
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const eventType = EXPENSE_TO_EVENT_TYPE[saved.category];

      await createEvent({
        title: saved.description,
        type: eventType,
        date: todayIso,
        startTime: `${hh}:${mm}`,
        endTime: '',
        location: '',
        notes: 'Generado desde un gasto rápido',
        cost: saved.amount,
        currency,
        attachments: [],
      });

      toast('Gasto y evento guardados', 'success');
      setOpen(false);
    } catch (err) {
      console.error('[FastExpenseFAB] event creation failed', err);
      toast('Gasto guardado, pero falló el evento', 'error');
      setOpen(false);
    } finally {
      setCreatingEvent(false);
    }
  };

  return (
    <>
      {/* FAB — sits one row above the Gemini chatbot button so they
          stack cleanly. On mobile both clear the trip bottom-nav (chatbot
          at ~100px, expense at ~170px above safe-area). On desktop the
          bottom-nav doesn't exist so we use a flat 88px to keep the same
          stacking order. */}
      {!open && (
        <button
          type="button"
          aria-label="Agregar gasto rápido"
          onClick={() => setOpen(true)}
          className="fixed right-6 lg:bottom-[88px] z-40 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full shadow-lg text-sm font-semibold transition-all hover:scale-105 active:scale-95 bottom-[calc(env(safe-area-inset-bottom,0px)+170px)]"
          style={{
            background: 'linear-gradient(135deg, #047857 0%, #10b981 100%)',
            color: '#ffffff',
            boxShadow: '0 10px 30px -10px rgba(4, 120, 87, 0.55)',
          }}
        >
          <Plus className="w-4 h-4" />
          Gasto
        </button>
      )}

      {/* Sheet */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Agregar gasto rápido"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={close}
          />

          {/* Sheet body */}
          <div
            className="relative w-full sm:w-[440px] sm:rounded-3xl rounded-t-3xl bg-white shadow-2xl overflow-hidden"
            style={{ maxHeight: '92vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {step === 'choose' && 'Nuevo gasto'}
                    {step === 'scanning' && 'Leyendo el ticket'}
                    {step === 'amount' && 'Confirmá el gasto'}
                    {step === 'event-prompt' && 'Guardado'}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {step === 'choose' && '¿Cómo lo cargás?'}
                    {step === 'scanning' && 'Un segundo, sacamos los datos solos'}
                    {step === 'amount' && (trip?.title || 'Este viaje')}
                    {step === 'event-prompt' && 'También podemos agendarlo'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={submitting || creatingEvent || step === 'scanning'}
                aria-label="Cerrar"
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Hidden file inputs — driven by the buttons in step "choose".
                One has `capture="environment"` to open the rear camera
                directly; the other lets the user pick from the gallery
                (or take a photo, depending on OS). */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = '';
                void handleReceiptFile(file);
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = '';
                void handleReceiptFile(file);
              }}
            />

            {/* Choose step — photo first, manual second */}
            {step === 'choose' && (
              <div className="p-5 space-y-3">
                {scanError && (
                  <div className="rounded-lg p-3 text-sm bg-amber-50 border border-amber-200 text-amber-800">
                    No pude leer el ticket: {scanError}. Probá con otra foto o cargalo manual.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full inline-flex items-center gap-3 px-4 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <Camera className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-bold leading-tight">Tomar foto del ticket</div>
                    <div className="text-[11px] opacity-90 mt-0.5">Lo leemos solos: monto, comercio y categoría</div>
                  </div>
                  <Sparkles className="w-4 h-4 opacity-70" />
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full inline-flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
                >
                  <ImagePlus className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold text-gray-900 leading-tight">Elegir foto de la galería</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Si ya tenés el ticket guardado</div>
                  </div>
                </button>

                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">o</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <button
                  type="button"
                  onClick={() => setStep('amount')}
                  className="w-full inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <Keyboard className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  <div className="flex-1 text-left text-sm font-semibold text-gray-700">
                    Escribir manualmente
                  </div>
                </button>
              </div>
            )}

            {/* Scanning step — loading overlay while Gemini reads the ticket */}
            {step === 'scanning' && (
              <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[260px]">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center">
                    <Receipt className="w-7 h-7" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  </div>
                </div>
                <div>
                  <div className="text-base font-bold text-gray-900">Leyendo el ticket…</div>
                  <div className="text-sm text-gray-500 mt-1">Identificando monto, comercio y categoría.</div>
                </div>
                <div className="text-[11px] text-gray-400 max-w-xs">
                  Si tarda más de 10 segundos es que la foto está movida o muy oscura.
                </div>
              </div>
            )}

            {/* Body */}
            {step === 'amount' && (
              <div className="p-5 space-y-4">
                {/* If we got here from a scan, show a subtle banner so the
                    user knows the fields below are detected and editable. */}
                {scanCurrency && (
                  <div className="rounded-xl px-3 py-2 flex items-center gap-2 bg-emerald-50 border border-emerald-200">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span className="text-[12px] text-emerald-800 font-medium">
                      Leído del ticket. Revisalo y guardalo.
                    </span>
                  </div>
                )}

                {/* Amount — the headline input. The currency label prefers
                    the scan-detected currency when present (e.g. EUR ticket
                    on an MXN-budgeted trip). */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    Cuánto gastaste
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-gray-400">
                      {currencySymbol(scanCurrency || currency)}
                    </span>
                    <input
                      ref={amountInputRef}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="flex-1 text-4xl font-bold tabular-nums outline-none bg-transparent text-gray-900 placeholder:text-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-400">{scanCurrency || currency}</span>
                  </div>
                </div>

                {/* Description — optional, 1 line */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    En qué (opcional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={CATEGORY_DEFAULT_LABEL[category]}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Category chips */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Categoría
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleCategories.map((c) => {
                      const cfg = EXPENSE_CATEGORIES[c];
                      const active = category === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCategory(c)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                          style={
                            active
                              ? {
                                  background: cfg.color,
                                  color: '#fff',
                                  borderColor: cfg.color,
                                }
                              : {
                                  background: '#fff',
                                  color: '#374151',
                                  borderColor: '#e5e7eb',
                                }
                          }
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="button"
                  onClick={submitExpense}
                  disabled={submitting || !amount}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {submitting ? 'Guardando…' : 'Guardar gasto'}
                </button>

                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  Lo guardamos como pagado por vos en efectivo, fecha hoy. Editalo después si hace falta.
                </p>
              </div>
            )}

            {step === 'event-prompt' && saved && (
              <div className="p-5 space-y-4">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide mb-1">
                    Gasto guardado
                  </div>
                  <div className="text-lg font-bold text-emerald-900">
                    {currencySymbol(currency)}
                    {saved.amount.toLocaleString()} {currency} · {saved.description}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">
                    ¿Lo agendamos también?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Creamos un evento <strong>{EXPENSE_CATEGORIES[EXPENSE_TO_EVENT_TYPE[saved.category] as ExpenseCategory]?.label || 'de actividad'}</strong> en
                    tu itinerario, con esta descripción y la hora actual.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={confirmEvent}
                    disabled={creatingEvent}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                  >
                    {creatingEvent ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarIcon className="w-4 h-4" />}
                    {creatingEvent ? 'Creando evento…' : 'Crear evento nuevo'}
                  </button>

                  {linkableEvents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep('pick-event')}
                      disabled={creatingEvent}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 text-sm font-bold transition-colors"
                    >
                      <CalendarIcon className="w-4 h-4" />
                      Vincular a evento existente ({linkableEvents.length})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={skipEvent}
                    disabled={creatingEvent}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 disabled:opacity-50 text-gray-700 text-sm font-semibold transition-colors"
                  >
                    No, gracias
                  </button>
                </div>
              </div>
            )}

            {/* Pick-event step — list of nearby events to attach the
                expense to. Compact rows: title + time + date hint. */}
            {step === 'pick-event' && saved && (
              <div className="p-5 space-y-3">
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Vincular a
                  </div>
                  <div className="text-sm text-gray-700 mt-1 leading-relaxed">
                    Elegí el evento al que pertenece este gasto. Mostramos los de la semana (±3 días desde hoy).
                  </div>
                </div>

                <div className="max-h-[55vh] overflow-y-auto space-y-1.5 -mx-2 px-2">
                  {linkableEvents.map((ev) => {
                    const today = new Date();
                    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    const isToday = ev.date === todayIso;
                    // Compute offset from today for friendlier labels
                    const dayDiff = Math.round(
                      (new Date(ev.date + 'T00:00:00').getTime() - new Date(todayIso + 'T00:00:00').getTime()) / 86_400_000,
                    );
                    const dateLabel = isToday
                      ? 'Hoy'
                      : dayDiff === 1
                        ? 'Mañana'
                        : dayDiff === -1
                          ? 'Ayer'
                          : new Date(ev.date + 'T00:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
                    const isBusy = linkingEventId === ev.id;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => linkToExistingEvent(ev.id)}
                        disabled={!!linkingEventId}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-left"
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                          style={{ background: EXPENSE_CATEGORIES[ev.type as ExpenseCategory]?.color || '#6b7280' }}
                        >
                          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarIcon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {ev.title || 'Evento sin título'}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {dateLabel}{ev.startTime ? ` · ${ev.startTime}` : ''}
                            {ev.location ? ` · ${ev.location}` : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setStep('event-prompt')}
                  disabled={!!linkingEventId}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 disabled:opacity-50 text-gray-600 text-sm font-semibold transition-colors"
                >
                  Volver
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Quick visual currency symbol for the headline input. Best-effort. */
function currencySymbol(code: string): string {
  switch (code) {
    case 'USD':
    case 'MXN':
    case 'ARS':
    case 'CAD':
    case 'AUD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'JPY':
    case 'CNY':
      return '¥';
    case 'BRL':
      return 'R$';
    default:
      return '$';
  }
}
