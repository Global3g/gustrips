import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let _app: App | undefined;

export function getAdminApp(): App {
  if (_app) return _app;

  const existing = getApps();
  if (existing.length > 0) {
    _app = existing[0];
    return _app;
  }

  const credsBase64 = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (credsBase64) {
    const serviceAccount = JSON.parse(
      Buffer.from(credsBase64, 'base64').toString('utf-8'),
    );
    _app = initializeApp({ credential: cert(serviceAccount) });
  } else {
    // Fallback: use application default credentials (works in GCP/Firebase env)
    _app = initializeApp();
  }

  return _app;
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
