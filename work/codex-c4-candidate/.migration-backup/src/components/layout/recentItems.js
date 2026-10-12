const KEY = 'lp.recent';

export function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function pushRecent(item) {
  if (!item || !item.path) return;
  let list = getRecent().filter((r) => r.path !== item.path);
  list.unshift({ label: item.label, path: item.path });
  list = list.slice(0, 8);
  localStorage.setItem(KEY, JSON.stringify(list));
}