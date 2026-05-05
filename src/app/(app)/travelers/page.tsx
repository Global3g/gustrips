'use client';

import { useState } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Globe,
  Phone,
  Heart,
  Shield,
  Plane,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import GlobalTravelerForm from '@/components/travelers/GlobalTravelerForm';
import { glassStyle, classNames, getInitials } from '@/lib/utils/helpers';
import type { GlobalTraveler } from '@/types';

/* ---- Doc status helpers ---- */

type DocStatus = 'valid' | 'warning' | 'expired' | 'none';

function getDocStatus(expiry?: string): DocStatus {
  if (!expiry) return 'none';
  const expiryDate = new Date(expiry);
  const now = new Date();
  if (expiryDate < now) return 'expired';
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  if (expiryDate < sixMonths) return 'warning';
  return 'valid';
}

const STATUS_COLORS: Record<DocStatus, string> = {
  valid: 'bg-emerald-400',
  warning: 'bg-amber-400',
  expired: 'bg-red-400',
  none: 'bg-gray-200',
};

const STATUS_LABELS: Record<DocStatus, string> = {
  valid: 'Vigente',
  warning: 'Pronto a vencer',
  expired: 'Vencido',
  none: 'Sin registrar',
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  yo: 'Yo',
  esposa: 'Esposa',
  esposo: 'Esposo',
  hijo: 'Hijo/a',
  padre: 'Padre',
  madre: 'Madre',
  hermano: 'Hermano/a',
  amigo: 'Amigo/a',
  otro: 'Otro',
};

/* ---- Skeleton ---- */

function TravelersSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl p-5 bg-white border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 animate-shimmer rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 animate-shimmer rounded w-32" />
              <div className="h-3 animate-shimmer rounded w-20" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 animate-shimmer rounded w-full" />
            <div className="h-3 animate-shimmer rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Traveler Card ---- */

interface GlobalTravelerCardProps {
  traveler: GlobalTraveler;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

function GlobalTravelerCard({ traveler, index, onEdit, onDelete }: GlobalTravelerCardProps) {
  const passportStatus = getDocStatus(traveler.passportExpiry);
  const visaStatus = getDocStatus(traveler.visaExpiry);
  const avatarColor = traveler.avatarColor || '#3b82f6';
  const relationship = traveler.relationship ? (RELATIONSHIP_LABELS[traveler.relationship] || traveler.relationship) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <div
        className="rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Header */}
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              <span className="text-white font-bold text-sm">
                {getInitials(traveler.fullName)}
              </span>
            </div>

            {/* Name + relationship */}
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 font-semibold text-base truncate">
                {traveler.fullName}
              </p>
              {relationship && (
                <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mt-1">
                  {relationship}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status dots */}
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={classNames('w-2 h-2 rounded-full flex-shrink-0', STATUS_COLORS[passportStatus])} />
              Pasaporte: {STATUS_LABELS[passportStatus]}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={classNames('w-2 h-2 rounded-full flex-shrink-0', STATUS_COLORS[visaStatus])} />
              Visa: {STATUS_LABELS[visaStatus]}
            </span>
          </div>

          {/* Quick info row */}
          {(traveler.nationality || traveler.phone) && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
              {traveler.nationality && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Globe className="w-3.5 h-3.5" />
                  {traveler.nationality}
                </span>
              )}
              {traveler.phone && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Phone className="w-3.5 h-3.5" />
                  {traveler.phone}
                </span>
              )}
            </div>
          )}

          {/* Document photos */}
          {(traveler.passportPhotoUrl || traveler.visaPhotoUrl) && (
            <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
              {traveler.passportPhotoUrl && (
                <a href={traveler.passportPhotoUrl} target="_blank" rel="noopener noreferrer" className="block flex-1">
                  <img
                    src={traveler.passportPhotoUrl}
                    alt="Pasaporte"
                    className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block text-center">Pasaporte</span>
                </a>
              )}
              {traveler.visaPhotoUrl && (
                <a href={traveler.visaPhotoUrl} target="_blank" rel="noopener noreferrer" className="block flex-1">
                  <img
                    src={traveler.visaPhotoUrl}
                    alt="Visa"
                    className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block text-center">Visa</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ---- Main Page ---- */

export default function TravelersPage() {
  const { travelers, loading, addTraveler, updateTraveler, deleteTraveler } = useGlobalTravelers();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingTraveler, setEditingTraveler] = useState<GlobalTraveler | null>(null);
  const [deletingTraveler, setDeletingTraveler] = useState<GlobalTraveler | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async (data: Omit<GlobalTraveler, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingTraveler) {
        await updateTraveler(editingTraveler.id, data);
        toast('Viajero actualizado', 'success');
      } else {
        await addTraveler(data);
        toast('Viajero agregado', 'success');
      }
      setShowForm(false);
      setEditingTraveler(null);
    } catch (err) {
      console.error('Error al guardar viajero:', err);
      toast('Error al guardar el viajero', 'error');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingTraveler) return;
    try {
      setDeleting(true);
      await deleteTraveler(deletingTraveler.id);
      toast('Viajero eliminado', 'success');
      setDeletingTraveler(null);
    } catch (err) {
      console.error('Error al eliminar viajero:', err);
      toast('Error al eliminar el viajero', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (traveler: GlobalTraveler) => {
    setEditingTraveler(traveler);
    setShowForm(true);
  };

  const openNew = () => {
    setEditingTraveler(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-gray-900 text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Users className="w-7 h-7 text-red-500" />
            Viajeros
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Gestiona tu grupo de viajeros: familia, amigos y companeros.
          </p>
        </div>

        <Button onClick={openNew} className="flex-shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Agregar viajero</span>
          <span className="sm:hidden">Agregar</span>
        </Button>
      </motion.div>

      {/* Loading */}
      {loading && <TravelersSkeleton />}

      {/* Empty state */}
      {!loading && travelers.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-violet-300" />
          </div>
          <h3 className="text-gray-900 font-bold text-lg mb-1">
            Sin viajeros registrados
          </h3>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Agrega a las personas con las que viajas frecuentemente. Podras asignarlos a cada viaje rapidamente.
          </p>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar tu primer viajero
          </Button>
        </motion.div>
      )}

      {/* Travelers grid */}
      {!loading && travelers.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {travelers.map((traveler, index) => (
            <GlobalTravelerCard
              key={traveler.id}
              traveler={traveler}
              index={index}
              onEdit={() => openEdit(traveler)}
              onDelete={() => setDeletingTraveler(traveler)}
            />
          ))}
        </motion.div>
      )}

      {/* Form Modal */}
      {showForm && (
        <GlobalTravelerForm
          open={showForm}
          onClose={() => {
            setShowForm(false);
            setEditingTraveler(null);
          }}
          onSave={handleSave}
          initialData={editingTraveler ?? undefined}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deletingTraveler}
        onClose={() => setDeletingTraveler(null)}
        title="Eliminar viajero"
        className="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Estas seguro de que quieres eliminar a{' '}
            <strong>{deletingTraveler?.fullName}</strong>? Esta accion no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeletingTraveler(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              loading={deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
