'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  X,
  Plane,
  Hotel,
  CarFront,
  MapPin,
  UtensilsCrossed,
  Car,
  Ship,
  MoreHorizontal,
  Gift,
  Coffee,
  ShoppingBag,
  Package,
  Fuel,
  ChevronDown,
  Check,
  Sparkles,
} from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
import { useEvents } from '@/hooks/useEvents';
import { useTrip } from '@/hooks/useTrip';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useToast } from '@/context/ToastContext';
import { uploadReceipt } from '@/lib/utils/uploadReceipt';
import { extractReceiptData } from '@/lib/utils/receiptOCR';
import { CURRENCIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/config/constants';
import Particles from '@/components/ui/Particles';
import { classNames, getInitials, formatCurrency, formatDateES } from '@/lib/utils/helpers';
import type { ExpenseCategory, PaymentMethod } from '@/types';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: CarFront,
  activity: MapPin,
  restaurant: UtensilsCrossed,
  transport: Car,
  cruise: Ship,
  souvenirs: Gift,
  snacks: Coffee,
  clothing: ShoppingBag,
  fuel: Fuel,
  misc: Package,
};

interface CaptureTabProps {
  tripId: string;
}

export function CaptureTab({ tripId }: CaptureTabProps) {
  const { addTripExpense } = useExpenses(tripId);
  const { events, updateEvent } = useEvents(tripId);
  const { trip } = useTrip(tripId);
  const { travelers: allTravelers } = useGlobalTravelers();
  const { toast } = useToast();

  const tripTravelers = useMemo(() => {
    const ids = trip?.travelerIds || [];
    return allTravelers.filter((t) => ids.includes(t.id));
  }, [allTravelers, trip?.travelerIds]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(trip?.budgetCurrency ?? 'MXN');
  const [category, setCategory] = useState<ExpenseCategory>('misc');
  const [linkedEvent, setLinkedEvent] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [pointsUsed, setPointsUsed] = useState('');
  const [equivalentValue, setEquivalentValue] = useState('');
  const [realValueCurrency, setRealValueCurrency] = useState(trip?.budgetCurrency ?? 'MXN');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (tripTravelers.length > 0 && !paidBy) {
      setPaidBy(tripTravelers[0].id);
      setSplitBetween(tripTravelers.map((t) => t.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripTravelers]);

  /* ── Auto-open camera/file picker when arrived with ?capture=1 ── */
  const searchParams = useSearchParams();
  const router = useRouter();
  const routeParams = useParams();
  useEffect(() => {
    if (searchParams.get('capture') !== '1') return;
    const t = setTimeout(() => fileInputRef.current?.click(), 220);
    const tripId = routeParams.tripId as string;
    if (tripId) router.replace(`/trips/${tripId}/expenses`, { scroll: false });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    setProcessingOCR(true);
    try {
      const result = await extractReceiptData(file);
      if (result) {
        setDescription(result.description);
        setAmount(String(result.amount));
        setCurrency(result.currency);
        setCategory(result.category);
        if (result.paymentMethod) setPaymentMethod(result.paymentMethod);
        toast('Datos extraidos del ticket', 'success');
      }
    } catch {
      // Silently fail — user can fill manually
    } finally {
      setProcessingOCR(false);
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleSplitMember = (uid: string) => {
    setSplitBetween((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handleSubmit = async () => {
    // Allow 0 (event didn't happen / free → savings) but not negative or empty
    if (paymentMethod !== 'points') {
      const parsed = parseFloat(amount);
      if (amount === '' || Number.isNaN(parsed) || parsed < 0) {
        toast('Ingresa un monto válido', 'error');
        return;
      }
    }
    if (!description.trim()) {
      toast('Agrega una descripcion', 'error');
      return;
    }
    if (splitBetween.length === 0) {
      toast('Selecciona al menos una persona para dividir', 'error');
      return;
    }

    setSubmitting(true);
    try {
      let receiptUrl: string | undefined;
      if (photo) receiptUrl = await uploadReceipt(tripId, photo);

      const isPoints = paymentMethod === 'points';
      const realValue = isPoints ? parseFloat(equivalentValue) || 0 : 0;

      await addTripExpense({
        tripId,
        description: description.trim(),
        amount: isPoints ? 0 : parseFloat(amount),
        currency: isPoints ? realValueCurrency : currency,
        category,
        paidBy: paidBy || '',
        splitBetween,
        eventId: linkedEvent || undefined,
        date,
        notes: notes.trim() || undefined,
        paymentMethod,
        pointsUsed: isPoints ? parseFloat(pointsUsed) || 0 : undefined,
        equivalentValue: isPoints ? realValue : undefined,
        realValueCurrency: isPoints ? realValueCurrency : undefined,
        receiptUrl,
        createdBy: paidBy || '',
      });

      if (isPoints && linkedEvent && realValue > 0) {
        try {
          await updateEvent(linkedEvent, { cost: realValue, currency: realValueCurrency });
        } catch {
          // Non-critical
        }
      }

      // Reset
      setPhoto(null);
      setPhotoPreview(null);
      setAmount('');
      setDescription('');
      setCategory('misc');
      setPaymentMethod('cash');
      setPointsUsed('');
      setEquivalentValue('');
      setRealValueCurrency(trip?.budgetCurrency ?? 'MXN');
      setLinkedEvent('');
      setNotes('');
      setDetailsOpen(false);
      setDate(new Date().toISOString().split('T')[0]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      toast('Gasto registrado', 'success');
    } catch {
      toast('Error al registrar gasto', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isPoints = paymentMethod === 'points';
  const numericAmount = parseFloat(amount) || 0;
  const perPerson = splitBetween.length > 0 && numericAmount > 0
    ? numericAmount / splitBetween.length
    : 0;
  const categoryColor = EXPENSE_CATEGORIES[category].color;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative rounded-3xl border border-white/[0.06] shadow-2xl shadow-black/30"
      style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1e3a5f 50%, #28406a 100%)' }}
    >
      {/* Visual layer — matches Historial tab so the look is consistent */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
        <Particles count={28} />
        <div
          className="absolute top-12 -left-12 w-72 h-72 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.20), transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)' }}
        />
        <div
          className="absolute bottom-12 left-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14), transparent 70%)' }}
        />
      </div>

      {/* Content layer */}
      <div className="relative z-10 p-5 sm:p-7 space-y-5">
        {/* ── Hero: Receipt FAB + Amount + Description ─────────── */}
        <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 sm:p-5">
          {/* Receipt FAB top-right */}
          <div className="absolute top-0 right-0 z-10">
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Receipt"
                  className="w-16 h-16 object-cover rounded-2xl border border-white/20 shadow-lg"
                />
                {processingOCR && (
                  <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-white/70 hover:text-white transition-all border border-white/15 hover:border-amber-300/60 backdrop-blur-sm"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}
                title="Escanear ticket (OCR)"
              >
                <Camera className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] font-semibold uppercase tracking-wide">Scan</span>
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ boxShadow: '0 0 24px rgba(245,158,11,0.35), inset 0 0 16px rgba(245,158,11,0.1)' }}
                />
              </button>
            )}
          </div>

          {/* Currency chips */}
          <div className="flex gap-2 mb-5 pr-20">
            {CURRENCIES.map((c) => {
              const active = currency === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={classNames(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border backdrop-blur-sm',
                    active
                      ? 'bg-amber-400/20 border-amber-300/60 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20',
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* Amount hero */}
          <div className="text-center py-2">
            <div className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Monto</div>
            <div className="relative">
              <span
                className={classNames(
                  'absolute left-0 top-1/2 -translate-y-1/2 text-4xl sm:text-5xl font-black transition-opacity',
                  numericAmount > 0 ? 'text-white/30' : 'text-white/15',
                )}
              >
                {currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '$'}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-center text-6xl sm:text-7xl font-black tabular-nums text-white placeholder:text-white/15 outline-none focus:text-amber-100 transition-colors"
                style={{ textShadow: numericAmount > 0 ? '0 0 30px rgba(255,255,255,0.15)' : 'none' }}
              />
            </div>
          </div>

          {/* Description inline */}
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿Qué fue? (Cena, taxi, souvenirs…)"
            className="w-full mt-3 bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 outline-none focus:border-amber-300/60 focus:bg-white/[0.08] backdrop-blur-sm transition-all"
          />
        </div>

        {/* ── Card: Categoría ─────────────────────────────────── */}
        <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4">
          <div className="text-white/50 text-[10px] uppercase tracking-[0.18em] font-bold mb-3">Categoría</div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {(Object.entries(EXPENSE_CATEGORIES) as [ExpenseCategory, (typeof EXPENSE_CATEGORIES)[ExpenseCategory]][]).map(
              ([type, cfg]) => {
                const Icon = CATEGORY_ICONS[type] || MoreHorizontal;
                const isSelected = category === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCategory(type)}
                    className={classNames(
                      'group relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all',
                      isSelected
                        ? 'border-white/30 bg-white/[0.08]'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]',
                    )}
                    style={
                      isSelected
                        ? { boxShadow: `0 0 24px ${cfg.color}44, inset 0 0 18px ${cfg.color}10` }
                        : undefined
                    }
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: `${cfg.color}22`,
                        boxShadow: isSelected ? `0 0 14px ${cfg.color}66` : 'none',
                      }}
                    >
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <span
                      className={classNames(
                        'text-[10px] font-medium leading-tight text-center',
                        isSelected ? 'text-white' : 'text-white/55',
                      )}
                    >
                      {cfg.label}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* ── Card: Pago + Split ──────────────────────────────── */}
        <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 space-y-4">
          {/* Paid by */}
          <div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.18em] font-bold mb-2">Pagó</div>
            <div className="flex flex-wrap gap-2">
              {tripTravelers.map((t) => {
                const active = paidBy === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPaidBy(t.id)}
                    className={classNames(
                      'inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-xs font-medium transition-all border',
                      active
                        ? 'bg-emerald-400/15 border-emerald-300/50 text-emerald-100 shadow-[0_0_14px_rgba(52,211,153,0.25)]'
                        : 'bg-white/[0.03] border-white/[0.08] text-white/55 hover:text-white/85 hover:border-white/20',
                    )}
                  >
                    <span
                      className={classNames(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                        active
                          ? 'bg-gradient-to-br from-emerald-300 to-emerald-500 text-emerald-950'
                          : 'bg-white/10 text-white/60',
                      )}
                    >
                      {getInitials(t.fullName)}
                    </span>
                    <span>{t.fullName.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Split between */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-white/50 text-[10px] uppercase tracking-[0.18em] font-bold">Dividir entre</div>
              {perPerson > 0 && (
                <motion.span
                  key={perPerson.toFixed(2)}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-emerald-300 text-xs font-bold tabular-nums"
                >
                  {formatCurrency(perPerson, currency)} c/u
                </motion.span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {tripTravelers.map((t) => {
                const isSelected = splitBetween.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleSplitMember(t.id)}
                    className={classNames(
                      'inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                      isSelected
                        ? 'bg-amber-400/15 border-amber-300/50 text-amber-100'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/35 hover:text-white/60',
                    )}
                  >
                    <span
                      className={classNames(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                        isSelected
                          ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950'
                          : 'bg-white/[0.06] text-white/35',
                      )}
                    >
                      {getInitials(t.fullName)}
                    </span>
                    <span>{t.fullName.split(' ')[0]}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Collapsible: Más detalles ───────────────────────── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setDetailsOpen((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-white/70 text-sm font-semibold">Más detalles</span>
            <span className="flex items-center gap-2 text-[11px] text-white/40">
              {paymentMethod !== 'cash' && (
                <span className="text-amber-200/80">{PAYMENT_METHODS[paymentMethod]}</span>
              )}
              {linkedEvent && <span className="text-emerald-300/80">vinculado</span>}
              <motion.span animate={{ rotate: detailsOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4" />
              </motion.span>
            </span>
          </button>

          <AnimatePresence initial={false}>
            {detailsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-2 space-y-4 border-t border-white/[0.06]">
                  {/* Date */}
                  <div>
                    <label className="block text-white/50 text-[10px] uppercase tracking-[0.18em] font-bold mb-2">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-amber-300/60 backdrop-blur-sm transition-colors [color-scheme:dark]"
                    />
                  </div>

                  {/* Linked event */}
                  <div>
                    <label className="block text-white/50 text-[10px] uppercase tracking-[0.18em] font-bold mb-2">
                      Vincular a evento
                    </label>
                    <select
                      value={linkedEvent}
                      onChange={(e) => setLinkedEvent(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-amber-300/60 backdrop-blur-sm transition-colors [color-scheme:dark]"
                    >
                      <option value="">Sin vincular</option>
                      {(() => {
                        const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
                        const grouped = new Map<string, typeof events>();
                        for (const ev of sorted) {
                          const list = grouped.get(ev.date) || [];
                          list.push(ev);
                          grouped.set(ev.date, list);
                        }
                        return [...grouped.entries()].map(([dateStr, evts]) => (
                          <optgroup key={dateStr} label={formatDateES(dateStr)}>
                            {evts.map((ev) => (
                              <option key={ev.id} value={ev.id}>
                                {ev.startTime ? `${ev.startTime} - ` : ''}
                                {ev.title}
                              </option>
                            ))}
                          </optgroup>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Payment method */}
                  <div>
                    <label className="block text-white/50 text-[10px] uppercase tracking-[0.18em] font-bold mb-2">
                      Forma de pago
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPaymentMethod(key)}
                          className={classNames(
                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                            paymentMethod === key
                              ? 'bg-amber-400/15 border-amber-300/50 text-amber-100'
                              : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {isPoints && (
                      <div className="mt-3 space-y-3 pt-3 border-t border-white/[0.06]">
                        <div>
                          <label className="block text-[10px] font-medium text-white/50 mb-1">Puntos usados</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={pointsUsed}
                            onChange={(e) => setPointsUsed(e.target.value)}
                            placeholder="Ej: 45000"
                            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2 text-white text-sm placeholder:text-white/25 outline-none focus:border-amber-300/60 backdrop-blur-sm transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-white/50 mb-1">
                            Valor real (precio de mercado)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={equivalentValue}
                              onChange={(e) => setEquivalentValue(e.target.value)}
                              placeholder="Ej: 8500"
                              className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2 text-white text-sm placeholder:text-white/25 outline-none focus:border-amber-300/60 backdrop-blur-sm transition-colors"
                            />
                            <select
                              value={realValueCurrency}
                              onChange={(e) => setRealValueCurrency(e.target.value)}
                              className="bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-white text-sm font-medium outline-none focus:border-amber-300/60 backdrop-blur-sm transition-colors [color-scheme:dark]"
                            >
                              {CURRENCIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                          <p className="text-[10px] text-emerald-300/80 mt-1">
                            Se agrega al presupuesto y al evento. Gasto real: $0 = ahorro
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-white/50 text-[10px] uppercase tracking-[0.18em] font-bold mb-2">
                      Notas
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Detalles adicionales…"
                      rows={3}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:border-amber-300/60 backdrop-blur-sm transition-colors resize-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Sticky live preview + Submit ────────────────────── */}
        <div className="sticky bottom-2 z-20">
          <div
            className="rounded-2xl border border-white/[0.1] backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/40"
            style={{ background: 'linear-gradient(135deg, rgba(13,27,46,0.85), rgba(40,64,106,0.85))' }}
          >
            <div className="flex items-center justify-between mb-2.5 text-[11px]">
              <span className="text-white/60 truncate">
                {numericAmount > 0 ? formatCurrency(numericAmount, currency) : '—'}
                {' · '}
                <span style={{ color: categoryColor }}>{EXPENSE_CATEGORIES[category].label}</span>
                {' · '}
                {splitBetween.length} pers
              </span>
              {perPerson > 0 && (
                <span className="text-emerald-300 font-bold tabular-nums whitespace-nowrap ml-2">
                  {formatCurrency(perPerson, currency)} c/u
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full relative overflow-hidden rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed group"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Registrando…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Registrar gasto
                  </>
                )}
              </span>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input (always mounted) — no capture so mobile shows
          camera / gallery / files chooser including PDFs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handlePhotoChange}
        className="hidden"
      />
    </motion.div>
  );
}
