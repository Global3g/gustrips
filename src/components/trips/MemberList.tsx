'use client';

import { UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
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

interface MemberListProps {
  members: TripMember[];
  onInvite: () => void;
  isOwner: boolean;
}

export default function MemberList({ members, onInvite, isOwner }: MemberListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-gray-900 font-semibold text-lg">
          Viajeros ({members.length})
        </h3>
        <Button variant="secondary" size="sm" onClick={onInvite}>
          <UserPlus className="w-4 h-4 mr-2" />
          Invitar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {members.map((member, index) => {
          const roleInfo = MEMBER_ROLES[member.role];
          const roleColor = ROLE_COLORS[member.role] || ROLE_COLORS.viewer;
          const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];

          return (
            <motion.div
              key={member.uid}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
            >
              <div
                className="rounded-xl p-4 flex items-center gap-4"
                style={glassStyle}
              >
                {/* Avatar */}
                <div
                  className={classNames(
                    'w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br flex-shrink-0',
                    gradient,
                  )}
                >
                  <span className="text-white font-bold text-sm">
                    {getInitials(member.displayName || member.email)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium text-sm truncate">
                    {member.displayName || 'Sin nombre'}
                  </p>
                  <p className="text-gray-500 text-xs truncate">
                    {member.email}
                  </p>
                </div>

                {/* Role badge */}
                <span
                  className={classNames(
                    'text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0',
                    roleColor.bg,
                    roleColor.text,
                    roleColor.border,
                  )}
                >
                  {roleInfo.label}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {members.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">No hay miembros aun</p>
        </div>
      )}
    </div>
  );
}
