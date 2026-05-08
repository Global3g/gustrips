'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getExchangeRates,
  convertAmount,
  type RatesPayload,
} from '@/lib/utils/exchangeRates';

export interface UseExchangeRatesReturn {
  rates: RatesPayload | null;
  loading: boolean;
  convert: (amount: number, from: string, to?: string) => number;
}

export function useExchangeRates(base: string): UseExchangeRatesReturn {
  const [rates, setRates] = useState<RatesPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getExchangeRates(base).then((r) => {
      if (cancelled) return;
      setRates(r);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const convert = useCallback(
    (amount: number, from: string, to?: string) =>
      convertAmount(amount, from, to ?? base, rates),
    [base, rates],
  );

  return { rates, loading, convert };
}
