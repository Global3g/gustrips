'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Phone,
  AlertTriangle,
  Shield,
  BookOpen,
  Globe,
  Pencil,
  Heart,
  Plane,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MEMBER_ROLES } from '@/config/constants';
import { glassStyle, getInitials, classNames } from '@/lib/utils/helpers';
import { Button } from '@/components/ui/Button';
import type { TripMember } from '@/types';

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  owner: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  editor: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  viewer: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
};

const AVATAR_GRADIENTS = [
  'from-blue-500 to-cyan-400',
  'from-purple-500 to-pink-400',
  'from-amber-500 to-orange-400',
  'from-emerald-500 to-teal-400',
  'from-rose-500 to-red-400',
  'from-indigo-500 to-violet-400',
];

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

interface StatusDotProps {
  status: DocStatus;
  label: string;
}

function StatusDot({ status, label }: StatusDotProps) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-600">
      <span className={classNames('w-2 h-2 rounded-full flex-shrink-0', STATUS_COLORS[status])} />
      {label}: {STATUS_LABELS[status]}
    </span>
  );
}

interface TravelerCardProps {
  member: TripMember;
  index: number;
  onEdit: () => void;
}

export default function TravelerCard({ member, index, onEdit }: TravelerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const roleInfo = MEMBER_ROLES[member.role];
  const roleColor = ROLE_COLORS[member.role] || ROLE_COLORS.viewer;
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const info = member.travelerInfo;

  const passportStatus = getDocStatus(info?.passportExpiry);
  const visaStatus = getDocStatus(info?.visaExpiry);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <div className="rounded-xl overflow-hidden" style={glassStyle}>
        {/* Main row */}
        <div
          className="p-4 flex items-center gap-4 cursor-pointer"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {/* Avatar */}
          <div
            className={classNames(
              'w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br flex-shrink-0',
              gradient,
            )}
          >
            <span className="text-white font-bold text-sm">
              {getInitials(info?.fullName || member.displayName || member.email)}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 font-medium text-sm truncate">
              {info?.fullName || member.displayName || 'Sin nombre'}
            </p>
            <p className="text-gray-500 text-xs truncate">{member.email}</p>
            {/* Status dots row */}
            <div className="flex items-center gap-3 mt-1.5">
              <StatusDot status={passportStatus} label="Pasaporte" />
              <StatusDot status={visaStatus} label="Visa" />
            </div>
          </div>

          {/* Role badge + expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={classNames(
                'text-xs font-medium px-2.5 py-1 rounded-full border',
                roleColor.bg,
                roleColor.text,
                roleColor.border,
              )}
            >
              {roleInfo.label}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
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
              <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                {info ? (
                  <div className="space-y-3">
                    {/* Contact row */}
                    {(info.phone || info.emergencyContact) && (
                      <div className="grid grid-cols-2 gap-3">
                        {info.phone && (
                          <div className="flex items-center gap-2 text-xs text-gray-700">
                            <Phone className="w-3.5 h-3.5 text-blue-600" />
                            {info.phone}
                          </div>
                        )}
                        {info.emergencyContact && (
                          <div className="flex items-center gap-2 text-xs text-gray-700">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            {info.emergencyContact}
                            {info.emergencyPhone && ` (${info.emergencyPhone})`}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Passport */}
                    {info.passportNumber && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <BookOpen className="w-3.5 h-3.5 text-cyan-600" />
                        Pasaporte: {info.passportNumber}
                        {info.passportCountry && ` (${info.passportCountry})`}
                        {info.passportExpiry && (
                          <span className={classNames(
                            'ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                            passportStatus === 'valid' && 'bg-emerald-50 text-emerald-600',
                            passportStatus === 'warning' && 'bg-amber-50 text-amber-600',
                            passportStatus === 'expired' && 'bg-red-50 text-red-600',
                          )}>
                            Exp: {info.passportExpiry}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Passport photo */}
                    {info.passportPhotoUrl && (
                      <a href={info.passportPhotoUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
                        <img
                          src={info.passportPhotoUrl}
                          alt="Pasaporte"
                          className="w-full max-w-xs rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        />
                        <span className="text-[10px] text-blue-500 mt-1 inline-block">Ver pasaporte completo</span>
                      </a>
                    )}

                    {/* Visa */}
                    {info.visaType && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Globe className="w-3.5 h-3.5 text-purple-600" />
                        Visa {info.visaType}
                        {info.visaCountry && ` — ${info.visaCountry}`}
                        {info.visaExpiry && (
                          <span className={classNames(
                            'ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                            visaStatus === 'valid' && 'bg-emerald-50 text-emerald-600',
                            visaStatus === 'warning' && 'bg-amber-50 text-amber-600',
                            visaStatus === 'expired' && 'bg-red-50 text-red-600',
                          )}>
                            Exp: {info.visaExpiry}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Visa photo */}
                    {info.visaPhotoUrl && (
                      <a href={info.visaPhotoUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
                        <img
                          src={info.visaPhotoUrl}
                          alt="Visa"
                          className="w-full max-w-xs rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        />
                        <span className="text-[10px] text-blue-500 mt-1 inline-block">Ver visa completa</span>
                      </a>
                    )}

                    {/* Preferences */}
                    {(info.seatPreference || info.dietaryRestrictions || info.specialNeeds) && (
                      <div className="space-y-1">
                        {info.seatPreference && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Plane className="w-3.5 h-3.5 text-sky-400" />
                            Asiento: {info.seatPreference === 'window' ? 'Ventana' : info.seatPreference === 'aisle' ? 'Pasillo' : 'Centro'}
                          </div>
                        )}
                        {info.dietaryRestrictions && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Heart className="w-3.5 h-3.5 text-pink-400" />
                            Dieta: {info.dietaryRestrictions}
                          </div>
                        )}
                        {info.specialNeeds && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Shield className="w-3.5 h-3.5 text-emerald-600" />
                            Necesidades: {info.specialNeeds}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Edit button */}
                    <div className="pt-2">
                      <Button variant="secondary" size="sm" onClick={onEdit}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Editar info
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-gray-400 text-xs mb-3">
                      Sin informacion de viajero registrada
                    </p>
                    <Button variant="secondary" size="sm" onClick={onEdit}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Agregar info
                    </Button>
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

export { getDocStatus };
export type { DocStatus };
