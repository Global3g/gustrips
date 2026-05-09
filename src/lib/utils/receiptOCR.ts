import type { ExpenseCategory, PaymentMethod } from '@/types';

export interface ReceiptData {
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paymentMethod?: PaymentMethod;
}

/** Custom error so callers can show the real reason ("No pude leer la imagen",
 *  "Gemini 429", etc.) instead of a generic message. */
export class ReceiptOCRError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReceiptOCRError';
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new ReceiptOCRError('No pude leer la imagen del archivo.'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new ReceiptOCRError('No pude abrir el archivo.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Extract expense data from a receipt photo by calling the server-side
 * /api/scan-receipt route, which proxies to Gemini Vision using the
 * server-only API key. Throws ReceiptOCRError with a human message when
 * something goes wrong so the UI can surface it instead of silently
 * returning null.
 */
export async function extractReceiptData(file: File): Promise<ReceiptData | null> {
  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  let res: Response;
  try {
    res = await fetch('/api/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType }),
    });
  } catch (err) {
    throw new ReceiptOCRError(
      err instanceof Error ? `Sin conexión: ${err.message}` : 'Sin conexión.',
    );
  }

  let body: { ok?: boolean; data?: Record<string, unknown>; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    throw new ReceiptOCRError(`Respuesta inválida del servidor (${res.status}).`);
  }

  if (!res.ok || !body.ok || !body.data) {
    throw new ReceiptOCRError(body.error || `Error ${res.status} al analizar el ticket.`);
  }

  const parsed = body.data as {
    description?: string;
    amount?: number;
    currency?: string;
    category?: string;
    paymentMethod?: string;
  };

  if (!parsed.description || typeof parsed.amount !== 'number') {
    throw new ReceiptOCRError(
      'No pude detectar el monto en la imagen. Prueba con otra foto más clara.',
    );
  }

  const validCategories: ExpenseCategory[] = [
    'flight', 'hotel', 'car_rental', 'activity', 'restaurant',
    'transport', 'cruise', 'souvenirs', 'snacks', 'clothing',
    'fuel', 'misc',
  ];
  const category: ExpenseCategory = validCategories.includes(parsed.category as ExpenseCategory)
    ? (parsed.category as ExpenseCategory)
    : 'misc';

  const validCurrencies = ['MXN', 'USD', 'EUR', 'GBP', 'CAD'];
  const currency = validCurrencies.includes(parsed.currency ?? '')
    ? parsed.currency!
    : 'MXN';

  const validPaymentMethods: PaymentMethod[] = [
    'cash', 'debit', 'credit', 'transfer', 'points', 'other',
  ];
  const paymentMethod: PaymentMethod | undefined = validPaymentMethods.includes(
    parsed.paymentMethod as PaymentMethod,
  )
    ? (parsed.paymentMethod as PaymentMethod)
    : undefined;

  return {
    description: parsed.description,
    amount: parsed.amount,
    currency,
    category,
    paymentMethod,
  };
}
