import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getClientStorage } from '@/lib/firebase/client';

export async function uploadReceipt(tripId: string, file: File): Promise<string> {
  const storage = getClientStorage();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `trips/${tripId}/receipts/${timestamp}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
