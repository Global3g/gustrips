'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Clock,
  Mail,
  UserPlus,
  BookOpen,
  Globe,
  Settings,
  Check,
  X,
  Phone,
  AlertTriangle,
  Shield,
  Heart,
  Plane,
  Pencil,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
// Trip comes from the layout-level TripDataProvider.
import { useTripFromContext as useTrip } from '@/context/TripDataContext';
import { useMembers } from '@/hooks/useMembers';
import { useGlobalTravelers } from '@/hooks/useGlobalTravelers';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/context/ToastContext';
import InviteForm from '@/components/trips/InviteForm';
import { MEMBER_ROLES } from '@/config/constants';
import { Modal } from '@/components/ui/Modal';
import { glassStyle, classNames, getInitials } from '@/lib/utils/helpers';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import type { MemberRole, GlobalTraveler } from '@/types';

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

const INVITE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600' },
  accepted: { label: 'Aceptada', color: 'text-emerald-600' },
  declined: { label: 'Rechazada', color: 'text-red-600' },
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

function MembersSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl p-4 flex items-center gap-4" style={glassStyle}>
          <div className="w-11 h-11 animate-shimmer rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 animate-shimmer rounded w-32" />
            <div className="h-3 animate-shimmer rounded w-48" />
          </div>
          <div className="h-6 animate-shimmer rounded-full w-16" />
        </div>
      ))}
    </div>
  );
}

/* ---- Assigned Traveler Card (read-only) ---- */

interface AssignedTravelerCardProps {
  traveler: GlobalTraveler;
  index: number;
}

function AssignedTravelerCard({ traveler, index }: AssignedTravelerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const avatarColor = traveler.avatarColor || '#3b82f6';
  const passportStatus = getDocStatus(traveler.passportExpiry);
  const visaStatus = getDocStatus(traveler.visaExpiry);
  const relationship = traveler.relationship
    ? (RELATIONSHIP_LABELS[traveler.relationship] || traveler.relationship)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <div className="rounded-xl overflow-hidden" style={glassStyle}>
        <div
          className="p-4 flex items-center gap-4 cursor-pointer"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            <span className="text-white font-bold text-sm">
              {getInitials(traveler.fullName)}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-gray-900 font-medium text-sm truncate">
                {traveler.fullName}
              </p>
              {relationship && (
                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {relationship}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={classNames('w-2.5 h-2.5 rounded-full flex-shrink-0', STATUS_COLORS[passportStatus])} />
                Pasaporte: {STATUS_LABELS[passportStatus]}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={classNames('w-2.5 h-2.5 rounded-full flex-shrink-0', STATUS_COLORS[visaStatus])} />
                Visa: {STATUS_LABELS[visaStatus]}
              </span>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-2">
                {traveler.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    {traveler.phone}
                  </div>
                )}
                {traveler.emergencyContact && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    {traveler.emergencyContact}
                    {traveler.emergencyPhone && ` (${traveler.emergencyPhone})`}
                  </div>
                )}
                {traveler.passportNumber && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-600" />
                    Pasaporte: {traveler.passportNumber}
                    {traveler.passportCountry && ` (${traveler.passportCountry})`}
                  </div>
                )}
                {traveler.visaType && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Globe className="w-3.5 h-3.5 text-purple-600" />
                    Visa {traveler.visaType}
                    {traveler.visaCountry && ` — ${traveler.visaCountry}`}
                  </div>
                )}
                {traveler.seatPreference && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Plane className="w-3.5 h-3.5 text-sky-400" />
                    Asiento: {traveler.seatPreference === 'window' ? 'Ventana' : traveler.seatPreference === 'aisle' ? 'Pasillo' : 'Centro'}
                  </div>
                )}
                {traveler.dietaryRestrictions && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Heart className="w-3.5 h-3.5 text-pink-400" />
                    Dieta: {traveler.dietaryRestrictions}
                  </div>
                )}
                {traveler.specialNeeds && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    Necesidades: {traveler.specialNeeds}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ---- Traveler Selector Modal ---- */

interface TravelerSelectorProps {
  open: boolean;
  onClose: () => void;
  allTravelers: GlobalTraveler[];
  selectedIds: string[];
  onSave: (ids: string[]) => Promise<void>;
}

function TravelerSelector({ open, onClose, allTravelers, selectedIds, onSave }: TravelerSelectorProps) {
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } catch {
      // handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Seleccionar viajeros" className="max-w-md">
      <div className="space-y-3">
        {allTravelers.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-400 text-sm mb-2">No tienes viajeros registrados.</p>
            <Link
              href="/travelers"
              className="text-red-500 hover:text-red-600 text-sm font-medium"
            >
              Agregar viajeros
            </Link>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {allTravelers.map((traveler) => {
              const isSelected = selected.includes(traveler.id);
              const avatarColor = traveler.avatarColor || '#3b82f6';

              return (
                <button
                  key={traveler.id}
                  type="button"
                  onClick={() => toggle(traveler.id)}
                  className={classNames(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left',
                    isSelected
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-white border border-gray-200 hover:bg-gray-50',
                  )}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {getInitials(traveler.fullName)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-medium truncate">
                      {traveler.fullName}
                    </p>
                    {traveler.relationship && (
                      <p className="text-gray-400 text-xs">
                        {RELATIONSHIP_LABELS[traveler.relationship] || traveler.relationship}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <Link
            href="/travelers"
            className="text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            Gestionar viajeros
          </Link>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Guardar ({selected.length})
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---- Main Page ---- */

export default function MembersPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { trip } = useTrip();
  const { members, invites, loading: membersLoading, inviteMember } = useMembers(tripId);
  const { travelers: allGlobalTravelers, loading: travelersLoading } = useGlobalTravelers();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [showSelector, setShowSelector] = useState(false);

  const loading = membersLoading || travelersLoading;
  const isOwner = trip?.createdBy === user?.uid;

  // Get assigned travelers from global collection
  const assignedTravelers = useMemo(() => {
    const ids = trip?.travelerIds || [];
    return allGlobalTravelers.filter((t) => ids.includes(t.id));
  }, [allGlobalTravelers, trip?.travelerIds]);

  const handleInvite = async (email: string, role: MemberRole) => {
    try {
      setInviting(true);
      await inviteMember(email, role);
      toast('Invitacion enviada exitosamente', 'success');
    } catch (err) {
      console.error('Error al invitar miembro:', err);
      toast('Error al enviar la invitacion', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateTravelers = async (ids: string[]) => {
    try {
      const db = getClientDb();
      const tripRef = doc(db, 'trips', tripId);
      await updateDoc(tripRef, { travelerIds: ids });
      toast('Viajeros actualizados', 'success');
    } catch (err) {
      console.error('Error al actualizar viajeros:', err);
      toast('Error al actualizar los viajeros', 'error');
      throw err;
    }
  };

  const pendingInvites = invites.filter((inv) => inv.status === 'pending');

  // Document status summary
  const passportCount = assignedTravelers.filter((t) => t.passportNumber).length;
  const visaCount = assignedTravelers.filter((t) => t.visaType).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-gray-900 text-2xl font-bold">Viajeros</h1>
        <p className="text-gray-500 text-sm">
          {trip?.title || 'Cargando...'}
        </p>
      </motion.div>

      {/* Assigned travelers section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Viajeros del viaje ({assignedTravelers.length})
            </h3>
            {assignedTravelers.length > 0 && (
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <BookOpen className="w-3.5 h-3.5" />
                  {passportCount} pasaporte{passportCount !== 1 ? 's' : ''} registrado{passportCount !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Globe className="w-3.5 h-3.5" />
                  {visaCount} visa{visaCount !== 1 ? 's' : ''} registrada{visaCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowSelector(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Asignar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invitar
            </Button>
          </div>
        </div>

        {/* Traveler cards grid */}
        {loading ? (
          <MembersSkeleton />
        ) : assignedTravelers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assignedTravelers.map((traveler, index) => (
              <AssignedTravelerCard
                key={traveler.id}
                traveler={traveler}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300">
            <EmptyState
              variant="travelers"
              title="Sin viajeros asignados"
              description="Agrega a quienes vienen contigo para compartir gastos, documentos y vivencias."
              compact
            />
            <div className="flex items-center justify-center gap-3 pb-6">
              <Button variant="secondary" size="sm" onClick={() => setShowSelector(true)}>
                Asignar viajeros
              </Button>
              <Link
                href="/travelers"
                className="text-sm text-gray-500 hover:text-red-500 transition-colors"
              >
                Gestionar viajeros
              </Link>
            </div>
          </div>
        )}
      </motion.div>

      {/* Invitaciones pendientes */}
      {pendingInvites.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="space-y-3"
        >
          <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Invitaciones Pendientes ({pendingInvites.length})
          </h3>

          <div className="space-y-2">
            {pendingInvites.map((invite) => {
              const statusInfo = INVITE_STATUS_LABELS[invite.status];
              const roleInfo = MEMBER_ROLES[invite.role];

              return (
                <div
                  key={invite.id}
                  className="rounded-xl p-4 flex items-center gap-4"
                  style={glassStyle}
                >
                  <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-amber-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-medium truncate">
                      {invite.email}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Rol: {roleInfo.label}
                    </p>
                  </div>

                  <span className={classNames('text-xs font-medium', statusInfo.color)}>
                    {statusInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* All invites (non-pending) */}
      {invites.filter((inv) => inv.status !== 'pending').length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-3"
        >
          <h3 className="text-gray-600 font-medium text-sm">
            Historial de Invitaciones
          </h3>

          <div className="space-y-2">
            {invites
              .filter((inv) => inv.status !== 'pending')
              .map((invite) => {
                const statusInfo = INVITE_STATUS_LABELS[invite.status];
                const roleInfo = MEMBER_ROLES[invite.role];

                return (
                  <div
                    key={invite.id}
                    className="rounded-xl p-3 flex items-center gap-3 opacity-60"
                    style={glassStyle}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-gray-700 text-sm truncate">
                        {invite.email}
                      </p>
                      <p className="text-gray-300 text-xs">
                        {roleInfo.label}
                      </p>
                    </div>

                    <span className={classNames('text-xs font-medium', statusInfo.color)}>
                      {statusInfo.label}
                    </span>
                  </div>
                );
              })}
          </div>
        </motion.div>
      )}

      {/* Invite Modal */}
      <InviteForm
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onSubmit={handleInvite}
        loading={inviting}
      />

      {/* Traveler Selector Modal */}
      {showSelector && (
        <TravelerSelector
          open={showSelector}
          onClose={() => setShowSelector(false)}
          allTravelers={allGlobalTravelers}
          selectedIds={trip?.travelerIds || []}
          onSave={handleUpdateTravelers}
        />
      )}
    </div>
  );
}
