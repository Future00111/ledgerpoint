import { useSyncExternalStore } from 'react';
import * as store from './notifications';

export function useNotifications() {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const unread = state.history.filter((h) => !h.read).length;
  return {
    active: state.active,
    history: state.history,
    unread,
    push: store.push,
    dismiss: store.dismiss,
    pause: store.pause,
    resume: store.resume,
    markRead: store.markRead,
    markAllRead: store.markAllRead,
    removeNotif: store.removeNotif,
    clearAll: store.clearAll,
  };
}