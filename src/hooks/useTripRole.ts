'use client';

/**
 * useTripRole — single source of truth for the current user's role on the
 * trip currently in scope (via `TripDataProvider`).
 *
 * Why this exists
 * ---------------
 * Before this hook, every component that needed to gate a button by role
 * had to:
 *   1. Pull the current user from `useAuth`
 *   2. Pull the members list from `useMembersFromContext`
 *   3. Find the matching member doc by uid
 *   4. Compare `member.role` against a string literal
 *
 * That logic was easy to get wrong (forgetting the owner-by-createdBy
 * fallback, treating `undefined` as `'editor'` silently, missing the
 * `kid` role…). This hook centralizes all of it and exposes a `can.*`
 * object precomputed from the role so call sites read like:
 *
 *   const { can } = useTripRole();
 *   if (!can.editEvents) return <ReadOnlyBanner />;
 *
 * Backwards compatibility
 * -----------------------
 * Existing member docs may not have a `role` field yet (the field has
 * been there since v1 but wasn't enforced). We default missing roles to
 * `'editor'` to preserve the historical "everyone on the trip can edit"
 * behavior — formal roles are an additive layer, not a sudden lockdown.
 *
 * The trip's `createdBy` user is always treated as `owner` regardless of
 * their member doc (or absence of one).
 */

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTripData } from '@/context/TripDataContext';
import type { TripRole } from '@/types';

export interface TripRolePermissions {
  /** Edit, create, delete events on the itinerary. */
  editEvents: boolean;
  /** Edit, create, delete expenses (including the FAB). */
  editExpenses: boolean;
  /** Upload / delete photos and documents. */
  editPhotos: boolean;
  /** Upload / delete documents (alias of editPhotos for clarity at the call site). */
  editDocuments: boolean;
  /** Invite, remove, change role of other members. */
  manageMembers: boolean;
  /** Hard-delete the entire trip. */
  deleteTrip: boolean;
  /** Change trip metadata (title, dates, destination, settings). */
  editTrip: boolean;
  /** True for viewer/kid — render the read-only chrome (banners, no FABs). */
  readOnly: boolean;
  /** True for `kid` only — render the simplified-UI variants where available. */
  kidMode: boolean;
}

export interface UseTripRoleReturn {
  /** The resolved role, or null if we can't determine it yet (loading / no user). */
  role: TripRole | null;
  /** Precomputed permission flags derived from `role`. */
  can: TripRolePermissions;
}

/**
 * Map a role to its full permission set. Kept as a pure function so it's
 * easy to unit-test and so future roles can be added in one place.
 */
function permissionsFor(role: TripRole | null): TripRolePermissions {
  // null = "still figuring it out" — treat as the most conservative state
  // so we never flash an edit affordance to an unauthenticated viewer.
  if (role === null) {
    return {
      editEvents: false,
      editExpenses: false,
      editPhotos: false,
      editDocuments: false,
      manageMembers: false,
      deleteTrip: false,
      editTrip: false,
      readOnly: true,
      kidMode: false,
    };
  }
  const isOwner = role === 'owner';
  const isEditor = role === 'editor';
  const canEdit = isOwner || isEditor;
  return {
    editEvents: canEdit,
    editExpenses: canEdit,
    editPhotos: canEdit,
    editDocuments: canEdit,
    manageMembers: isOwner,
    deleteTrip: isOwner,
    editTrip: isOwner,
    readOnly: !canEdit,
    kidMode: role === 'kid',
  };
}

export function useTripRole(): UseTripRoleReturn {
  const { user } = useAuth();
  // Reads from the same context that powers the rest of the trip subtree —
  // no extra Firestore listener.
  const { trip, membersHook } = useTripData();
  const { members } = membersHook;

  const role = useMemo<TripRole | null>(() => {
    if (!user || !trip) return null;
    // The trip creator is always owner, even if there's no matching
    // member doc (which is the legacy case — single-owner trips never
    // had a members subcollection populated for the creator).
    if (trip.createdBy === user.uid) return 'owner';
    const me = members.find((m) => m.uid === user.uid);
    if (!me) {
      // No member doc yet. Could be a shared-link visitor, a pending
      // invite that wasn't fully processed, or simply a viewer of a
      // public trip. Treat as viewer so we render the read-only chrome.
      return 'viewer';
    }
    // Backwards-compat: legacy member docs may have an empty / undefined
    // role. Default to editor so we don't lock long-standing collaborators
    // out of a trip they used to be able to edit.
    return me.role || 'editor';
  }, [user, trip, members]);

  const can = useMemo(() => permissionsFor(role), [role]);

  return { role, can };
}
