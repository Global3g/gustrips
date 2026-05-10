'use client';

import { useState, useRef, useEffect, type FormEvent, type ReactNode } from 'react';
import {
  Upload,
  User,
  IdCard,
  Stamp,
  Heart,
  Save,
  Loader2,
  Check,
  X,
  Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { getClientStorage } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { classNames, getInitials } from '@/lib/utils/helpers';
import type { GlobalTraveler } from '@/types';

type TravelerFormData = Omit<GlobalTraveler, 'id' | 'createdAt' | 'updatedAt'>;

interface GlobalTravelerFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TravelerFormData) => Promise<void>;
  initialData?: GlobalTraveler;
}

const EMPTY_FORM: TravelerFormData = {
  fullName: '',
  relationship: '',
  avatarColor: '',
  dateOfBirth: '',
  nationality: '',
  phone: '',
  emergencyContact: '',
  emergencyPhone: '',
  passportNumber: '',
  passportCountry: '',
  passportExpiry: '',
  visaType: '',
  visaCountry: '',
  visaExpiry: '',
  seatPreference: '',
  dietaryRestrictions: '',
  specialNeeds: '',
  passportPhotoUrl: '',
  visaPhotoUrl: '',
};

const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'Seleccionar…' },
  { value: 'yo', label: 'Yo' },
  { value: 'esposa', label: 'Esposa' },
  { value: 'esposo', label: 'Esposo' },
  { value: 'hijo', label: 'Hijo/a' },
  { value: 'padre', label: 'Padre' },
  { value: 'madre', label: 'Madre' },
  { value: 'hermano', label: 'Hermano/a' },
  { value: 'amigo', label: 'Amigo/a' },
  { value: 'otro', label: 'Otro' },
];

const SEAT_OPTIONS = [
  { value: '', label: 'Sin preferencia' },
  { value: 'window', label: 'Ventana' },
  { value: 'aisle', label: 'Pasillo' },
  { value: 'middle', label: 'Centro' },
];

const AVATAR_PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#ef4444', '#6366f1', '#14b8a6', '#f97316',
  '#d946ef', '#84cc16',
];

/* ─── Dark-glass form primitives (scoped to this modal) ─── */

interface FieldShellProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}

function FieldShell({ label, required, hint, children, className }: FieldShellProps) {
  return (
    <label className={classNames('block', className)}>
      <span className="block text-[10px] uppercase tracking-[0.18em] font-bold text-white/45 mb-1.5">
        {label}
        {required && <span className="text-amber-300 ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-white/35 mt-1">{hint}</span>}
    </label>
  );
}

function darkInputClass(extra = '') {
  return classNames(
    'w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition',
    'focus:border-amber-300/50 focus:bg-white/[0.06] [color-scheme:dark]',
    extra,
  );
}

interface DarkInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}

function DarkInput({ label, value, onChange, type = 'text', placeholder, required, hint }: DarkInputProps) {
  return (
    <FieldShell label={label} required={required} hint={hint}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={darkInputClass()}
      />
    </FieldShell>
  );
}

interface DarkSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

function DarkSelect({ label, value, onChange, options }: DarkSelectProps) {
  return (
    <FieldShell label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={darkInputClass('cursor-pointer pr-9')}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0f1d33] text-white">
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/* ─── File upload with image preview ─── */

interface DocUploadProps {
  label: string;
  currentUrl?: string;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
}

function DocUpload({ label, currentUrl, uploading, onUpload, onClear }: DocUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isImage = currentUrl ? !/\.pdf($|\?)/i.test(currentUrl) : false;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await onUpload(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <FieldShell label={label}>
      <div className="rounded-xl border border-white/[0.1] bg-white/[0.04] overflow-hidden">
        {currentUrl ? (
          <div className="relative">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUrl} alt={label} className="w-full h-44 object-cover" />
            ) : (
              <div className="h-44 flex flex-col items-center justify-center gap-2 text-white/65">
                <ImageIcon className="w-8 h-8" />
                <span className="text-sm font-medium">Documento PDF</span>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-200 hover:text-amber-100 underline-offset-2 hover:underline"
                >
                  Abrir
                </a>
              </div>
            )}
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 transition disabled:opacity-50"
              >
                {uploading ? 'Subiendo…' : 'Reemplazar'}
              </button>
              <button
                type="button"
                onClick={onClear}
                className="w-7 h-7 rounded-full text-white bg-black/50 hover:bg-rose-500/70 backdrop-blur-sm border border-white/20 transition flex items-center justify-center"
                title="Quitar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="w-full h-32 flex flex-col items-center justify-center gap-2 text-white/55 hover:text-white/80 hover:bg-white/[0.03] transition disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            <span className="text-xs font-bold">
              {uploading ? 'Subiendo…' : 'Tap para subir foto o PDF'}
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </FieldShell>
  );
}

/* ─── Tab definitions ─── */

type TabId = 'personal' | 'passport' | 'visa' | 'prefs';

const TABS: { id: TabId; label: string; shortLabel: string; icon: typeof User }[] = [
  { id: 'personal', label: 'Personal', shortLabel: 'Personal', icon: User },
  { id: 'passport', label: 'Pasaporte', shortLabel: 'Pasap.', icon: IdCard },
  { id: 'visa', label: 'Visa', shortLabel: 'Visa', icon: Stamp },
  { id: 'prefs', label: 'Preferencias', shortLabel: 'Pref.', icon: Heart },
];

/* ─── Main form ─── */

export default function GlobalTravelerForm({
  open,
  onClose,
  onSave,
  initialData,
}: GlobalTravelerFormProps) {
  const { user } = useAuth();
  const isEditing = !!initialData;

  const [form, setForm] = useState<TravelerFormData>(() => {
    if (initialData) {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = initialData;
      void _id; void _ca; void _ua;
      return { ...EMPTY_FORM, ...rest };
    }
    return { ...EMPTY_FORM };
  });

  const [tab, setTab] = useState<TabId>('personal');
  const [saving, setSaving] = useState(false);
  const [uploadingPassport, setUploadingPassport] = useState(false);
  const [uploadingVisa, setUploadingVisa] = useState(false);
  const [showNameError, setShowNameError] = useState(false);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close (only when not saving)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  const updateField = <K extends keyof TravelerFormData>(key: K, value: TravelerFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'fullName' && showNameError) setShowNameError(false);
  };

  const handleUpload = async (file: File, type: 'passport' | 'visa') => {
    if (!user) return;
    const setUploading = type === 'passport' ? setUploadingPassport : setUploadingVisa;
    const fieldKey: keyof TravelerFormData = type === 'passport' ? 'passportPhotoUrl' : 'visaPhotoUrl';

    setUploading(true);
    try {
      const storage = getClientStorage();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `users/${user.uid}/travelers/${type}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateField(fieldKey, url as never);
    } catch (err) {
      console.error(`Error al subir ${type}:`, err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setShowNameError(true);
      setTab('personal');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch {
      /* parent toasts */
    } finally {
      setSaving(false);
    }
  };

  // Section completion (for the dot in the tab strip)
  const sectionFilled: Record<TabId, boolean> = {
    personal: !!form.fullName.trim(),
    passport: !!(form.passportNumber || form.passportExpiry || form.passportCountry || form.passportPhotoUrl),
    visa: !!(form.visaType || form.visaCountry || form.visaExpiry || form.visaPhotoUrl),
    prefs: !!(form.seatPreference || form.dietaryRestrictions || form.specialNeeds),
  };

  const previewColor = form.avatarColor || '#3b82f6';
  const previewName = form.fullName.trim() || (isEditing ? initialData!.fullName : 'Nuevo viajero');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="traveler-form-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-stretch sm:items-center justify-center sm:p-4"
          onClick={() => !saving && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative w-full sm:max-w-2xl bg-gradient-to-br from-[#152441] to-[#0c1a30] sm:rounded-3xl border border-white/[0.08] shadow-2xl flex flex-col max-h-screen sm:max-h-[92vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative orbs */}
            <div
              className="absolute -top-32 -right-32 w-72 h-72 rounded-full pointer-events-none blur-3xl opacity-40"
              style={{ background: previewColor }}
            />
            <div className="absolute -bottom-32 -left-24 w-72 h-72 rounded-full pointer-events-none blur-3xl opacity-25 bg-amber-500" />

            {/* ── Sticky header ── */}
            <div className="relative px-5 sm:px-6 pt-5 pb-4 border-b border-white/[0.06]">
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${previewColor}, ${previewColor}aa)`,
                    boxShadow: `0 6px 24px ${previewColor}66`,
                  }}
                >
                  <span className="text-white font-black text-base">
                    {getInitials(previewName) || '·'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-amber-300/80">
                    {isEditing ? 'Editando viajero' : 'Nuevo viajero'}
                  </span>
                  <h2 className="text-white text-xl sm:text-2xl font-black mt-0.5 truncate">
                    {previewName}
                  </h2>
                  <p className="text-white/45 text-xs mt-0.5">
                    Toda la info quedará lista para copiar al hacer check-in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-white/65 hover:text-white transition disabled:opacity-50"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Avatar color picker */}
              <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/45 flex-shrink-0">
                  Color
                </span>
                {AVATAR_PALETTE.map((color) => {
                  const active = (form.avatarColor || '#3b82f6') === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateField('avatarColor', color)}
                      className={classNames(
                        'w-7 h-7 rounded-full transition flex-shrink-0 flex items-center justify-center',
                        active && 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#152441]',
                      )}
                      style={{ background: color }}
                      title={color}
                    >
                      {active && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  );
                })}
              </div>

              {/* Tab strip */}
              <div className="mt-4 flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-1">
                {TABS.map((t) => {
                  const active = tab === t.id;
                  const filled = sectionFilled[t.id];
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={classNames(
                        'relative flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition',
                        active
                          ? 'bg-gradient-to-br from-amber-500/25 to-amber-600/15 text-amber-100 shadow-inner'
                          : 'text-white/55 hover:text-white/80 hover:bg-white/[0.04]',
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t.label}</span>
                      <span className="sm:hidden">{t.shortLabel}</span>
                      {filled && (
                        <span
                          className={classNames(
                            'absolute top-1 right-1 w-1.5 h-1.5 rounded-full',
                            active ? 'bg-amber-300' : 'bg-emerald-400',
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <form onSubmit={handleSubmit} className="relative flex-1 min-h-0 overflow-y-auto">
              <div className="px-5 sm:px-6 py-5">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {tab === 'personal' && (
                      <>
                        <DarkInput
                          label="Nombre completo"
                          value={form.fullName}
                          onChange={(v) => updateField('fullName', v)}
                          placeholder="Como aparece en el pasaporte"
                          required
                        />
                        {showNameError && (
                          <div className="flex items-center gap-2 text-rose-300 text-xs font-medium -mt-2">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            El nombre completo es requerido.
                          </div>
                        )}
                        <DarkSelect
                          label="Relación"
                          value={form.relationship || ''}
                          onChange={(v) => updateField('relationship', v)}
                          options={RELATIONSHIP_OPTIONS}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <DarkInput
                            label="Fecha de nacimiento"
                            type="date"
                            value={form.dateOfBirth || ''}
                            onChange={(v) => updateField('dateOfBirth', v)}
                          />
                          <DarkInput
                            label="Nacionalidad"
                            value={form.nationality || ''}
                            onChange={(v) => updateField('nationality', v)}
                            placeholder="Mexicana"
                          />
                        </div>
                        <DarkInput
                          label="Teléfono"
                          type="tel"
                          value={form.phone || ''}
                          onChange={(v) => updateField('phone', v)}
                          placeholder="+52 55 1234 5678"
                        />
                        <div className="rounded-2xl border border-rose-300/20 bg-rose-500/[0.05] p-4 space-y-3">
                          <div className="flex items-center gap-2 text-rose-200 text-[10px] uppercase tracking-[0.18em] font-bold">
                            <Heart className="w-3 h-3" /> Contacto de emergencia
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <DarkInput
                              label="Nombre"
                              value={form.emergencyContact || ''}
                              onChange={(v) => updateField('emergencyContact', v)}
                              placeholder="Persona a contactar"
                            />
                            <DarkInput
                              label="Teléfono"
                              type="tel"
                              value={form.emergencyPhone || ''}
                              onChange={(v) => updateField('emergencyPhone', v)}
                              placeholder="+52 55 …"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {tab === 'passport' && (
                      <>
                        <DarkInput
                          label="Número de pasaporte"
                          value={form.passportNumber || ''}
                          onChange={(v) => updateField('passportNumber', v)}
                          placeholder="G12345678"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <DarkInput
                            label="País de emisión"
                            value={form.passportCountry || ''}
                            onChange={(v) => updateField('passportCountry', v)}
                            placeholder="México"
                          />
                          <DarkInput
                            label="Fecha de expiración"
                            type="date"
                            value={form.passportExpiry || ''}
                            onChange={(v) => updateField('passportExpiry', v)}
                            hint="Tip: muchos países exigen ≥6 meses de vigencia."
                          />
                        </div>
                        <DocUpload
                          label="Foto del pasaporte"
                          currentUrl={form.passportPhotoUrl}
                          uploading={uploadingPassport}
                          onUpload={(file) => handleUpload(file, 'passport')}
                          onClear={() => updateField('passportPhotoUrl', '')}
                        />
                      </>
                    )}

                    {tab === 'visa' && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <DarkInput
                            label="Tipo de visa"
                            value={form.visaType || ''}
                            onChange={(v) => updateField('visaType', v)}
                            placeholder="Turista, trabajo…"
                          />
                          <DarkInput
                            label="País"
                            value={form.visaCountry || ''}
                            onChange={(v) => updateField('visaCountry', v)}
                            placeholder="Estados Unidos"
                          />
                        </div>
                        <DarkInput
                          label="Fecha de expiración"
                          type="date"
                          value={form.visaExpiry || ''}
                          onChange={(v) => updateField('visaExpiry', v)}
                        />
                        <DocUpload
                          label="Foto de la visa"
                          currentUrl={form.visaPhotoUrl}
                          uploading={uploadingVisa}
                          onUpload={(file) => handleUpload(file, 'visa')}
                          onClear={() => updateField('visaPhotoUrl', '')}
                        />
                      </>
                    )}

                    {tab === 'prefs' && (
                      <>
                        <DarkSelect
                          label="Preferencia de asiento"
                          value={form.seatPreference || ''}
                          onChange={(v) =>
                            updateField('seatPreference', v as TravelerFormData['seatPreference'])
                          }
                          options={SEAT_OPTIONS}
                        />
                        <DarkInput
                          label="Restricciones alimentarias"
                          value={form.dietaryRestrictions || ''}
                          onChange={(v) => updateField('dietaryRestrictions', v)}
                          placeholder="Vegetariano, sin gluten…"
                        />
                        <DarkInput
                          label="Necesidades especiales"
                          value={form.specialNeeds || ''}
                          onChange={(v) => updateField('specialNeeds', v)}
                          placeholder="Silla de ruedas, asistencia…"
                        />
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* ── Sticky footer ── */}
              <div className="sticky bottom-0 left-0 right-0 px-5 sm:px-6 py-3.5 border-t border-white/[0.06] bg-gradient-to-b from-[#0c1a30]/85 to-[#0c1a30] backdrop-blur-md flex items-center justify-between gap-3">
                <span className="text-[11px] text-white/45 hidden sm:inline">
                  {isEditing ? 'Los cambios se guardan al confirmar.' : 'Solo el nombre es requerido.'}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-full text-sm font-bold text-white/85 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !form.fullName.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-900/30 transition disabled:opacity-50 disabled:from-white/10 disabled:to-white/10"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving
                      ? 'Guardando…'
                      : isEditing
                        ? 'Guardar cambios'
                        : 'Agregar viajero'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
