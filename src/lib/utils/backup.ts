import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase/client';
import type {
  Trip,
  TripEvent,
  ChecklistItem,
  TripAttachment,
  SharedExpense,
  TripMember,
} from '@/types';

const BACKUP_VERSION = '1.0.0';

export interface TripBackupData {
  version: string;
  exportedAt: string;
  trip: Trip;
  events: TripEvent[];
  checklistItems: ChecklistItem[];
  documents: Omit<TripAttachment, 'url'>[];
  expenses: SharedExpense[];
  members: TripMember[];
}

export interface FullBackupData {
  version: string;
  exportedAt: string;
  trips: TripBackupData[];
}

/**
 * Fetches ALL data for a single trip and returns a backup object.
 */
export async function exportTripBackup(tripId: string): Promise<TripBackupData> {
  const db = getClientDb();

  // Fetch trip document
  const tripSnap = await getDoc(doc(db, 'trips', tripId));
  if (!tripSnap.exists()) {
    throw new Error('Viaje no encontrado');
  }
  const trip = { id: tripSnap.id, ...tripSnap.data() } as Trip;

  // Fetch subcollections in parallel
  const [eventsSnap, checklistSnap, docsSnap, expensesSnap, membersSnap] = await Promise.all([
    getDocs(query(collection(db, `trips/${tripId}/events`), orderBy('date', 'asc'))),
    getDocs(query(collection(db, `trips/${tripId}/checklist`), orderBy('phase', 'asc'))),
    getDocs(query(collection(db, `trips/${tripId}/attachments`), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, `trips/${tripId}/expenses`), orderBy('date', 'desc'))),
    getDocs(collection(db, `trips/${tripId}/members`)),
  ]);

  const events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TripEvent[];
  const checklistItems = checklistSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChecklistItem[];

  // Exclude download URLs from document backup for safety (metadata only)
  const documents = docsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      type: data.type,
      size: data.size,
      uploadedBy: data.uploadedBy,
      createdAt: data.createdAt,
      eventId: data.eventId,
      category: data.category,
    };
  }) as Omit<TripAttachment, 'url'>[];

  const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SharedExpense[];
  const members = membersSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as TripMember[];

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    trip,
    events,
    checklistItems,
    documents,
    expenses,
    members,
  };
}

/**
 * Exports ALL trips for a given user as a single backup object.
 */
export async function exportAllTripsBackup(userId: string): Promise<FullBackupData> {
  const db = getClientDb();
  const tripsSnap = await getDocs(
    query(collection(db, 'trips'), where('createdBy', '==', userId)),
  );

  const tripIds = tripsSnap.docs.map((d) => d.id);
  const tripsData = await Promise.all(tripIds.map((id) => exportTripBackup(id)));

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    trips: tripsData,
  };
}

/**
 * Triggers a JSON file download in the browser.
 */
export function downloadBackup(data: TripBackupData | FullBackupData, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a safe filename for a trip backup.
 */
export function getTripBackupFilename(tripTitle: string): string {
  const safeTitle = tripTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const dateStr = new Date().toISOString().slice(0, 10);
  return `gustrips-backup-${safeTitle}-${dateStr}.json`;
}

/**
 * Generates a filename for a full backup.
 */
export function getFullBackupFilename(): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `gustrips-backup-all-${dateStr}.json`;
}
