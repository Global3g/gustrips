'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  Pencil,
  Receipt,
  Image,
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
  Fuel,
  Package,
} from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
import { useEvents } from '@/hooks/useEvents';
import { useMembers } from '@/hooks/useMembers';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useTrip } from '@/hooks/useTrip';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { EVENT_TYPES, CURRENCIES, PAYMENT_METHODS } from '@/config/constants';
import { classNames, formatCurrency, getInitials, formatDateES } from '@/lib/utils/helpers';
import type { EventType, TripExpense, PaymentMethod } from '@/types';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_ICONS: Record<EventType, LucideIcon> = {
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

interface HistoryTabProps {
  tripId: string;
}

export function HistoryTab({ tripId }: HistoryTabProps) {
  const { expenses, loading, deleteExpense, updateExpense } = useExpenses(tripId);
  const { events } = useEvents(tripId);
  const { members } = useMembers(tripId);
  const { user } = useAuth();
  const { travelers } = useGlobalTravelers();
  const { trip } = useTrip(tripId);
  const { toast } = useToast();

  // Trip travelers
  const tripTravelers = useMemo(() => {
    const ids = trip?.travelerIds || [];
    return travelers.filter((t) => ids.includes(t.id));
  }, [travelers, trip?.travelerIds]);

  const [filterCategory, setFilterCategory] = useState<EventType | 'all'>('all');
  const [filterPerson, setFilterPerson] = useState<string>('all');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState('MXN');
  const [editDate, setEditDate] = useState('');
  const [editEvent, setEditEvent] = useState('');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editSplit, setEditSplit] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editPayment, setEditPayment] = useState<PaymentMethod>('cash');
  const [editLoading, setEditLoading] = useState(false);

  const openEdit = (expense: TripExpense) => {
    setEditingExpense(expense);
    setEditDesc(expense.description);
    setEditAmount(String(expense.amount));
    setEditCurrency(expense.currency);
    setEditDate(expense.date);
    setEditEvent(expense.eventId || '');
    setEditPaidBy(expense.paidBy || '');
    setEditSplit(expense.splitBetween || []);
    setEditNotes((expense as { notes?: string }).notes || '');
    setEditPayment((expense.paymentMethod as PaymentMethod) || 'cash');
  };

  const toggleEditSplit = (id: string) => {
    setEditSplit((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    setEditLoading(true);
    try {
      await updateExpense(editingExpense.id, {
        description: editDesc.trim(),
        amount: parseFloat(editAmount) || 0,
        currency: editCurrency,
        date: editDate,
        eventId: editEvent || undefined,
        paidBy: editPaidBy,
        splitBetween: editSplit,
        paymentMethod: editPayment,
      });
      setEditingExpense(null);
      toast('Gasto actualizado', 'success');
    } catch {
      toast('Error al actualizar', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];

    if (filterCategory !== 'all') {
      filtered = filtered.filter((e) => {
        // Try to match by linked event type
        if (e.eventId) {
          const event = events.find((ev) => ev.id === e.eventId);
          return event?.type === filterCategory;
        }
        return false;
      });
    }

    if (filterPerson !== 'all') {
      filtered = filtered.filter((e) => e.paidBy === filterPerson);
    }

    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, events, filterCategory, filterPerson]);

  const getEventName = (eventId?: string): string | null => {
    if (!eventId) return null;
    const event = events.find((e) => e.id === eventId);
    return event?.title ?? null;
  };

  const getEventType = (eventId?: string): string => {
    if (!eventId) return 'misc';
    const event = events.find((e) => e.id === eventId);
    return event?.type ?? 'misc';
  };

  const getMemberName = (uid: string): string => {
    if (user && uid === user.uid) return user.displayName || user.email?.split('@')[0] || 'Yo';
    const m = members.find((member) => member.uid === uid);
    if (m?.displayName) return m.displayName;
    if (m?.email) return m.email.split('@')[0];
    const t = travelers.find((tr) => tr.id === uid);
    if (t?.fullName) return t.fullName;
    return uid.slice(0, 6);
  };

  const handleDelete = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      setConfirmingDelete(null);
      toast('Gasto eliminado', 'success');
    } catch {
      toast('Error al eliminar gasto', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as EventType | 'all')}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-amber-400 transition-colors"
        >
          <option value="all">Todas las categorias</option>
          {(Object.entries(EVENT_TYPES) as [EventType, (typeof EVENT_TYPES)[EventType]][]).map(
            ([type, cfg]) => (
              <option key={type} value={type}>
                {cfg.label}
              </option>
            ),
          )}
        </select>
        <select
          value={filterPerson}
          onChange={(e) => setFilterPerson(e.target.value)}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-amber-400 transition-colors"
        >
          <option value="all">Todos</option>
          {members.map((m) => (
            <option key={m.uid} value={m.uid}>
              {m.displayName || m.email}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {filteredExpenses.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-gray-700 font-semibold mb-1">Sin gastos registrados</h3>
          <p className="text-gray-400 text-sm">
            Los gastos que captures apareceran aqui
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {filteredExpenses.map((expense, idx) => {
            const eventType = getEventType(expense.eventId) as EventType;
            const cfg = EVENT_TYPES[eventType] ?? EVENT_TYPES.misc;
            const Icon = CATEGORY_ICONS[eventType] ?? CATEGORY_ICONS.misc;
            const eventName = getEventName(expense.eventId);
            const payerName = getMemberName(expense.paidBy);

            return (
              <motion.div
                key={expense.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: idx * 0.03, duration: 0.3 }}
              >
                <Card hoverable className="group cursor-pointer" onClick={() => openEdit(expense)}>
                  <CardBody className="flex items-center gap-3">
                    {/* Category icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${cfg.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                    </div>

                    {/* Center content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900 text-sm font-semibold truncate">
                          {expense.description}
                        </p>
                        {expense.eventId && (
                          <Image className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {eventName && (
                          <>
                            <span className="text-gray-400 text-xs truncate max-w-[120px]">
                              {eventName}
                            </span>
                            <span className="text-gray-200 text-xs">&middot;</span>
                          </>
                        )}
                        <span className="text-gray-400 text-xs">{formatDateES(expense.date)}</span>
                      </div>
                    </div>

                    {/* Right: amount + payer */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-gray-900 font-bold text-sm">
                        {formatCurrency(expense.amount, expense.currency)}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[7px] font-bold">
                          {getInitials(payerName)}
                        </div>
                        <span className="text-gray-400 text-[11px]">
                          {payerName.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {confirmingDelete === expense.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg font-medium"
                        >
                          Si
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded-lg font-medium"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(expense); }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-amber-600 hover:bg-amber-50 transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmingDelete(expense.id); }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
      {/* Edit modal */}
      <Modal
        open={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        title="Editar gasto"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingExpense(null)}>Cancelar</Button>
            <Button variant="primary" loading={editLoading} onClick={handleSaveEdit}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Descripcion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-amber-400"
            />
          </div>

          {/* Monto + Moneda */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
              <input
                type="number"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
              <select
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 outline-none focus:border-amber-400"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 outline-none focus:border-amber-400"
            />
          </div>

          {/* Pagado por */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pagado por</label>
            <select
              value={editPaidBy}
              onChange={(e) => setEditPaidBy(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 outline-none focus:border-amber-400"
            >
              {tripTravelers.map((t) => (
                <option key={t.id} value={t.id}>{t.fullName}</option>
              ))}
            </select>
          </div>

          {/* Dividir entre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dividir entre</label>
            <div className="flex flex-wrap gap-2">
              {tripTravelers.map((t) => {
                const isSelected = editSplit.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleEditSplit(t.id)}
                    className={classNames(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      isSelected
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-gray-50 border-gray-200 text-gray-400',
                    )}
                  >
                    {t.fullName.split(' ')[0]}
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vincular a evento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a evento</label>
            <select
              value={editEvent}
              onChange={(e) => setEditEvent(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 outline-none focus:border-amber-400"
            >
              <option value="">Sin vincular</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title} — {formatDateES(ev.date)}</option>
              ))}
            </select>
          </div>

          {/* Forma de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago</label>
            <select
              value={editPayment}
              onChange={(e) => setEditPayment(e.target.value as PaymentMethod)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 outline-none focus:border-amber-400"
            >
              {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-amber-400 resize-none"
              placeholder="Notas adicionales..."
            />
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
