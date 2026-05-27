'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Calendar, Users, Wallet, Sparkles, Check, ArrowLeft, ArrowRight, Plus, X, Loader2,
} from 'lucide-react';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/config/constants';
import { TRIP_TEMPLATE_LIST, TRIP_TEMPLATES, type TripTemplateId } from '@/lib/tripTemplates';
import { classNames, getInitials } from '@/lib/utils/helpers';

export interface TripWizardData {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelerIds: string[];
  budget?: number;
  budgetCurrency: string;
  templateId: TripTemplateId | null;
}

interface TripWizardProps {
  loading?: boolean;
  onCancel: () => void;
  onComplete: (data: TripWizardData) => Promise<void> | void;
}

const STEPS = [
  { key: 'where', label: 'Destino', icon: MapPin },
  { key: 'when', label: 'Fechas', icon: Calendar },
  { key: 'who', label: 'Viajeros', icon: Users },
  { key: 'budget', label: 'Presupuesto', icon: Wallet },
  { key: 'type', label: 'Tipo', icon: Sparkles },
  { key: 'review', label: 'Listo', icon: Check },
] as const;

const inputCls =
  'w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition placeholder:text-gray-400';

export default function TripWizard({ loading = false, onCancel, onComplete }: TripWizardProps) {
  const { travelers, addTraveler } = useGlobalTravelers();

  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelerIds, setTravelerIds] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [templateId, setTemplateId] = useState<TripTemplateId | null>(null);
  const [noTemplate, setNoTemplate] = useState(false);

  const [newTraveler, setNewTraveler] = useState('');
  const [addingTraveler, setAddingTraveler] = useState(false);

  const effectiveTitle = (title.trim() || (destination.trim() ? `Viaje a ${destination.trim()}` : '')).trim();

  const canAdvance = useMemo(() => {
    switch (STEPS[step].key) {
      case 'where': return destination.trim().length > 0;
      case 'when': return !!startDate && !!endDate && endDate >= startDate;
      case 'who': return true; // optional
      case 'budget': return true; // optional
      case 'type': return noTemplate || templateId !== null;
      case 'review': return true;
      default: return true;
    }
  }, [step, destination, startDate, endDate, noTemplate, templateId]);

  const toggleTraveler = (id: string) =>
    setTravelerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleAddTraveler = async () => {
    const name = newTraveler.trim();
    if (!name || addingTraveler) return;
    setAddingTraveler(true);
    try {
      const id = await addTraveler({ fullName: name });
      if (id) setTravelerIds((prev) => [...prev, id]);
      setNewTraveler('');
    } catch {
      /* ignore — they can add later */
    } finally {
      setAddingTraveler(false);
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => (step === 0 ? onCancel() : setStep((s) => s - 1));

  const handleCreate = () => {
    onComplete({
      title: effectiveTitle || destination.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      travelerIds,
      budget: budget.trim() ? Math.max(0, Number(budget)) || undefined : undefined,
      budgetCurrency: currency,
      templateId: noTemplate ? null : templateId,
    });
  };

  const tripDays =
    startDate && endDate && endDate >= startDate
      ? Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1
      : 0;

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6 px-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.key} className="flex items-center gap-1 flex-1 last:flex-none">
              <div
                className={classNames(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all',
                  active ? 'bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/30'
                    : done ? 'bg-blue-100 text-blue-600'
                      : 'bg-white/10 text-white/40',
                )}
              >
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              {i < STEPS.length - 1 && (
                <div className={classNames('h-0.5 flex-1 rounded-full', done ? 'bg-blue-300' : 'bg-white/10')} />
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl bg-white shadow-xl p-6 sm:p-8 min-h-[360px] flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            {/* STEP: where */}
            {STEPS[step].key === 'where' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">¿A dónde vas? ✈️</h2>
                <p className="text-gray-500 text-sm mb-5">El destino principal de tu viaje.</p>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Destino</label>
                <input autoFocus type="text" value={destination} onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ej. Londres, Inglaterra" className={inputCls} />
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 mt-4">Nombre del viaje (opcional)</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder={destination.trim() ? `Viaje a ${destination.trim()}` : 'Le ponés un nombre lindo'} className={inputCls} />
              </div>
            )}

            {/* STEP: when */}
            {STEPS[step].key === 'when' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">¿Cuándo? 📅</h2>
                <p className="text-gray-500 text-sm mb-5">Fechas de salida y regreso.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Inicio</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Fin</label>
                    <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
                {startDate && endDate && endDate < startDate && (
                  <p className="text-rose-500 text-xs mt-2">La fecha de fin no puede ser antes del inicio.</p>
                )}
                {tripDays > 0 && <p className="text-blue-600 text-sm mt-3 font-medium">{tripDays} {tripDays === 1 ? 'día' : 'días'} de viaje 🎒</p>}
              </div>
            )}

            {/* STEP: who */}
            {STEPS[step].key === 'who' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">¿Con quién viajás? 👫</h2>
                <p className="text-gray-500 text-sm mb-5">Opcional — podés agregar más después.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {travelers.map((t) => {
                    const sel = travelerIds.includes(t.id);
                    return (
                      <button key={t.id} type="button" onClick={() => toggleTraveler(t.id)}
                        className={classNames('inline-flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-full border text-sm font-medium transition',
                          sel ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300')}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: t.avatarColor || '#64748b' }}>
                          {getInitials(t.fullName)}
                        </span>
                        {t.fullName.split(' ')[0]}
                        {sel && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newTraveler} onChange={(e) => setNewTraveler(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTraveler(); } }}
                    placeholder="Agregar viajero (nombre)" className={classNames(inputCls, 'py-2.5 text-sm')} />
                  <button type="button" onClick={handleAddTraveler} disabled={!newTraveler.trim() || addingTraveler}
                    className="px-4 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-40 inline-flex items-center">
                    {addingTraveler ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* STEP: budget */}
            {STEPS[step].key === 'budget' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">¿Presupuesto? 💰</h2>
                <p className="text-gray-500 text-sm mb-5">Opcional — te ayuda a controlar gastos. Lo podés cambiar después.</p>
                <div className="flex gap-2">
                  <input autoFocus type="number" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)}
                    placeholder="0" className={classNames(inputCls, 'flex-1')} />
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={classNames(inputCls, 'w-28')}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* STEP: type */}
            {STEPS[step].key === 'type' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">¿Qué tipo de viaje? ✨</h2>
                <p className="text-gray-500 text-sm mb-5">Elegí uno y te dejo el itinerario, la maleta y la checklist arrancados. O empezá de cero.</p>
                <div className="grid grid-cols-2 gap-2">
                  {TRIP_TEMPLATE_LIST.map((tpl) => {
                    const sel = !noTemplate && templateId === tpl.id;
                    return (
                      <button key={tpl.id} type="button" onClick={() => { setTemplateId(tpl.id); setNoTemplate(false); }}
                        className={classNames('text-left p-3 rounded-2xl border transition',
                          sel ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400/20' : 'border-gray-200 bg-white hover:border-gray-300')}>
                        <div className="text-2xl mb-1">{tpl.emoji}</div>
                        <div className="text-sm font-bold text-gray-900">{tpl.label}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {tpl.suggestedEvents.length} eventos · maleta {tpl.packingTemplate.toLowerCase()}
                        </div>
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => { setNoTemplate(true); setTemplateId(null); }}
                    className={classNames('text-left p-3 rounded-2xl border transition',
                      noTemplate ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400/20' : 'border-dashed border-gray-300 bg-white hover:border-gray-400')}>
                    <div className="text-2xl mb-1">📝</div>
                    <div className="text-sm font-bold text-gray-900">Empezar de cero</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Sin plantilla</div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP: review */}
            {STEPS[step].key === 'review' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">¿Todo bien? 🎉</h2>
                <p className="text-gray-500 text-sm mb-5">Revisá y creamos tu viaje.</p>
                <dl className="space-y-2.5 text-sm">
                  <Row label="Viaje" value={effectiveTitle || '—'} />
                  <Row label="Destino" value={destination || '—'} />
                  <Row label="Fechas" value={startDate && endDate ? `${startDate} → ${endDate}${tripDays ? `  (${tripDays} días)` : ''}` : '—'} />
                  <Row label="Viajeros" value={travelerIds.length ? `${travelerIds.length} seleccionado${travelerIds.length !== 1 ? 's' : ''}` : 'Sin asignar'} />
                  <Row label="Presupuesto" value={budget.trim() ? `${Number(budget).toLocaleString()} ${currency}` : 'Sin definir'} />
                  <Row label="Plantilla" value={noTemplate || !templateId ? 'Ninguna' : `${TRIP_TEMPLATES[templateId].emoji} ${TRIP_TEMPLATES[templateId].label}`} />
                </dl>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-100">
          <button type="button" onClick={back} disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition disabled:opacity-50">
            <ArrowLeft className="w-4 h-4" /> {step === 0 ? 'Cancelar' : 'Atrás'}
          </button>
          {STEPS[step].key === 'review' ? (
            <button type="button" onClick={handleCreate} disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 transition disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Creando…' : 'Crear viaje'}
            </button>
          ) : (
            <button type="button" onClick={next} disabled={!canAdvance}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-40">
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-gray-400 uppercase text-[10px] font-bold tracking-wider flex-shrink-0">{label}</dt>
      <dd className="text-gray-900 font-medium text-right truncate">{value}</dd>
    </div>
  );
}
