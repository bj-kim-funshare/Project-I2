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
let __lastAggregateData = null;
const __periodMode = { dayTokens: 'day', dayCost: 'day' };

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

// ---------- Skill count helper ----------

// Use local-time date keys because collect.py:867 parse_ts_hour writes hour keys in local time,
// so by_day[i].day is a local date. A UTC slice would misalign at day boundaries.
function computeSkillCountByDay(invocations) {
  const counts = {};
  for (const w of (invocations || [])) {
    const skill = w.skill || '';
    if (!skill || skill === '(no-skill)') continue;
    const d = new Date(w.start_timestamp);
    if (isNaN(d.getTime())) continue;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
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

function makeDayTokensSkillCountPlugin(countsByDay) {
  return {
    id: 'dayTokensSkillCount',
    afterDatasetsDraw(chart) {
      if (!countsByDay || !Object.keys(countsByDay).length) return;

      const { ctx } = chart;
      const labels = chart.data.labels || [];
      const datasets = chart.data.datasets || [];

      labels.forEach((label, i) => {
        const count = countsByDay[label];
        if (!count) return;

        // Find the topmost stack 's' dataset index (last one in array order)
        let topIdx = -1;
        for (let di = 0; di < datasets.length; di++) {
          if (datasets[di].stack === 's') topIdx = di;
        }
        if (topIdx === -1) return;

        const meta = chart.getDatasetMeta(topIdx);
        const pt = meta.data && meta.data[i];
        if (!pt) return;

        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.fillText(String(count), pt.x, pt.y - 8);
        ctx.restore();
      });
    },
  };
}

// ---------- Charts ----------

function getISOWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { year: new Date(firstThursday).getUTCFullYear(), week };
}

function aggregateByWeek(daysArray, fields) {
  const map = new Map();
  for (const d of daysArray) {
    const date = new Date(d.day + 'T00:00:00');
    const { year, week } = getISOWeek(date);
    const key = `${year}-W${String(week).padStart(2, '0')}`;
    if (!map.has(key)) {
      const entry = { day: key };
      for (const f of fields) entry[f] = 0;
      map.set(key, entry);
    }
    const entry = map.get(key);
    for (const f of fields) entry[f] = (entry[f] || 0) + (d[f] || 0);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, v]) => v);
}

function renderChartDayTokens(data, opts) {
  const chartKey = (opts && opts.chartKey) || 'dayTokens';
  const canvasSel = (opts && opts.canvasSel) || '#chart-day-tokens canvas';
  const compareData = (opts && opts.compareData) || null;
  const periodMode = (opts && opts.periodMode) || 'day';
  destroyChart(chartKey);
  const days = periodMode === 'week'
    ? aggregateByWeek(data.by_day || [], ['input', 'output'])
    : (data.by_day || []);
  const labels = days.map(d => d.day);
  const ctx = $(canvasSel);
  if (!ctx || !days.length) return;

  const datasets = [
    { label: 'input', data: days.map(d => d.input || 0), borderColor: COLORS.input, backgroundColor: COLORS.input + '66', stack: 's', fill: 'origin' },
    { label: 'output', data: days.map(d => d.output || 0), borderColor: COLORS.output, backgroundColor: COLORS.output + '66', stack: 's', fill: '-1' },
  ];

  if (compareData) {
    const cdays = periodMode === 'week'
      ? aggregateByWeek(compareData.by_day || [], ['input', 'output'])
      : (compareData.by_day || []);
    datasets.push(
      { label: 'input (비교)', data: cdays.map(d => d.input || 0), borderColor: COLORS.input, backgroundColor: COLORS.input + '99', borderDash: [5, 5], stack: 'c', fill: 'origin' },
      { label: 'output (비교)', data: cdays.map(d => d.output || 0), borderColor: COLORS.output, backgroundColor: COLORS.output + '99', borderDash: [5, 5], stack: 'c', fill: '-1' },
    );
  }

  const skillCountsByDay = (opts && opts.skillCountsByDay) || null;
  const chartOptions = {
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
  };
  const chartPlugins = (skillCountsByDay && periodMode === 'day') ? [makeDayTokensSkillCountPlugin(skillCountsByDay)] : [];
  charts[chartKey] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: chartOptions,
    plugins: chartPlugins,
  });
}

function totalTokens(r) {
  return (r.input || 0) + (r.output || 0) + (r.cache_creation_5m || 0) + (r.cache_creation_1h || 0) + (r.cache_read || 0);
}

function renderHtmlLegend(containerEl, labels, values, bgs, opts) {
  if (!containerEl) return;
  const prevMap = (opts && opts.prevMap) || null;
  const prevTotal = (opts && opts.prevTotal) || 0;
  const totalVal = values.reduce((a, v) => a + v, 0);
  containerEl.innerHTML = '';
  labels.forEach((label, i) => {
    const li = document.createElement('div');
    li.className = 'chart-legend-item';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = bgs[i];
    const textBox = document.createElement('span');
    textBox.className = 'text';
    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = label;
    textBox.appendChild(labelEl);
    if (prevMap && prevTotal > 0 && totalVal > 0) {
      const cs = values[i] / totalVal * 100;
      const ps = (prevMap[label] || 0) / prevTotal * 100;
      const delta = cs - ps;
      if (Math.abs(delta) >= 0.1) {
        const absDelta = values[i] - (prevMap[label] || 0);
        const deltaEl = document.createElement('span');
        deltaEl.className = 'delta ' + (delta >= 0 ? 'up' : 'down');
        const sign = delta >= 0 ? '▲' : '▼';
        const pctStr = `${sign} ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%p`;
        const absStr = `(${absDelta >= 0 ? '+' : ''}${fmtKMB(absDelta)})`;
        deltaEl.textContent = `${pctStr} ${absStr}`;
        textBox.appendChild(deltaEl);
      }
    }
    li.appendChild(dot);
    li.appendChild(textBox);
    containerEl.appendChild(li);
  });
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
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtNum(c.parsed)}` } },
      },
    },
    plugins: [pieLabelsPlugin],
  });
  const legendEl = ctx.parentElement.querySelector('.chart-legend');
  renderHtmlLegend(legendEl, labels, values, bgs, { prevMap, prevTotal });
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
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtNum(c.parsed)}` } },
      },
    },
    plugins: [pieLabelsPlugin],
  });
  const legendEl = ctx.parentElement.querySelector('.chart-legend');
  renderHtmlLegend(legendEl, labels, values, bgs, { prevMap, prevTotal });
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
  let prevMap = null;
  if (prevRows) {
    prevVals = prevRows.map(r => r.val || 0);
    prevTotal = prevVals.reduce((a, v) => a + v, 0);
    prevMap = {};
    cacheLabels.forEach((lbl, i) => { prevMap[lbl] = prevVals[i] || 0; });
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
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtNum(c.parsed)}` } },
      },
    },
    plugins: [pieLabelsPlugin],
  });
  const legendEl = ctx.parentElement.querySelector('.chart-legend');
  renderHtmlLegend(legendEl, cacheLabels, values, bgs, { prevMap, prevTotal });
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

function renderChartAgentBar(data, opts) {
  destroyChart('agentBar');
  const compareData = (opts && opts.compareData) || null;
  const rows = (data.by_agent || [])
    .slice()
    .sort((a, b) => {
      const ta = (a.input || 0) + (a.output || 0) + (a.cache_creation_5m || 0) + (a.cache_creation_1h || 0) + (a.cache_read || 0);
      const tb = (b.input || 0) + (b.output || 0) + (b.cache_creation_5m || 0) + (b.cache_creation_1h || 0) + (b.cache_read || 0);
      return tb - ta;
    });
  const ctx = $('#chart-agent-bar canvas');
  if (!ctx || !rows.length) return;
  charts.agentBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.agent),
      datasets: [{
        label: '총 토큰',
        data: rows.map(r => (r.input || 0) + (r.output || 0) + (r.cache_creation_5m || 0) + (r.cache_creation_1h || 0) + (r.cache_read || 0)),
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
              return [
                `메시지: ${fmtNum(r.messages || 0)}`,
                `input: ${fmtNum(r.input || 0)}`,
                `output: ${fmtNum(r.output || 0)}`,
                `cache read: ${fmtNum(r.cache_read || 0)}`,
              ];
            },
            afterBody: (items) => {
              if (!items.length) return '';
              const label = items[0].label;
              const desc = (data.agent_descriptions || {})[label];
              if (!desc) return '';
              const wrapped = [];
              const words = desc.split(/\s+/);
              let line = '';
              for (const w of words) {
                if ((line + ' ' + w).trim().length > 60) {
                  wrapped.push(line.trim());
                  line = w;
                } else {
                  line = (line + ' ' + w).trim();
                }
              }
              if (line) wrapped.push(line);
              return ['', ...wrapped];
            },
          },
        },
      },
    },
  });

  if (compareData) {
    const card = ctx.closest('#chart-agent-bar');
    if (card) {
      let legendEl = card.querySelector('.chart-legend-agent-2col');
      if (!legendEl) {
        legendEl = document.createElement('div');
        legendEl.className = 'chart-legend-agent-2col';
        card.appendChild(legendEl);
      }
      const prevMap = {};
      for (const r of (compareData.by_agent || [])) {
        prevMap[r.agent] = (r.input || 0) + (r.output || 0) + (r.cache_creation_5m || 0) + (r.cache_creation_1h || 0) + (r.cache_read || 0);
      }
      const prevTotal = Object.values(prevMap).reduce((a, v) => a + v, 0);
      const labels = rows.map(r => r.agent);
      const values = rows.map(r => (r.input || 0) + (r.output || 0) + (r.cache_creation_5m || 0) + (r.cache_creation_1h || 0) + (r.cache_read || 0));
      const bgs = labels.map((_, i) => PALETTE[i % PALETTE.length]);
      legendEl.innerHTML = '';
      labels.forEach((label, i) => {
        const li = document.createElement('div');
        li.className = 'chart-legend-item';
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = bgs[i];
        const textBox = document.createElement('span');
        textBox.className = 'text';
        const labelEl = document.createElement('span');
        labelEl.className = 'label';
        labelEl.textContent = label === '신규' ? label : label;
        textBox.appendChild(labelEl);
        const curVal = values[i];
        const prevVal = prevMap[label];
        if (prevVal == null) {
          const newEl = document.createElement('span');
          newEl.className = 'delta up';
          newEl.textContent = '신규';
          textBox.appendChild(newEl);
        } else {
          const absDelta = curVal - prevVal;
          if (Math.abs(absDelta) >= 1) {
            const deltaEl = document.createElement('span');
            deltaEl.className = 'delta ' + (absDelta >= 0 ? 'up' : 'down');
            const sign = absDelta >= 0 ? '▲' : '▼';
            deltaEl.textContent = `${sign} ${absDelta >= 0 ? '+' : ''}${fmtKMB(absDelta)}`;
            textBox.appendChild(deltaEl);
          }
        }
        li.appendChild(dot);
        li.appendChild(textBox);
        legendEl.appendChild(li);
      });
    }
  }
}

function renderChartPromptBar(data, invocations) {
  destroyChart('promptBar');
  const ctx = $('#chart-prompt-bar canvas');
  const rows = (invocations || [])
    .map(w => {
      const t = w.total || {};
      const usage = (t.input || 0) + (t.output || 0);
      const cache = (t.cache_creation_5m || 0) + (t.cache_creation_1h || 0) + (t.cache_read || 0);
      return { w, usage, cache, total: usage + cache };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);
  if (!ctx || !rows.length) return;
  const truncate = (s) => s.length > 60 ? s.slice(0, 60) + '...' : s;
  charts.promptBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => truncate(r.w.title_prompt || '')),
      datasets: [
        {
          label: '실사용 (input+output)',
          data: rows.map(r => r.usage),
          backgroundColor: COLORS.noncache,
          stack: 's',
        },
        {
          label: '캐시 (creation+read)',
          data: rows.map(r => r.cache),
          backgroundColor: COLORS.cache,
          stack: 's',
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { callback: (v) => fmtKMB(v) } },
        y: { stacked: true },
      },
      plugins: {
        tooltip: {
          mode: 'nearest',
          callbacks: {
            title: (items) => {
              const r = rows[items[0].dataIndex];
              return r ? (r.w.title_prompt || '') : '';
            },
            label: (c) => {
              const r = rows[c.dataIndex];
              if (!r) return fmtKMB(c.parsed.x);
              const t = r.w.total || {};
              return [
                `${c.dataset.label}: ${fmtKMB(c.parsed.x)}`,
                `총 토큰: ${fmtKMB(r.usage + r.cache)}`,
                `input: ${fmtKMB(t.input)}`,
                `output: ${fmtKMB(t.output)}`,
                `cache_creation_5m: ${fmtKMB(t.cache_creation_5m)}`,
                `cache_creation_1h: ${fmtKMB(t.cache_creation_1h)}`,
                `cache_read: ${fmtKMB(t.cache_read)}`,
                `비용: $${(t.cost_usd || 0).toFixed(4)}`,
                `스킬: ${r.w.skill || ''}`,
                `세션: ${(r.w.session_id || '').slice(0, 8)}`,
                `시작: ${shortTime(r.w.start_timestamp)}`,
              ];
            },
          },
        },
      },
    },
  });
}

function renderChartDayCost(data, opts) {
  destroyChart('dayCost');
  const periodMode = (opts && opts.periodMode) || 'day';
  const days = periodMode === 'week'
    ? aggregateByWeek(data.by_day || [], ['cost_usd'])
    : (data.by_day || []);
  const ctx = $('#chart-day-cost canvas');
  if (!ctx || !days.length) return;
  charts.dayCost = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days.map(d => d.day),
      datasets: [{
        label: '추정 비용 (USD)',
        data: days.map(d => d.cost_usd || 0),
        borderColor: COLORS.positive,
        backgroundColor: COLORS.positive + '33',
        tension: 0.25,
        pointRadius: 3,
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => USD(v) } } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => USD(c.parsed.y) } },
      },
    },
  });
}

// ---------- Skill Invocations ----------

let __skillInvData = [];
let __skillInvPage = 1;
const SKILL_INV_PAGE_SIZE = 30;

function formatDurationSec(sec) {
  if (!sec || sec <= 0) return '0s';
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${sec}s`;
}

function formatTokensCompact(n) {
  if (!n || n <= 0) return '0.00M';
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function skillColor(name) {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h) ^ name.charCodeAt(i);
    h = h >>> 0;
  }
  return h % 360;
}

function formatDurationBucket(sec) {
  if (!sec || sec < 60) return 'fast';
  if (sec < 600) return 'med';
  if (sec < 3600) return 'slow';
  return 'very-slow';
}

function skillInvTotalTokens(rec) {
  return (rec.input || 0) + (rec.output || 0) + (rec.cache_creation_5m || 0) + (rec.cache_creation_1h || 0) + (rec.cache_read || 0);
}

function formatStartTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const yyyy = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}`;
}

function renderSkillInvPager(containerId, page, totalPages) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (totalPages <= 0) {
    el.innerHTML = '';
    return;
  }
  const prevDisabled = page <= 1 ? 'disabled' : '';
  const nextDisabled = page >= totalPages ? 'disabled' : '';
  el.innerHTML = `
    <button ${prevDisabled} data-inv-prev>◀</button>
    <span>${page} / ${totalPages}</span>
    <button ${nextDisabled} data-inv-next>▶</button>
  `;
  el.querySelector('[data-inv-prev]')?.addEventListener('click', () => {
    if (__skillInvPage > 1) { __skillInvPage--; renderSkillInvocations(); }
  });
  el.querySelector('[data-inv-next]')?.addEventListener('click', () => {
    const completed = __skillInvData.filter(w => w.close_reason !== 'in_progress');
    const tp = Math.ceil(completed.length / SKILL_INV_PAGE_SIZE) || 1;
    if (__skillInvPage < tp) { __skillInvPage++; renderSkillInvocations(); }
  });
}

function buildInvTableRows(items, artifactCellFn, tokCellFn, extraRowClass) {
  if (!items.length) return '';
  let maxTotalUsage = 0, maxTotalCache = 0, maxMainUsage = 0, maxMainCache = 0;
  items.forEach(({ w }) => {
    const t = w.total || {};
    const m = w.main_session || {};
    maxTotalUsage = Math.max(maxTotalUsage, (t.input || 0) + (t.output || 0));
    maxTotalCache = Math.max(maxTotalCache, (t.cache_creation_5m || 0) + (t.cache_creation_1h || 0) + (t.cache_read || 0));
    maxMainUsage = Math.max(maxMainUsage, (m.input || 0) + (m.output || 0));
    maxMainCache = Math.max(maxMainCache, (m.cache_creation_5m || 0) + (m.cache_creation_1h || 0) + (m.cache_read || 0));
  });
  return items.map(({ w, i }, localIdx) => {
    const zebraClass = extraRowClass || (localIdx % 2 === 1 ? ' row-odd' : '');
    const startTs = formatStartTimestamp(w.start_timestamp);
    const durSec = w.duration_sec || 0;
    const durText = formatDurationSec(durSec);
    const bucket = formatDurationBucket(durSec);
    const skillName = w.skill || '—';
    const hue = skillColor(skillName);
    const titleFull = w.title_prompt || '';
    const titleTrunc = titleFull.length > 70 ? titleFull.slice(0, 70) + '…' : titleFull;
    const titleAttr = escapeHtml(titleFull);
    const totalRec = w.total || {};
    const mainRec = w.main_session || {};
    const totalUsageVal = (totalRec.input || 0) + (totalRec.output || 0);
    const totalCacheVal = (totalRec.cache_creation_5m || 0) + (totalRec.cache_creation_1h || 0) + (totalRec.cache_read || 0);
    const mainUsageVal = (mainRec.input || 0) + (mainRec.output || 0);
    const mainCacheVal = (mainRec.cache_creation_5m || 0) + (mainRec.cache_creation_1h || 0) + (mainRec.cache_read || 0);
    const agentMap = w.by_agent || {};
    const agentKeys = Object.keys(agentMap);
    let agentsCell;
    if (agentKeys.length === 0) {
      agentsCell = '—';
    } else {
      agentsCell = agentKeys.map(name => {
        const rec = agentMap[name];
        const usage = formatTokensCompact((rec.input || 0) + (rec.output || 0));
        const cache = formatTokensCompact((rec.cache_creation_5m || 0) + (rec.cache_creation_1h || 0) + (rec.cache_read || 0));
        const aHue = skillColor(name);
        return `<span class="agent-pill" style="--agent-hue:${aHue}">${escapeHtml(name)} <span class="agent-tok">${usage}/${cache}</span></span>`;
      }).join(' ');
    }
    return `<tr data-window-index="${i}" class="${zebraClass}">
      <td>${startTs}</td>
      <td><span class="dur-pip dur-bucket-${bucket}"></span>${durText}</td>
      <td><span class="skill-chip" style="--skill-hue:${hue}">${escapeHtml(skillName)}</span></td>
      <td class="title-cell" title="${titleAttr}">${escapeHtml(titleTrunc)}</td>
      <td>${artifactCellFn(w.artifact_kind, w.artifact_id)}</td>
      <td>${tokCellFn(totalUsageVal, maxTotalUsage, 'tok-total-usage')}</td>
      <td>${tokCellFn(totalCacheVal, maxTotalCache, 'tok-total-cache')}</td>
      <td>${tokCellFn(mainUsageVal, maxMainUsage, 'tok-main-usage')}</td>
      <td>${tokCellFn(mainCacheVal, maxMainCache, 'tok-main-cache')}</td>
      <td class="agents-cell">${agentsCell}</td>
    </tr>`;
  }).join('');
}

function renderSkillInvocations() {
  const tableWrap = document.getElementById('skill-invocations-table');
  if (!tableWrap) return;

  const allItems = __skillInvData.map((w, i) => ({ w, i }));
  const inprogItems = allItems.filter(x => x.w.close_reason === 'in_progress');
  const completedItems = allItems.filter(x => x.w.close_reason !== 'in_progress');

  // Render in-progress section
  const ipSection = document.getElementById('skill-inv-inprogress');
  if (ipSection) {
    if (inprogItems.length === 0) {
      ipSection.hidden = true;
      ipSection.innerHTML = '';
    } else {
      ipSection.hidden = false;
      function artifactCellFn(kind, id) {
        if (!kind || kind === 'none' || !id || id === '-') return '—';
        const kindMap = { issue: 'art-issue', 'patch-note': 'art-doc', roadmap: 'art-doc' };
        const cls = kindMap[kind] || 'art-doc';
        return `<span class="art-tag ${cls}">${escapeHtml(id)}</span>`;
      }
      function tokCellFn(val, colMax, cssClass) {
        const pct = colMax > 0 ? Math.round((val / colMax) * 100) : 0;
        return `<div class="tok-cell ${cssClass}"><span class="tok-num">${formatTokensCompact(val)}</span><div class="tok-bar"><div class="tok-bar-fill" style="width:${pct}%"></div></div></div>`;
      }
      const headers = ['시작 시각', '소요 시간', '스킬', '제목', '생성물', '총 사용', '총 캐시', '메인 사용', '메인 캐시', '서브에이전트'];
      const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
      const rows = buildInvTableRows(inprogItems, artifactCellFn, tokCellFn, 'row-inprogress');
      ipSection.innerHTML = `
        <div class="skill-inv-inprogress-heading">🔴 진행 중인 호출 (실시간 부분 집계)</div>
        <div class="table-wrap"><table class="skill-inv-table">${thead}<tbody>${rows}</tbody></table></div>
      `;
      ipSection.querySelectorAll('tr[data-window-index]').forEach(tr => {
        tr.addEventListener('click', () => {
          const idx = parseInt(tr.getAttribute('data-window-index'), 10);
          openSkillInvocationModal(idx);
        });
      });
    }
  }

  const total = completedItems.length;
  const totalPages = total > 0 ? Math.ceil(total / SKILL_INV_PAGE_SIZE) : 1;
  if (__skillInvPage > totalPages) __skillInvPage = totalPages;
  if (__skillInvPage < 1) __skillInvPage = 1;

  renderSkillInvPager('skill-invocations-pager', __skillInvPage, total > 0 ? totalPages : 0);
  renderSkillInvPager('skill-invocations-pager-bottom', __skillInvPage, total > 0 ? totalPages : 0);

  if (total === 0) {
    tableWrap.innerHTML = '<p style="padding:12px;color:var(--muted)">데이터 없음</p>';
    return;
  }

  const start = (__skillInvPage - 1) * SKILL_INV_PAGE_SIZE;
  const slice = completedItems.slice(start, start + SKILL_INV_PAGE_SIZE);

  function artifactCell(kind, id) {
    if (!kind || kind === 'none' || !id || id === '-') return '—';
    const kindMap = { issue: 'art-issue', 'patch-note': 'art-doc', roadmap: 'art-doc' };
    const cls = kindMap[kind] || 'art-doc';
    return `<span class="art-tag ${cls}">${escapeHtml(id)}</span>`;
  }

  function tokCell(val, colMax, cssClass) {
    const pct = colMax > 0 ? Math.round((val / colMax) * 100) : 0;
    return `<div class="tok-cell ${cssClass}"><span class="tok-num">${formatTokensCompact(val)}</span><div class="tok-bar"><div class="tok-bar-fill" style="width:${pct}%"></div></div></div>`;
  }

  const headers = ['시작 시각', '소요 시간', '스킬', '제목', '생성물', '총 사용', '총 캐시', '메인 사용', '메인 캐시', '서브에이전트'];
  const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const rows = buildInvTableRows(slice, artifactCell, tokCell, null);

  tableWrap.innerHTML = `<table class="skill-inv-table">${thead}<tbody>${rows}</tbody></table>`;

  tableWrap.querySelectorAll('tr[data-window-index]').forEach(tr => {
    tr.addEventListener('click', () => {
      const idx = parseInt(tr.getAttribute('data-window-index'), 10);
      openSkillInvocationModal(idx);
    });
  });
}

function openSkillInvocationModal(idx) {
  const modal = document.getElementById('skill-invocation-modal');
  if (!modal) return;
  const w = __skillInvData[idx];
  if (!w) return;

  const body = modal.querySelector('.modal-body');
  if (!body) return;

  const closeReasonLabels = {
    explicit: '명시 종료',
    plain_prompt: '일반 프롬프트',
    next_skill: '다음 스킬',
    attribution_drop: 'attribution 변경',
    session_end: '세션 종료',
    in_progress: '🔴 진행 중',
  };
  const closeReason = w.close_reason || 'session_end';
  const closeLabel = closeReasonLabels[closeReason] || escapeHtml(closeReason);

  const skillName = w.skill || '—';
  const hue = skillColor(skillName);
  const artifactKind = w.artifact_kind || 'none';
  const artifactId = w.artifact_id || '-';

  const kindMap = { issue: 'art-issue', 'patch-note': 'art-doc', roadmap: 'art-doc' };
  const artCls = kindMap[artifactKind] || 'art-doc';
  const artTag = (artifactKind !== 'none' && artifactId !== '-')
    ? `<span class="art-tag ${artCls}">${escapeHtml(artifactId)}</span>`
    : '';

  // Stat values
  const totalRec = w.total || {};
  const totalUsage = (totalRec.input || 0) + (totalRec.output || 0);
  const totalCache = (totalRec.cache_creation_5m || 0) + (totalRec.cache_creation_1h || 0) + (totalRec.cache_read || 0);
  const totalCost = totalRec.cost_usd != null ? totalRec.cost_usd : 0;
  const durSec = w.duration_sec || 0;

  const startShort = (w.start_timestamp || '').replace('T', ' ').replace(/\..+/, '').replace(/Z$/, '');
  const endShort = (w.end_timestamp || '').replace('T', ' ').replace(/\..+/, '').replace(/Z$/, '');

  // Channel bar data
  const chInput = totalRec.input || 0;
  const chOutput = totalRec.output || 0;
  const ch5m = totalRec.cache_creation_5m || 0;
  const ch1h = totalRec.cache_creation_1h || 0;
  const chRead = totalRec.cache_read || 0;
  const chTotal = chInput + chOutput + ch5m + ch1h + chRead;
  function pctW(v) { return chTotal > 0 ? ((v / chTotal) * 100).toFixed(1) : '0'; }
  const channelColors = {
    input: '#3b82f6',
    output: '#60a5fa',
    cache_5m: '#a855f7',
    cache_1h: '#7c3aed',
    cache_read: '#c084fc',
  };
  const channelBar = `
    <div class="channel-bar">
      <div class="channel-seg" style="width:${pctW(chInput)}%;background:${channelColors.input}" title="input ${fmtNum(chInput)}"></div>
      <div class="channel-seg" style="width:${pctW(chOutput)}%;background:${channelColors.output}" title="output ${fmtNum(chOutput)}"></div>
      <div class="channel-seg" style="width:${pctW(ch5m)}%;background:${channelColors.cache_5m}" title="cache_write_5m ${fmtNum(ch5m)}"></div>
      <div class="channel-seg" style="width:${pctW(ch1h)}%;background:${channelColors.cache_1h}" title="cache_write_1h ${fmtNum(ch1h)}"></div>
      <div class="channel-seg" style="width:${pctW(chRead)}%;background:${channelColors.cache_read}" title="cache_read ${fmtNum(chRead)}"></div>
    </div>
    <div class="channel-legend">
      <span class="channel-legend-chip" style="--ch-color:${channelColors.input}">input</span>
      <span class="channel-legend-chip" style="--ch-color:${channelColors.output}">output</span>
      <span class="channel-legend-chip" style="--ch-color:${channelColors.cache_5m}">cache_5m</span>
      <span class="channel-legend-chip" style="--ch-color:${channelColors.cache_1h}">cache_1h</span>
      <span class="channel-legend-chip" style="--ch-color:${channelColors.cache_read}">cache_read</span>
    </div>
  `;

  // Per-channel table rows
  function tokenCells(rec) {
    if (!rec) return '<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>';
    const usageSum = (rec.input || 0) + (rec.output || 0);
    const cacheSum = (rec.cache_creation_5m || 0) + (rec.cache_creation_1h || 0) + (rec.cache_read || 0);
    return [
      rec.messages != null ? fmtNum(rec.messages) : '—',
      rec.input != null ? fmtNum(rec.input) : '—',
      rec.output != null ? fmtNum(rec.output) : '—',
      rec.cache_creation_5m != null ? fmtNum(rec.cache_creation_5m) : '—',
      rec.cache_creation_1h != null ? fmtNum(rec.cache_creation_1h) : '—',
      rec.cache_read != null ? fmtNum(rec.cache_read) : '—',
      rec.cost_usd != null ? `$${rec.cost_usd.toFixed(4)}` : '—',
      formatTokensCompact(usageSum),
      formatTokensCompact(cacheSum),
    ].map(v => `<td>${v}</td>`).join('');
  }

  const agentMap = w.by_agent || {};
  const agentRows = Object.entries(agentMap).map(([name, rec]) => {
    const aHue = skillColor(name);
    return `<tr><td><span class="skill-chip" style="--skill-hue:${aHue}">${escapeHtml(name)}</span></td>${tokenCells(rec)}</tr>`;
  }).join('');

  // Agent viz section
  const agentEntries = Object.entries(agentMap);
  let agentsSection = '';
  if (agentEntries.length > 0) {
    const agentStats = agentEntries.map(([name, rec]) => {
      const usage = (rec.input || 0) + (rec.output || 0);
      const cache = (rec.cache_creation_5m || 0) + (rec.cache_creation_1h || 0) + (rec.cache_read || 0);
      const total = usage + cache;
      const cost = rec.cost_usd != null ? rec.cost_usd : 0;
      return { name, usage, cache, total, cost };
    });
    agentStats.sort((a, b) => b.total - a.total);
    const maxUsage = Math.max(...agentStats.map(a => a.usage));
    const maxCache = Math.max(...agentStats.map(a => a.cache));
    const agentRowsViz = agentStats.map(({ name, usage, cache, total, cost }) => {
      const aHue = skillColor(name);
      const usagePct = maxUsage > 0 ? ((usage / maxUsage) * 100).toFixed(1) : '0';
      const cachePct = maxCache > 0 ? ((cache / maxCache) * 100).toFixed(1) : '0';
      return `
        <div class="agent-row">
          <div class="agent-row-head">
            <span class="agent-pill" style="--agent-hue:${aHue}">${escapeHtml(name)}</span>
            <span class="agent-row-total">${formatTokensCompact(total)} 토큰 · $${cost.toFixed(4)}</span>
          </div>
          <div class="agent-row-bars">
            <div class="bar-row">
              <span class="bar-label">사용</span>
              <div class="bar-track"><div class="bar-fill bar-fill-usage" style="width:${usagePct}%"></div></div>
              <span class="bar-num">${formatTokensCompact(usage)}</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">캐시</span>
              <div class="bar-track"><div class="bar-fill bar-fill-cache" style="width:${cachePct}%"></div></div>
              <span class="bar-num">${formatTokensCompact(cache)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
    agentsSection = `
      <div class="modal-agents-section">
        <h4>서브 에이전트별 사용량</h4>
        <div class="agent-row-list">${agentRowsViz}</div>
      </div>
    `;
  }

  const lastSeenRow = w.last_seen_timestamp
    ? `<div><dt>마지막 활동</dt><dd>${escapeHtml(w.last_seen_timestamp)}</dd></div>`
    : '';

  body.innerHTML = `
    <div class="modal-hero">
      <span class="skill-chip skill-chip-hue" style="--skill-hue:${hue}">${escapeHtml(skillName)}</span>
      ${artTag}
      <span class="modal-close-reason close-${escapeHtml(closeReason)}">${closeLabel}</span>
    </div>
    <pre class="modal-title-prompt">${escapeHtml(w.title_prompt || '')}</pre>

    <div class="modal-stats">
      <div class="stat-card stat-usage">
        <div class="stat-label">총 사용 토큰</div>
        <div class="stat-value">${formatTokensCompact(totalUsage)}</div>
        <div class="stat-sub">${fmtNum(totalUsage)} 개</div>
      </div>
      <div class="stat-card stat-cache">
        <div class="stat-label">총 캐시 토큰</div>
        <div class="stat-value">${formatTokensCompact(totalCache)}</div>
        <div class="stat-sub">${fmtNum(totalCache)} 개</div>
      </div>
      <div class="stat-card stat-duration">
        <div class="stat-label">소요 시간</div>
        <div class="stat-value">${formatDurationSec(durSec)}</div>
        <div class="stat-sub">${escapeHtml(startShort)} → ${escapeHtml(endShort)}</div>
      </div>
      <div class="stat-card stat-cost">
        <div class="stat-label">추정 비용</div>
        <div class="stat-value">$${totalCost.toFixed(4)}</div>
      </div>
    </div>

    ${channelBar}

    ${agentsSection}

    <h4 style="margin:12px 0 4px;font-size:12px;color:var(--muted)">토큰 채널 분해</h4>
    <table class="modal-token-table">
      <thead><tr><th>채널</th><th>messages</th><th>input</th><th>output</th><th>cache_5m</th><th>cache_1h</th><th>cache_read</th><th>cost</th><th>사용 합</th><th>캐시 합</th></tr></thead>
      <tbody>
        <tr class="modal-row-total"><td>총합</td>${tokenCells(w.total)}</tr>
        <tr><td>메인 세션</td>${tokenCells(w.main_session)}</tr>
        ${agentRows}
      </tbody>
    </table>

    <details class="modal-session-footer">
      <summary>세션 메타</summary>
      <dl class="modal-session-dl">
        <div><dt>세션 ID</dt><dd>${escapeHtml(w.session_id || '—')}</dd></div>
        <div><dt>시작</dt><dd>${escapeHtml(w.start_timestamp || '—')}</dd></div>
        <div><dt>종료</dt><dd>${escapeHtml(w.end_timestamp || '—')}</dd></div>
        <div><dt>종료 사유</dt><dd>${closeLabel}</dd></div>
        ${lastSeenRow}
      </dl>
    </details>
  `;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeSkillInvocationModal() {
  const modal = document.getElementById('skill-invocation-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function loadSkillInvocations(data) {
  __skillInvData = (data.by_skill_invocation || [])
    .slice()
    .sort((a, b) => (b.start_timestamp || '').localeCompare(a.start_timestamp || ''));
  __skillInvPage = 1;
  renderSkillInvocations();
}

// ---------- Orchestration ----------

let _aggregateCache = null;
let _hourlyCache = null;
let _pickerState = { left: null, right: null };
let _allWeeklyKeys = [];

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

function computeRealtimeWindows(now, hoursBack) {
  if (!hoursBack) {
    return { baseStart: now - 5 * 24 * 3600 * 1000, baseEnd: now, compareStart: null, compareEnd: null };
  }
  const windowMs = hoursBack * 3600 * 1000;
  return {
    baseStart: now - windowMs,
    baseEnd: now,
    compareStart: now - 2 * windowMs,
    compareEnd: now - windowMs,
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

function updateLastRefreshDisplay() {
  const el = document.getElementById('last-refresh-time');
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  el.textContent = `마지막 새로고침: ${hh}:${mm}:${ss}`;
}

// ---------- Weekly picker functions ----------

async function loadWeekly(weekKey) {
  return loadPeriodData('weekly', weekKey);
}

async function listWeeklyKeys() {
  const agg = await loadAggregate();
  const pi = (agg.periods_index || {});
  const keys = (pi.weekly || []).slice().sort().reverse();
  return keys;
}

function weekDropdownLabel(weekKey, allKeys) {
  const m = weekKey.match(/^(\d{4})-W(\d+)$/);
  if (!m) return weekKey;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  const monday = isoWeekToDate(year, week);
  const md = String(monday.getUTCMonth() + 1);
  const dd = String(monday.getUTCDate());
  const idx = allKeys.indexOf(weekKey);
  if (idx === 0) return `이번 주 (${weekKey})`;
  if (idx === 1) return `지난 주 (${weekKey})`;
  return `${weekKey} (${md}월 ${dd}일 주)`;
}

function renderCustomDropdown(rootEl, options, selectedKey, onChange) {
  if (!rootEl) return;
  const toggle = rootEl.querySelector('.cdrop-toggle');
  const menu = rootEl.querySelector('.cdrop-menu');
  if (!toggle || !menu) return;

  const selectedOpt = options.find(o => o.value === selectedKey) || options[0];

  const newToggle = toggle.cloneNode(false);
  newToggle.textContent = selectedOpt ? selectedOpt.label : '—';
  toggle.parentNode.replaceChild(newToggle, toggle);
  newToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = rootEl.classList.contains('is-open');
    document.querySelectorAll('.cdrop.is-open').forEach(el => el.classList.remove('is-open'));
    if (!isOpen) rootEl.classList.add('is-open');
  });

  const newMenu = menu.cloneNode(false);
  menu.parentNode.replaceChild(newMenu, menu);
  options.forEach((opt) => {
    const li = document.createElement('li');
    li.className = 'cdrop-item' + (opt.value === selectedKey ? ' is-active' : '');
    li.setAttribute('role', 'option');
    li.setAttribute('tabindex', '-1');
    li.dataset.value = opt.value;
    li.textContent = opt.label;
    li.addEventListener('click', () => {
      rootEl.classList.remove('is-open');
      if (opt.value !== selectedKey) {
        onChange(opt.value);
      }
    });
    newMenu.appendChild(li);
  });

  newMenu.addEventListener('keydown', (e) => {
    const items = Array.from(newMenu.querySelectorAll('.cdrop-item'));
    const focused = document.activeElement;
    const idx = items.indexOf(focused);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[idx + 1] || items[0];
      next && next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[idx - 1] || items[items.length - 1];
      prev && prev.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      focused && focused.click();
    } else if (e.key === 'Escape') {
      rootEl.classList.remove('is-open');
      newToggle.focus();
    }
  });
}

function enforceLeftRightOrder(state, allKeys) {
  if (!state.right || !state.left) return;
  if (state.right >= state.left) {
    const pastKeys = allKeys.filter(k => k < state.left);
    state.right = pastKeys.length > 0 ? pastKeys[0] : state.left;
  }
}

async function applyWeekSelection(state) {
  const err = $('#error');
  err.hidden = true;
  try {
    const [leftData, rightData, aggregateData] = await Promise.all([
      loadWeekly(state.left),
      loadWeekly(state.right),
      loadAggregate(),
    ]);
    __lastAggregateData = aggregateData;

    $('#meta').textContent = `기간: ${state.left} vs ${state.right} | 생성일: ${shortTime(aggregateData.generated_at)}`;

    renderKpi(leftData);
    applyDeltaBadgesFromValues(computeKpiSnapshot(rightData), computeKpiSnapshot(leftData));

    const rightTotal = rightData.total || {};
    const prevCacheRows = [
      { val: (rightTotal.input || 0) + (rightTotal.output || 0) },
      { val: (rightTotal.cache_creation_5m || 0) + (rightTotal.cache_creation_1h || 0) },
      { val: rightTotal.cache_read || 0 },
    ];
    renderChartModelDonut(leftData, { prevRows: rightData.by_model || [] });
    renderChartSkillDonut(leftData, { prevRows: rightData.by_skill || [] });
    renderChartCacheDonut(leftData, { prevRows: prevCacheRows });

    renderChartAgentBar(leftData, { compareData: rightData });

    const weekDays = new Set((leftData.by_day || []).map(d => d.day));
    const weekInvocations = (aggregateData.by_skill_invocation || [])
      .filter(inv => weekDays.has((inv.start_timestamp || '').slice(0, 10)));
    loadSkillInvocations({ by_skill_invocation: weekInvocations });
    renderChartPromptBar(leftData, weekInvocations);

    renderChartDayTokens(aggregateData, { skillCountsByDay: computeSkillCountByDay(aggregateData.by_skill_invocation || []), periodMode: __periodMode.dayTokens });
    renderChartDayCost(aggregateData, { periodMode: __periodMode.dayCost });

    updateLastRefreshDisplay();
  } catch (e) {
    err.hidden = false;
    err.textContent = `주간 데이터 로딩 실패: ${e.message}`;
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
    await applyWeekSelection(_pickerState);
  } catch (e) {
    const err = $('#error');
    err.hidden = false;
    err.textContent = `${e.message} — static mode 일 가능성 (serve.py 가 아니라 단순 static 서버). 수동 'python3 monitoring/scripts/collect.py' 후 페이지 리로드 필요.`;
  } finally {
    btn.disabled = false;
    btn.textContent = '새로고침';
  }
}

function setupPeriodToggles() {
  document.querySelectorAll('.period-toggle').forEach(toggleEl => {
    toggleEl.querySelectorAll('button[data-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleEl.querySelectorAll('button[data-period]').forEach(b => b.setAttribute('data-active', 'false'));
        btn.setAttribute('data-active', 'true');
        const target = toggleEl.dataset.target;
        __periodMode[target] = btn.dataset.period;
        if (!__lastAggregateData) return;
        if (target === 'dayTokens') {
          renderChartDayTokens(__lastAggregateData, {
            skillCountsByDay: computeSkillCountByDay(__lastAggregateData.by_skill_invocation || []),
            periodMode: __periodMode.dayTokens,
          });
        } else if (target === 'dayCost') {
          renderChartDayCost(__lastAggregateData, { periodMode: __periodMode.dayCost });
        }
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setupPeriodToggles();
  $('#refresh-btn').addEventListener('click', refresh);

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-modal]')) {
      closeSkillInvocationModal();
    }
    if (!e.target.closest('.cdrop')) {
      document.querySelectorAll('.cdrop.is-open').forEach(el => el.classList.remove('is-open'));
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('skill-invocation-modal');
      if (modal && !modal.classList.contains('hidden')) {
        closeSkillInvocationModal();
      }
    }
  });

  try {
    const allKeys = await listWeeklyKeys();
    _allWeeklyKeys = allKeys;

    _pickerState.left = allKeys[0] || null;
    _pickerState.right = allKeys[1] || allKeys[0] || null;

    function buildLeftOptions() {
      return allKeys.map(k => ({ value: k, label: weekDropdownLabel(k, allKeys) }));
    }

    function buildRightOptions(leftKey) {
      const past = allKeys.filter(k => k < leftKey);
      return past.map(k => ({ value: k, label: weekDropdownLabel(k, allKeys) }));
    }

    const leftEl = document.getElementById('week-picker-left');
    const rightEl = document.getElementById('week-picker-right');

    function rebuildDropdowns() {
      renderCustomDropdown(leftEl, buildLeftOptions(), _pickerState.left, (newKey) => {
        _pickerState.left = newKey;
        enforceLeftRightOrder(_pickerState, allKeys);
        rebuildDropdowns();
        applyWeekSelection(_pickerState);
      });
      renderCustomDropdown(rightEl, buildRightOptions(_pickerState.left), _pickerState.right, (newKey) => {
        _pickerState.right = newKey;
        applyWeekSelection(_pickerState);
      });
    }

    if (allKeys.length > 0) {
      rebuildDropdowns();
      await applyWeekSelection(_pickerState);
    } else {
      const err = $('#error');
      err.hidden = false;
      err.textContent = '주간 데이터 없음 — collect.py 실행 필요.';
    }
  } catch (e) {
    const err = $('#error');
    err.hidden = false;
    err.textContent = `초기 로딩 실패: ${e.message}. monitoring/data/aggregate.json 부재일 수 있음 — 'python3 monitoring/scripts/collect.py' 또는 'python3 monitoring/scripts/serve.py' 실행 필요.`;
  }
});
