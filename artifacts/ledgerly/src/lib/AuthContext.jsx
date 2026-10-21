/**
 * Application identity and sign-out state from the authenticated Clerk session.
 */
import React, { createContext, useContext } from 'react';
import { useUser, useClerk } from '@clerk/react';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const contextUser = user
    ? {
        id: user.id,
        email: user.emailAddresses?.[0]?.emailAddress ?? null,
        full_name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        first_name: user.firstName ?? null,
        last_name: user.lastName ?? null,
        image_url: user.imageUrl ?? null,
      }
    : null;

  const value = {
    user: contextUser,
    isAuthenticated: !!isSignedIn,
    isLoadingAuth: !isLoaded,
    isLoadingPublicSettings: !isLoaded,
    authChecked: isLoaded,
    authError: null,
    navigateToLogin: () => { window.location.href = '/sign-in'; },
    logout: () => signOut({ redirectUrl: '/' }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside the Clerk-backed AuthProvider.');
  return ctx;
}
