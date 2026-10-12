import { getServerUrl } from './socket.js';

/**
 * Returns the base URL for the backend REST API
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    if (window.QRDINE_API_URL) return window.QRDINE_API_URL;
    try {
      const stored = localStorage.getItem('QRDINE_API_URL');
      if (stored) return stored;
    } catch (_) {}
  }
  return `${getServerUrl()}/api`;
}

/**
 * Fetch active menu from backend
 */
export async function fetchMenu() {
  const url = `${getApiBaseUrl()}/menu`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Server returned HTTP ${res.status}: ${errText || res.statusText}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`API Error [fetchMenu] (${url}):`, error);
    return { success: false, menu: [], error: error.message };
  }
}

/**
 * Create order and request server-generated QR code
 * @param {Array<{id: string, qty: number}>} items 
 */
export async function createOrder(items) {
  const url = `${getApiBaseUrl()}/order/create`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ items })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Failed to create order (HTTP ${res.status})`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [createOrder] (${url}):`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Simulate payment trigger
 * @param {string} orderId 
 */
export async function triggerPayment(orderId) {
  const url = `${getApiBaseUrl()}/order/pay`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ orderId })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Payment processing failed (HTTP ${res.status})`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [triggerPayment] (${url}):`, error);
    return { success: false, error: error.message };
  }
}