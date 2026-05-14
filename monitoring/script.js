'use strict';

const $ = (sel) => document.querySelector(sel);

const NUM = new Intl.NumberFormat('ko-KR');
const USD = (n) => `$${(n || 0).toFixed(2)}`;
const fmtNum = (n) => NUM.format(n || 0);

function fmtKMB(n, opts) {
  if (n == null || (typeof n === 'number' && isNaN(n))) return '—';
  const { precision = 1, hideZeroDecimal = true } = opts || {};
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  let value, suffix;
  if (abs >= 1_000_000_000) {
    value = abs / 1_000_000_000;
    suffix = 'B';
  } else if (abs >= 1_000_000) {
    value = abs / 1_000_000;
    suffix = 'M';
  } else if (abs >= 1_000) {
    value = abs / 1_000;
    suffix = 'K';
  } else {
    return sign + String(abs);
  }
  const fixed = value.toFixed(precision);
  const display = (hideZeroDecimal && fixed.endsWith('.' + '0'.repeat(precision)))
    ? String(Math.round(value))
    : fixed;
  return sign + display + suffix;
}

const COLORS = {
  noncache: '#3b82f6',
  input: '#3b82f6',
  output: '#60a5fa',
  cache: '#9b59b6',
  cacheWrite: '#a855f7',
  cacheRead: '#c084fc',
  positive: '#10b981',
  muted: '#8b93a7',
};

const PALETTE = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#22d3ee', '#f97316', '#8b93a7', '#7c3aed', '#facc15'];

if (typeof Chart !== 'undefined') {
  Chart.defaults.color = '#e6e9f2';
  Chart.defaults.borderColor = 'rgba(139, 147, 167, 0.18)';
  Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif';
  if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(11, 13, 18, 0.92)';
    Chart.defaults.plugins.tooltip.borderColor = '#2a3144';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = '#e6e9f2';
    Chart.defaults.plugins.tooltip.bodyColor = '#e6e9f2';
  }
}

const charts = {};

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

function shortSha(s) { return (s || '').slice(0, 8); }
function shortTime(s) { return (s || '').replace('T', ' ').replace(/\..+/, ''); }
// HTML-escape user-supplied strings before inserting into innerHTML
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function table(headers, rows) {
  const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

// ---------- Period comparison helpers ----------

function isoWeekToDate(year, week) {
  // Returns the Monday of ISO week `week` in `year`.
  const jan4 = new Date(Date.UTC(year, 0, 4)); // Jan 4 is always in W1
  const w1Monday = new Date(jan4);
  w1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const result = new Date(w1Monday);
  result.setUTCDate(result.getUTCDate() + (week - 1) * 7);
  return result;
}

function dateToIsoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dayOfWeek + 3); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const yearStartMonday = new Date(yearStart);
  yearStartMonday.setUTCDate(yearStart.getUTCDate() - ((yearStart.getUTCDay() + 6) % 7));
  const week = Math.round((d - yearStartMonday) / (7 * 86400000)) + 1;
  return { year: d.getUTCFullYear(), week };
}

function formatWeekLabel(weekKey) {
  const m = weekKey.match(/^(\d{4})-W(\d+)$/);
  if (!m) return weekKey;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  const monday = isoWeekToDate(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const mm1 = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const dd1 = String(monday.getUTCDate()).padStart(2, '0');
  const mm2 = String(sunday.getUTCMonth() + 1).padStart(2, '0');
  const dd2 = String(sunday.getUTCDate()).padStart(2, '0');
  return `${mm1}/${dd1} ~ ${mm2}/${dd2} (월~일)`;
}

function prevPeriodKey(unit, key) {
  if (unit === 'weekly') {
    // key: "YYYY-WWW"
    const m = key.match(/^(\d{4})-W(\d+)$/);
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const week = parseInt(m[2], 10);
    const monday = isoWeekToDate(year, week);
    monday.setUTCDate(monday.getUTCDate() - 7);
    const { year: py, week: pw } = dateToIsoWeek(monday);
    return `${py}-W${String(pw).padStart(2, '0')}`;
  }
  if (unit === 'monthly') {
    // key: "YYYY-MM"
    const m = key.match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    let year = parseInt(m[1], 10);
    let month = parseInt(m[2], 10);
    month -= 1;
    if (month < 1) { month = 12; year -= 1; }
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  if (unit === 'quarterly') {
    // key: "YYYY-QN"
    const m = key.match(/^(\d{4})-Q(\d)$/);
    if (!m) return null;
    let year = parseInt(m[1], 10);
    let q = parseInt(m[2], 10);
    q -= 1;
    if (q < 1) { q = 4; year -= 1; }
    return `${year}-Q${q}`;
  }
  if (unit === 'half') {
    // key: "YYYY-HN"
    const m = key.match(/^(\d{4})-H(\d)$/);
    if (!m) return null;
    let year = parseInt(m[1], 10);
    let h = parseInt(m[2], 10);
    h -= 1;
    if (h < 1) { h = 2; year -= 1; }
    return `${year}-H${h}`;
  }
  if (unit === 'yearly') {
    // key: "YYYY"
    const y = parseInt(key, 10);
    if (isNaN(y)) return null;
    return String(y - 1);
  }
  return null;
}

// ---------- KPI ----------

function renderKpi(data) {
  const t = data.total || {};
  const messages = t.messages || 0;
  const input = t.input || 0;
  const output = t.output || 0;
  const cwrite = (t.cache_creation_5m || 0) + (t.cache_creation_1h || 0);
  const cread = t.cache_read || 0;
  const noncache = input + output;
  const cache = cwrite + cread;

  $('#kpi-messages-val').textContent = fmtNum(messages);
  $('#kpi-sessions').textContent = fmtNum(data.files_processed || 0);

  const byDay = data.by_day || [];
  const bySession = data.by_session || [];
  $('#kpi-msgs-avg-day').textContent = byDay.length > 0 ? (messages / byDay.length).toFixed(1) : '—';
  $('#kpi-msgs-avg-session').textContent = bySession.length > 0 ? (messages / bySession.length).toFixed(1) : '—';
  // 마지막 일 단위 집계로 근사
  const last24hMsgs = byDay.length > 0 ? (byDay[byDay.length - 1].messages || 0) : 0;
  $('#kpi-msgs-24h').textContent = fmtNum(last24hMsgs);
  $('#kpi-msgs-24h-pct').textContent = messages > 0 ? ((last24hMsgs / messages) * 100).toFixed(1) + '%' : '—';

  $('#kpi-noncache').textContent = fmtKMB(noncache);
  $('#kpi-cache').textContent = fmtKMB(cache);
  $('#kpi-input').textContent = fmtKMB(input);
  $('#kpi-output').textContent = fmtKMB(output);
  $('#kpi-cwrite').textContent = fmtKMB(cwrite);
  $('#kpi-cread').textContent = fmtKMB(cread);

  const totalInputSide = input + cwrite + cread;
  const cacheRatio = totalInputSide > 0 ? cread / totalInputSide : 0;
  $('#kpi-cache-eff-val').textContent = `${(cacheRatio * 100).toFixed(1)}%`;
  const gaugeFg = document.querySelector('#kpi-cache-eff .gauge-fg');
  if (gaugeFg) {
    gaugeFg.style.strokeDashoffset = `${100 - cacheRatio * 100}`;
  }

  const bd = (t.cost_breakdown) || {};
  const hypothetical = bd.hypothetical_no_cache || 0;
  const cacheSaved = Math.max(0, hypothetical - (t.cost_usd || 0));
  const cacheHitRatio = (cwrite + cread) > 0 ? cread / (cwrite + cread) : 0;

  $('#kpi-cache-read-abs').textContent = fmtKMB(cread);
  $('#kpi-cache-hit-ratio').textContent = `${(cacheHitRatio * 100).toFixed(1)}%`;
  $('#kpi-cache-saved-usd').textContent = USD(cacheSaved);
  $('#kpi-cache-no-cache-cost').textContent = USD(hypothetical);

  $('#kpi-cost-val').textContent = USD(t.cost_usd);

  // 카드 4 보조 정보
  const byDayCosts = byDay.map(d => d.cost_usd || 0);
  const dailyAvg = byDayCosts.length > 0
    ? byDayCosts.reduce((a, v) => a + v, 0) / byDayCosts.length
    : null;
  $('#kpi-cost-daily-avg').textContent = dailyAvg != null ? USD(dailyAvg) : '—';

  const hypotheticalTotal = bd.hypothetical_no_cache || 0;
  const costSaved = Math.max(0, hypotheticalTotal - (t.cost_usd || 0));
  $('#kpi-cost-saved').textContent = USD(costSaved);

  $('#kpi-cost-input').textContent = USD(bd.input || 0);
  $('#kpi-cost-output').textContent = USD(bd.output || 0);
  const cacheCost = (bd.cache_write || 0) + (bd.cache_read || 0);
  $('#kpi-cost-cache').textContent = USD(cacheCost);

  const topModels = (data.by_model || [])
    .slice()
    .sort((a, b) => (b.cost_usd || 0) - (a.cost_usd || 0))
    .slice(0, 3);
  const topModelsEl = $('#kpi-cost-top-models');
  if (topModelsEl) {
    topModelsEl.innerHTML = topModels.map(m =>
      `<div class="cost-model-row"><span class="lbl">${escapeHtml(m.model)}</span><span class="val">${USD(m.cost_usd || 0)}</span></div>`
    ).join('');
  }
}

// ---------- Delta badge clear ----------

function clearDeltaBadges() {
  const ids = ['kpi-delta-msgs', 'kpi-delta-noncache', 'kpi-delta-cache', 'kpi-delta-cache-hit-ratio', 'kpi-delta-cost'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.textContent = '';
    el.className = 'kpi-delta';
  }
}

// ---------- Delta badges ----------

function computeKpiSnapshot(data) {
  const t = data.total || {};
  const cwrite = (t.cache_creation_5m || 0) + (t.cache_creation_1h || 0);
  const cread = t.cache_read || 0;
  const cacheHitRatio = (cwrite + cread) > 0 ? (cread / (cwrite + cread)) * 100 : 0;
  return {
    messages: t.messages || 0,
    noncache: (t.input || 0) + (t.output || 0),
    cache: cwrite + cread,
    cache_hit_ratio: cacheHitRatio,
    cost_usd: t.cost_usd || 0,
  };
}

function applyDeltaBadgesFromValues(prev, current) {
  const setBadge = (id, delta, fmt) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    el.className = 'kpi-delta';
    if (delta > 0) {
      el.textContent = `▲ +${fmt(delta)}`;
      el.classList.add('up');
    } else if (delta < 0) {
      el.textContent = `▼ -${fmt(Math.abs(delta))}`;
      el.classList.add('down');
    }
  };

  setBadge('kpi-delta-msgs', current.messages - (prev.messages || 0), (v) => fmtKMB(v));
  setBadge('kpi-delta-noncache', current.noncache - (prev.noncache || 0), (v) => fmtKMB(v));
  setBadge('kpi-delta-cache', current.cache - (prev.cache || 0), (v) => fmtKMB(v));
  setBadge('kpi-delta-cache-hit-ratio', current.cache_hit_ratio - (prev.cache_hit_ratio || 0), (v) => `${v.toFixed(1)}%p`);
  setBadge('kpi-delta-cost', current.cost_usd - (prev.cost_usd || 0), (v) => `$${v.toFixed(2)}`);
}

function applyDeltaBadges(data) {
  clearDeltaBadges();
  const SNAPSHOT_KEY = 'monitoring:last-snapshot';
  const current = computeKpiSnapshot(data);

  const raw = localStorage.getItem(SNAPSHOT_KEY);
  if (raw) {
    try {
      const snap = JSON.parse(raw);
      if (snap.saved_at !== data.generated_at) {
        applyDeltaBadgesFromValues(snap.values || {}, current);
      }
    } catch (_) {
      // 손상된 snapshot 무시
    }
  }

  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      saved_at: data.generated_at,
      values: current,
    }));
  } catch (_) {
    // localStorage 쓰기 실패 무시
  }
}

// ---------- Plugin ----------

const pieLabelsPlugin = {
  id: 'pieLabels',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    const ds = chart.getDatasetMeta(0);
    if (!ds || !ds.data) return;
    const total = data.datasets[0].data.reduce((a, b) => a + (b || 0), 0);
    if (total <= 0) return;
    ds.data.forEach((arc, i) => {
      const value = data.datasets[0].data[i] || 0;
      const pct = (value / total) * 100;
      if (pct < 10) return;
      const { x, y } = arc.tooltipPosition();
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3;
      ctx.fillText(pct.toFixed(0) + '%', x, y - 7);
      ctx.fillText(fmtKMB(value), x, y + 7);
      ctx.restore();
    });
  },
};

// ---------- Charts ----------

function renderChartDayTokens(data, opts) {
  const chartKey = (opts && opts.chartKey) || 'dayTokens';
  const canvasSel = (opts && opts.canvasSel) || '#chart-day-tokens canvas';
  const compareData = (opts && opts.compareData) || null;
  destroyChart(chartKey);
  const days = (data.by_day || []);
  const labels = days.map(d => d.day);
  const ctx = $(canvasSel);
  if (!ctx || !days.length) return;

  const datasets = [
    { label: 'input', data: days.map(d => d.input || 0), borderColor: COLORS.input, backgroundColor: COLORS.input + '66', stack: 's', fill: 'origin' },
    { label: 'output', data: days.map(d => d.output || 0), borderColor: COLORS.output, backgroundColor: COLORS.output + '66', stack: 's', fill: '-1' },
  ];

  if (compareData) {
    const cdays = (compareData.by_day || []);
    datasets.push(
      { label: 'input (비교)', data: cdays.map(d => d.input || 0), borderColor: COLORS.input, backgroundColor: COLORS.input + '99', borderDash: [5, 5], stack: 'c', fill: 'origin' },
      { label: 'output (비교)', data: cdays.map(d => d.output || 0), borderColor: COLORS.output, backgroundColor: COLORS.output + '99', borderDash: [5, 5], stack: 'c', fill: '-1' },
    );
  }

  charts[chartKey] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, ticks: { callback: (v) => fmtKMB(v) } },
      },
      plugins: {
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtKMB(c.parsed.y)}` } },
        legend: { position: 'bottom' },
      },
    },
  });
}

function totalTokens(r) {
  return (r.input || 0) + (r.output || 0) + (r.cache_creation_5m || 0) + (r.cache_creation_1h || 0) + (r.cache_read || 0);
}

function renderChartModelDonut(data, opts) {
  const chartKey = (opts && opts.chartKey) || 'modelDonut';
  const canvasSel = (opts && opts.canvasSel) || '#chart-model-donut canvas';
  destroyChart(chartKey);
  const rows = (data.by_model || []).slice();
  const ctx = $(canvasSel);
  if (!ctx || !rows.length) return;
  const labels = rows.map(r => r.model);
  const values = rows.map(r => totalTokens(r));
  const prevRows = (opts && opts.prevRows) || null;
  const totalVal = values.reduce((a, v) => a + v, 0);
  let prevMap = null;
  let prevTotal = 0;
  if (prevRows) {
    prevMap = {};
    for (const r of prevRows) prevMap[r.model] = totalTokens(r);
    prevTotal = Object.values(prevMap).reduce((a, v) => a + v, 0);
  }
  const bgs = labels.map((_, i) => PALETTE[i % PALETTE.length]);
  charts[chartKey] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: bgs }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          align: 'center',
          labels: {
            color: '#e6e9f2',
            boxWidth: 12,
            boxHeight: 12,
            generateLabels: (chart) => {
              const ds = chart.data.datasets[0] || {};
              const bgColors = ds.backgroundColor || [];
              return (chart.data.labels || []).map((label, i) => {
                let text = label;
                if (prevMap && prevTotal > 0 && totalVal > 0) {
                  const cs = values[i] / totalVal * 100;
                  const ps = (prevMap[label] || 0) / prevTotal * 100;
                  const delta = cs - ps;
                  const sign = delta >= 0 ? '▲' : '▼';
                  const absDelta = values[i] - (prevMap[label] || 0);
                  text = `${label}  ${sign}${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%p (${absDelta >= 0 ? '+' : ''}${fmtKMB(absDelta)})`;
                }
                return {
                  text,
                  fillStyle: bgColors[i],
                  strokeStyle: bgColors[i],
                  fontColor: '#e6e9f2',
                  lineWidth: 0,
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                };
              });
            },
          },
        },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtNum(c.parsed)}` } },
      },
    },
    plugins: [pieLabelsPlugin],
  });
}

function renderChartSkillDonut(data, opts) {
  const chartKey = (opts && opts.chartKey) || 'skillDonut';
  const canvasSel = (opts && opts.canvasSel) || '#chart-skill-donut canvas';
  destroyChart(chartKey);
  const rows = (data.by_skill || []).slice().sort((a, b) => totalTokens(b) - totalTokens(a));
  const ctx = $(canvasSel);
  if (!ctx || !rows.length) return;
  const top = rows.slice(0, 8);
  const others = rows.slice(8);
  const labels = top.map(r => r.skill);
  const values = top.map(r => totalTokens(r));
  if (others.length) {
    labels.push('기타');
    values.push(others.reduce((a, r) => a + totalTokens(r), 0));
  }
  const prevRowsRaw = (opts && opts.prevRows) || null;
  const totalVal = values.reduce((a, v) => a + v, 0);
  let prevMap = null;
  let prevTotal = 0;
  if (prevRowsRaw) {
    prevMap = {};
    for (const r of prevRowsRaw) prevMap[r.skill] = totalTokens(r);
    prevTotal = Object.values(prevMap).reduce((a, v) => a + v, 0);
  }
  const bgs = labels.map((_, i) => PALETTE[i % PALETTE.length]);
  charts[chartKey] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: bgs }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          align: 'center',
          labels: {
            color: '#e6e9f2',
            boxWidth: 12,
            boxHeight: 12,
            generateLabels: (chart) => {
              const ds = chart.data.datasets[0] || {};
              const bgColors = ds.backgroundColor || [];
              return (chart.data.labels || []).map((label, i) => {
                let text = label;
                if (prevMap && prevTotal > 0 && totalVal > 0) {
                  const cs = values[i] / totalVal * 100;
                  const ps = (prevMap[label] || 0) / prevTotal * 100;
                  const delta = cs - ps;
                  const sign = delta >= 0 ? '▲' : '▼';
                  const absDelta = values[i] - (prevMap[label] || 0);
                  text = `${label}  ${sign}${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%p (${absDelta >= 0 ? '+' : ''}${fmtKMB(absDelta)})`;
                }
                return {
                  text,
                  fillStyle: bgColors[i],
                  strokeStyle: bgColors[i],
                  fontColor: '#e6e9f2',
                  lineWidth: 0,
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                };
              });
            },
          },
        },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtNum(c.parsed)}` } },
      },
    },
    plugins: [pieLabelsPlugin],
  });
}

function renderChartCacheDonut(data, opts) {
  destroyChart('cacheDonut');
  const t = data.total || {};
  const noncache = (t.input || 0) + (t.output || 0);
  const cwrite = (t.cache_creation_5m || 0) + (t.cache_creation_1h || 0);
  const cread = t.cache_read || 0;
  const ctx = $('#chart-cache-donut canvas');
  if (!ctx) return;
  const values = [noncache, cwrite, cread];
  const cacheLabels = ['non-cache (input+output)', 'cache write', 'cache read'];
  const prevRows = (opts && opts.prevRows) || null;
  const totalVal = values.reduce((a, v) => a + v, 0);
  let prevVals = null;
  let prevTotal = 0;
  if (prevRows) {
    prevVals = prevRows.map(r => r.val || 0);
    prevTotal = prevVals.reduce((a, v) => a + v, 0);
  }
  const bgs = [COLORS.noncache, COLORS.cacheWrite, COLORS.cacheRead];
  charts.cacheDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cacheLabels,
      datasets: [{ data: values, backgroundColor: bgs }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          align: 'center',
          labels: {
            color: '#e6e9f2',
            boxWidth: 12,
            boxHeight: 12,
            generateLabels: (chart) => {
              const ds = chart.data.datasets[0] || {};
              const bgColors = ds.backgroundColor || [];
              return (chart.data.labels || []).map((label, i) => {
                let text = label;
                if (prevVals && prevTotal > 0 && totalVal > 0) {
                  const cs = values[i] / totalVal * 100;
                  const ps = prevVals[i] / prevTotal * 100;
                  const delta = cs - ps;
                  const sign = delta >= 0 ? '▲' : '▼';
                  const absDelta = values[i] - prevVals[i];
                  text = `${label}  ${sign}${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%p (${absDelta >= 0 ? '+' : ''}${fmtKMB(absDelta)})`;
                }
                return {
                  text,
                  fillStyle: bgColors[i],
                  strokeStyle: bgColors[i],
                  fontColor: '#e6e9f2',
                  lineWidth: 0,
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                };
              });
            },
          },
        },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtNum(c.parsed)}` } },
      },
    },
    plugins: [pieLabelsPlugin],
  });
}

function clearPieCompareLists() {
  for (const id of ['compare-model-list', 'compare-skill-list', 'compare-cache-list']) {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = ''; el.hidden = true; }
  }
}

function renderPieCompareList(listId, currRows, prevRows, labelKey, valueKey) {
  const el = document.getElementById(listId);
  if (!el) return;

  const currTotal = currRows.reduce((a, r) => a + (r[valueKey] || 0), 0);
  const prevTotal = prevRows.reduce((a, r) => a + (r[valueKey] || 0), 0);
  if (currTotal <= 0 || prevTotal <= 0) { el.hidden = true; return; }

  const currMap = {};
  for (const r of currRows) currMap[r[labelKey]] = (r[valueKey] || 0);
  const prevMap = {};
  for (const r of prevRows) prevMap[r[labelKey]] = (r[valueKey] || 0);

  const labels = Array.from(new Set([...Object.keys(currMap), ...Object.keys(prevMap)]));
  const deltas = labels.map(lbl => {
    const cs = (currMap[lbl] || 0) / currTotal * 100;
    const ps = (prevMap[lbl] || 0) / prevTotal * 100;
    const absDelta = (currMap[lbl] || 0) - (prevMap[lbl] || 0);
    return { lbl, pctDelta: cs - ps, absDelta };
  });

  const filtered = deltas
    .filter(d => Math.abs(d.pctDelta) >= 1)
    .sort((a, b) => Math.abs(b.pctDelta) - Math.abs(a.pctDelta))
    .slice(0, 5);

  if (!filtered.length) { el.hidden = true; return; }

  el.innerHTML = filtered.map(d => {
    const sign = d.pctDelta >= 0 ? '▲' : '▼';
    const cls = d.pctDelta >= 0 ? 'cmp-up' : 'cmp-down';
    const pctStr = `${sign} ${d.pctDelta >= 0 ? '+' : ''}${d.pctDelta.toFixed(1)}%p`;
    const absStr = `(${d.absDelta >= 0 ? '+' : ''}${fmtKMB(d.absDelta)})`;
    return `<div><span class="${cls}">${escapeHtml(d.lbl)}: ${pctStr} ${absStr}</span></div>`;
  }).join('');
  el.hidden = false;
}

function renderChartSessionBar(data, opts) {
  const chartKey = (opts && opts.chartKey) || 'sessionBar';
  const canvasSel = (opts && opts.canvasSel) || '#chart-session-bar canvas';
  destroyChart(chartKey);
  const rows = (data.by_session || [])
    .filter(s => (s.tokens && s.tokens.messages) > 0)
    .slice()
    .sort((a, b) => totalTokens(b.tokens) - totalTokens(a.tokens))
    .slice(0, 10);
  const ctx = $(canvasSel);
  if (!ctx || !rows.length) return;
  charts[chartKey] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => shortSha(r.session_id)),
      datasets: [{
        label: '총 토큰',
        data: rows.map(r => totalTokens(r.tokens)),
        backgroundColor: rows.map((_, i) => PALETTE[i % PALETTE.length]),
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { ticks: { callback: (v) => fmtKMB(v) } } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => `${fmtKMB(c.parsed.x)} 토큰`,
            afterLabel: (c) => {
              const r = rows[c.dataIndex];
              const skills = (r.skills || []).filter(s => s !== '(no-skill)');
              const lines = [
                `시작: ${shortTime(r.first_timestamp)}`,
                `종료: ${shortTime(r.last_timestamp)}`,
                `메시지: ${fmtNum(r.tokens.messages)}`,
                `주 모델: ${r.model_primary || '?'}`,
              ];
              if (skills.length) lines.push(`스킬: ${skills.join(', ')}`);
              return lines;
            },
          },
        },
      },
    },
  });
}

function renderChartPromptBar(data) {
  destroyChart('promptBar');
  const items = (data.by_prompt || []).slice(0, 30);
  const ctx = $('#chart-prompt-bar canvas');
  if (!ctx || !items.length) return;
  charts.promptBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: items.map(p => p.prompt_preview || ''),
      datasets: [{
        label: '총 토큰',
        data: items.map(p => (p.input_tokens || 0) + (p.output_tokens || 0) + (p.cache_read || 0) + (p.cache_write || 0)),
        backgroundColor: '#6366f1',
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { ticks: { callback: (v) => fmtKMB(v) } } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const p = (data.by_prompt || [])[items[0].dataIndex];
              return p ? p.prompt_preview : '';
            },
            label: (c) => {
              const p = (data.by_prompt || [])[c.dataIndex];
              if (!p) return fmtKMB(c.parsed.x);
              return [
                `총 토큰: ${fmtKMB(c.parsed.x)}`,
                `input: ${fmtKMB(p.input_tokens)}`,
                `output: ${fmtKMB(p.output_tokens)}`,
                `cache read: ${fmtKMB(p.cache_read)}`,
                `cache write: ${fmtKMB(p.cache_write)}`,
                `비용: $${(p.cost_usd || 0).toFixed(4)}`,
                `세션: ${(p.session_id || '').slice(0, 8)}`,
                `시각: ${shortTime(p.timestamp)}`,
              ];
            },
          },
        },
      },
    },
  });
}

function renderChartDayCost(data) {
  destroyChart('dayCost');
  const days = (data.by_day || []);
  const ctx = $('#chart-day-cost canvas');
  if (!ctx || !days.length) return;
  charts.dayCost = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days.map(d => d.day),
      datasets: [{
        label: '추정 비용 (USD)',
        data: days.map(d => d.cost_usd || 0),
        backgroundColor: COLORS.positive,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { ticks: { callback: (v) => USD(v) } } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => USD(c.parsed.y) } },
      },
    },
  });
}

// ---------- Tables ----------

function renderByModel(rows) {
  return table(
    ['모델', 'messages', 'input', 'output', 'cache write 5m', 'cache write 1h', 'cache read', '비용'],
    rows.map(r => [
      escapeHtml(r.model), fmtNum(r.messages), fmtNum(r.input), fmtNum(r.output),
      fmtNum(r.cache_creation_5m), fmtNum(r.cache_creation_1h), fmtNum(r.cache_read),
      USD(r.cost_usd || 0),
    ]),
  );
}

function renderBySkill(rows) {
  return table(
    ['스킬', 'messages', 'input', 'output', 'cache write 5m', 'cache write 1h', 'cache read'],
    rows.map(r => [
      escapeHtml(r.skill), fmtNum(r.messages), fmtNum(r.input), fmtNum(r.output),
      fmtNum(r.cache_creation_5m), fmtNum(r.cache_creation_1h), fmtNum(r.cache_read),
    ]),
  );
}

function renderByDay(rows) {
  return table(
    ['일자', 'messages', 'input', 'output', 'cache write 5m', 'cache write 1h', 'cache read', '비용'],
    rows.map(r => [
      escapeHtml(r.day), fmtNum(r.messages), fmtNum(r.input), fmtNum(r.output),
      fmtNum(r.cache_creation_5m), fmtNum(r.cache_creation_1h), fmtNum(r.cache_read),
      USD(r.cost_usd || 0),
    ]),
  );
}

function renderBySession(rows) {
  const live = rows.filter(s => (s.tokens && s.tokens.messages) > 0);
  return table(
    ['session', '시작', '종료', '주 모델', '메시지', 'skills'],
    live.slice(0, 50).map(r => [
      shortSha(r.session_id),
      shortTime(r.first_timestamp),
      shortTime(r.last_timestamp),
      escapeHtml(r.model_primary || '?'),
      fmtNum(r.tokens.messages),
      (() => { const live = (r.skills || []).filter(s => s !== '(no-skill)'); return live.length ? escapeHtml(live.join(', ')) : '<i>(no-skill)</i>'; })(),
    ]),
  );
}

// ---------- Orchestration ----------

let _aggregateCache = null;
let _hourlyCache = null;
let _autoRefreshInFlight = false;

async function loadAggregate() {
  if (_aggregateCache) return _aggregateCache;
  const r = await fetch('data/aggregate.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(`failed to load aggregate.json: ${r.status}`);
  _aggregateCache = await r.json();
  return _aggregateCache;
}

async function loadHourlyData() {
  if (_hourlyCache) return _hourlyCache;
  const r = await fetch('data/hourly.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(`hourly.json 로딩 실패 (${r.status}) — collect.py 실행 필요`);
  _hourlyCache = await r.json();
  return _hourlyCache;
}

function currentWeekMondayMs() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sunday
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
  return monday.getTime();
}

function computeRealtimeWindows(now, hoursBack) {
  const weekStart = currentWeekMondayMs();
  if (!hoursBack) {
    return { baseStart: weekStart, baseEnd: now, compareStart: null, compareEnd: null };
  }
  const windowMs = hoursBack * 3600 * 1000;
  const compareEnd = Math.max(weekStart, now - windowMs);
  return {
    baseStart: weekStart,
    baseEnd: now,
    compareStart: weekStart,
    compareEnd,
  };
}

function aggregateHoursInWindow(hours, startMs, endMs) {
  const total = {
    input: 0, output: 0, cache_creation_5m: 0, cache_creation_1h: 0,
    cache_read: 0, messages: 0, cost_usd: 0,
  };
  const byDayMap = {};
  const modelMap = {};
  const skillMap = {};

  function accTokens(map, key, entry) {
    if (!map[key]) {
      map[key] = { input: 0, output: 0, cache_creation_5m: 0, cache_creation_1h: 0, cache_read: 0 };
    }
    const r = map[key];
    r.input += entry.input || 0;
    r.output += entry.output || 0;
    r.cache_creation_5m += entry.cache_creation_5m || 0;
    r.cache_creation_1h += entry.cache_creation_1h || 0;
    r.cache_read += entry.cache_read || 0;
  }

  for (const h of (hours || [])) {
    const hourKey = h.hour || '';
    const d = new Date(hourKey + ':00:00');
    const ms = d.getTime();
    if (isNaN(ms) || ms < startMs || ms >= endMs) continue;

    total.input += h.input || 0;
    total.output += h.output || 0;
    total.cache_creation_5m += h.cache_creation_5m || 0;
    total.cache_creation_1h += h.cache_creation_1h || 0;
    total.cache_read += h.cache_read || 0;
    total.messages += h.messages || 0;
    total.cost_usd += h.cost_usd || 0;

    const dayKey = hourKey.slice(0, 10);
    if (!byDayMap[dayKey]) {
      byDayMap[dayKey] = { day: dayKey, input: 0, output: 0, cache_creation_5m: 0, cache_creation_1h: 0, cache_read: 0, messages: 0, cost_usd: 0 };
    }
    const dr = byDayMap[dayKey];
    dr.input += h.input || 0;
    dr.output += h.output || 0;
    dr.cache_creation_5m += h.cache_creation_5m || 0;
    dr.cache_creation_1h += h.cache_creation_1h || 0;
    dr.cache_read += h.cache_read || 0;
    dr.messages += h.messages || 0;
    dr.cost_usd += h.cost_usd || 0;

    for (const m of (h.by_model || [])) {
      accTokens(modelMap, m.model, m);
    }
    for (const s of (h.by_skill || [])) {
      accTokens(skillMap, s.skill, s);
    }
  }

  const by_day = Object.keys(byDayMap).sort().map(k => byDayMap[k]);

  function totalTok(r) {
    return (r.input || 0) + (r.output || 0) + (r.cache_creation_5m || 0) + (r.cache_creation_1h || 0) + (r.cache_read || 0);
  }

  const by_model = Object.entries(modelMap)
    .map(([model, r]) => ({ model, ...r, cost_usd: 0 }))
    .sort((a, b) => totalTok(b) - totalTok(a));

  const by_skill = Object.entries(skillMap)
    .map(([skill, r]) => ({ skill, ...r, cost_usd: 0 }))
    .sort((a, b) => totalTok(b) - totalTok(a));

  return {
    total,
    by_day,
    by_model,
    by_skill,
    by_session: [],
    by_prompt: [],
  };
}

async function loadPeriodData(unit, key) {
  const r = await fetch(`data/periods/${unit}/${key}.json`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`failed to load period data: ${unit}/${key} (${r.status})`);
  return r.json();
}

function updateUrl(unit, key) {
  const params = new URLSearchParams();
  if (unit === 'realtime') {
    params.set('period', 'realtime');
    const compareEl = document.getElementById('period-compare-target');
    const compareKey = compareEl ? compareEl.value : '';
    if (compareKey) params.set('compare', compareKey);
  } else if (unit && unit !== 'all') {
    params.set('period', unit);
    if (key) params.set('key', key);
    const compareEl = document.getElementById('period-compare-target');
    const compareKey = compareEl ? compareEl.value : '';
    if (compareKey) params.set('compare', compareKey);
  }
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function renderAll(data, compareData) {
  const aggData = _aggregateCache || data;
  renderKpi(data);
  renderChartDayTokens(aggData, {});
  if (compareData) {
    const prevTotal = compareData.total || {};
    const prevCacheRows = [
      { val: (prevTotal.input || 0) + (prevTotal.output || 0) },
      { val: (prevTotal.cache_creation_5m || 0) + (prevTotal.cache_creation_1h || 0) },
      { val: prevTotal.cache_read || 0 },
    ];
    renderChartModelDonut(data, { prevRows: compareData.by_model || [] });
    renderChartSkillDonut(data, { prevRows: compareData.by_skill || [] });
    renderChartCacheDonut(data, { prevRows: prevCacheRows });
  } else {
    renderChartModelDonut(data);
    renderChartSkillDonut(data);
    renderChartCacheDonut(data);
  }
  renderChartSessionBar(data);
  renderChartDayCost(aggData);
  renderChartPromptBar(data);

  renderChartModelDonut(data, { chartKey: 'modelDonutDetail', canvasSel: '#chart-detail-model' });
  renderChartSkillDonut(data, { chartKey: 'skillDonutDetail', canvasSel: '#chart-detail-skill' });
  renderChartDayTokens(aggData, { chartKey: 'dayTokensDetail', canvasSel: '#chart-detail-day' });
  renderChartSessionBar(data, { chartKey: 'sessionBarDetail', canvasSel: '#chart-detail-session' });

  $('#by-model').innerHTML = renderByModel(data.by_model || []);
  $('#by-skill').innerHTML = renderBySkill(data.by_skill || []);
  $('#by-day').innerHTML = renderByDay(data.by_day || []);
  $('#by-session').innerHTML = renderBySession(data.by_session || []);
}

function render(data) {
  $('#meta').textContent = `생성일: ${shortTime(data.generated_at)} | 처리된 세션: ${data.files_processed}`;

  if (data.error) {
    const err = $('#error');
    err.hidden = false;
    err.textContent = data.error;
    return;
  }

  renderAll(data);
  applyDeltaBadges(data);
}

function populatePeriodKeys(periodsIndex, unit) {
  const keyEl = $('#period-key');
  keyEl.innerHTML = '';
  if (!unit || unit === 'all' || unit === 'realtime') {
    keyEl.disabled = true;
    keyEl.innerHTML = '<option value="">—</option>';
    return;
  }
  const keys = ((periodsIndex || {})[unit] || []).slice().sort().reverse();
  if (!keys.length) {
    keyEl.disabled = true;
    keyEl.innerHTML = '<option value="">—</option>';
    return;
  }
  let displayKeys = keys;
  if (unit === 'weekly') {
    const { year: cy, week: cw } = dateToIsoWeek(new Date());
    const currentWeekKey = `${cy}-W${String(cw).padStart(2, '0')}`;
    displayKeys = keys.filter(k => k !== currentWeekKey);
  }
  if (!displayKeys.length) {
    keyEl.disabled = true;
    keyEl.innerHTML = '<option value="">—</option>';
    return;
  }
  if (unit === 'weekly') {
    keyEl.innerHTML = displayKeys.map(k => `<option value="${k}">${formatWeekLabel(k)}</option>`).join('');
  } else {
    keyEl.innerHTML = displayKeys.map(k => `<option value="${k}">${k}</option>`).join('');
  }
  keyEl.disabled = false;
}

function populateCompareTarget(periodsIndex, unit, selectedKey) {
  const el = document.getElementById('period-compare-target');
  if (!el) return;
  el.innerHTML = '<option value="">없음</option>';
  if (!unit || unit === 'all') {
    el.disabled = true;
    return;
  }
  if (unit === 'realtime') {
    const REALTIME_OPTIONS = [
      { value: '1', label: '1시간 전' },
      { value: '3', label: '3시간 전' },
      { value: '7', label: '7시간 전' },
      { value: '24', label: '24시간 전' },
      { value: '48', label: '2일 전' },
      { value: '72', label: '3일 전' },
      { value: '120', label: '5일 전' },
    ];
    for (const opt of REALTIME_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      el.appendChild(o);
    }
    el.disabled = false;
    return;
  }
  const { year: cy, week: cw } = dateToIsoWeek(new Date());
  const currentWeekKey = `${cy}-W${String(cw).padStart(2, '0')}`;
  let keys = ((periodsIndex || {})[unit] || []).slice().sort().reverse();
  keys = keys.filter(k => k !== selectedKey);
  if (unit === 'weekly') {
    keys = keys.filter(k => k !== currentWeekKey);
  }
  if (!keys.length) {
    el.disabled = true;
    return;
  }
  for (const k of keys) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = unit === 'weekly' ? formatWeekLabel(k) : k;
    el.appendChild(opt);
  }
  el.disabled = false;
}

function updateLastRefreshDisplay() {
  const el = document.getElementById('last-refresh-time');
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  el.textContent = `마지막 새로고침: ${hh}:${mm}:${ss}`;
}

async function applyPeriodSelection(unit, key, periodsIndex) {
  const err = $('#error');
  err.hidden = true;
  const compareTargetEl = document.getElementById('period-compare-target');
  const compareKey = compareTargetEl && !compareTargetEl.disabled ? compareTargetEl.value : '';

  const keyEl = $('#period-key');
  if (unit === 'realtime') {
    keyEl.style.display = 'none';
  } else {
    keyEl.style.display = '';
  }

  try {
    if (unit === 'realtime') {
      const hoursBack = parseInt(compareKey, 10) || 0;
      let hourly;
      try {
        hourly = await loadHourlyData();
      } catch (fetchErr) {
        $('#meta').textContent = `실시간 데이터 없음 — collect.py 실행 필요`;
        err.hidden = false;
        err.textContent = `${fetchErr.message}`;
        updateUrl('realtime', null);
        return;
      }
      const now = Date.now();
      const windows = computeRealtimeWindows(now, hoursBack);
      const baseData = aggregateHoursInWindow(hourly.hours, windows.baseStart, windows.baseEnd);
      let compareData = null;
      if (windows.compareStart != null) {
        compareData = aggregateHoursInWindow(hourly.hours, windows.compareStart, windows.compareEnd);
      }
      // preload aggregate so _aggregateCache is set before renderAll uses it for day charts
      await loadAggregate().catch(() => null);
      // fallback: inject current week's session/prompt data into realtime base
      try {
        const { year: cy, week: cw } = dateToIsoWeek(new Date());
        const currentWeekKey = `${cy}-W${String(cw).padStart(2, '0')}`;
        const weeklyFallback = await loadPeriodData('weekly', currentWeekKey);
        baseData.by_session = weeklyFallback.by_session || [];
        baseData.by_prompt = weeklyFallback.by_prompt || [];
      } catch (_) { /* 현재 주 데이터 없으면 빈 채로 유지 */ }
      if (compareData) {
        const hoursLabel = compareKey === '48' ? '2일' : compareKey === '72' ? '3일' : compareKey === '120' ? '5일' : `${compareKey}시간`;
        $('#meta').textContent = `실시간: 이번주 월요일 00:00 ~ 지금까지 (vs ${hoursLabel} 전 누적 — 그동안의 증가분)`;
      } else {
        $('#meta').textContent = `실시간: 이번주 월요일 00:00 ~ 지금까지`;
      }
      renderAll(baseData, compareData);
      if (compareData) {
        applyDeltaBadgesFromValues(computeKpiSnapshot(compareData), computeKpiSnapshot(baseData));
      } else {
        clearDeltaBadges();
      }
      updateUrl('realtime', null);
    } else if (!unit || unit === 'all') {
      const data = await loadAggregate();
      $('#meta').textContent = `생성일: ${shortTime(data.generated_at)} | 처리된 세션: ${data.files_processed}`;
      renderAll(data);
      applyDeltaBadges(data);
      clearPieCompareLists();
      updateUrl('all', null);
    } else {
      const data = await loadPeriodData(unit, key);
      const agg = await loadAggregate();
      const idx = periodsIndex || (agg.periods_index || {});

      if (compareKey && compareKey !== key) {
        const compareKeys = idx[unit] || [];
        if (compareKeys.includes(compareKey)) {
          const compareData = await loadPeriodData(unit, compareKey);
          $('#meta').textContent = `기간: ${key} vs ${compareKey} (비교) | 생성일: ${shortTime(agg.generated_at)}`;
          renderAll(data, compareData);
          applyDeltaBadgesFromValues(computeKpiSnapshot(compareData), computeKpiSnapshot(data));
        } else {
          $('#meta').textContent = `기간: ${key} | 비교 불가: 선택한 비교 기간 데이터 없음 | 생성일: ${shortTime(agg.generated_at)}`;
          clearDeltaBadges();
          renderAll(data);
        }
      } else {
        $('#meta').textContent = `기간: ${key} | 생성일: ${shortTime(agg.generated_at)}`;
        clearDeltaBadges();
        renderAll(data);
      }
      updateUrl(unit, key);
    }
    updateLastRefreshDisplay();
  } catch (e) {
    err.hidden = false;
    err.textContent = `기간 데이터 로딩 실패: ${e.message}`;
  }
}

async function refresh() {
  const btn = $('#refresh-btn');
  btn.disabled = true;
  btn.textContent = '갱신 중...';
  try {
    const r = await fetch('/api/refresh', { method: 'POST' });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`refresh failed: ${r.status} ${body}`);
    }
    _aggregateCache = null;
    _hourlyCache = null;
    const unit = $('#period-unit').value;
    const key = $('#period-key').value;
    await applyPeriodSelection(unit, key);
  } catch (e) {
    const err = $('#error');
    err.hidden = false;
    err.textContent = `${e.message} — static mode 일 가능성 (serve.py 가 아니라 단순 static 서버). 수동 'python3 monitoring/scripts/collect.py' 후 페이지 리로드 필요.`;
  } finally {
    btn.disabled = false;
    btn.textContent = '새로고침';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#refresh-btn').addEventListener('click', refresh);

  try {
    const agg = await loadAggregate();

    const urlParams = new URLSearchParams(location.search);
    const initUnit = urlParams.get('period') || 'all';
    const initKey = urlParams.get('key') || '';

    const periodsIndex = agg.periods_index || {};

    const unitEl = $('#period-unit');
    const keyEl = $('#period-key');
    const compareTargetEl = document.getElementById('period-compare-target');

    unitEl.value = initUnit;
    populatePeriodKeys(periodsIndex, initUnit);

    if (initUnit !== 'all' && initUnit !== 'realtime' && initKey) {
      const validKeys = (periodsIndex[initUnit] || []);
      if (validKeys.includes(initKey)) {
        keyEl.value = initKey;
      } else {
        unitEl.value = 'all';
        populatePeriodKeys(periodsIndex, 'all');
      }
    }

    const resolvedUnit = unitEl.value;
    const resolvedKey = keyEl.value;
    populateCompareTarget(periodsIndex, resolvedUnit, resolvedKey);

    const initCompare = urlParams.get('compare') || '';
    if (initCompare && compareTargetEl && !compareTargetEl.disabled) {
      compareTargetEl.value = initCompare;
    }

    unitEl.addEventListener('change', () => {
      const unit = unitEl.value;
      populatePeriodKeys(periodsIndex, unit);
      populateCompareTarget(periodsIndex, unit, keyEl.value);
      if (unit === 'realtime') {
        applyPeriodSelection('realtime', null, periodsIndex);
      } else if (unit === 'all') {
        applyPeriodSelection('all', null, periodsIndex);
      } else {
        const key = keyEl.value;
        if (key) applyPeriodSelection(unit, key, periodsIndex);
      }
    });

    keyEl.addEventListener('change', () => {
      const unit = unitEl.value;
      const key = keyEl.value;
      populateCompareTarget(periodsIndex, unit, key);
      if (unit !== 'all' && key) applyPeriodSelection(unit, key, periodsIndex);
    });

    if (compareTargetEl) {
      compareTargetEl.addEventListener('change', () => {
        const unit = unitEl.value;
        const key = keyEl.value;
        if (unit === 'realtime') {
          applyPeriodSelection('realtime', null, periodsIndex);
        } else if (unit !== 'all' && key) {
          applyPeriodSelection(unit, key, periodsIndex);
        }
      });
    }

    const currentUnit = unitEl.value;
    const currentKey = keyEl.value;
    if (currentUnit === 'realtime') {
      await applyPeriodSelection('realtime', null, periodsIndex);
    } else if (currentUnit !== 'all' && currentKey) {
      await applyPeriodSelection(currentUnit, currentKey, periodsIndex);
    } else {
      render(agg);
      updateLastRefreshDisplay();
    }

    const AUTO_REFRESH_MS = 60_000;
    const autoRefreshHandle = setInterval(async () => {
      if (_autoRefreshInFlight) return;
      _autoRefreshInFlight = true;
      try {
        await refresh();
      } catch (_) {
        // 자동 새로고침 실패는 조용히 무시 (수동 버튼은 사용자에게 노출)
      } finally {
        _autoRefreshInFlight = false;
      }
    }, AUTO_REFRESH_MS);
    window.addEventListener('beforeunload', () => clearInterval(autoRefreshHandle));
  } catch (e) {
    const err = $('#error');
    err.hidden = false;
    err.textContent = `초기 로딩 실패: ${e.message}. monitoring/data/aggregate.json 부재일 수 있음 — 'python3 monitoring/scripts/collect.py' 또는 'python3 monitoring/scripts/serve.py' 실행 필요.`;
  }
});
