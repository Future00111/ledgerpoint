/** Persist only an opaque event locator, never financial intent or review tokens.
 * Native company membership checks remain authoritative on every status read. */
export function createPaymentLocator(companyId, browser = window) {
  const key = `ledgerly.payment-outcome:${companyId}`;
  const prefix = `${key}:event:`;
  const valid = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  return {
    read() {
      try {
        const url = new URL(browser.location.href);
        const id = url.searchParams.get('payment_request');
        if (url.searchParams.get('payment_company') === companyId && valid(id)) return id;
        const stored = browser.localStorage.getItem(key); // Older single-reference format.
        if (valid(stored)) return stored;
        const ids = [];
        for (let i = 0; i < browser.localStorage.length; i++) {
          const k = browser.localStorage.key(i);
          if (k?.startsWith(prefix)) {
            const candidate = k.slice(prefix.length);
            if (valid(candidate) && browser.localStorage.getItem(k) === candidate) ids.push(candidate);
          }
        }
        return ids.sort()[0] ?? null;
      } catch { return null; }
    },
    remember(id) {
      if (!valid(id)) throw Error('The payment reference is invalid. Nothing was sent.');
      try {
        const prior = this.read();
        if (prior && prior !== id) throw Error('An earlier payment reference still needs checking');
        // Different event IDs never compete for the same storage key. Two tabs
        // racing past the prior check cannot overwrite one another's locator.
        browser.localStorage.setItem(prefix + id, id);
        if (browser.localStorage.getItem(prefix + id) !== id) throw Error('Storage did not retain the reference');
        const url = new URL(browser.location.href);
        url.searchParams.set('payment_request', id);
        url.searchParams.set('payment_company', companyId);
        browser.history.replaceState(browser.history.state, '', url);
      } catch {
        throw Error('The recovery reference could not be saved. Nothing was sent. Enable browser storage before recording a payment.');
      }
    },
    forget(id) {
      // Only used after a verified recorded outcome, never for an unknown event.
      try {
        if (browser.localStorage.getItem(key) === id) browser.localStorage.removeItem(key);
        browser.localStorage.removeItem(prefix + id);
        const url = new URL(browser.location.href);
        if (url.searchParams.get('payment_company') === companyId && url.searchParams.get('payment_request') === id) {
          url.searchParams.delete('payment_request'); url.searchParams.delete('payment_company');
          browser.history.replaceState(browser.history.state, '', url);
        }
      } catch { /* A retained known locator is safe to check again. */ }
    },
  };
}
