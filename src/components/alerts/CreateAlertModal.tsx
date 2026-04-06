'use client';

import { useState } from 'react';
import { Bell, Plane, DollarSign } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import AirportAutocomplete from '@/components/ui/AirportAutocomplete';
import { createAlert } from '@/lib/api/alerts';

interface CreateAlertModalProps {
  userId: string;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
  // Optional pre-fill data from flight search
  defaultOrigin?: string;
  defaultDestination?: string;
  defaultPrice?: number;
}

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'MXN', label: 'MXN ($)' },
];

export default function CreateAlertModal({
  userId,
  userEmail,
  onClose,
  onSuccess,
  defaultOrigin = '',
  defaultDestination = '',
  defaultPrice,
}: CreateAlertModalProps) {
  const [origin, setOrigin] = useState(defaultOrigin);
  const [destination, setDestination] = useState(defaultDestination);
  const [targetPrice, setTargetPrice] = useState(defaultPrice?.toString() || '');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!origin || !destination || !targetPrice) {
      setError('Completa todos los campos');
      return;
    }

    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      setError('Ingresa un precio válido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createAlert({
        userId,
        email: userEmail,
        origin,
        destination,
        targetPrice: price,
        currency,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear alerta');
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Crear Alerta de Precio">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Origin & Destination */}
        <div className="grid grid-cols-2 gap-4">
          <AirportAutocomplete
            label="Origen"
            placeholder="Buscar ciudad o aeropuerto..."
            value={origin}
            onChange={setOrigin}
            required
          />
          <AirportAutocomplete
            label="Destino"
            placeholder="Buscar ciudad o aeropuerto..."
            value={destination}
            onChange={setDestination}
            required
          />
        </div>

        {/* Price & Currency */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Precio objetivo"
            type="number"
            step="0.01"
            min="1"
            placeholder="2500"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            icon={DollarSign}
            required
          />
          <Select
            label="Moneda"
            options={CURRENCY_OPTIONS}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </div>

        {/* Info */}
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-400">
          <Bell className="inline h-4 w-4 mr-2" />
          Te enviaremos un email a <strong>{userEmail}</strong> cuando el precio esté por debajo de tu objetivo.
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={loading}
            className="flex-1"
          >
            Crear Alerta
          </Button>
        </div>
      </form>
    </Modal>
  );
}
