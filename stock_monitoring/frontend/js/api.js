// ===== API Client =====
const API_BASE = '';  // same origin

async function apiRequest(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

const api = {
  // Stocks
  listStocks: () => apiRequest('GET', '/api/stocks'),
  addStock: (symbol) => apiRequest('POST', '/api/stocks', { symbol }),
  removeStock: (symbol) => apiRequest('DELETE', `/api/stocks/${symbol}`),
  getStockPrice: (symbol) => apiRequest('GET', `/api/stocks/${symbol}/price`),
  getHistory: (symbol, period, interval) =>
    apiRequest('GET', `/api/stocks/${symbol}/history?period=${period}&interval=${interval}`),
  searchSymbols: (q) => apiRequest('GET', `/api/stocks/search?q=${encodeURIComponent(q)}`),

  // Alerts
  listAlerts: (symbol) =>
    apiRequest('GET', `/api/alerts${symbol ? `?symbol=${symbol}` : ''}`),
  listTriggered: () => apiRequest('GET', '/api/alerts?triggered_only=true'),
  createAlert: (payload) => apiRequest('POST', '/api/alerts', payload),
  deleteAlert: (id) => apiRequest('DELETE', `/api/alerts/${id}`),
  resetAlert: (id) => apiRequest('PATCH', `/api/alerts/${id}/reset`),
};
