import { useState, useEffect } from 'react';

const KEY = 'ledgerly:workspace:favourites';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

// Lightweight per-record favourite toggle persisted in localStorage.
// Reusable across every Workspace so favourites feel consistent.
export function useFavourite(id) {
  const [fav, setFav] = useState(() => !!id && !!read()[id]);

  useEffect(() => {
    if (id) setFav(!!read()[id]);
  }, [id]);

  const toggle = () => {
    if (!id) return;
    const all = read();
    if (all[id]) {
      delete all[id];
    } else {
      all[id] = Date.now();
    }
    localStorage.setItem(KEY, JSON.stringify(all));
    setFav(!!all[id]);
  };

  return [fav, toggle];
}