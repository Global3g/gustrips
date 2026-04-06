import type React from 'react';

export const glassStyle = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.3)',
  borderTop: '1px solid rgba(255,255,255,0.45)',
  borderLeft: '1px solid rgba(255,255,255,0.35)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.15)',
} as React.CSSProperties;

export function classNames(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatCurrency(amount: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Timezone helpers ──────────────────────────────

/**
 * Obtiene la abreviatura de una zona horaria (CST, CET, MST, etc.)
 * usando Intl.DateTimeFormat del browser.
 */
export function getTimezoneAbbr(timezone: string, dateStr?: string): string {
  try {
    const date = dateStr ? new Date(dateStr) : new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value || timezone;
  } catch {
    return timezone;
  }
}

/**
 * Calcula la diferencia en horas entre dos zonas horarias.
 * Devuelve un string como "+7h", "-3h", "+0h".
 */
export function getTimezoneOffset(fromTz: string, toTz: string, dateStr?: string): string {
  try {
    const date = dateStr ? new Date(dateStr) : new Date();

    const getOffset = (tz: string) => {
      const str = date.toLocaleString('en-US', { timeZone: tz });
      const tzDate = new Date(str);
      return tzDate.getTime();
    };

    const diffMs = getOffset(toTz) - getOffset(fromTz);
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const sign = diffHours >= 0 ? '+' : '';
    return `${sign}${diffHours}h`;
  } catch {
    return '';
  }
}
