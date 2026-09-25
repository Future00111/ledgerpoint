const KEY = 'lp.ask.searches';

export function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function pushRecentSearch(q) {
  if (!q) return;
  let list = getRecentSearches().filter((s) => s !== q);
  list.unshift(q);
  list = list.slice(0, 6);
  localStorage.setItem(KEY, JSON.stringify(list));
}