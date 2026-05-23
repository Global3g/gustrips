'use client';

import { useState } from 'react';
import { z } from 'zod/v4';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MEMBER_ROLES } from '@/config/constants';
import type { MemberRole } from '@/types';

// Roles available in the invite picker. We intentionally exclude
// `owner` — there can only be one owner per trip and ownership is
// transferred through a dedicated flow, not by invitation.
const INVITABLE_ROLES = ['editor', 'viewer', 'kid'] as const;
type InvitableRole = typeof INVITABLE_ROLES[number];

const inviteSchema = z.object({
  email: z.email('Ingresa un correo valido'),
  role: z.enum(INVITABLE_ROLES),
});

interface InviteFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: MemberRole) => Promise<void>;
  loading?: boolean;
}

export default function InviteForm({ open, onClose, onSubmit, loading = false }: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('editor');
  const [errors, setErrors] = useState<{ email?: string; role?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = inviteSchema.safeParse({ email, role });
    if (!result.success) {
      const fieldErrors: { email?: string; role?: string } = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as 'email' | 'role';
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    await onSubmit(result.data.email, result.data.role);

    // Limpiar formulario despues de enviar
    setEmail('');
    setRole('editor');
    onClose();
  };

  const handleClose = () => {
    setEmail('');
    setRole('editor');
    setErrors({});
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Invitar Viajero">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Correo electronico"
          type="email"
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          error={errors.email}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-gray-800 text-sm font-medium">
            Rol
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as InvitableRole)}
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all appearance-none cursor-pointer"
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r} className="bg-white text-gray-900">
                {MEMBER_ROLES[r].label} — {MEMBER_ROLES[r].description}
              </option>
            ))}
          </select>
          {errors.role && (
            <p className="text-red-600 text-xs mt-1">{errors.role}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            <Send className="w-4 h-4 mr-2" />
            Enviar Invitacion
          </Button>
        </div>
      </form>
    </Modal>
  );
}
