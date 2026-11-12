import { ZONES, ZONE_INFO, rotated, cardCells, scoreCity, goalById, soloRank, SOLO_RANKS, MAX_OVERLAP, DRAFT_ROUNDS, DRAFT_HAND } from './rules.js';
import { newGame, current, humans, playCard, results, serialize, deserialize, picksTotal, passDirection } from './game.js';
import { chooseMove } from './bot.js';
import { Board, drawCardCanvas, renderCityThumb, loadArt } from './board.js';

const $ = (s) => document.querySelector(s);
const SAVE_KEY = 'blocktown.save.v1';
const CFG_KEY = 'blocktown.config.v1';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

let state = null;
let config = null; // players array used to start the game
let sel = null; // {hi, rot, x, y}
let viewing = null; // index of player whose city is on the board
let lastHuman = null;
let busy = false;

// ---------- screens ----------
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function modal(html) {
  $('#modalBody').innerHTML = html;
  const d = $('#modal');
  if (!d.open) d.showModal();
  return $('#modalBody');
}
const closeModal = () => { const d = $('#modal'); if (d.open) d.close(); };

// ---------- setup ----------
const LEVELS = [['human', 'Human'], ['bot:easy', 'Bot · Easy'], ['bot:normal', 'Bot · Normal'], ['bot:hard', 'Bot · Hard']];
const BOT_NAMES = ['Robo Rita', 'Mayor Bolt', 'Gizmo', 'Unit 7'];
const PRESETS = {
  solo: [{ name: 'You', type: 'human' }],
  bot1: [{ name: 'You', type: 'human' }, { name: BOT_NAMES[0], type: 'bot', level: 'normal' }],
  bot3: [{ name: 'You', type: 'human' }, ...[0, 1, 2].map((i) => ({ name: BOT_NAMES[i], type: 'bot', level: ['easy', 'normal', 'hard'][i] }))],
  hot2: [{ name: 'Player 1', type: 'human' }, { name: 'Player 2', type: 'human' }],
};
let setup = JSON.parse(store.get(CFG_KEY) || 'null') || PRESETS.bot1;

function renderSetup() {
  const list = $('#playerList');
  list.innerHTML = '';
  setup.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    const val = p.type === 'human' ? 'human' : 'bot:' + p.level;
    row.innerHTML = `<input maxlength="14" aria-label="Name" value="${escapeHtml(p.name)}">
      <select aria-label="Player type">${LEVELS.map(([v, l]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${setup.length > 1 ? '<button class="rm" aria-label="Remove">×</button>' : '<span style="width:32px"></span>'}`;
    row.querySelector('input').oninput = (e) => { p.name = e.target.value; };
    row.querySelector('select').onchange = (e) => {
      const v = e.target.value;
      if (v === 'human') { p.type = 'human'; delete p.level; } else { p.type = 'bot'; p.level = v.split(':')[1]; }
      renderSetup();
    };
    const rm = row.querySelector('.rm');
    if (rm) rm.onclick = () => { setup.splice(i, 1); renderSetup(); };
    list.appendChild(row);
  });
  $('#btnAddPlayer').classList.toggle('hidden', setup.length >= 4);
  const h = setup.filter((p) => p.type === 'human').length;
  let note;
  if (setup.length === 1) note = `Solo challenge: ${picksTotal({ mode: 'solo' })} cards, hand of 3. Aim for ${SOLO_RANKS[SOLO_RANKS.length - 1][0]}+ to build a ${SOLO_RANKS[SOLO_RANKS.length - 1][1]}.`;
  else note = `Draft game: ${DRAFT_ROUNDS} rounds. Each round you're dealt ${DRAFT_HAND} cards — keep one, pass the rest. ${h > 1 ? 'Pass the device between human players.' : ''}`;
  if (h === 0) note = 'Need at least one human player.';
  $('#modeNote').textContent = note;
  $('#btnStart').disabled = h === 0;
  document.querySelectorAll('.chip[data-preset]').forEach((c) => {
    c.classList.toggle('on', JSON.stringify(PRESETS[c.dataset.preset]) === JSON.stringify(setup));
  });
  $('#btnContinue').classList.toggle('hidden', !store.get(SAVE_KEY));
}

function possessive(name) {
  if (humans(state) === 1 && current(state).type === 'human') return 'Your';
  if (name.toLowerCase() === 'you') return 'Your';
  return name + (name.endsWith('s') ? "'" : "'s");
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

document.querySelectorAll('.chip[data-preset]').forEach((c) => {
  c.onclick = () => { setup = structuredClone(PRESETS[c.dataset.preset]); renderSetup(); };
});
$('#btnAddPlayer').onclick = () => {
  const bots = setup.filter((p) => p.type === 'bot').length;
  setup.push({ name: BOT_NAMES[bots % 4], type: 'bot', level: 'normal' });
  renderSetup();
};
$('#btnStart').onclick = () => {
  setup.forEach((p, i) => { p.name = (p.name || '').trim() || (p.type === 'bot' ? BOT_NAMES[i % 4] : `Player ${i + 1}`); });
  store.set(CFG_KEY, JSON.stringify(setup));
  startGame(structuredClone(setup));
};
$('#btnContinue').onclick = () => {
  try {
    const o = JSON.parse(store.get(SAVE_KEY));
    state = deserialize(o.state); config = o.config;
    beginTurns(true);
  } catch { store.del(SAVE_KEY); renderSetup(); }
};
$('#btnRules').onclick = () => showRules();

// ---------- game ----------
const board = new Board($('#board'), {
  onTap: (fx, fy) => {
    if (!sel) return;
    moveGhost(Math.round(fx - 1), Math.round(fy - 1));
  },
  onGhostMove: (x, y) => moveGhost(x, y),
  onGhostTap: () => rotateSel(),
});
loadArt(() => { board.draw(); if (state) renderHand(); });

function startGame(players) {
  config = players;
  state = newGame({ players });
  lastHuman = null; viewing = null;
  save();
  beginTurns(false);
}

function save() {
  if (!state) return;
  if (state.over) store.del(SAVE_KEY);
  else store.set(SAVE_KEY, JSON.stringify({ state: serialize(state), config }));
}

function beginTurns(resumed) {
  sel = null;
  show('game');
  $('#btnCities').classList.toggle('hidden', state.players.length < 2);
  if (state.over) return finish();
  const p = current(state);
  if (p.type === 'bot') {
    if (viewing === null || !state.players[viewing] || state.players[viewing].type !== 'human') {
      viewing = state.players.findIndex((q) => q.type === 'human');
    }
    board.setCity(state.players[viewing].city, true);
    renderGame();
    return runBots();
  }
  if (humans(state) > 1 && (resumed || lastHuman !== state.turn)) return passTo(state.turn);
  startHumanTurn();
}

function startHumanTurn() {
  show('game');
  lastHuman = state.turn;
  viewing = state.turn;
  sel = null;
  board.setGhost(null);
  board.setCity(current(state).city, true);
  renderGame();
}

function passTo(i) {
  const p = state.players[i];
  $('#passName').textContent = p.name;
  $('#passInfo').textContent = state.mode === 'draft'
    ? `Round ${state.round + 1} of ${DRAFT_ROUNDS} · pick ${state.pick + 1} of ${DRAFT_HAND - 1}`
    : '';
  show('pass');
}
$('#btnReady').onclick = () => startHumanTurn();

function runBots() {
  busy = true;
  renderGame();
  const step = () => {
    if (state.over) { busy = false; save(); return finish(); }
    const p = current(state);
    if (p.type !== 'bot') { busy = false; save(); return beginTurns(false); }
    const m = chooseMove(p.city, p.hand, state.goals, p.level);
    playCard(state, m.hi, m.rot, m.x, m.y);
    toast(`${p.name} built a block`);
    renderGame();
    setTimeout(step, humans(state) > 1 ? 250 : 450);
  };
  setTimeout(step, 300);
}

function renderGame() {
  const viewer = state.players[viewing ?? state.turn];
  const p = current(state);
  const sc = scoreCity(viewer.city, state.goals);
  $('#scoreNow').textContent = sc.total;
  if (state.mode === 'solo') {
    const played = viewer.city.placed;
    $('#statusTitle').textContent = `Card ${Math.min(played + 1, picksTotal(state))} of ${picksTotal(state)}`;
    const next = SOLO_RANKS.find(([t]) => t > sc.total);
    $('#statusSub').textContent = `${state.deck.length} left in deck${next ? ` · ${next[1]} at ${next[0]}` : ''}`;
  } else {
    $('#statusTitle').textContent = `Round ${state.round + 1}/${DRAFT_ROUNDS} · Pick ${state.pick + 1}/${DRAFT_HAND - 1}`;
    $('#statusSub').textContent = busy ? `${p.name} is thinking…` : `${possessive(viewer.name)} city · pass ${passDirection(state)}`;
  }
  $('#handLabel').textContent = busy ? 'Waiting…' : `${possessive(p.name)} hand`;
  $('#handInfo').textContent = state.mode === 'draft' ? `keep 1 of ${p.hand.length}` : '';
  renderHand();
  renderGoals(sc);
  renderPlaceBar();
}

function renderHand() {
  const el = $('#hand');
  el.innerHTML = '';
  const p = current(state);
  if (busy || p.type === 'bot') return;
  p.hand.forEach((card, i) => {
    const b = document.createElement('button');
    b.className = 'hand-card' + (sel && sel.hi === i ? ' sel' : '');
    b.setAttribute('aria-label', 'Card: ' + card.cells.map((z) => ZONE_INFO[z].name).join(', '));
    const cv = document.createElement('canvas');
    b.appendChild(cv);
    el.appendChild(b);
    const rot = sel && sel.hi === i ? sel.rot : 0;
    const r = rotated(card, rot);
    drawCardCanvas(cv, r.cells, r.roads);
    b.onclick = () => selectCard(i);
  });
}

function renderGoals(sc) {
  const el = $('#goals');
  el.innerHTML = '';
  state.goals.forEach((id, i) => {
    const g = goalById(id);
    const b = document.createElement('button');
    b.className = 'goal';
    b.innerHTML = `<b>${g.name}</b><span class="desc">${g.text}</span><span>Now: <span class="pts">${sc.goals[i].pts}</span></span>`;
    b.onclick = () => modal(`<h3>${g.name}</h3><p>${g.text}</p><p>Your city currently scores <b>${sc.goals[i].pts}</b> for this goal.</p>`);
    el.appendChild(b);
  });
}

function selectCard(i) {
  if (busy) return;
  if (sel && sel.hi === i) return rotateSel();
  const p = current(state);
  const card = p.hand[i];
  const rot = 0;
  // default position: nearest legal spot to the centre of the view
  const [vx, vy] = board.viewCenter();
  const b = p.city.bounds();
  let best = null, bestD = Infinity;
  for (let y = b.minY - 2; y <= b.maxY + 1; y++) for (let x = b.minX - 2; x <= b.maxX + 1; x++) {
    if (!p.city.check(card, rot, x, y).ok) continue;
    const ov = p.city.check(card, rot, x, y).overlap;
    const d = Math.hypot(x + 1 - vx, y + 1 - vy) + ov * 0.6;
    if (d < bestD) { bestD = d; best = [x, y]; }
  }
  sel = { hi: i, rot, x: best[0], y: best[1] };
  updateGhost();
  board.ensureGhostVisible();
  renderHand();
}

function rotateSel() {
  if (!sel) return;
  sel.rot = (sel.rot + 1) % 4;
  updateGhost();
  renderHand();
}

function moveGhost(x, y) {
  if (!sel) return;
  sel.x = x; sel.y = y;
  updateGhost();
}

function updateGhost() {
  if (!sel) { board.setGhost(null); renderPlaceBar(); return; }
  const p = current(state);
  const card = p.hand[sel.hi];
  const chk = p.city.check(card, sel.rot, sel.x, sel.y);
  sel.ok = chk.ok; sel.reason = chk.reason;
  board.setGhost({ cells: cardCells(card, sel.rot, sel.x, sel.y), ok: chk.ok, x: sel.x, y: sel.y });
  renderPlaceBar();
}

function renderPlaceBar() {
  const bar = $('#placeBar'), hint = $('#hint');
  const p = current(state);
  hint.classList.remove('bad');
  if (busy) { bar.classList.add('hidden'); hint.textContent = `${p.name} is building…`; hint.classList.remove('hidden'); return; }
  if (!sel) {
    bar.classList.add('hidden');
    hint.classList.remove('hidden');
    hint.textContent = state.mode === 'draft' ? 'Choose a card to keep and build' : 'Pick a card from your hand';
    return;
  }
  bar.classList.remove('hidden');
  const card = p.hand[sel.hi];
  if (sel.ok) {
    const before = scoreCity(p.city, state.goals).total;
    const undo = p.city.place(card, sel.rot, sel.x, sel.y);
    const after = scoreCity(p.city, state.goals).total;
    p.city.undo(undo);
    const d = after - before;
    $('#preview').innerHTML = `${after} <b class="${d >= 0 ? 'up' : 'down'}">(${d >= 0 ? '+' : ''}${d})</b>`;
    hint.textContent = 'Drag or tap to move · tap card to rotate';
  } else {
    $('#preview').innerHTML = '—';
    hint.textContent = sel.reason;
    hint.classList.add('bad');
  }
  $('#btnConfirm').disabled = !sel.ok;
}

$('#btnRotate').onclick = rotateSel;
$('#btnCancel').onclick = () => { sel = null; updateGhost(); renderHand(); };
$('#btnFit').onclick = () => board.fit();
$('#btnConfirm').onclick = () => {
  if (!sel || !sel.ok || busy) return;
  const s = sel;
  sel = null;
  board.setGhost(null);
  playCard(state, s.hi, s.rot, s.x, s.y);
  save();
  board.draw();
  if (state.over) { renderGame(); return setTimeout(finish, 600); }
  const next = current(state);
  if (next.type === 'bot') return runBots();
  if (humans(state) > 1 && state.turn !== lastHuman) return passTo(state.turn);
  startHumanTurn();
};

$('#btnScore').onclick = () => {
  const v = state.players[viewing ?? state.turn];
  modal(`<h3>${escapeHtml(possessive(v.name))} score</h3>${breakdownHtml(scoreCity(v.city, state.goals))}
    <p class="note">Each zone scores its single largest connected group. Every separate road network costs 1.</p>`);
};

function breakdownHtml(sc) {
  const row = (l, v) => `<div class="bd-row"><span>${l}</span><b>${v}</b></div>`;
  return ZONES.map((z) => row(`<i class="swatch" style="background:${ZONE_INFO[z].color}"></i>Largest ${ZONE_INFO[z].name}`, sc.zones[z])).join('')
    + row(`Road networks (${sc.roads})`, sc.roadPenalty)
    + sc.goals.map((g) => row('Goal · ' + g.name, g.pts)).join('')
    + `<div class="bd-row total"><span>Total</span><b>${sc.total}</b></div>`;
}

$('#btnCities').onclick = () => {
  const body = modal(`<h3>All cities</h3><div class="city-list">${state.players.map((p, i) =>
    `<div class="res-city"><canvas data-i="${i}"></canvas><b>${escapeHtml(p.name)}</b><span class="note">${scoreCity(p.city, state.goals).total} pts</span></div>`).join('')}</div>`);
  body.querySelectorAll('canvas').forEach((cv) => renderCityThumb(cv, state.players[+cv.dataset.i].city));
};

$('#btnMenu').onclick = () => {
  const body = modal(`<h3>Paused</h3><div class="menu-actions">
    <button class="btn primary wide" data-a="resume">Resume</button>
    <button class="btn ghost wide" data-a="rules">How to play</button>
    <button class="btn ghost wide" data-a="quit">Save &amp; quit to menu</button>
    <button class="btn ghost wide" data-a="abandon">Abandon game</button></div>`);
  body.querySelector('[data-a=resume]').onclick = closeModal;
  body.querySelector('[data-a=rules]').onclick = showRules;
  body.querySelector('[data-a=quit]').onclick = () => { closeModal(); toMenu(); };
  body.querySelector('[data-a=abandon]').onclick = () => { store.del(SAVE_KEY); closeModal(); toMenu(); };
};

function toMenu() {
  state = null; busy = false;
  renderSetup();
  show('menu');
}

// ---------- results ----------
function finish() {
  store.del(SAVE_KEY);
  const rows = results(state);
  show('results');
  const solo = state.mode === 'solo';
  const winners = rows.filter((r) => r.winner);
  if (solo) {
    $('#resTitle').textContent = `${rows[0].total} points — ${soloRank(rows[0].total)}`;
    const next = SOLO_RANKS.find(([t]) => t > rows[0].total);
    $('#resSub').textContent = next ? `${next[0] - rows[0].total} more for ${next[1]}.` : 'Top rank! Can you beat your score?';
  } else {
    $('#resTitle').textContent = winners.length > 1 ? `Tie: ${winners.map((w) => w.name).join(' & ')}` : `${winners[0].name} wins!`;
    $('#resSub').textContent = winners.length > 1 ? `${winners[0].total} points each` : `with ${winners[0].total} points`;
  }
  $('#resCities').innerHTML = rows.map((r) =>
    `<div class="res-city ${r.winner && !solo ? 'win' : ''}"><canvas data-i="${r.i}"></canvas><b>${escapeHtml(r.name)}</b><span class="note">${r.total} pts</span></div>`).join('');
  $('#resCities').querySelectorAll('canvas').forEach((cv) => renderCityThumb(cv, state.players[+cv.dataset.i].city));
  const head = `<tr><th></th>${rows.map((r) => `<th>${escapeHtml(r.name)}</th>`).join('')}</tr>`;
  const line = (label, fn, cls = '') => `<tr class="${cls}"><td>${label}</td>${rows.map((r) => `<td>${fn(r)}</td>`).join('')}</tr>`;
  $('#resTable').innerHTML = head
    + ZONES.map((z) => line(`<i class="swatch" style="background:${ZONE_INFO[z].color}"></i>${ZONE_INFO[z].name}`, (r) => r.zones[z])).join('')
    + line('Roads', (r) => r.roadPenalty)
    + state.goals.map((id, gi) => line(goalById(id).name, (r) => r.goals[gi].pts)).join('')
    + line('Total', (r) => r.total, 'total');
}
$('#btnAgain').onclick = () => startGame(structuredClone(config));
$('#btnToMenu').onclick = toMenu;

// ---------- rules ----------
function showRules() {
  modal(`<h3>How to play</h3>
    <p>Every card is a 2×2 city block of four zones:
      ${ZONES.map((z) => `<i class="swatch" style="background:${ZONE_INFO[z].color}"></i>${ZONE_INFO[z].name}`).join(' ')}.
      Some carry roads.</p>
    <h4>Building</h4>
    <ul>
      <li>Pick a card, then drag or tap the board to position it. Tap the card again (or ⟳) to rotate.</li>
      <li>It must touch your city, edge to edge or by overlapping it.</li>
      <li>You may cover up to ${MAX_OVERLAP} existing spaces — covered spaces are replaced.</li>
    </ul>
    <h4>Scoring</h4>
    <ul>
      <li>For each zone, score 1 point per space in your <b>largest</b> connected group of that zone.</li>
      <li>Lose 1 point for each separate road network. Connect your roads!</li>
      <li>Plus three random <b>goals</b> shown under your hand.</li>
    </ul>
    <h4>Solo</h4>
    <p>Hold 3 cards; play one, draw one, until ${picksTotal({ mode: 'solo' })} cards are built. Ranks:
      ${SOLO_RANKS.slice(1).map(([t, n]) => `${n} ${t}+`).join(', ')}.</p>
    <h4>Draft (2–4 players)</h4>
    <p>Everyone builds their own city. Each round you're dealt ${DRAFT_HAND} cards: build one and pass the rest
      (left, then right on alternate rounds) until one card is left, which is discarded.
      After ${DRAFT_ROUNDS} rounds the highest score wins. Bots and humans can mix; humans pass the device.</p>
    <h4>Controls</h4>
    <p>Drag to pan, pinch or scroll to zoom, ⤢ to fit the city.</p>`);
}

// ---------- boot ----------
renderSetup();
show('menu');
document.addEventListener('gesturestart', (e) => e.preventDefault());
