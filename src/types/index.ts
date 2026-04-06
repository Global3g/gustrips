import type { Timestamp } from 'firebase/firestore';

// ─── Trip ───────────────────────────────────────────
export type TripStatus = 'planning' | 'active' | 'completed' | 'cancelled';

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  coverImage: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: TripStatus;
}

// ─── Member ─────────────────────────────────────────
export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface TripMember {
  uid: string;
  email: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string;
  invitedBy: string;
}

// ─── Invite ─────────────────────────────────────────
export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface TripInvite {
  id: string;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  invitedBy: string;
  createdAt: string;
}

// ─── Event ──────────────────────────────────────────
export type EventType = 'flight' | 'hotel' | 'activity' | 'restaurant' | 'transport' | 'car_rental' | 'other';

export interface TripEvent {
  id: string;
  title: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  cost: number;
  currency: string;
  attachments: string[];
  details?: Record<string, string>;
  timezone?: string; // IANA timezone, ej. "America/Mazatlan"
  createdBy: string;
  createdAt: string;
}

// ─── Attachment ─────────────────────────────────────
export interface TripAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  eventId?: string;
}

// ─── Checklist ──────────────────────────────────────
export type ChecklistPhase = 'pre-7d' | 'pre-1d' | 'airport' | 'hotel' | 'return';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  phase: ChecklistPhase;
  createdBy: string;
  createdAt: string;
}

// ─── User (minimal for auth) ────────────────────────
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}
