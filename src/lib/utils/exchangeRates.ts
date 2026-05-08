/* Currency conversion via frankfurter.dev — free, no auth, ECB-backed.
   The old api.frankfurter.app domain now 301-redirects, which CORS
   refuses to follow, so we hit the new domain directly.
   Supports common currencies (USD, EUR, GBP, JPY, MXN, BRL, CNY, …).
   Result is cached in sessionStorage for 24h.
*/

const CACHE_KEY_PREFIX = 'gustrips:fx:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface RatesPayload {
  base: string;
  date: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

export async function getExchangeRates(base: string): Promise<RatesPayload | null> {
  if (typeof window === 'undefined') return null;
  const upper = base.toUpperCase();
  const cacheKey = CACHE_KEY_PREFIX + upper;

  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as RatesPayload;
      if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) return parsed;
    }
  } catch {
    // ignore parse failures
  }

  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(upper)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.rates || !data?.base) return null;
    const payload: RatesPayload = {
      base: data.base,
      date: data.date || '',
      rates: data.rates,
      fetchedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
    return payload;
  } catch {
    return null;
  }
}

/** Convert `amount` from `from` currency to `to` currency.
 *  If rates are missing or currency not supported, returns the amount unchanged. */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: RatesPayload | null,
): number {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;
  if (!rates) return amount;

  // Base of the rates payload acts as the pivot
  if (rates.base === t) {
    const rate = rates.rates[f];
    if (!rate) return amount;
    return amount / rate;
  }
  if (rates.base === f) {
    const rate = rates.rates[t];
    if (!rate) return amount;
    return amount * rate;
  }
  const fromRate = rates.rates[f];
  const toRate = rates.rates[t];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}
