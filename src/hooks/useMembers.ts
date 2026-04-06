'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  orderBy,
  query,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { nowISO } from '@/lib/utils/helpers';
import type { TripMember, TripInvite, MemberRole } from '@/types';

interface UseMembersReturn {
  members: TripMember[];
  invites: TripInvite[];
  loading: boolean;
  inviteMember: (email: string, role: MemberRole) => Promise<void>;
}

export function useMembers(tripId: string): UseMembersReturn {
  const { user } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Escuchar miembros
  useEffect(() => {
    if (!tripId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const db = getClientDb();
    const membersRef = collection(db, 'trips', tripId, 'members');

    const unsubscribe = onSnapshot(
      membersRef,
      (snapshot) => {
        const membersData: TripMember[] = snapshot.docs.map((doc) => ({
          ...doc.data(),
          uid: doc.id,
        })) as TripMember[];
        setMembers(membersData);
        setLoading(false);
      },
      (err) => {
        console.error('Error al escuchar miembros:', err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [tripId]);

  // Escuchar invitaciones
  useEffect(() => {
    if (!tripId) {
      setInvites([]);
      return;
    }

    const db = getClientDb();
    const invitesRef = collection(db, 'trips', tripId, 'invites');
    const q = query(invitesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const invitesData: TripInvite[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TripInvite[];
        setInvites(invitesData);
      },
      (err) => {
        console.error('Error al escuchar invitaciones:', err);
      },
    );

    return () => unsubscribe();
  }, [tripId]);

  const inviteMember = useCallback(
    async (email: string, role: MemberRole): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');
      if (!tripId) throw new Error('ID de viaje no proporcionado');

      const db = getClientDb();
      const invitesRef = collection(db, 'trips', tripId, 'invites');

      await addDoc(invitesRef, {
        email,
        role,
        status: 'pending',
        invitedBy: user.uid,
        createdAt: nowISO(),
      });
    },
    [user, tripId],
  );

  return { members, invites, loading, inviteMember };
}
