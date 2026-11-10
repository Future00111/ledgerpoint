/**
 * Application identity and sign-out state from the authenticated Clerk session.
 */
import React, { createContext, useContext } from 'react';
import { useUser, useClerk } from '@clerk/react';
import { authPaths } from './authPaths.mjs';

const AuthContext = createContext(undefined);
const paths = authPaths(import.meta.env.BASE_URL);

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
    navigateToLogin: () => { window.location.href = paths.signIn; },
    logout: () => signOut({ redirectUrl: paths.home }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside the Clerk-backed AuthProvider.');
  return ctx;
}
