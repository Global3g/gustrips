'use client';

/**
 * Biometric / WebAuthn lock for sensitive sections (currently used by
 * /documents). Uses the platform authenticator (Face ID, Touch ID,
 * Windows Hello, Android biometric prompt) via the WebAuthn API.
 *
 * Model:
 *   - First time the user opens a locked section, we ask whether they
 *     want to enable biometric protection. If yes, we register a
 *     resident credential bound to the device.
 *   - Subsequent opens prompt for the platform authenticator. The
 *     unlocked state persists in sessionStorage so navigating between
 *     pages inside the documents section doesn't re-prompt.
 *   - There is no fallback PIN today — if the device loses the
 *     credential (e.g. biometrics reset), the user can re-enable from
 *     Settings. Their data isn't encrypted with this credential; this is
 *     a gate, not a key. Real E2EE is on the roadmap.
 *
 * Why this shape: the WebAuthn API is everywhere modern (iOS 15+, every
 * modern Android, Windows 10+, macOS) and doesn't need any external
 * service. Capacitor builds inherit native biometric for free via the
 * platform authenticator.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const PREF_KEY = (uid: string) => `gustrips:biometric:${uid}`;
const SESSION_UNLOCK_KEY = (uid: string) => `gustrips:biometric:session:${uid}`;

type Status =
  | 'idle'           // initial — we don't know yet
  | 'unsupported'    // WebAuthn not available
  | 'available'      // supported, no credential registered yet
  | 'registered'     // credential registered, currently locked
  | 'unlocked';      // credential registered AND session is unlocked

interface BiometricLock {
  status: Status;
  /** Whether the section is currently accessible without further prompt. */
  isUnlocked: boolean;
  /** Register a new platform-authenticator credential for this user. */
  enable: () => Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Prompt the user with the platform auth to unlock the section. */
  unlock: () => Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Forget the credential (re-enable required next time). */
  disable: () => void;
  /** Lock the section in the current session (e.g. on logout). */
  lock: () => void;
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function useBiometricLock(): BiometricLock {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const uid = user?.uid;

  useEffect(() => {
    if (!uid || typeof window === 'undefined') return;
    if (!window.PublicKeyCredential) {
      setStatus('unsupported');
      return;
    }
    const stored = window.localStorage.getItem(PREF_KEY(uid));
    if (!stored) {
      setStatus('available');
      return;
    }
    const sessionUnlocked = window.sessionStorage.getItem(SESSION_UNLOCK_KEY(uid)) === '1';
    setStatus(sessionUnlocked ? 'unlocked' : 'registered');
  }, [uid]);

  const enable = useCallback(async (): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (!uid) return { ok: false, reason: 'no-user' };
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return { ok: false, reason: 'unsupported' };
    }
    try {
      // Challenge is just a random nonce — no server roundtrip because
      // we use this only as a local gate, not for authentication to a
      // server. If we ever harden it to server-side, we'd issue the
      // challenge from an endpoint and verify the assertion there.
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userIdBuf = new TextEncoder().encode(uid);
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'GusTrips' },
          user: {
            id: userIdBuf,
            name: user?.email || uid,
            displayName: user?.displayName || 'GusTrips user',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60_000,
          attestation: 'none',
        },
      })) as PublicKeyCredential | null;

      if (!credential) return { ok: false, reason: 'cancelled' };

      const credentialId = bufferToBase64Url(credential.rawId);
      window.localStorage.setItem(PREF_KEY(uid), credentialId);
      window.sessionStorage.setItem(SESSION_UNLOCK_KEY(uid), '1');
      setStatus('unlocked');
      return { ok: true };
    } catch (err) {
      const reason = err instanceof Error ? err.name || err.message : 'unknown';
      return { ok: false, reason };
    }
  }, [uid, user?.email, user?.displayName]);

  const unlock = useCallback(async (): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (!uid) return { ok: false, reason: 'no-user' };
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return { ok: false, reason: 'unsupported' };
    }
    const stored = window.localStorage.getItem(PREF_KEY(uid));
    if (!stored) return { ok: false, reason: 'not-enrolled' };
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credentialIdBuf = base64UrlToBuffer(stored);
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: credentialIdBuf, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!assertion) return { ok: false, reason: 'cancelled' };
      window.sessionStorage.setItem(SESSION_UNLOCK_KEY(uid), '1');
      setStatus('unlocked');
      return { ok: true };
    } catch (err) {
      const reason = err instanceof Error ? err.name || err.message : 'unknown';
      return { ok: false, reason };
    }
  }, [uid]);

  const disable = useCallback(() => {
    if (!uid || typeof window === 'undefined') return;
    window.localStorage.removeItem(PREF_KEY(uid));
    window.sessionStorage.removeItem(SESSION_UNLOCK_KEY(uid));
    setStatus('available');
  }, [uid]);

  const lock = useCallback(() => {
    if (!uid || typeof window === 'undefined') return;
    window.sessionStorage.removeItem(SESSION_UNLOCK_KEY(uid));
    if (window.localStorage.getItem(PREF_KEY(uid))) {
      setStatus('registered');
    }
  }, [uid]);

  return {
    status,
    isUnlocked: status === 'unlocked' || status === 'unsupported',
    enable,
    unlock,
    disable,
    lock,
  };
}
