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

function table(headers, rows) {
  const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
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
      `<div class="cost-model-row"><span class="lbl">${m.model}</span><span class="val">${USD(m.cost_usd || 0)}</span></div>`
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

function applyDeltaBadges(data) {
  const SNAPSHOT_KEY = 'monitoring:last-snapshot';
  const t = data.total || {};
  const cwrite = (t.cache_creation_5m || 0) + (t.cache_creation_1h || 0);
  const cread = t.cache_read || 0;
  const cacheHitRatio = (cwrite + cread) > 0 ? (cread / (cwrite + cread)) * 100 : 0;

  const current = {
    messages: t.messages || 0,
    noncache: (t.input || 0) + (t.output || 0),
    cache: cwrite + cread,
    cache_hit_ratio: cacheHitRatio,
    cost_usd: t.cost_usd || 0,
  };

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

  const raw = localStorage.getItem(SNAPSHOT_KEY);
  if (raw) {
    try {
      const snap = JSON.parse(raw);
      if (snap.saved_at !== data.generated_at) {
        const prev = snap.values || {};
        setBadge('kpi-delta-msgs', current.messages - (prev.messages || 0), (v) => fmtKMB(v));
        setBadge('kpi-delta-noncache', current.noncache - (prev.noncache || 0), (v) => fmtKMB(v));
        setBadge('kpi-delta-cache', current.cache - (prev.cache || 0), (v) => fmtKMB(v));
        setBadge('kpi-delta-cache-hit-ratio', current.cache_hit_ratio - (prev.cache_hit_ratio || 0), (v) => `${v.toFixed(1)}%p`);
        setBadge('kpi-delta-cost', current.cost_usd - (prev.cost_usd || 0), (v) => `$${v.toFixed(2)}`);
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

function renderChartDayTokens(data) {
  destroyChart('dayTokens');
  const days = (data.by_day || []);
  const labels = days.map(d => d.day);
  const ctx = $('#chart-day-tokens canvas');
  if (!ctx || !days.length) return;
  charts.dayTokens = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'input', data: days.map(d => d.input || 0), borderColor: COLORS.input, backgroundColor: COLORS.input + '66', stack: 's', fill: 'origin' },
        { label: 'output', data: days.map(d => d.output || 0), borderColor: COLORS.output, backgroundColor: COLORS.output + '66', stack: 's', fill: '-1' },
      ],
    },
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

function renderChartModelDonut(data) {
  destroyChart('modelDonut');
  const rows = (data.by_model || []).slice();
  const ctx = $('#chart-model-donut canvas');
  if (!ctx || !rows.length) return;
  const labels = rows.map(r => r.model);
  const values = rows.map(r => totalTokens(r));
  charts.modelDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]) }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtNum(c.parsed)}` } },
      },
    },
    plugins: [pieLabelsPlugin],
  });
}

function renderChartSkillDonut(data) {
  destroyChart('skillDonut');
  const rows = (data.by_skill || []).slice().sort((a, b) => totalTokens(b) - totalTokens(a));
  const ctx = $('#chart-skill-donut canvas');
  if (!ctx || !rows.length) return;
  const top = rows.slice(0, 8);
  const others = rows.slice(8);
  const labels = top.map(r => r.skill);
  const values = top.map(r => totalTokens(r));
  if (others.length) {
    labels.push('기타');
    values.push(others.reduce((a, r) => a + totalTokens(r), 0));
  }
  charts.skillDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]) }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtNum(c.parsed)}` } },
      },
    },
    plugins: [pieLabelsPlugin],
  });
}

function renderChartCacheDonut(data) {
  destroyChart('cacheDonut');
  const t = data.total || {};
  const noncache = (t.input || 0) + (t.output || 0);
  const cwrite = (t.cache_creation_5m || 0) + (t.cache_creation_1h || 0);
  const cread = t.cache_read || 0;
  const ctx = $('#chart-cache-donut canvas');
  if (!ctx) return;
  charts.cacheDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['non-cache (input+output)', 'cache write', 'cache read'],
      datasets: [{ data: [noncache, cwrite, cread], backgroundColor: [COLORS.noncache, COLORS.cacheWrite, COLORS.cacheRead] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtNum(c.parsed)}` } },
      },
    },
    plugins: [pieLabelsPlugin],
  });
}

function renderChartSessionBar(data) {
  destroyChart('sessionBar');
  const rows = (data.by_session || [])
    .filter(s => (s.tokens && s.tokens.messages) > 0)
    .slice()
    .sort((a, b) => totalTokens(b.tokens) - totalTokens(a.tokens))
    .slice(0, 10);
  const ctx = $('#chart-session-bar canvas');
  if (!ctx || !rows.length) return;
  charts.sessionBar = new Chart(ctx, {
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
      r.model, fmtNum(r.messages), fmtNum(r.input), fmtNum(r.output),
      fmtNum(r.cache_creation_5m), fmtNum(r.cache_creation_1h), fmtNum(r.cache_read),
      USD(r.cost_usd || 0),
    ]),
  );
}

function renderBySkill(rows) {
  return table(
    ['스킬', 'messages', 'input', 'output', 'cache write 5m', 'cache write 1h', 'cache read'],
    rows.map(r => [
      r.skill, fmtNum(r.messages), fmtNum(r.input), fmtNum(r.output),
      fmtNum(r.cache_creation_5m), fmtNum(r.cache_creation_1h), fmtNum(r.cache_read),
    ]),
  );
}

function renderByDay(rows) {
  return table(
    ['일자', 'messages', 'input', 'output', 'cache write 5m', 'cache write 1h', 'cache read', '비용'],
    rows.map(r => [
      r.day, fmtNum(r.messages), fmtNum(r.input), fmtNum(r.output),
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
      r.model_primary || '?',
      fmtNum(r.tokens.messages),
      (r.skills || []).filter(s => s !== '(no-skill)').join(', ') || '<i>(no-skill)</i>',
    ]),
  );
}

// ---------- Orchestration ----------

let _aggregateCache = null;

async function loadAggregate() {
  if (_aggregateCache) return _aggregateCache;
  const r = await fetch('data/aggregate.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(`failed to load aggregate.json: ${r.status}`);
  _aggregateCache = await r.json();
  return _aggregateCache;
}

async function loadPeriodData(unit, key) {
  const r = await fetch(`data/periods/${unit}/${key}.json`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`failed to load period data: ${unit}/${key} (${r.status})`);
  return r.json();
}

function updateUrl(unit, key) {
  const params = new URLSearchParams();
  if (unit && unit !== 'all') {
    params.set('period', unit);
    if (key) params.set('key', key);
  }
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function renderAll(data) {
  renderKpi(data);
  renderChartDayTokens(data);
  renderChartModelDonut(data);
  renderChartSkillDonut(data);
  renderChartCacheDonut(data);
  renderChartSessionBar(data);
  renderChartDayCost(data);

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
  if (!unit || unit === 'all') {
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
  keyEl.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('');
  keyEl.disabled = false;
}

async function applyPeriodSelection(unit, key) {
  const err = $('#error');
  err.hidden = true;
  try {
    if (!unit || unit === 'all') {
      const data = await loadAggregate();
      $('#meta').textContent = `생성일: ${shortTime(data.generated_at)} | 처리된 세션: ${data.files_processed}`;
      renderAll(data);
      applyDeltaBadges(data);
      updateUrl('all', null);
    } else {
      const data = await loadPeriodData(unit, key);
      const agg = await loadAggregate();
      $('#meta').textContent = `기간: ${key} | 생성일: ${shortTime(agg.generated_at)}`;
      clearDeltaBadges();
      renderAll(data);
      updateUrl(unit, key);
    }
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

    unitEl.value = initUnit;
    populatePeriodKeys(periodsIndex, initUnit);

    if (initUnit !== 'all' && initKey) {
      const validKeys = (periodsIndex[initUnit] || []);
      if (validKeys.includes(initKey)) {
        keyEl.value = initKey;
      } else {
        unitEl.value = 'all';
        populatePeriodKeys(periodsIndex, 'all');
      }
    }

    unitEl.addEventListener('change', () => {
      const unit = unitEl.value;
      populatePeriodKeys(periodsIndex, unit);
      if (unit === 'all') {
        applyPeriodSelection('all', null);
      } else {
        const key = keyEl.value;
        if (key) applyPeriodSelection(unit, key);
      }
    });

    keyEl.addEventListener('change', () => {
      const unit = unitEl.value;
      const key = keyEl.value;
      if (unit !== 'all' && key) applyPeriodSelection(unit, key);
    });

    const currentUnit = unitEl.value;
    const currentKey = keyEl.value;
    if (currentUnit !== 'all' && currentKey) {
      await applyPeriodSelection(currentUnit, currentKey);
    } else {
      render(agg);
    }
  } catch (e) {
    const err = $('#error');
    err.hidden = false;
    err.textContent = `초기 로딩 실패: ${e.message}. monitoring/data/aggregate.json 부재일 수 있음 — 'python3 monitoring/scripts/collect.py' 또는 'python3 monitoring/scripts/serve.py' 실행 필요.`;
  }
});
