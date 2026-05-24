'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import Cookies from 'js-cookie';
import * as Sentry from '@sentry/nextjs';
import { getClientAuth } from '@/lib/firebase/client';
import type { AppUser } from '@/types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onIdTokenChanged fires both on sign-in/out AND on every silent token
    // refresh (Firebase auto-refreshes ~5 min before expiry). That keeps
    // the cookie in sync with a live ID token — which is what server-side
    // verification needs.
    // NOTE: this callback must stay synchronous up to `setLoading(false)`.
    // onIdTokenChanged restores the cached Firebase user from IndexedDB with
    // NO network, but `getIdToken()` hits the network whenever the cached
    // token is stale (tokens expire in 1h). Awaiting it here used to block
    // `setLoading(false)` — so once the token went stale offline or on a
    // flaky connection (hello, London roaming), the refresh hung/threw and
    // the whole app stuck on the "Cargando..." spinner with `user` null.
    // We now set the user + clear loading immediately, and refresh the cookie
    // in the background as best-effort.
    const unsubscribe = onIdTokenChanged(getClientAuth(), (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        setUser({
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || '',
          photoURL: fbUser.photoURL,
        });
        // Tell Sentry who's logged in so future error reports get tagged
        // with the user id (and we can search "all errors for user X").
        // The email is intentionally NOT sent — id is enough to triage.
        Sentry.setUser({ id: fbUser.uid });

        // Keep the auth-token cookie in sync for server-side verification.
        // Fire-and-forget: never block render and never throw out of the
        // observer (that would leave loading=true forever offline).
        fbUser
          .getIdToken()
          .then((token) => {
            const isSecure =
              typeof window !== 'undefined' && window.location.protocol === 'https:';
            Cookies.set('auth-token', token, {
              expires: 1 / 24, // 1 hour — matches the ID token lifetime
              path: '/',
              sameSite: 'Lax',
              secure: isSecure,
            });
          })
          .catch(() => {
            /* offline or refresh failed — keep using the app with cached data */
          });
      } else {
        Cookies.remove('auth-token', { path: '/' });
        setUser(null);
        Sentry.setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(getClientAuth(), email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const credential = await createUserWithEmailAndPassword(getClientAuth(), email, password);
    await updateProfile(credential.user, { displayName });
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getClientAuth(), provider);
  };

  const signOut = async () => {
    await firebaseSignOut(getClientAuth());
    Cookies.remove('auth-token', { path: '/' });
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(getClientAuth(), email);
  };

  const value = useMemo(
    () => ({ firebaseUser, user, loading, signIn, signUp, signInWithGoogle, signOut, resetPassword }),
    [firebaseUser, user, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within an AuthProvider');
  return context;
}
