'use client';

import { useAuthContext } from '@/context/AuthContext';

export function useAuth() {
  const context = useAuthContext();
  const isAuthenticated = !!context.firebaseUser && !context.loading;
  return { ...context, isAuthenticated };
}
