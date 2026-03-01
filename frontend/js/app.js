// ===== Stock Tracker App =====

// ---- State ----
let watchlist = [];          // [{symbol, name, price, change_pct, ...}]
let selectedSymbol = null;
let refreshTimer = null;
let searchTimer = null;
let currentPeriod = '5d';
let currentInterval = '15m';

// ---- Helpers ----
function fmt(val, decimals = 2) {
  if (val == null) return '—';
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtLarge(val) {
  if (val == null) return '—';
  if (val >= 1e12) return '$' + (val / 1e12).toFixed(2) + 'T';
  if (val >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return '$' + (val / 1e3).toFixed(2) + 'K';
  return '$' + val.toFixed(2);
}

function fmtVolume(val) {
  if (val == null) return '—';
  if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
  if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
  return String(val);
}

function colorClass(val) {
  if (val > 0) return 'positive';
  if (val < 0) return 'negative';
  return 'neutral';
}

function setLastUpdated() {
  const el = document.getElementById('last-updated');
  el.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

// ---- Watchlist rendering ----
function renderWatchlist() {
  const ul = document.getElementById('watchlist');
  const empty = document.getElementById('watchlist-empty');
  const loading = document.getElementById('watchlist-loading');

  loading.classList.add('hidden');
  ul.innerHTML = '';

  if (watchlist.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  watchlist.forEach(stock => {
    const li = document.createElement('li');
    li.className = 'watchlist-item' + (stock.symbol === selectedSymbol ? ' active' : '');
    li.dataset.symbol = stock.symbol;

    const chg = stock.change_pct;
    const chgClass = colorClass(chg);
    const chgStr = chg != null ? (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%' : '—';

    li.innerHTML = `
      <div class="wl-left">
        <div class="wl-symbol">${stock.symbol}</div>
        <div class="wl-name">${stock.name || ''}</div>
      </div>
      <div class="wl-right">
        <div class="wl-price">${stock.price != null ? '$' + fmt(stock.price) : '—'}</div>
        <div class="wl-change ${chgClass}">${chgStr}</div>
      </div>
      <button class="wl-remove" data-symbol="${stock.symbol}" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    li.querySelector('.wl-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeStock(stock.symbol);
    });

    li.addEventListener('click', () => selectSymbol(stock.symbol));
    ul.appendChild(li);
  });
}

// ---- Refresh price data ----
async function refreshPrices(showLoading = false) {
  if (showLoading) document.getElementById('watchlist-loading').classList.remove('hidden');

  try {
    const data = await api.listStocks();
    watchlist = data;
    renderWatchlist();
    setLastUpdated();

    // Update detail panel if one is selected
    if (selectedSymbol) {
      const stock = watchlist.find(s => s.symbol === selectedSymbol);
      if (stock) updateDetailHeader(stock);
    }

    // Check triggered alerts
    await refreshTriggeredAlerts();
  } catch (err) {
    console.error('Refresh error:', err);
  }
}

// ---- Select a symbol ----
async function selectSymbol(symbol) {
  selectedSymbol = symbol;

  document.getElementById('no-selection').classList.add('hidden');
  document.getElementById('detail-content').classList.remove('hidden');

  // Mark active in watchlist
  document.querySelectorAll('.watchlist-item').forEach(el => {
    el.classList.toggle('active', el.dataset.symbol === symbol);
  });

  // Find stock in watchlist
  const stock = watchlist.find(s => s.symbol === symbol);
  if (stock) updateDetailHeader(stock);

  document.getElementById('detail-symbol').textContent = symbol;
  document.getElementById('detail-name').textContent = stock?.name || '';

  // Load chart
  await loadChart(symbol, currentPeriod, currentInterval);

  // Load alerts
  await loadAlerts(symbol);
}

function updateDetailHeader(stock) {
  document.getElementById('detail-symbol').textContent = stock.symbol;
  document.getElementById('detail-name').textContent = stock.name || '';
  document.getElementById('detail-price').textContent = stock.price != null ? '$' + fmt(stock.price) : '—';

  const chgEl = document.getElementById('detail-change');
  if (stock.change != null) {
    const sign = stock.change >= 0 ? '+' : '';
    chgEl.textContent = `${sign}${fmt(stock.change)} (${sign}${stock.change_pct?.toFixed(2)}%)`;
    chgEl.className = 'price-change ' + colorClass(stock.change);
  } else {
    chgEl.textContent = '—';
    chgEl.className = 'price-change neutral';
  }

  document.getElementById('stat-high').textContent = stock.day_high != null ? '$' + fmt(stock.day_high) : '—';
  document.getElementById('stat-low').textContent = stock.day_low != null ? '$' + fmt(stock.day_low) : '—';
  document.getElementById('stat-volume').textContent = fmtVolume(stock.volume);
  document.getElementById('stat-mktcap').textContent = fmtLarge(stock.market_cap);
  document.getElementById('stat-52h').textContent = stock.week_52_high != null ? '$' + fmt(stock.week_52_high) : '—';
  document.getElementById('stat-52l').textContent = stock.week_52_low != null ? '$' + fmt(stock.week_52_low) : '—';
}

// ---- Chart ----
async function loadChart(symbol, period, interval) {
  try {
    const result = await api.getHistory(symbol, period, interval);
    const alerts = await api.listAlerts(symbol);
    const priceAlerts = alerts.filter(a => !a.triggered && a.alert_type !== 'pct_change');
    renderChart(result.data, interval, priceAlerts);
  } catch (err) {
    console.error('Chart error:', err);
  }
}

// Period buttons
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    currentInterval = btn.dataset.interval;
    if (selectedSymbol) await loadChart(selectedSymbol, currentPeriod, currentInterval);
  });
});

// ---- Add Stock ----
async function addStock(symbol) {
  const errEl = document.getElementById('add-error');
  errEl.classList.add('hidden');
  const btn = document.getElementById('btn-add');
  btn.disabled = true;
  btn.textContent = 'Adding…';

  try {
    await api.addStock(symbol);
    document.getElementById('symbol-input').value = '';
    hideSuggestions();
    await refreshPrices(true);
    // Auto-select the newly added stock
    selectSymbol(symbol.toUpperCase());
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add';
  }
}

document.getElementById('btn-add').addEventListener('click', () => {
  const val = document.getElementById('symbol-input').value.trim();
  if (val) addStock(val);
});

document.getElementById('symbol-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (val) addStock(val);
  }
});

// ---- Symbol Search / Suggestions ----
function hideSuggestions() {
  document.getElementById('search-suggestions').classList.add('hidden');
}

document.getElementById('symbol-input').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  clearTimeout(searchTimer);
  if (q.length < 2) { hideSuggestions(); return; }

  searchTimer = setTimeout(async () => {
    try {
      const results = await api.searchSymbols(q);
      const ul = document.getElementById('search-suggestions');
      ul.innerHTML = '';
      if (results.length === 0) { hideSuggestions(); return; }

      results.slice(0, 6).forEach(r => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="suggestion-symbol">${r.symbol}</span> <span class="suggestion-name">${r.name}</span>`;
        li.addEventListener('click', () => {
          document.getElementById('symbol-input').value = r.symbol;
          hideSuggestions();
          addStock(r.symbol);
        });
        ul.appendChild(li);
      });
      ul.classList.remove('hidden');
    } catch {}
  }, 300);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.add-stock-card')) hideSuggestions();
});

// ---- Remove Stock ----
async function removeStock(symbol) {
  try {
    await api.removeStock(symbol);
    if (selectedSymbol === symbol) {
      selectedSymbol = null;
      document.getElementById('no-selection').classList.remove('hidden');
      document.getElementById('detail-content').classList.add('hidden');
    }
    await refreshPrices();
  } catch (err) {
    alert('Error removing ' + symbol + ': ' + err.message);
  }
}

// ---- Alerts ----
async function loadAlerts(symbol) {
  const list = document.getElementById('alerts-list');
  const empty = document.getElementById('alerts-empty');
  list.innerHTML = '';

  try {
    const alerts = await api.listAlerts(symbol);
    if (alerts.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    alerts.forEach(a => {
      const li = document.createElement('li');
      li.className = 'alert-item';

      let badgeClass = 'badge-above';
      let label = 'Above';
      if (a.alert_type === 'below') { badgeClass = 'badge-below'; label = 'Below'; }
      else if (a.alert_type === 'pct_change') { badgeClass = 'badge-pct'; label = '% Change'; }

      const isTriggered = a.triggered;
      const triggerBadge = isTriggered
        ? `<span class="alert-type-badge badge-triggered">Triggered</span>`
        : `<span class="alert-type-badge ${badgeClass}">${label}</span>`;

      const threshold = a.alert_type === 'pct_change'
        ? `±${a.threshold}%`
        : `$${fmt(a.threshold)}`;

      li.innerHTML = `
        <div class="alert-info">
          ${triggerBadge}
          <span class="alert-threshold">${threshold}</span>
          ${a.message ? `<div class="alert-note">${a.message}</div>` : ''}
          ${isTriggered && a.triggered_at ? `<div class="alert-note">Fired: ${new Date(a.triggered_at).toLocaleString()}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          ${isTriggered ? `<button class="btn btn-sm btn-secondary reset-btn" data-id="${a.id}">Re-arm</button>` : ''}
          <button class="btn btn-sm btn-danger delete-alert-btn" data-id="${a.id}">Delete</button>
        </div>
      `;

      li.querySelector('.delete-alert-btn').addEventListener('click', async () => {
        await api.deleteAlert(a.id);
        loadAlerts(symbol);
        loadChart(symbol, currentPeriod, currentInterval);
      });

      const resetBtn = li.querySelector('.reset-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
          await api.resetAlert(a.id);
          loadAlerts(symbol);
        });
      }

      list.appendChild(li);
    });
  } catch (err) {
    console.error('Alerts load error:', err);
  }
}

document.getElementById('alert-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('alert-form-error');
  errEl.classList.add('hidden');

  if (!selectedSymbol) return;

  const alertType = document.getElementById('alert-type').value;
  const threshold = parseFloat(document.getElementById('alert-threshold').value);
  const message = document.getElementById('alert-message').value.trim();

  if (isNaN(threshold)) {
    errEl.textContent = 'Please enter a valid threshold number.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await api.createAlert({
      symbol: selectedSymbol,
      alert_type: alertType,
      threshold,
      message: message || null,
    });
    document.getElementById('alert-threshold').value = '';
    document.getElementById('alert-message').value = '';
    await loadAlerts(selectedSymbol);
    await loadChart(selectedSymbol, currentPeriod, currentInterval);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

// ---- Triggered Alerts Sidebar ----
async function refreshTriggeredAlerts() {
  try {
    const triggered = await api.listTriggered();
    const list = document.getElementById('triggered-alerts-list');
    const empty = document.getElementById('triggered-empty');
    const banner = document.getElementById('alert-banner');

    list.innerHTML = '';

    if (triggered.length === 0) {
      empty.classList.remove('hidden');
      banner.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');

    // Update banner
    const recent = triggered.filter(a => {
      if (!a.triggered_at) return false;
      return (Date.now() - new Date(a.triggered_at).getTime()) < 60_000;
    });

    if (recent.length > 0) {
      banner.innerHTML = '<strong>🔔 Alert:</strong> ' + recent.map(a => {
        const msg = a.message || `${a.symbol} ${a.alert_type} ${a.threshold}`;
        return `<span class="alert-banner-item">${msg}</span>`;
      }).join('');
      banner.classList.remove('hidden');
      setTimeout(() => banner.classList.add('hidden'), 15000);
    }

    triggered.slice(0, 10).forEach(a => {
      const li = document.createElement('li');
      li.className = 'triggered-item';
      const msg = a.message || `${a.alert_type} ${a.threshold}`;
      const time = a.triggered_at ? new Date(a.triggered_at).toLocaleTimeString() : '';
      li.innerHTML = `
        <div class="triggered-info">
          <div class="triggered-symbol">${a.symbol}</div>
          <div class="triggered-msg">${msg}</div>
          <div class="triggered-time">${time}</div>
        </div>
      `;
      list.appendChild(li);
    });
  } catch {}
}

// ---- Refresh button ----
document.getElementById('btn-refresh').addEventListener('click', async () => {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  await refreshPrices(true);
  if (selectedSymbol) {
    await loadChart(selectedSymbol, currentPeriod, currentInterval);
    await loadAlerts(selectedSymbol);
  }
  btn.disabled = false;
});

// ---- Clear triggered alerts button ----
document.getElementById('btn-clear-triggered').addEventListener('click', async () => {
  const banner = document.getElementById('alert-banner');
  banner.classList.add('hidden');
  document.getElementById('triggered-alerts-list').innerHTML = '';
  document.getElementById('triggered-empty').classList.remove('hidden');
});

// ---- Auto-refresh every 60 seconds ----
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    refreshPrices();
    if (selectedSymbol) {
      loadAlerts(selectedSymbol);
    }
  }, 60_000);
}

// ---- Init ----
(async function init() {
  await refreshPrices(true);
  startAutoRefresh();
})();
