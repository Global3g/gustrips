'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getClientDb, getClientStorage } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { nowISO } from '@/lib/utils/helpers';
import { markMutation } from '@/components/SyncIndicator';
import type { TripAttachment, DocumentCategory } from '@/types';

interface UploadOptions {
  eventId?: string;
  category?: DocumentCategory;
  /** Override the document name (defaults to file.name if omitted) */
  name?: string;
}

/**
 * Lightweight write-only variant — exposes `uploadDocument` without opening
 * the live attachments subscription. Use this in components/layouts that
 * only need to upload (not display) docs; calling the full `useDocuments`
 * unnecessarily costs a permanent onSnapshot listener.
 */
export function useUploadDocument(tripId: string) {
  const { user } = useAuth();

  const uploadDocument = useCallback(
    async (file: File, options?: UploadOptions) => {
      if (!user) throw new Error('Usuario no autenticado');

      const storage = getClientStorage();
      const timestamp = Date.now();
      const storageRef = ref(storage, `trips/${tripId}/${timestamp}_${file.name}`);

      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      const db = getClientDb();
      const attachmentsRef = collection(db, `trips/${tripId}/attachments`);

      const docData: Record<string, unknown> = {
        name: options?.name?.trim() || file.name,
        url,
        type: file.type,
        size: file.size,
        uploadedBy: user.uid,
        createdAt: nowISO(),
      };

      if (options?.eventId) {
        docData.eventId = options.eventId;
      }
      if (options?.category) {
        docData.category = options.category;
      }

      await addDoc(attachmentsRef, docData);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }

      return url;
    },
    [tripId, user],
  );

  return { uploadDocument };
}

export function useDocuments(tripId: string) {
  const [documents, setDocuments] = useState<TripAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!tripId) return;

    const db = getClientDb();
    const attachmentsRef = collection(db, `trips/${tripId}/attachments`);
    const q = query(attachmentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as TripAttachment[];
        setDocuments(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error al escuchar documentos:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tripId]);

  const uploadDocument = useCallback(
    async (file: File, options?: UploadOptions) => {
      if (!user) throw new Error('Usuario no autenticado');

      const storage = getClientStorage();
      const timestamp = Date.now();
      const storageRef = ref(storage, `trips/${tripId}/${timestamp}_${file.name}`);

      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      const db = getClientDb();
      const attachmentsRef = collection(db, `trips/${tripId}/attachments`);

      const docData: Record<string, unknown> = {
        name: options?.name?.trim() || file.name,
        url,
        type: file.type,
        size: file.size,
        uploadedBy: user.uid,
        createdAt: nowISO(),
      };

      if (options?.eventId) {
        docData.eventId = options.eventId;
      }
      if (options?.category) {
        docData.category = options.category;
      }

      await addDoc(attachmentsRef, docData);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }

      return url;
    },
    [tripId, user]
  );

  const deleteDocument = useCallback(
    async (docId: string, url: string) => {
      const storage = getClientStorage();
      const storageRef = ref(storage, url);

      try {
        await deleteObject(storageRef);
      } catch (error) {
        console.error('Error al eliminar archivo de Storage:', error);
      }

      const db = getClientDb();
      const docRef = doc(db, `trips/${tripId}/attachments`, docId);
      await deleteDoc(docRef);
      try { markMutation(); } catch { /* localStorage may be unavailable */ }
    },
    [tripId]
  );

  const getDocumentsByEvent = useCallback(
    (eventId: string): TripAttachment[] => {
      return documents.filter((d) => d.eventId === eventId);
    },
    [documents]
  );

  const getDocumentsByCategory = useCallback(
    (category: DocumentCategory): TripAttachment[] => {
      return documents.filter((d) => d.category === category);
    },
    [documents]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of documents) {
      const cat = d.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [documents]);

  return {
    documents,
    loading,
    uploadDocument,
    deleteDocument,
    getDocumentsByEvent,
    getDocumentsByCategory,
    categoryCounts,
  };
}
