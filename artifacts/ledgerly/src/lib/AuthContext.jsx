/**
 * AuthContext — replaced with Clerk.
 * Provides a thin compatibility layer so existing code using useAuth() keeps working.
 */
import React, { createContext, useContext } from 'react';
import { useUser, useClerk } from '@clerk/react';

const AuthContext = createContext(null);

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
    checkUserAuth: () => {},
    navigateToLogin: () => { window.location.href = '/sign-in'; },
    logout: () => signOut({ redirectUrl: '/' }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const defaultAuth = {
  user: null,
  isAuthenticated: false,
  isLoadingAuth: true,
  isLoadingPublicSettings: true,
  authChecked: false,
  authError: null,
  checkUserAuth: () => {},
  navigateToLogin: () => { window.location.href = '/sign-in'; },
  logout: () => Promise.resolve(),
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx ?? defaultAuth;
}
