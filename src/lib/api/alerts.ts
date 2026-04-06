// ─── Tipos ─────────────────────────────────────────────

export interface Alert {
  id: string;
  userId: string;
  email: string;
  origin: string;
  destination: string;
  targetPrice: number;
  currency: string;
  active: boolean;
  createdAt: string;
  lastChecked?: string;
  lastNotified?: string;
}

export interface CreateAlertRequest {
  userId: string;
  email: string;
  origin: string;
  destination: string;
  targetPrice: number;
  currency?: string;
}

export interface PriceHistoryEntry {
  price: number;
  currency: string;
  timestamp: string;
}

export interface PriceHistory {
  date: string;
  prices: PriceHistoryEntry[];
}

export interface AlertHistoryResponse {
  origin: string;
  destination: string;
  targetPrice: number;
  currency: string;
  history: PriceHistory[];
  days: number;
}

// ─── Configuración ─────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_FLIGHT_API_URL || 'http://localhost:8000';

// ─── API Functions ─────────────────────────────────────

/**
 * Create a new price alert
 */
export async function createAlert(data: CreateAlertRequest): Promise<{ success: boolean; alertId: string; alert: Alert }> {
  const response = await fetch(`${API_BASE_URL}/api/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(error.detail || `Error ${response.status}`);
  }

  return response.json();
}

/**
 * List all alerts for a user
 */
export async function listAlerts(userId: string): Promise<{ alerts: Alert[]; count: number }> {
  const response = await fetch(`${API_BASE_URL}/api/alerts?userId=${encodeURIComponent(userId)}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(error.detail || `Error ${response.status}`);
  }

  return response.json();
}

/**
 * Delete an alert
 */
export async function deleteAlert(alertId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/alerts/${alertId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(error.detail || `Error ${response.status}`);
  }

  return response.json();
}

/**
 * Get price history for an alert
 */
export async function getAlertHistory(alertId: string, days: number = 30): Promise<AlertHistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/history?days=${days}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(error.detail || `Error ${response.status}`);
  }

  return response.json();
}
