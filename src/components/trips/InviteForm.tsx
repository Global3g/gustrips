'use client';

import { useState } from 'react';
import { z } from 'zod/v4';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MEMBER_ROLES } from '@/config/constants';
import type { MemberRole } from '@/types';

const inviteSchema = z.object({
  email: z.email('Ingresa un correo valido'),
  role: z.enum(['editor', 'viewer'] as const),
});

interface InviteFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: MemberRole) => Promise<void>;
  loading?: boolean;
}

export default function InviteForm({ open, onClose, onSubmit, loading = false }: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
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
    <Modal open={open} onClose={handleClose} title="Invitar Miembro">
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
          <label className="block text-white/80 text-sm font-medium">
            Rol
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all appearance-none cursor-pointer"
          >
            <option value="editor" className="bg-gray-800 text-white">
              {MEMBER_ROLES.editor.label} — {MEMBER_ROLES.editor.description}
            </option>
            <option value="viewer" className="bg-gray-800 text-white">
              {MEMBER_ROLES.viewer.label} — {MEMBER_ROLES.viewer.description}
            </option>
          </select>
          {errors.role && (
            <p className="text-red-400 text-xs mt-1">{errors.role}</p>
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
