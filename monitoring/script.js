'use strict';

const $ = (sel) => document.querySelector(sel);

const NUM = new Intl.NumberFormat('ko-KR');
const USD = (n) => `$${n.toFixed(2)}`;

function fmtNum(n) { return NUM.format(n || 0); }

function table(headers, rows) {
  const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

function renderTotals(t) {
  const items = [
    ['메시지', fmtNum(t.messages)],
    ['Input', fmtNum(t.input)],
    ['Output', fmtNum(t.output)],
    ['Cache write (5m)', fmtNum(t.cache_creation_5m)],
    ['Cache write (1h)', fmtNum(t.cache_creation_1h)],
    ['Cache read', fmtNum(t.cache_read)],
    ['추정 비용', USD(t.cost_usd || 0)],
  ];
  return items.map(([k, v]) => `<div class="card"><div class="card-label">${k}</div><div class="card-val">${v}</div></div>`).join('');
}

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
    ['일자', 'messages', 'input', 'output', 'cache write 5m', 'cache write 1h', 'cache read'],
    rows.map(r => [
      r.day, fmtNum(r.messages), fmtNum(r.input), fmtNum(r.output),
      fmtNum(r.cache_creation_5m), fmtNum(r.cache_creation_1h), fmtNum(r.cache_read),
    ]),
  );
}

function shortSha(s) { return (s || '').slice(0, 8); }
function shortTime(s) { return (s || '').replace('T', ' ').replace(/\..+/, ''); }

function renderBySession(rows) {
  return table(
    ['session', '시작', '종료', '주 모델', '메시지', 'skills', 'cost (모델별 분배 X)'],
    rows.slice(0, 50).map(r => [
      shortSha(r.session_id),
      shortTime(r.first_timestamp),
      shortTime(r.last_timestamp),
      r.model_primary || '?',
      fmtNum(r.tokens.messages),
      (r.skills || []).filter(s => s !== '(no-skill)').join(', ') || '<i>(no-skill)</i>',
      '—',
    ]),
  );
}

async function load() {
  const r = await fetch('data/aggregate.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(`failed to load aggregate.json: ${r.status}`);
  return r.json();
}

function render(data) {
  $('#meta').textContent = `생성일: ${shortTime(data.generated_at)} | 처리된 세션: ${data.files_processed}`;
  if (data.error) {
    const err = $('#error');
    err.hidden = false;
    err.textContent = data.error;
    return;
  }
  $('#totals').innerHTML = renderTotals(data.total);
  $('#by-model').innerHTML = renderByModel(data.by_model);
  $('#by-skill').innerHTML = renderBySkill(data.by_skill);
  $('#by-day').innerHTML = renderByDay(data.by_day);
  $('#by-session').innerHTML = renderBySession(data.by_session);
}

async function refresh() {
  $('#refresh-btn').disabled = true;
  $('#refresh-btn').textContent = '갱신 중...';
  try {
    const r = await fetch('/api/refresh', { method: 'POST' });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`refresh failed: ${r.status} ${body}`);
    }
    const data = await load();
    render(data);
  } catch (e) {
    const err = $('#error');
    err.hidden = false;
    err.textContent = `${e.message} — static mode 일 가능성 (serve.py 가 아니라 단순 static 서버). 수동 'python3 monitoring/scripts/collect.py' 후 페이지 리로드 필요.`;
  } finally {
    $('#refresh-btn').disabled = false;
    $('#refresh-btn').textContent = '새로고침';
  }
}

$('#refresh-btn').addEventListener('click', refresh);

load().then(render).catch((e) => {
  const err = $('#error');
  err.hidden = false;
  err.textContent = `초기 로딩 실패: ${e.message}. monitoring/data/aggregate.json 부재일 수 있음 — 'python3 monitoring/scripts/collect.py' 또는 'python3 monitoring/scripts/serve.py' 실행 필요.`;
});
