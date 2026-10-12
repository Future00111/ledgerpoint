// Bridge so existing `toast({ title, description, variant })` call sites flow
// into the new notification system (src/components/notifications).
import { useSyncExternalStore } from 'react';
import * as store from '@/components/notifications/notifications';

export function toast(props = {}) {
  return store.push({
    type: props.variant === 'destructive' ? 'error' : props.type || 'info',
    title: props.title,
    description: props.description,
    route: props.route,
  });
}

export function useToast() {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return {
    toasts: state.active,
    toast,
    dismiss: store.dismiss,
  };
}

export { store as _notificationStore };