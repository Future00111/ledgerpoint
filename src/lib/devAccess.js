import { useAuth } from '@/lib/AuthContext';

// Development Tools are only visible when the app runs in a development
// environment OR the signed-in user has the Developer role. Never to normal
// customers.
export function canAccessDevTools(user) {
  const isDevEnv =
    (typeof import.meta !== 'undefined' && import.meta.env &&
      (import.meta.env.DEV || import.meta.env.MODE === 'development')) || false;
  return !!(isDevEnv || (user && user.role === 'developer'));
}

export function useCanAccessDevTools() {
  const { user } = useAuth();
  return canAccessDevTools(user);
}