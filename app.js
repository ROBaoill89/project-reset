'use strict';
/* Project Reset — all data stays in this browser's local storage. No network calls. */

const KEY = 'pr.state.v1';
const AREAS = [
  { id: '01', name: 'iPhone & Digital Life', short: 'Digital', words: /iphone|digital/ },
  { id: '02', name: 'ADHD & Habits', short: 'Habits', words: /adhd|habit/ },
  { id: '03', name: 'Home & Life Admin', short: 'Home', words: /home|admin/ },
  { id: '04', name: 'Health & Sleep', short: 'Health & Sleep', words: /health|sleep/ },
  { id: '05', name: 'Money & Future', short: 'Money & Future', words: /money|future|financ/ },
  { id: '06', name: 'Relationships & Growth', short: 'Relationships', words: /relationship|growth/ }
];
const STAGES = ['Stabilise', 'Buffer', 'Build', 'Long term'];
const REVIEW = [
  'What went well?',
  'What got in the way?',
  'Anything urgent?',
  'Is the main priority still right?',
  'Parking Lot check',
  'One focus for next week'
];
const ASK_COMMANDS = ['Next', 'Stuck', 'Low energy', 'Review'];
const KEEP_REPORTS = 5;
const KEEP_REVIEWS = 12;

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nice = s => s ? new Date(s + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const areaDef = id => AREAS.find(a => a.id === id);
const area = id => state.areas.find(a => a.id === id);
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInstalled = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

/* ---------- state ---------- */
function defaults() {
  return {
    v: 1,
    priority: '', next: '', starter: '', energy: 'medium',
    minDay: { items: [], date: '', done: [] },
    areas: AREAS.map(a => ({
      id: a.id, status: '', next: '', mode: 'maintenance', updated: '',
      ...(a.id === '05' ? { stage: 1 } : {}), ...(a.id === '06' ? { theme: '' } : {})
    })),
    reports: {}, parking: [], wins: [], reviews: [], reviewDraft: null,
    urgent: '', canWait: '', carry: '',
    settings: { links: {}, prefill: false }
  };
}
function normalise(s) {
  const d = defaults();
  const o = { ...d, ...s };
  o.minDay = { ...d.minDay, ...(s.minDay || {}) };
  o.settings = { ...d.settings, ...(s.settings || {}) };
  o.settings.links = { ...(o.settings.links || {}) };
  o.areas = d.areas.map(a => ({ ...a, ...((s.areas || []).find(x => x.id === a.id) || {}) }));
  o.reports = { ...(s.reports || {}) };
  for (const k of ['parking', 'wins', 'reviews']) if (!Array.isArray(o[k])) o[k] = [];
  return o;
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return normalise(s);
  } catch (e) { /* fall through to a fresh start */ }
  return defaults();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save on this device'); }
}
let state = load();

/* Minimum Day resets each day. No history is kept. */
function rollDay() {
  if (state.minDay.date !== iso()) {
    state.minDay.date = iso();
    state.minDay.done = [];
    save();
  }
}

/* ---------- toast + sheet ---------- */
let toastTimer;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${h(msg)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  if (undo) t.querySelector('button').onclick = () => { undo(); t.classList.remove('show'); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), undo ? 6000 : 2600);
}
const sheet = $('#sheet');
function openSheet(html) {
  $('#sheetBody').innerHTML = html;
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });

const fld = (label, name, value, o = {}) => `<label class="field"><span>${h(label)}</span>${
  o.area
    ? `<textarea name="${name}" rows="${o.rows || 3}" placeholder="${h(o.ph || '')}">${h(value)}</textarea>`
    : `<input type="${o.type || 'text'}" name="${name}" value="${h(value)}" placeholder="${h(o.ph || '')}" autocomplete="off">`
}</label>`;
const sheetButtons = (label = 'Save') => `<div class="stack mt">
  <button class="btn primary" type="submit">${h(label)}</button>
  <button class="btn plain" type="button" data-act="close">Cancel</button></div>`;

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      (sheet.open ? sheet : document.body).appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e2) { return false; }
  }
}

/* ---------- text builders ---------- */
const dash = s => (s && String(s).trim()) || '—';
function winsThisWeek() {
  const from = new Date(); from.setDate(from.getDate() - 6);
  const cut = iso(from);
  return state.wins.filter(w => w.date >= cut);
}
function minDayLine() {
  const m = state.minDay;
  if (!m.items.length) return '—';
  return `${m.items.map(i => i.text).join('; ')} (${m.done.length}/${m.items.length} done today)`;
}
function areaLine(a) {
  const bits = [dash(a.status)];
  if (a.next) bits.push('next: ' + a.next);
  bits.push(a.mode === 'active' ? 'Active' : 'Maintenance');
  return bits.join(' | ');
}
function buildStatus() {
  rollDay();
  const s = state, A = id => area(id);
  const next = s.next ? s.next + (s.starter ? ` (starter: ${s.starter})` : '') : '—';
  return [
    `COMMAND CENTRE STATUS — ${nice(iso())}`,
    `Main priority: ${dash(s.priority)}`,
    `Next action (+ starter step): ${next}`,
    `Minimum day: ${minDayLine()}`,
    `Area snapshot (one line each):`,
    `  01 Digital: ${areaLine(A('01'))}`,
    `  02 Habits: ${areaLine(A('02'))}`,
    `  03 Home: ${areaLine(A('03'))}`,
    `  04 Health & Sleep: ${areaLine(A('04'))}`,
    `  05 Money & Future (stage ${A('05').stage} ${STAGES[A('05').stage - 1]}): ${areaLine(A('05'))}`,
    `  06 Relationships (theme: ${dash(A('06').theme)}): ${areaLine(A('06'))}`,
    `Urgent / deadlines: ${dash(s.urgent)}`,
    `Can wait: ${dash(s.canWait)}`,
    `Parking Lot: ${dash(s.parking.map(p => p.text).join('; '))}`,
    `Wins this week: ${dash(winsThisWeek().map(w => w.text).join('; '))}`,
    `Carry forward / open questions: ${dash(s.carry)}`
  ].join('\n');
}
function buildArea(id) {
  const a = area(id), d = areaDef(id), rep = (state.reports[id] || [])[0];
  const out = [
    `AREA STATUS — ${id} ${d.name} — ${nice(iso())}`,
    `Mode: ${a.mode === 'active' ? 'Active' : 'Maintenance'}`
  ];
  if (id === '05') out.push(`Stage: ${a.stage} ${STAGES[a.stage - 1]}`);
  if (id === '06') out.push(`Theme: ${dash(a.theme)}`);
  out.push(`Status: ${dash(a.status)}`, `Next action: ${dash(a.next)}`, `Last updated: ${dash(nice(a.updated))}`);
  out.push(rep ? `Latest report (${nice(rep.date)}):\n${rep.text}` : 'Latest report: —');
  return out.join('\n');
}

/* ---------- report detection ---------- */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function detectReport(text) {
  const head = text.slice(0, 500);
  const m = head.match(/REPORT\s+FROM\s*[:\-–—]?\s*\[?\s*([^\]\n]*)/i);
  const hay = (m ? m[1] : head).toLowerCase();
  let areaId = (AREAS.find(a => a.words.test(hay)) || {}).id || '';
  if (!areaId) {
    const n = hay.match(/^\s*(?:area\s*)?0?([1-6])\b/);
    if (n) areaId = '0' + n[1];
  }
  let date = '', d;
  const ok = (y, mo, da) => (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) ? `${y}-${pad(mo)}-${pad(da)}` : '';
  if ((d = head.match(/\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/))) date = ok(d[1], +d[2], +d[3]);
  else if ((d = head.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d\d)\b/))) date = ok(d[3], +d[2], +d[1]); // day first
  else if ((d = head.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?,?\s+(20\d\d)\b/))) date = ok(d[3], MONTHS.indexOf(d[2].toLowerCase()) + 1, +d[1]);
  else if ((d = head.match(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d\d)\b/))) date = ok(d[3], MONTHS.indexOf(d[1].toLowerCase()) + 1, +d[2]);
  return { areaId, date };
}

/* ---------- views ---------- */
const V = {};
let afterRender = null;

V.today = () => {
  rollDay();
  const s = state, low = s.energy === 'low';
  const bars = n => `<span class="bars" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  let out = `<h1>Today</h1>
  <div class="seg" role="group" aria-label="Energy">
    ${[['low', 'Low', 1], ['medium', 'Medium', 2], ['high', 'High', 3]].map(([k, l, n]) =>
      `<button type="button" data-act="energy" data-v="${k}" aria-pressed="${s.energy === k}">${bars(n)} ${l}</button>`).join('')}
  </div>`;
  if (!isInstalled && isIOS) out += `<div class="note">You're in Safari. The Home Screen app keeps its own separate data. <a href="#settings">How to install</a></div>`;
  if (!low) {
    out += `<button class="card" data-act="editPriority">
      <div class="label">Main priority</div>
      <div class="big">${s.priority ? h(s.priority) : '<span class="muted">Tap to set</span>'}</div>
    </button>
    <section class="card">
      <button class="tap" data-act="editNext">
        <div class="label">Next action</div>
        <div class="big">${s.next ? h(s.next) : '<span class="muted">Tap to set</span>'}</div>
        ${s.starter ? `<div class="starter"><div class="label">2-minute starter</div>${h(s.starter)}</div>` : ''}
      </button>
      ${s.next ? `<button class="btn primary mt" data-act="done">✓ Done</button>` : ''}
    </section>`;
  }
  const m = s.minDay;
  out += `<section class="card">
    <div class="row"><div class="label grow">Minimum Day</div>
      <button class="btn small plain" data-act="editMinDay">${m.items.length ? 'Edit' : 'Set up'}</button></div>
    ${m.items.length ? `<ul class="checks">${m.items.map(i => {
      const on = m.done.includes(i.id);
      return `<li><button type="button" data-act="tick" data-id="${i.id}" aria-pressed="${on}">
        <span class="box" aria-hidden="true">${on ? '✓' : ''}</span><span class="txt">${h(i.text)}</span></button></li>`;
    }).join('')}</ul>` : `<p class="muted small">The few things that make a day count, even a low one.</p>`}
  </section>
  <button class="btn" data-act="ask" data-target="cc">Ask Claude</button>`;
  return out;
};

V.areas = () => `<h1>Areas</h1>` + state.areas.map(a => {
  const d = areaDef(a.id), active = a.mode === 'active';
  const extra = a.id === '05' ? `<span class="chip">Stage ${a.stage} · ${STAGES[a.stage - 1]}</span>`
    : a.id === '06' ? `<span class="chip">Theme · ${a.theme ? h(a.theme) : '—'}</span>` : '';
  return `<section class="card area">
    <div class="row"><span class="num">${a.id}</span><h2>${h(d.name)}</h2></div>
    <div class="row wrap line">
      <button class="chip ${active ? 'on' : ''}" data-act="toggleMode" data-id="${a.id}" aria-label="Mode: ${active ? 'Active' : 'Maintenance'}. Tap to change.">
        <span class="dot" aria-hidden="true"></span>${active ? 'Active' : 'Maintenance'}</button>
      ${extra}
    </div>
    <div class="line">${a.status ? h(a.status) : '<span class="muted">No status yet</span>'}</div>
    <div class="line"><div class="label">Next action</div>${a.next ? h(a.next) : '<span class="muted">—</span>'}</div>
    <div class="line muted small">${a.updated ? 'Updated ' + nice(a.updated) : 'Not updated yet'}</div>
    <div class="row actions">
      <button class="btn small" data-act="editArea" data-id="${a.id}">Edit</button>
      <button class="btn small" data-act="ask" data-target="${a.id}" aria-label="Ask Claude about ${h(d.name)}">Ask Claude</button>
    </div>
  </section>`;
}).join('');

V.park = () => `<h1>Parking Lot</h1>
  <form data-submit="addIdea" class="stack">
    <input type="text" name="text" id="ideaInput" placeholder="Park an idea…" autocomplete="off" enterkeyhint="done" aria-label="Idea">
    <button class="btn primary" type="submit">Park it</button>
  </form>
  <ul class="list mt">${state.parking.map(p => `<li>
    <div>${h(p.text)}</div>
    <div class="row">
      <span class="chip grow" style="border:0;padding-left:0">◷ Later</span>
      <button class="btn small" data-act="promote" data-id="${p.id}">↑ Promote</button>
      <button class="btn small" data-act="bin" data-id="${p.id}">✕ Bin</button>
    </div></li>`).join('')}</ul>
  ${state.parking.length ? '' : '<p class="muted mt">Nothing parked.</p>'}`;

V.more = () => `<h1>More</h1>
  <div class="stack menu">
    <a class="btn primary" href="#status">Copy Status</a>
    <a class="btn" href="#reports">Reports</a>
    <a class="btn" href="#review">Weekly Review</a>
    <a class="btn" href="#wins">Wins</a>
    <a class="btn" href="#settings">Settings &amp; backup</a>
  </div>`;

const back = `<a class="back" href="#more">‹ More</a>`;

V.status = () => `${back}<h1>Copy Status</h1>
  <button class="btn primary" data-act="copyStatus">Copy status</button>
  <pre class="block mt" id="statusPreview">${h(buildStatus())}</pre>
  <label class="field"><span>Urgent / deadlines</span><textarea rows="2" data-bind="urgent">${h(state.urgent)}</textarea></label>
  <label class="field"><span>Can wait</span><textarea rows="2" data-bind="canWait">${h(state.canWait)}</textarea></label>
  <label class="field"><span>Carry forward / open questions</span><textarea rows="2" data-bind="carry">${h(state.carry)}</textarea></label>`;

V.reports = () => {
  const lists = AREAS.map(d => {
    const rs = state.reports[d.id] || [];
    if (!rs.length) return '';
    return `<div class="label mt">${d.id} ${h(d.name)}</div><ul class="list">${rs.map((r, i) =>
      `<li><button class="tap" data-act="viewReport" data-id="${d.id}" data-i="${i}">
        <strong>${nice(r.date)}</strong><div class="muted small">${h(r.text.replace(/\s+/g, ' ').slice(0, 90))}</div></button></li>`).join('')}</ul>`;
  }).join('');
  return `${back}<h1>Reports</h1>
  <form data-submit="saveReport">
    <label class="field"><span>Paste a “REPORT FROM …” block</span>
      <textarea name="text" id="reportText" rows="6" placeholder="REPORT FROM [area] …"></textarea></label>
    <div class="row">
      <label class="field grow"><span>Area</span><select name="area" id="reportArea">
        <option value="">Choose…</option>${AREAS.map(d => `<option value="${d.id}">${d.id} ${h(d.short)}</option>`).join('')}</select></label>
      <label class="field grow"><span>Date</span><input type="date" name="date" id="reportDate" value="${iso()}"></label>
    </div>
    <p class="muted small" id="reportHint">Area and date are detected when you paste. Change them if wrong.</p>
    <button class="btn primary" type="submit">Save report</button>
  </form>
  ${lists || '<p class="muted mt">No reports saved yet.</p>'}`;
};

function draft() {
  if (!state.reviewDraft) state.reviewDraft = { step: 0, answers: ['', '', '', state.priority, '', ''] };
  return state.reviewDraft;
}
V.review = () => {
  const last = state.reviews[0];
  const lastHtml = last ? `<details class="mt"><summary>Last review · ${nice(last.date)}</summary>
    ${REVIEW.map((q, i) => `<div class="label mt">${h(q)}</div><div>${h(dash(last.answers[i]))}</div>`).join('')}</details>` : '';
  if (!state.reviewDraft) {
    return `${back}<h1>Weekly Review</h1>
      <p class="muted">Six short questions. Your answers save as you go.</p>
      <button class="btn primary" data-act="rvStart">Start review</button>${lastHtml}`;
  }
  const r = draft(), i = r.step;
  let body;
  if (i === 3) {
    body = `<p class="muted">Change it here if it isn't.</p>
      <input type="text" data-rv="3" value="${h(r.answers[3])}" aria-label="Main priority" autocomplete="off">`;
  } else if (i === 4) {
    body = `${state.parking.length ? `<ul class="list">${state.parking.map(p => `<li class="row" style="margin-top:0">
        <span class="grow">${h(p.text)}</span>
        <button class="btn small" data-act="bin" data-id="${p.id}">✕ Bin</button></li>`).join('')}</ul>` : '<p class="muted">Nothing parked.</p>'}
      <textarea rows="2" data-rv="4" placeholder="Notes (optional)">${h(r.answers[4])}</textarea>`;
  } else {
    body = `<textarea rows="4" data-rv="${i}" id="rvInput" aria-label="${h(REVIEW[i])}">${h(r.answers[i])}</textarea>`;
  }
  return `${back}<h1>Weekly Review</h1>
    <div class="progress">${i + 1} of ${REVIEW.length}</div>
    <h2 style="margin-bottom:12px">${h(REVIEW[i])}</h2>
    ${body}
    <div class="stack mt">
      <button class="btn primary" data-act="rvNext">${i === REVIEW.length - 1 ? 'Save review' : 'Next'}</button>
      ${i > 0 ? '<button class="btn" data-act="rvBack">Back</button>' : ''}
      <button class="btn plain" data-act="rvDiscard">Discard this review</button>
    </div>`;
};

V.wins = () => `${back}<h1>Wins</h1>
  <form data-submit="addWin" class="stack">
    <input type="text" name="text" id="winInput" placeholder="Add a win…" autocomplete="off" enterkeyhint="done" aria-label="Win">
    <button class="btn primary" type="submit">Add win</button>
  </form>
  <ul class="list mt">${state.wins.map(w => `<li class="row" style="margin-top:0">
    <div class="grow"><div>★ ${h(w.text)}</div><div class="muted small">${nice(w.date)}</div></div>
    <button class="btn small plain" data-act="delWin" data-id="${w.id}" aria-label="Remove win">✕</button></li>`).join('')}</ul>`;

V.settings = () => {
  const L = state.settings.links;
  const link = (k, label) => `<label class="field"><span>${h(label)}</span>
    <input type="url" inputmode="url" data-link="${k}" value="${h(L[k] || '')}" placeholder="https://claude.ai/chat/…" autocomplete="off"></label>`;
  return `${back}<h1>Settings</h1>
  <section class="card">
    <h2>Backup</h2>
    <p class="muted small mt">Everything is stored only on this device. Export now and then so you have a copy.</p>
    <div class="stack">
      <button class="btn" data-act="exportData">Export backup (JSON)</button>
      <button class="btn" data-act="importPick">Import backup…</button>
      <input type="file" id="importFile" accept=".json,application/json" hidden>
    </div>
  </section>
  <section class="card">
    <h2>Claude chat links</h2>
    <p class="muted small mt">Paste the link to each chat. “Ask Claude” then opens that chat. Leave blank to open a new chat.</p>
    ${link('cc', 'Command Centre')}
    ${AREAS.map(d => link(d.id, `${d.id} ${d.name}`)).join('')}
    <label class="check"><input type="checkbox" data-act="togglePrefill" ${state.settings.prefill ? 'checked' : ''}>
      <span>Try pre-filling new chats <span class="muted small">(experimental, only when no chat link is saved)</span></span></label>
  </section>
  <section class="card">
    <h2>Add to iPhone Home Screen</h2>
    <p class="small mt">In Safari: Share → Add to Home Screen → keep “Open as Web App” on → Add.</p>
    <p class="muted small">${isInstalled ? 'You are using the installed app.' : 'You are in a browser tab. On iPhone, the Home Screen app keeps separate data from Safari, so pick one and stick with it.'}</p>
  </section>
  <p class="muted small">Project Reset v1 · no accounts, no tracking, nothing sent anywhere.</p>`;
};

/* ---------- router ---------- */
const TABS = { today: 'today', areas: 'areas', park: 'park' };
function route() { return (location.hash.replace(/^#\/?/, '') || 'today').split('?')[0]; }
function render() {
  const r = V[route()] ? route() : 'today';
  $('#view').innerHTML = V[r]();
  const tab = TABS[r] || 'more';
  document.querySelectorAll('.tabs a').forEach(a => a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  if (afterRender) { const f = afterRender; afterRender = null; f(); }
}
addEventListener('hashchange', () => { closeSheet(); render(); scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && route() === 'today' && state.minDay.date !== iso()) render(); });

/* ---------- actions (clicks) ---------- */
const A = {};
A.close = closeSheet;

A.energy = el => { state.energy = el.dataset.v; save(); render(); };
A.editPriority = () => openSheet(`<form data-submit="priority"><h2>Main priority</h2>
  ${fld('One thing only', 'priority', state.priority)}${sheetButtons()}</form>`);
A.editNext = () => openSheet(`<form data-submit="next"><h2>Next action</h2>
  ${fld('Next action', 'next', state.next)}
  ${fld('2-minute starter step', 'starter', state.starter, { ph: 'The tiniest first move' })}${sheetButtons()}</form>`);
A.done = () => openSheet(`<form data-submit="done"><h2>✓ Done</h2>
  <label class="check"><input type="checkbox" name="win" checked><span>Add “${h(state.next)}” to Wins</span></label>
  ${fld('What’s the next action?', 'next', '')}
  ${fld('2-minute starter step', 'starter', '', { ph: 'The tiniest first move' })}
  <p class="muted small">Leave blank if you’re not sure yet.</p>${sheetButtons()}</form>`);
A.editMinDay = () => openSheet(`<form data-submit="minDay"><h2>Minimum Day</h2>
  ${fld('One item per line. Keep it short.', 'items', state.minDay.items.map(i => i.text).join('\n'), { area: true, rows: 6 })}${sheetButtons()}</form>`);
A.tick = el => {
  const d = state.minDay.done, id = el.dataset.id, i = d.indexOf(id);
  i < 0 ? d.push(id) : d.splice(i, 1);
  save(); render();
};

A.toggleMode = el => {
  const a = area(el.dataset.id);
  if (a.mode === 'active') { a.mode = 'maintenance'; save(); render(); return; }
  const active = state.areas.filter(x => x.mode === 'active');
  if (active.length < 3) { a.mode = 'active'; save(); render(); return; }
  openSheet(`<h2>3 areas are already Active</h2>
    <p class="muted">Which one moves to Maintenance?</p>
    <div class="stack">${active.map(x => `<button class="btn" data-act="swapMode" data-on="${a.id}" data-off="${x.id}">${x.id} ${h(areaDef(x.id).name)}</button>`).join('')}
    <button class="btn plain" data-act="close">Cancel</button></div>`);
};
A.swapMode = el => {
  area(el.dataset.off).mode = 'maintenance';
  area(el.dataset.on).mode = 'active';
  save(); closeSheet(); render();
};
A.editArea = el => {
  const a = area(el.dataset.id), d = areaDef(a.id);
  openSheet(`<form data-submit="area"><h2>${a.id} ${h(d.name)}</h2>
    <input type="hidden" name="id" value="${a.id}">
    ${fld('One-line status', 'status', a.status)}
    ${fld('Next action', 'next', a.next)}
    ${a.id === '05' ? `<label class="field"><span>Stage</span><select name="stage">${STAGES.map((s, i) =>
      `<option value="${i + 1}" ${a.stage === i + 1 ? 'selected' : ''}>${i + 1} · ${s}</option>`).join('')}</select></label>` : ''}
    ${a.id === '06' ? fld('Current theme', 'theme', a.theme) : ''}
    ${sheetButtons()}</form>`);
};

function addIdea(text) { state.parking.unshift({ id: uid(), text, created: iso() }); save(); }
function removeIdea(id) {
  const i = state.parking.findIndex(p => p.id === id);
  return i < 0 ? null : { item: state.parking.splice(i, 1)[0], i };
}
A.bin = el => {
  const gone = removeIdea(el.dataset.id);
  if (!gone) return;
  save(); render();
  toast('Binned', () => { state.parking.splice(gone.i, 0, gone.item); save(); render(); });
};
A.promote = el => {
  const p = state.parking.find(x => x.id === el.dataset.id);
  if (!p) return;
  openSheet(`<h2>Promote</h2><p>${h(p.text)}</p>
    <p class="muted small">Becomes a next action. Whatever it replaces goes back to the Parking Lot.</p>
    <div class="stack">
      <button class="btn primary" data-act="promoteTo" data-id="${p.id}" data-to="today">Today’s next action</button>
      ${AREAS.map(d => `<button class="btn" data-act="promoteTo" data-id="${p.id}" data-to="${d.id}">${d.id} ${h(d.name)}</button>`).join('')}
      <button class="btn plain" data-act="close">Cancel</button></div>`);
};
A.promoteTo = el => {
  const gone = removeIdea(el.dataset.id);
  if (!gone) return;
  const to = el.dataset.to, text = gone.item.text;
  if (to === 'today') {
    if (state.next) addIdea(state.next);
    state.next = text; state.starter = '';
  } else {
    const a = area(to);
    if (a.next) addIdea(a.next);
    a.next = text; a.updated = iso();
  }
  save(); closeSheet(); render();
  toast(to === 'today' ? 'Now your next action' : `Next action for ${areaDef(to).short}`);
};

A.copyStatus = async () => {
  const text = buildStatus();
  if (await copyText(text)) toast('✓ Copied status');
  else openSheet(`<h2>Copy this</h2><p class="muted">Automatic copy was blocked. Select and copy:</p>
    <textarea rows="12" readonly>${h(text)}</textarea><button class="btn mt" data-act="close">Close</button>`);
};

A.viewReport = el => {
  const r = (state.reports[el.dataset.id] || [])[+el.dataset.i];
  if (!r) return;
  openSheet(`<h2>${el.dataset.id} ${h(areaDef(el.dataset.id).short)} · ${nice(r.date)}</h2>
    <pre class="block">${h(r.text)}</pre>
    <div class="stack"><button class="btn" data-act="close">Close</button>
    <button class="btn plain" data-act="delReport" data-id="${el.dataset.id}" data-i="${el.dataset.i}">Delete this report</button></div>`);
};
A.delReport = el => {
  (state.reports[el.dataset.id] || []).splice(+el.dataset.i, 1);
  save(); closeSheet(); render();
};

A.rvStart = () => { draft(); save(); render(); };
A.rvBack = () => { draft().step--; save(); render(); };
A.rvDiscard = () => { state.reviewDraft = null; save(); render(); };
A.rvNext = () => {
  const r = draft();
  if (r.step < REVIEW.length - 1) { r.step++; save(); render(); scrollTo(0, 0); return; }
  const answers = r.answers.map(a => a.trim());
  state.reviews.unshift({ date: iso(), answers });
  state.reviews.length = Math.min(state.reviews.length, KEEP_REVIEWS);
  let msg = 'Review saved';
  if (answers[3] && answers[3] !== state.priority) { state.priority = answers[3]; msg += ' · main priority updated'; }
  if (answers[2]) state.urgent = answers[2];
  state.reviewDraft = null;
  save(); render(); toast(msg);
};

A.delWin = el => {
  const i = state.wins.findIndex(w => w.id === el.dataset.id);
  if (i < 0) return;
  const [w] = state.wins.splice(i, 1);
  save(); render();
  toast('Removed', () => { state.wins.splice(i, 0, w); save(); render(); });
};

/* ----- Ask Claude, Mode A: copy the message, then open Claude ----- */
function claudeUrl(target, msg) {
  const link = state.settings.links[target];
  if (link) return link;
  if (state.settings.prefill && msg) {
    const q = encodeURIComponent(msg);
    if (q.length < 6000) return 'https://claude.ai/new?q=' + q;
  }
  return 'https://claude.ai/new';
}
A.ask = el => {
  const t = el.dataset.target || 'cc';
  const who = t === 'cc' ? 'Command Centre' : `${t} ${areaDef(t).name}`;
  const a = (cmd, label, cls = '') => `<a class="btn ${cls}" href="${h(claudeUrl(t))}" target="_blank" rel="noopener" data-act="askGo" data-target="${t}" data-cmd="${h(cmd)}">${h(label)}</a>`;
  openSheet(`<h2>Ask Claude</h2>
    <p class="muted small">${h(who)} · copies your status, then opens Claude. Paste and send.</p>
    <div class="stack">
      ${ASK_COMMANDS.map(c => a(c, c)).join('')}
      <textarea id="askCustom" rows="2" placeholder="Custom question…" aria-label="Custom question"></textarea>
      ${a('custom', 'Ask custom question')}
      <button class="btn plain" data-act="close">Cancel</button>
    </div>`);
};
A.askGo = (el, e) => {
  let cmd = el.dataset.cmd;
  if (cmd === 'custom') {
    cmd = $('#askCustom').value.trim();
    if (!cmd) { e.preventDefault(); $('#askCustom').focus(); return; }
  }
  const t = el.dataset.target;
  const msg = cmd + '\n\n' + (t === 'cc' ? buildStatus() : buildArea(t));
  const url = claudeUrl(t, msg);
  el.href = url; // the tap itself opens Claude; we copy first
  copyText(msg).then(ok => openSheet(`<h2>${ok ? '✓ Copied — paste into Claude' : 'Copy this, then paste into Claude'}</h2>
    ${ok ? '' : `<textarea rows="8" readonly>${h(msg)}</textarea>`}
    <div class="stack mt">
      <a class="btn primary" href="${h(url)}" target="_blank" rel="noopener">Open Claude</a>
      <button class="btn" data-act="close">Done</button>
    </div>
    ${ok ? `<details class="mt"><summary>What was copied</summary><pre class="block">${h(msg)}</pre></details>` : ''}`));
};
A.togglePrefill = el => { state.settings.prefill = el.checked; save(); };

/* ----- Export / Import ----- */
A.exportData = async () => {
  const name = `project-reset-backup-${iso()}.json`;
  const data = JSON.stringify({ app: 'project-reset', exported: new Date().toISOString(), state }, null, 2);
  const file = new File([data], name, { type: 'application/json' });
  if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  toast('Backup saved');
};
A.importPick = () => $('#importFile').click();
let pendingImport = null;
async function importFile(file) {
  try {
    const j = JSON.parse(await file.text());
    const s = j && j.app === 'project-reset' ? j.state : j;
    if (!s || s.v !== 1 || !Array.isArray(s.areas)) throw new Error('bad');
    pendingImport = normalise(s);
    openSheet(`<h2>Replace everything?</h2>
      <p>This replaces all data on this device with the backup${j.exported ? ' from ' + nice(j.exported.slice(0, 10)) : ''}.</p>
      <div class="stack"><button class="btn primary" data-act="importGo">Replace with backup</button>
      <button class="btn plain" data-act="close">Cancel</button></div>`);
  } catch (e) { toast('That file isn’t a Project Reset backup'); }
}
A.importGo = () => {
  if (!pendingImport) return;
  state = pendingImport; pendingImport = null;
  save(); closeSheet(); location.hash = '#today'; render(); toast('Backup restored');
};

/* ---------- form submits ---------- */
const S = {};
S.priority = d => { state.priority = d.priority.trim(); save(); closeSheet(); render(); };
S.next = d => { state.next = d.next.trim(); state.starter = d.starter.trim(); save(); closeSheet(); render(); };
S.done = d => {
  if (d.win && state.next) state.wins.unshift({ id: uid(), text: state.next, date: iso() });
  state.next = d.next.trim(); state.starter = d.starter.trim();
  save(); closeSheet(); render();
};
S.minDay = d => {
  const old = state.minDay.items;
  state.minDay.items = d.items.split('\n').map(t => t.trim()).filter(Boolean)
    .map(text => (old.find(o => o.text === text) || { id: uid(), text }));
  const ids = state.minDay.items.map(i => i.id);
  state.minDay.done = state.minDay.done.filter(id => ids.includes(id));
  save(); closeSheet(); render();
};
S.area = d => {
  const a = area(d.id);
  a.status = d.status.trim(); a.next = d.next.trim();
  if (d.stage) a.stage = +d.stage;
  if (d.theme != null) a.theme = d.theme.trim();
  a.updated = iso();
  save(); closeSheet(); render();
};
S.addIdea = d => {
  const t = d.text.trim();
  if (t) addIdea(t);
  afterRender = () => $('#ideaInput').focus();
  render();
};
S.addWin = d => {
  const t = d.text.trim();
  if (t) { state.wins.unshift({ id: uid(), text: t, date: iso() }); save(); }
  afterRender = () => $('#winInput').focus();
  render();
};
S.saveReport = d => {
  const text = d.text.trim();
  if (!text) { $('#reportText').focus(); return; }
  if (!d.area) { $('#reportArea').focus(); toast('Choose the area'); return; }
  const list = state.reports[d.area] || (state.reports[d.area] = []);
  list.unshift({ date: d.date || iso(), text, saved: iso() });
  list.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  list.length = Math.min(list.length, KEEP_REPORTS);
  save(); render(); toast(`Saved to ${d.area} ${areaDef(d.area).short}`);
};

/* ---------- event wiring ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && A[el.dataset.act]) A[el.dataset.act](el, e);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-submit]');
  if (!f) return;
  e.preventDefault();
  S[f.dataset.submit](Object.fromEntries(new FormData(f)), f);
});
function applyDetect() {
  const t = $('#reportText');
  if (!t) return;
  const { areaId, date } = detectReport(t.value);
  if (areaId) $('#reportArea').value = areaId;
  if (date) $('#reportDate').value = date;
  $('#reportHint').textContent = t.value.trim()
    ? `${areaId ? 'Detected ' + areaId + ' ' + areaDef(areaId).short : 'Couldn’t detect the area'} · ${date ? 'date ' + nice(date) : 'no date found, using today'}. Change them if wrong.`
    : 'Area and date are detected when you paste. Change them if wrong.';
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.bind) {
    state[el.dataset.bind] = el.value; save();
    const p = $('#statusPreview'); if (p) p.textContent = buildStatus();
  } else if (el.dataset.rv != null) {
    draft().answers[+el.dataset.rv] = el.value; save();
  } else if (el.dataset.link != null) {
    const v = el.value.trim();
    if (v) state.settings.links[el.dataset.link] = v; else delete state.settings.links[el.dataset.link];
    save();
  } else if (el.id === 'reportText') applyDetect();
});
document.addEventListener('change', e => {
  if (e.target.id === 'importFile' && e.target.files[0]) { importFile(e.target.files[0]); e.target.value = ''; }
  if (e.target.dataset.link != null && e.target.value.trim() && !/^https:\/\/claude\.ai\//.test(e.target.value.trim())) toast('That doesn’t look like a claude.ai link');
});

/* ---------- deep links: ?go=today|capture|report|review|status|ask &text=… ---------- */
function deepLink() {
  const p = new URLSearchParams(location.search);
  const go = p.get('go');
  if (!go) return;
  const text = (p.get('text') || '').trim();
  const map = { today: 'today', areas: 'areas', park: 'park', capture: 'park', report: 'reports', review: 'review', status: 'status', wins: 'wins', ask: 'today' };
  // Remove the query so a reload can never repeat a capture.
  history.replaceState(null, '', location.pathname + '#' + (map[go] || 'today'));
  if (go === 'capture') {
    if (text) { addIdea(text); afterRender = () => toast('✓ Added to Parking Lot'); }
    else afterRender = () => $('#ideaInput').focus();
  } else if (go === 'report' && text) {
    afterRender = () => { $('#reportText').value = text; applyDetect(); };
  } else if (go === 'ask') {
    afterRender = () => A.ask({ dataset: { target: 'cc' } });
  }
}

/* ---------- boot ---------- */
deepLink();
render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
