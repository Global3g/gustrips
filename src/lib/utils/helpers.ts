import type React from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export const glassStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

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
  // Cryptographically secure fallback for environments without randomUUID.
  // Builds a v4-shape UUID from getRandomValues. Math.random is not secure
  // enough for shareToken / id collision resistance — we'd rather throw.
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant
    const hex = Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('No secure RNG available (crypto.randomUUID / getRandomValues missing)');
}

export function formatCurrency(amount: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// --- Date formatting helpers ---

/**
 * Formats a date string as "dd-MMMM-yyyy" in Spanish (e.g., "06-mayo-2026").
 */
export function formatDateES(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return format(d, 'dd-MMMM-yyyy', { locale: es });
  } catch {
    return dateStr;
  }
}

/**
 * Formats a date string as "dd-MMM" in Spanish for compact display (e.g., "06-may").
 */
export function formatDateShortES(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return format(d, 'dd-MMM', { locale: es });
  } catch {
    return dateStr;
  }
}

/**
 * Formats a date string as "EEEE dd-MMMM" in Spanish for day headers (e.g., "Martes 06-mayo").
 * Returns capitalized string.
 */
export function formatDateHeaderES(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const full = format(d, "EEEE dd-MMMM", { locale: es });
    return full.charAt(0).toUpperCase() + full.slice(1);
  } catch {
    return dateStr;
  }
}

// --- Timezone helpers ---

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
