'use client';

import { useState, useRef, type FormEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Upload,
  User,
  BookOpen,
  Globe,
  Heart,
  Save,
  Loader2,
  Check,
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { getClientStorage } from '@/lib/firebase/client';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { classNames } from '@/lib/utils/helpers';
import type { TravelerInfo } from '@/types';

interface TravelerFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (info: TravelerInfo) => Promise<void>;
  initialData?: TravelerInfo;
  travelerName: string;
  tripId: string;
  uid: string;
}

const EMPTY_TRAVELER: TravelerInfo = {
  fullName: '',
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

const SEAT_OPTIONS = [
  { value: '', label: 'Sin preferencia' },
  { value: 'window', label: 'Ventana' },
  { value: 'aisle', label: 'Pasillo' },
  { value: 'middle', label: 'Centro' },
];

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-blue-600">{icon}</span>
        <span className="text-gray-900 font-medium text-sm flex-1">{title}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-4 border-t border-gray-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FileUploadButtonProps {
  label: string;
  currentUrl?: string;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
}

function FileUploadButton({ label, currentUrl, uploading, onUpload }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUpload(file);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-gray-700 font-medium">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={classNames(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
            'bg-gray-50 border border-gray-300 text-gray-800 hover:bg-gray-100 hover:text-gray-900',
            uploading && 'opacity-50 cursor-not-allowed',
          )}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? 'Subiendo...' : 'Subir foto'}
        </button>
        {currentUrl && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600">
            <Check className="w-3.5 h-3.5" />
            Archivo cargado
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  );
}

export default function TravelerForm({
  open,
  onClose,
  onSave,
  initialData,
  travelerName,
  tripId,
  uid,
}: TravelerFormProps) {
  const [form, setForm] = useState<TravelerInfo>({
    ...EMPTY_TRAVELER,
    ...initialData,
    fullName: initialData?.fullName || travelerName,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPassport, setUploadingPassport] = useState(false);
  const [uploadingVisa, setUploadingVisa] = useState(false);

  const updateField = <K extends keyof TravelerInfo>(key: K, value: TravelerInfo[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpload = async (
    file: File,
    type: 'passport' | 'visa',
  ) => {
    const setUploading = type === 'passport' ? setUploadingPassport : setUploadingVisa;
    const fieldKey = type === 'passport' ? 'passportPhotoUrl' : 'visaPhotoUrl';

    setUploading(true);
    try {
      const storage = getClientStorage();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `trips/${tripId}/travelers/${uid}/${type}.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updateField(fieldKey, url);
    } catch (err) {
      console.error(`Error al subir ${type}:`, err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      console.error('Error al guardar info de viajero:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm({
      ...EMPTY_TRAVELER,
      ...initialData,
      fullName: initialData?.fullName || travelerName,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Info de Viajero — ${travelerName}`} className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Personal */}
        <CollapsibleSection
          title="Informacion Personal"
          icon={<User className="w-4 h-4" />}
          defaultOpen
        >
          <Input
            label="Nombre completo"
            value={form.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            placeholder="Nombre como aparece en el pasaporte"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={form.dateOfBirth || ''}
              onChange={(e) => updateField('dateOfBirth', e.target.value)}
            />
            <Input
              label="Nacionalidad"
              value={form.nationality || ''}
              onChange={(e) => updateField('nationality', e.target.value)}
              placeholder="Ej. Mexicana"
            />
          </div>
          <Input
            label="Telefono"
            type="tel"
            value={form.phone || ''}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+52 55 1234 5678"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contacto de emergencia"
              value={form.emergencyContact || ''}
              onChange={(e) => updateField('emergencyContact', e.target.value)}
              placeholder="Nombre"
            />
            <Input
              label="Tel. emergencia"
              type="tel"
              value={form.emergencyPhone || ''}
              onChange={(e) => updateField('emergencyPhone', e.target.value)}
              placeholder="+52 55 ..."
            />
          </div>
        </CollapsibleSection>

        {/* Passport */}
        <CollapsibleSection
          title="Pasaporte"
          icon={<BookOpen className="w-4 h-4" />}
        >
          <Input
            label="Numero de pasaporte"
            value={form.passportNumber || ''}
            onChange={(e) => updateField('passportNumber', e.target.value)}
            placeholder="G12345678"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Pais de emision"
              value={form.passportCountry || ''}
              onChange={(e) => updateField('passportCountry', e.target.value)}
              placeholder="Mexico"
            />
            <Input
              label="Fecha de expiracion"
              type="date"
              value={form.passportExpiry || ''}
              onChange={(e) => updateField('passportExpiry', e.target.value)}
            />
          </div>
          <FileUploadButton
            label="Foto del pasaporte"
            currentUrl={form.passportPhotoUrl}
            uploading={uploadingPassport}
            onUpload={(file) => handleUpload(file, 'passport')}
          />
        </CollapsibleSection>

        {/* Visa */}
        <CollapsibleSection
          title="Visa"
          icon={<Globe className="w-4 h-4" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tipo de visa"
              value={form.visaType || ''}
              onChange={(e) => updateField('visaType', e.target.value)}
              placeholder="Turista, Trabajo..."
            />
            <Input
              label="Pais"
              value={form.visaCountry || ''}
              onChange={(e) => updateField('visaCountry', e.target.value)}
              placeholder="Estados Unidos"
            />
          </div>
          <Input
            label="Fecha de expiracion"
            type="date"
            value={form.visaExpiry || ''}
            onChange={(e) => updateField('visaExpiry', e.target.value)}
          />
          <FileUploadButton
            label="Foto de la visa"
            currentUrl={form.visaPhotoUrl}
            uploading={uploadingVisa}
            onUpload={(file) => handleUpload(file, 'visa')}
          />
        </CollapsibleSection>

        {/* Preferences */}
        <CollapsibleSection
          title="Preferencias"
          icon={<Heart className="w-4 h-4" />}
        >
          <Select
            label="Preferencia de asiento"
            options={SEAT_OPTIONS}
            value={form.seatPreference || ''}
            onChange={(e) =>
              updateField('seatPreference', e.target.value as TravelerInfo['seatPreference'])
            }
          />
          <Input
            label="Restricciones alimentarias"
            value={form.dietaryRestrictions || ''}
            onChange={(e) => updateField('dietaryRestrictions', e.target.value)}
            placeholder="Vegetariano, sin gluten..."
          />
          <Input
            label="Necesidades especiales"
            value={form.specialNeeds || ''}
            onChange={(e) => updateField('specialNeeds', e.target.value)}
            placeholder="Silla de ruedas, asistencia..."
          />
        </CollapsibleSection>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
