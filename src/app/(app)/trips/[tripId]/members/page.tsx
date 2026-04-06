'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Calendar, Users, FileText, CheckSquare, Clock, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTrip } from '@/hooks/useTrip';
import { useMembers } from '@/hooks/useMembers';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/context/ToastContext';
import MemberList from '@/components/trips/MemberList';
import InviteForm from '@/components/trips/InviteForm';
import { TRIP_NAV_ITEMS } from '@/config/navigation';
import { ROUTES, MEMBER_ROLES } from '@/config/constants';
import { glassStyle, classNames } from '@/lib/utils/helpers';
import type { MemberRole } from '@/types';

const NAV_ICONS: Record<string, typeof MapPin> = {
  MapPin,
  Calendar,
  Users,
  FileText,
  CheckSquare,
};

const INVITE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'text-amber-400' },
  accepted: { label: 'Aceptada', color: 'text-emerald-400' },
  declined: { label: 'Rechazada', color: 'text-red-400' },
};

function MembersSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl p-4 flex items-center gap-4" style={glassStyle}>
          <div className="w-11 h-11 bg-white/10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/10 rounded w-32" />
            <div className="h-3 bg-white/5 rounded w-48" />
          </div>
          <div className="h-6 bg-white/5 rounded-full w-16" />
        </div>
      ))}
    </div>
  );
}

export default function MembersPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { trip } = useTrip(tripId);
  const { members, invites, loading, inviteMember } = useMembers(tripId);
  const { user } = useAuth();
  const { toast } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);

  const isOwner = trip?.createdBy === user?.uid;

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

  const pendingInvites = invites.filter((inv) => inv.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3"
      >
        <Link
          href={ROUTES.app.trip(tripId)}
          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <div>
          <h1 className="text-white text-2xl font-bold">Miembros</h1>
          <p className="text-white/50 text-sm">
            {trip?.title || 'Cargando...'}
          </p>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div
          className="rounded-xl overflow-x-auto scrollbar-none"
          style={glassStyle}
        >
          <nav className="flex min-w-max">
            {TRIP_NAV_ITEMS.map((item) => {
              const href = item.href
                ? ROUTES.app.trip(tripId) + item.href
                : ROUTES.app.trip(tripId);
              const isActive = item.href === '/members';
              const Icon = NAV_ICONS[item.icon] || MapPin;

              return (
                <Link
                  key={item.label}
                  href={href}
                  className={classNames(
                    'flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap relative',
                    isActive
                      ? 'text-blue-400'
                      : 'text-white/50 hover:text-white/80',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="trip-tab-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-400 rounded-full"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </motion.div>

      {/* Members */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {loading ? (
          <MembersSkeleton />
        ) : (
          <MemberList
            members={members}
            onInvite={() => setShowInvite(true)}
            isOwner={isOwner}
          />
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
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
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
                  <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-amber-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {invite.email}
                    </p>
                    <p className="text-white/40 text-xs">
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
          <h3 className="text-white/60 font-medium text-sm">
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
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3.5 h-3.5 text-white/40" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-sm truncate">
                        {invite.email}
                      </p>
                      <p className="text-white/30 text-xs">
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
    </div>
  );
}
