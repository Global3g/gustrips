'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { z } from 'zod/v4';
import { ImagePlus, X, Loader2, Users, Check } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TRIP_STATUS, CURRENCIES, DEFAULT_CURRENCY } from '@/config/constants';
import { getClientStorage } from '@/lib/firebase/client';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { classNames, getInitials } from '@/lib/utils/helpers';
import type { Trip, TripStatus } from '@/types';

const COVER_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const COVER_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const tripSchema = z.object({
  title: z.string().min(1, 'El titulo es obligatorio').max(100, 'Maximo 100 caracteres'),
  destination: z.string().min(1, 'El destino es obligatorio').max(100, 'Maximo 100 caracteres'),
  startDate: z.string().min(1, 'La fecha de inicio es obligatoria'),
  endDate: z.string().min(1, 'La fecha de fin es obligatoria'),
  description: z.string().max(500, 'Maximo 500 caracteres').optional().default(''),
  status: z.enum(['planning', 'active', 'completed', 'cancelled'] as const),
  budget: z.coerce.number().min(0, 'El presupuesto no puede ser negativo').optional(),
  budgetCurrency: z.string().optional().default(DEFAULT_CURRENCY),
  travelerIds: z.array(z.string()).optional().default([]),
});

type TripFormData = z.infer<typeof tripSchema>;

interface TripFormProps {
  initialData?: Partial<Trip>;
  onSubmit: (data: TripFormData & { coverImage?: string | null }) => Promise<void>;
  loading?: boolean;
}

export default function TripForm({ initialData, onSubmit, loading = false }: TripFormProps) {
  const isEditing = !!initialData?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { travelers: globalTravelers, loading: travelersLoading } = useGlobalTravelers();

  const [formData, setFormData] = useState<TripFormData>({
    title: initialData?.title || '',
    destination: initialData?.destination || '',
    startDate: initialData?.startDate || '',
    endDate: initialData?.endDate || '',
    description: initialData?.description || '',
    status: initialData?.status || 'planning',
    budget: initialData?.budget ?? undefined,
    budgetCurrency: initialData?.budgetCurrency || DEFAULT_CURRENCY,
    travelerIds: initialData?.travelerIds || [],
  });

  const [coverPreview, setCoverPreview] = useState<string | null>(initialData?.coverImage || null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<keyof TripFormData, string>>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        destination: initialData.destination || '',
        startDate: initialData.startDate || '',
        endDate: initialData.endDate || '',
        description: initialData.description || '',
        status: initialData.status || 'planning',
        budget: initialData.budget ?? undefined,
        budgetCurrency: initialData.budgetCurrency || DEFAULT_CURRENCY,
        travelerIds: initialData.travelerIds || [],
      });
      setCoverPreview(initialData.coverImage || null);
    }
  }, [initialData]);

  const validateCoverFile = (file: File): string | null => {
    if (!COVER_ACCEPTED_TYPES.includes(file.type)) {
      return 'Solo se permiten imagenes JPEG, PNG o WebP';
    }
    if (file.size > COVER_MAX_SIZE) {
      return 'La imagen no debe superar 5MB';
    }
    return null;
  };

  const handleCoverSelect = useCallback((file: File) => {
    const error = validateCoverFile(file);
    if (error) {
      setCoverError(error);
      return;
    }
    setCoverError(null);
    setCoverFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverPreview(objectUrl);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCoverSelect(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCoverSelect(file);
  };

  const removeCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setCoverError(null);
  };

  const uploadCoverImage = async (tripId: string): Promise<string> => {
    if (!coverFile) throw new Error('No cover file to upload');
    const storage = getClientStorage();
    const ext = coverFile.name.split('.').pop() || 'jpg';
    const storagePath = `trips/${tripId}/cover_${Date.now()}.${ext}`;
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, coverFile);
    return getDownloadURL(snapshot.ref);
  };

  const toggleTraveler = (travelerId: string) => {
    setFormData((prev) => {
      const current = prev.travelerIds || [];
      const isSelected = current.includes(travelerId);
      return {
        ...prev,
        travelerIds: isSelected
          ? current.filter((id) => id !== travelerId)
          : [...current, travelerId],
      };
    });
  };

  const handleChange = (field: keyof TripFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = tripSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof TripFormData, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof TripFormData;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    if (result.data.endDate < result.data.startDate) {
      setErrors({ endDate: 'La fecha de fin debe ser posterior a la de inicio' });
      return;
    }

    setErrors({});

    // Determine cover image URL
    let coverImageUrl: string | null = coverPreview;
    if (coverFile) {
      try {
        setCoverUploading(true);
        const uploadId = initialData?.id || `temp_${Date.now()}`;
        coverImageUrl = await uploadCoverImage(uploadId);
      } catch (err) {
        console.error('Error al subir imagen de portada:', err);
        setCoverError('Error al subir la imagen');
        return;
      } finally {
        setCoverUploading(false);
      }
    } else if (!coverPreview) {
      coverImageUrl = null;
    }

    await onSubmit({ ...result.data, coverImage: coverImageUrl });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-2xl p-6 space-y-5 bg-white border border-gray-200 shadow-sm">
        <h2 className="text-gray-900 text-xl font-semibold mb-4">
          {isEditing ? 'Editar Viaje' : 'Nuevo Viaje'}
        </h2>

        {/* Cover Image Upload */}
        <div className="space-y-1.5">
          <label className="block text-gray-700 text-sm font-medium">
            Imagen de portada
          </label>

          {coverPreview ? (
            <div className="relative rounded-xl overflow-hidden group">
              <img
                src={coverPreview}
                alt="Portada del viaje"
                className="w-full h-48 object-cover rounded-xl"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors backdrop-blur-sm"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={removeCover}
                  className="w-9 h-9 bg-red-500/60 hover:bg-red-500/80 rounded-lg flex items-center justify-center text-white transition-colors backdrop-blur-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {coverUploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                h-48 rounded-xl border-2 border-dashed cursor-pointer
                flex flex-col items-center justify-center gap-3 transition-all duration-200
                ${dragOver
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }
              `}
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <ImagePlus className="w-6 h-6 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm">
                  Arrastra una imagen o haz clic
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  JPEG, PNG, WebP (max 5MB)
                </p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {coverError && (
            <p className="text-red-500 text-xs mt-1">{coverError}</p>
          )}
        </div>

        <Input
          label="Titulo del viaje"
          placeholder="Ej: Vacaciones en Cancun"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          error={errors.title}
          required
        />

        <Input
          label="Destino"
          placeholder="Ej: Cancun, Mexico"
          value={formData.destination}
          onChange={(e) => handleChange('destination', e.target.value)}
          error={errors.destination}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Fecha de inicio"
            type="date"
            value={formData.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            error={errors.startDate}
            required
          />

          <Input
            label="Fecha de fin"
            type="date"
            value={formData.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
            error={errors.endDate}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-gray-700 text-sm font-medium">
            Descripcion
          </label>
          <textarea
            placeholder="Describe tu viaje..."
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-all resize-none"
          />
          {errors.description && (
            <p className="text-red-500 text-xs mt-1">{errors.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Presupuesto"
            type="number"
            placeholder="Ej: 50000"
            min={0}
            step={0.01}
            value={formData.budget ?? ''}
            onChange={(e) => handleChange('budget', e.target.value)}
            error={errors.budget}
          />

          <div className="space-y-1.5">
            <label className="block text-gray-700 text-sm font-medium">
              Moneda
            </label>
            <select
              value={formData.budgetCurrency}
              onChange={(e) => handleChange('budgetCurrency', e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-all appearance-none cursor-pointer"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Traveler selection */}
        <div className="space-y-2">
          <label className="block text-gray-700 text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            Viajeros del viaje
          </label>
          {travelersLoading ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-gray-400 text-sm">Cargando viajeros...</span>
            </div>
          ) : globalTravelers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center">
              <p className="text-gray-400 text-sm">
                No tienes viajeros registrados.
              </p>
              <a
                href="/travelers"
                className="text-red-500 hover:text-red-600 text-sm font-medium mt-1 inline-block"
              >
                Agregar viajeros
              </a>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {globalTravelers.map((traveler) => {
                const isSelected = (formData.travelerIds || []).includes(traveler.id);
                const avatarColor = traveler.avatarColor || '#3b82f6';

                return (
                  <button
                    key={traveler.id}
                    type="button"
                    onClick={() => toggleTraveler(traveler.id)}
                    className={classNames(
                      'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 border',
                      isSelected
                        ? 'bg-red-50 border-red-300 text-red-700 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300',
                    )}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials(traveler.fullName)}
                    </span>
                    <span className="truncate max-w-[120px]">{traveler.fullName}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {(formData.travelerIds || []).length > 0 && (
            <p className="text-xs text-gray-400">
              {(formData.travelerIds || []).length} viajero{(formData.travelerIds || []).length !== 1 ? 's' : ''} seleccionado{(formData.travelerIds || []).length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-gray-700 text-sm font-medium">
            Estado
          </label>
          <select
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-all appearance-none cursor-pointer"
          >
            {(Object.entries(TRIP_STATUS) as [TripStatus, { label: string; color: string }][]).map(
              ([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            loading={loading || coverUploading}
            className="w-full"
          >
            {coverUploading ? 'Subiendo imagen...' : isEditing ? 'Guardar Cambios' : 'Crear Viaje'}
          </Button>
        </div>
      </div>
    </form>
  );
}
