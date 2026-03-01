// ===== Chart Manager =====
let priceChart = null;

function formatDate(isoStr, interval) {
  const d = new Date(isoStr);
  if (interval === '1d' || interval === '1wk' || interval === '1mo' || interval === '3mo') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function buildGradient(ctx, color) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(1, color + '00');
  return gradient;
}

function renderChart(historyData, interval, alertLines = []) {
  const canvas = document.getElementById('price-chart');
  const ctx = canvas.getContext('2d');

  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }

  if (!historyData || historyData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const labels = historyData.map(d => formatDate(d.timestamp, interval));
  const closes = historyData.map(d => d.close);

  const first = closes[0];
  const last = closes[closes.length - 1];
  const isPositive = last >= first;
  const lineColor = isPositive ? '#22c55e' : '#ef4444';

  const annotations = {};
  alertLines.forEach((a, i) => {
    let color = '#4f8ef7';
    if (a.alert_type === 'above') color = '#22c55e';
    else if (a.alert_type === 'below') color = '#ef4444';
    else color = '#eab308';

    annotations[`alert_${i}`] = {
      type: 'line',
      yMin: a.threshold,
      yMax: a.threshold,
      borderColor: color,
      borderWidth: 1.5,
      borderDash: [6, 3],
      label: {
        content: `${a.alert_type === 'pct_change' ? '±' : (a.alert_type === 'above' ? '▲' : '▼')} ${a.threshold}`,
        enabled: true,
        position: 'end',
        backgroundColor: color + '33',
        color: color,
        font: { size: 10, weight: 'bold' },
        padding: 3,
        borderRadius: 3,
      },
    };
  });

  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Price',
        data: closes,
        borderColor: lineColor,
        borderWidth: 2,
        pointRadius: historyData.length > 100 ? 0 : 2,
        pointHoverRadius: 4,
        fill: true,
        backgroundColor: (context) => buildGradient(context.chart.ctx, lineColor),
        tension: 0.1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` $${ctx.parsed.y.toFixed(4)}`,
          },
          backgroundColor: '#1a1d27',
          borderColor: '#2e3354',
          borderWidth: 1,
          titleColor: '#8892b0',
          bodyColor: '#e2e8f0',
        },
        annotation: { annotations },
      },
      scales: {
        x: {
          grid: { color: '#2e335420' },
          ticks: {
            color: '#8892b0',
            maxTicksLimit: 8,
            font: { size: 11 },
          },
        },
        y: {
          position: 'right',
          grid: { color: '#2e335430' },
          ticks: {
            color: '#8892b0',
            font: { size: 11 },
            callback: (v) => '$' + v.toFixed(2),
          },
        },
      },
    },
  });
}
