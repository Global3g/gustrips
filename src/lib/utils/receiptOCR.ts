import type { ExpenseCategory, PaymentMethod } from '@/types';

export interface ReceiptData {
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paymentMethod?: PaymentMethod;
}

/**
 * Convert a File to base64 using FileReader (browser-compatible).
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to convert file to base64'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Extract expense data from a receipt photo using Gemini Vision API.
 * Returns null if extraction fails.
 */
export async function extractReceiptData(file: File): Promise<ReceiptData | null> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const base64 = await fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { thinkingConfig: { thinkingBudget: 1024 } },
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
                {
                  text: `Extract from this receipt/ticket: merchant name or description, total amount (number only), currency (MXN/USD/EUR/GBP/CAD), category (one of: flight, hotel, car_rental, activity, restaurant, transport, cruise, souvenirs, snacks, clothing, fuel, misc), and payment method (one of: cash, debit, credit, transfer, points, other — detect from "efectivo"/"contado"=cash, "tarjeta de débito"=debit, "tarjeta de crédito"/"TDC"/"visa"/"mastercard"=credit, "transferencia"/"SPEI"=transfer). Return JSON only: {"description", "amount", "currency", "category", "paymentMethod"}`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    // Gemini 2.5 returns thinking + text parts. Skip thinking.
    const parts = data.candidates?.[0]?.content?.parts || [];
    let text = '';
    for (const part of parts) {
      if (part.thought) continue;
      if (part.text) text += part.text;
    }
    if (!text) {
      for (const part of parts) {
        if (part.text) text += part.text;
      }
    }

    if (!text) return null;

    // Extract JSON from response
    let jsonStr = text.trim();
    if (jsonStr.includes('```')) {
      const match = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match) jsonStr = match[1].trim();
      else jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\s*$/g, '').trim();
    }
    if (!jsonStr.startsWith('{')) {
      const objMatch = jsonStr.match(/(\{[\s\S]*\})/);
      if (objMatch) jsonStr = objMatch[1];
    }

    const parsed = JSON.parse(jsonStr) as {
      description?: string;
      amount?: number;
      currency?: string;
      category?: string;
      paymentMethod?: string;
    };

    // Validate required fields
    if (!parsed.description || typeof parsed.amount !== 'number') return null;

    // Validate category
    const validCategories: ExpenseCategory[] = [
      'flight', 'hotel', 'car_rental', 'activity', 'restaurant',
      'transport', 'cruise', 'souvenirs', 'snacks', 'clothing',
      'fuel', 'misc', 'misc',
    ];
    const category: ExpenseCategory = validCategories.includes(parsed.category as ExpenseCategory)
      ? (parsed.category as ExpenseCategory)
      : 'misc';

    // Validate currency
    const validCurrencies = ['MXN', 'USD', 'EUR', 'GBP', 'CAD'];
    const currency = validCurrencies.includes(parsed.currency ?? '')
      ? parsed.currency!
      : 'MXN';

    // Validate payment method
    const validPaymentMethods: PaymentMethod[] = ['cash', 'debit', 'credit', 'transfer', 'points', 'other'];
    const paymentMethod: PaymentMethod | undefined = validPaymentMethods.includes(parsed.paymentMethod as PaymentMethod)
      ? (parsed.paymentMethod as PaymentMethod)
      : undefined;

    return {
      description: parsed.description,
      amount: parsed.amount,
      currency,
      category,
      paymentMethod,
    };
  } catch {
    return null;
  }
}
