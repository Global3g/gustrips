'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  setDoc,
  deleteDoc,
  orderBy,
  query,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { nowISO } from '@/lib/utils/helpers';
import { markMutation } from '@/components/SyncIndicator';
import type { TripMember, TripInvite, MemberRole, TravelerInfo } from '@/types';

interface UseMembersReturn {
  members: TripMember[];
  invites: TripInvite[];
  loading: boolean;
  inviteMember: (email: string, role: MemberRole) => Promise<void>;
  updateTravelerInfo: (uid: string, info: TravelerInfo) => Promise<void>;
  /** Owner-only: change another member's role. The owner role itself
   * cannot be reassigned through this — transferring ownership is a
   * separate flow (not yet implemented). */
  updateMemberRole: (uid: string, role: MemberRole) => Promise<void>;
  /** Owner-only: revoke a member from the trip. */
  removeMember: (uid: string) => Promise<void>;
  /** Any non-owner member: leave the trip voluntarily. */
  leaveTrip: () => Promise<void>;
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
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [user, tripId],
  );

  const updateTravelerInfo = useCallback(
    async (uid: string, info: TravelerInfo): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');
      if (!tripId) throw new Error('ID de viaje no proporcionado');

      const db = getClientDb();
      const memberRef = doc(db, 'trips', tripId, 'members', uid);

      await setDoc(memberRef, { travelerInfo: info }, { merge: true });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [user, tripId],
  );

  const updateMemberRole = useCallback(
    async (uid: string, role: MemberRole): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');
      if (!tripId) throw new Error('ID de viaje no proporcionado');
      // The UI gates this behind `can.manageMembers` and the Firestore
      // rules enforce owner-only as well — this is the third line of
      // defense (helpful error messages for engineers debugging in dev).
      const db = getClientDb();
      const memberRef = doc(db, 'trips', tripId, 'members', uid);
      await setDoc(memberRef, { role }, { merge: true });
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [user, tripId],
  );

  const removeMember = useCallback(
    async (uid: string): Promise<void> => {
      if (!user) throw new Error('Usuario no autenticado');
      if (!tripId) throw new Error('ID de viaje no proporcionado');
      const db = getClientDb();
      const memberRef = doc(db, 'trips', tripId, 'members', uid);
      await deleteDoc(memberRef);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [user, tripId],
  );

  const leaveTrip = useCallback(async (): Promise<void> => {
    if (!user) throw new Error('Usuario no autenticado');
    if (!tripId) throw new Error('ID de viaje no proporcionado');
    // Self-delete: the firestore rules allow a member to remove their
    // own member doc. The owner uses removeMember/transfer-ownership
    // instead and never reaches this path.
    const db = getClientDb();
    const memberRef = doc(db, 'trips', tripId, 'members', user.uid);
    await deleteDoc(memberRef);
    try { markMutation(); } catch { /* localStorage may be unavailable */ }
  }, [user, tripId]);

  return {
    members,
    invites,
    loading,
    inviteMember,
    updateTravelerInfo,
    updateMemberRole,
    removeMember,
    leaveTrip,
  };
}
