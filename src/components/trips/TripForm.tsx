'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod/v4';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TRIP_STATUS } from '@/config/constants';
import { glassStyle } from '@/lib/utils/helpers';
import type { Trip, TripStatus } from '@/types';

const tripSchema = z.object({
  title: z.string().min(1, 'El titulo es obligatorio').max(100, 'Maximo 100 caracteres'),
  destination: z.string().min(1, 'El destino es obligatorio').max(100, 'Maximo 100 caracteres'),
  startDate: z.string().min(1, 'La fecha de inicio es obligatoria'),
  endDate: z.string().min(1, 'La fecha de fin es obligatoria'),
  description: z.string().max(500, 'Maximo 500 caracteres').optional().default(''),
  status: z.enum(['planning', 'active', 'completed', 'cancelled'] as const),
});

type TripFormData = z.infer<typeof tripSchema>;

interface TripFormProps {
  initialData?: Partial<Trip>;
  onSubmit: (data: TripFormData) => Promise<void>;
  loading?: boolean;
}

export default function TripForm({ initialData, onSubmit, loading = false }: TripFormProps) {
  const isEditing = !!initialData?.id;

  const [formData, setFormData] = useState<TripFormData>({
    title: initialData?.title || '',
    destination: initialData?.destination || '',
    startDate: initialData?.startDate || '',
    endDate: initialData?.endDate || '',
    description: initialData?.description || '',
    status: initialData?.status || 'planning',
  });

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
      });
    }
  }, [initialData]);

  const handleChange = (field: keyof TripFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpiar error del campo al escribir
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

    // Validar que la fecha de fin sea posterior a la de inicio
    if (result.data.endDate < result.data.startDate) {
      setErrors({ endDate: 'La fecha de fin debe ser posterior a la de inicio' });
      return;
    }

    setErrors({});
    await onSubmit(result.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-2xl p-6 space-y-5" style={glassStyle}>
        <h2 className="text-white text-xl font-semibold mb-4">
          {isEditing ? 'Editar Viaje' : 'Nuevo Viaje'}
        </h2>

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
          <label className="block text-white/80 text-sm font-medium">
            Descripcion
          </label>
          <textarea
            placeholder="Describe tu viaje..."
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all resize-none"
          />
          {errors.description && (
            <p className="text-red-400 text-xs mt-1">{errors.description}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-white/80 text-sm font-medium">
            Estado
          </label>
          <select
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all appearance-none cursor-pointer"
          >
            {(Object.entries(TRIP_STATUS) as [TripStatus, { label: string; color: string }][]).map(
              ([key, val]) => (
                <option key={key} value={key} className="bg-gray-800 text-white">
                  {val.label}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            loading={loading}
            className="w-full"
          >
            {isEditing ? 'Guardar Cambios' : 'Crear Viaje'}
          </Button>
        </div>
      </div>
    </form>
  );
}
