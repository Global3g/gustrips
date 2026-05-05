'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
import { useEvents } from '@/hooks/useEvents';
import { useTrip } from '@/hooks/useTrip';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useToast } from '@/context/ToastContext';
import { uploadReceipt } from '@/lib/utils/uploadReceipt';
import { extractReceiptData } from '@/lib/utils/receiptOCR';
import { CURRENCIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/config/constants';
import { Card, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { classNames, getInitials, formatDateES } from '@/lib/utils/helpers';
import type { ExpenseCategory, PaymentMethod, TripExpense } from '@/types';
import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';

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
  const { addExpense, addTripExpense } = useExpenses(tripId);
  const { events, updateEvent } = useEvents(tripId);
  const { trip } = useTrip(tripId);
  const { travelers: allTravelers } = useGlobalTravelers();
  const { toast } = useToast();

  // Get trip travelers (filtered by trip.travelerIds)
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

  // Initialize paidBy and splitBetween when travelers load
  useEffect(() => {
    if (tripTravelers.length > 0 && !paidBy) {
      setPaidBy(tripTravelers[0].id);
      setSplitBetween(tripTravelers.map((t) => t.id));
    }
  }, [tripTravelers]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    // OCR extraction
    setProcessingOCR(true);
    try {
      const result = await extractReceiptData(file);
      if (result) {
        setDescription(result.description);
        setAmount(String(result.amount));
        setCurrency(result.currency);
        setCategory(result.category);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleSplitMember = (uid: string) => {
    setSplitBetween((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  const handleSubmit = async () => {
    if (paymentMethod !== 'points' && (!amount || parseFloat(amount) <= 0)) {
      toast('Ingresa un monto valido', 'error');
      return;
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
      if (photo) {
        receiptUrl = await uploadReceipt(tripId, photo);
      }

      const isPoints = paymentMethod === 'points';
      const realValue = isPoints ? (parseFloat(equivalentValue) || 0) : 0;

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
        pointsUsed: isPoints ? (parseFloat(pointsUsed) || 0) : undefined,
        equivalentValue: isPoints ? realValue : undefined,
        realValueCurrency: isPoints ? realValueCurrency : undefined,
        receiptUrl,
        createdBy: paidBy || '',
      });

      // If paid with points and linked to an event, update the event cost with the real value
      if (isPoints && linkedEvent && realValue > 0) {
        try {
          await updateEvent(linkedEvent, {
            cost: realValue,
            currency: realValueCurrency,
          });
        } catch {
          // Non-critical — expense was saved, event update is bonus
        }
      }

      // Reset form
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
      setDate(new Date().toISOString().split('T')[0]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      toast('Gasto registrado', 'success');
    } catch {
      toast('Error al registrar gasto', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Receipt photo */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Foto del recibo (opcional)
          </label>
          {photoPreview ? (
            <div className="relative inline-block">
              <img
                src={photoPreview}
                alt="Receipt preview"
                className="w-24 h-24 object-cover rounded-xl border border-gray-200"
              />
              {processingOCR && (
                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                  <span className="text-white text-[10px] font-medium animate-pulse">
                    Procesando...
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={removePhoto}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-amber-400 hover:text-amber-600 transition-colors"
            >
              <Camera className="w-6 h-6 mb-1" />
              <span className="text-xs">Foto</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </CardBody>
      </Card>

      {/* Description */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripcion
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cena, taxi, souvenirs..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:border-amber-400 transition-colors"
          />
        </CardBody>
      </Card>

      {/* Amount + Currency */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monto
          </label>
          {/* Currency selector */}
          <div className="flex gap-2 mb-3">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={classNames(
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border',
                  currency === c
                    ? 'bg-amber-50 border-amber-600 text-amber-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300',
                )}
              >
                {c}
              </button>
            ))}
          </div>
          {/* Amount input */}
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-2xl font-bold text-gray-900 placeholder:text-gray-300 outline-none focus:border-amber-400 transition-colors"
          />
        </CardBody>
      </Card>

      {/* Category picker */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Categoria
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(EXPENSE_CATEGORIES) as [ExpenseCategory, (typeof EXPENSE_CATEGORIES)[ExpenseCategory]][]).map(
              ([type, cfg]) => {
                const Icon = CATEGORY_ICONS[type];
                const isSelected = category === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCategory(type)}
                    className={classNames(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center',
                      isSelected
                        ? 'bg-amber-50 border-amber-600 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${cfg.color}20` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <span
                      className={classNames(
                        'text-[11px] font-medium leading-tight',
                        isSelected ? 'text-amber-700' : 'text-gray-600',
                      )}
                    >
                      {cfg.label}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </CardBody>
      </Card>

      {/* Link to event */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vincular a evento (opcional)
          </label>
          <select
            value={linkedEvent}
            onChange={(e) => setLinkedEvent(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 outline-none focus:border-amber-400 transition-colors"
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
                      {ev.startTime ? `${ev.startTime} - ` : ''}{ev.title}
                    </option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
        </CardBody>
      </Card>

      {/* Paid by */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pagado por
          </label>
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 outline-none focus:border-amber-400 transition-colors"
          >
            {tripTravelers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </CardBody>
      </Card>

      {/* Split between */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dividir entre
          </label>
          <div className="flex flex-wrap gap-2">
            {tripTravelers.map((t) => {
              const isSelected = splitBetween.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleSplitMember(t.id)}
                  className={classNames(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                    isSelected
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600',
                  )}
                >
                  <div
                    className={classNames(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold',
                      isSelected
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                        : 'bg-gray-100 text-gray-400',
                    )}
                  >
                    {getInitials(t.fullName)}
                  </div>
                  {t.fullName.split(' ')[0]}
                  {isSelected && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
          {splitBetween.length > 0 && parseFloat(amount) > 0 && (
            <p className="text-gray-400 text-xs mt-2">
              ${(parseFloat(amount) / splitBetween.length).toFixed(2)} {currency} por persona
            </p>
          )}
        </CardBody>
      </Card>

      {/* Date */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 outline-none focus:border-amber-400 transition-colors"
          />
        </CardBody>
      </Card>

      {/* Payment method */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Forma de pago
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPaymentMethod(key)}
                className={classNames(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                  paymentMethod === key
                    ? 'bg-amber-50 border-amber-600 text-amber-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Points fields */}
          {paymentMethod === 'points' && (
            <div className="mt-3 space-y-3 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Puntos usados
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={pointsUsed}
                  onChange={(e) => setPointsUsed(e.target.value)}
                  placeholder="Ej: 45000"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none focus:border-amber-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Valor real (precio de mercado)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={equivalentValue}
                    onChange={(e) => setEquivalentValue(e.target.value)}
                    placeholder="Ej: 8500"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder:text-gray-400 outline-none focus:border-amber-400 transition-colors"
                  />
                  <select
                    value={realValueCurrency}
                    onChange={(e) => setRealValueCurrency(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 font-medium outline-none focus:border-amber-400 transition-colors"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-emerald-600 mt-1">Se agrega al presupuesto y al evento. Gasto real: $0 = ahorro</p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Notes */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalles adicionales..."
            rows={3}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:border-amber-400 transition-colors resize-none"
          />
        </CardBody>
      </Card>

      {/* Submit */}
      <Button
        variant="primary"
        size="lg"
        loading={submitting}
        onClick={handleSubmit}
        className="w-full"
      >
        Registrar Gasto
      </Button>
    </motion.div>
  );
}
