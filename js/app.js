import { ZONES, ZONE_INFO, R, rotated, cardCells, scoreCity, goalById, soloRank, loadRuleset, validateRuleset, allowedRotations } from './rules.js';
import { newGame, current, humans, playCard, results, serialize, deserialize, picksTotal, passDirection, cityOf } from './game.js';
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
  renderVariants();
  const h = setup.filter((p) => p.type === 'human').length;
  const paired = !!(R.goalSelection && R.goalSelection.mode === 'paired-card-removal');
  let note;
  if (paired && setup.length === 1) {
    note = `Sprawl Jam solo: ${R.solo.plays} city cards, hand of ${R.solo.hand}. Three goal cards are set aside — reach their target total to win.`;
  } else if (paired) {
    const mp = R.multiplayer || {};
    note = `Sprawl Jam co-op: one shared city. Start player holds ${mp.startPlayerHand ?? 3} cards, the rest ${mp.otherPlayerHand ?? 1} each — play one, pass ${mp.passUnplayed ?? 2} left, draw ${mp.drawAfterPlay ?? 1}. Meet the target together.${h > 1 ? ' Pass the device between human players.' : ''}`;
  } else if (setup.length === 1) note = `Solo challenge: ${picksTotal({ mode: 'solo' })} cards, hand of ${R.solo.hand}. Aim for ${R.solo.ranks[R.solo.ranks.length - 1][0]}+ to build a ${R.solo.ranks[R.solo.ranks.length - 1][1]}.`;
  else note = `Draft game: ${R.draft.rounds} rounds. Each round you're dealt ${R.draft.hand} cards — keep one, pass the rest. ${h > 1 ? 'Pass the device between human players.' : ''}`;
  if (h === 0) note = 'Need at least one human player.';
  $('#modeNote').textContent = note;
  $('#btnStart').disabled = h === 0 || !selectedData;
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
  loadRuleset(selectedData);
  config = players;
  state = newGame({ players, variants: [...selectedVariants] });
  lastHuman = null; viewing = null;
  save();
  showGoalReveal();
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
  $('#btnCities').classList.toggle('hidden', state.players.length < 2 || state.mode === 'sprawl');
  if (state.over) return finish();
  const p = current(state);
  if (p.type === 'bot') {
    if (viewing === null || !state.players[viewing] || state.players[viewing].type !== 'human') {
      viewing = state.players.findIndex((q) => q.type === 'human');
    }
    board.setCity(cityOf(state, state.players[viewing]), true);
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
  board.setCity(cityOf(state, current(state)), true);
  renderGame();
}

function passTo(i) {
  const p = state.players[i];
  $('#passName').textContent = p.name;
  $('#passInfo').textContent = state.mode === 'draft'
    ? `Round ${state.round + 1} of ${R.draft.rounds} · pick ${state.pick + 1} of ${R.draft.hand - 1}`
    : state.mode === 'sprawl'
      ? `Shared city · ${p.hand.length} card${p.hand.length === 1 ? '' : 's'} in hand · ${state.deck.length} in deck`
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
    const m = chooseMove(cityOf(state, p), p.hand, state.goals, p.level);
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
  const sc = scoreCity(cityOf(state, viewer), state.goals);
  $('#scoreNow').textContent = sc.total;
  if (state.mode === 'solo') {
    const played = cityOf(state, viewer).placed;
    const total = picksTotal(state);
    const countsAsPlay = !!(R.setup && R.setup.startingCardCountsAsPlay);
    $('#statusTitle').textContent = `Card ${Math.min(countsAsPlay ? played : played + 1, total)} of ${total}`;
    const next = R.solo.ranks.find(([t]) => t > sc.total);
    $('#statusSub').textContent = sc.target !== undefined
      ? `${state.deck.length} in deck · target ${sc.target}`
      : `${state.deck.length} left in deck${next ? ` · ${next[1]} at ${next[0]}` : ''}`;
  } else if (state.mode === 'sprawl') {
    $('#statusTitle').textContent = `Card ${cityOf(state, viewer).placed} of ${R.solo.plays} · ${p.name}'s turn`;
    $('#statusSub').textContent = busy ? `${p.name} is thinking…` : `Target ${sc.target} · ${state.deck.length} in deck`;
  } else {
    $('#statusTitle').textContent = `Round ${state.round + 1}/${R.draft.rounds} · Pick ${state.pick + 1}/${R.draft.hand - 1}`;
    $('#statusSub').textContent = busy ? `${p.name} is thinking…` : `${possessive(viewer.name)} city · pass ${passDirection(state)}`;
  }
  $('#handLabel').textContent = busy ? 'Waiting…' : `${possessive(p.name)} hand`;
  $('#handInfo').textContent = state.mode === 'draft' ? `keep 1 of ${p.hand.length}`
    : state.mode === 'sprawl' ? `${p.hand.length} held` : '';
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
  const head = $('#goalsHead');
  if (head) head.textContent = sc.target !== undefined ? `Goals · target ${sc.target}` : 'Goals';
  state.goals.forEach((id, i) => {
    const g = goalById(id);
    const num = g.number !== undefined ? `#${g.number} · ` : '';
    const b = document.createElement('button');
    b.className = 'goal';
    b.innerHTML = `<b>${num}${escapeHtml(g.name)}</b><span class="desc">${escapeHtml(g.text)}</span><span>Now: <span class="pts">${sc.goals[i].pts}</span></span>`;
    b.onclick = () => modal(`<h3>${num}${escapeHtml(g.name)}</h3><p>${escapeHtml(g.text)}</p>
      <p>This goal currently scores <b>${sc.goals[i].pts}</b>${g.number !== undefined ? `, and its number <b>${g.number}</b> counts toward the target` : ''}.</p>`);
    el.appendChild(b);
  });
}

// Co-op variant: reveal the three goal cards, their numbers and the target total.
function showGoalReveal() {
  if (!(R.victory && R.victory.mode === 'score-at-least-target')) return;
  const target = state.goals.reduce((t, id) => t + (goalById(id)?.number ?? 0), 0);
  const list = state.goals.map((id) => {
    const g = goalById(id);
    return `<p><b>#${g.number} ${escapeHtml(g.name)}</b><br><span class="note">${escapeHtml(g.text)}</span></p>`;
  }).join('');
  modal(`<h3>The three goals</h3>${list}
    <p class="note">Target score: <b>${target}</b> — the sum of the three goal numbers.
    The city wins if its final score meets or exceeds the target.</p>`);
}

function selectCard(i) {
  if (busy) return;
  if (sel && sel.hi === i) return rotateSel();
  const p = current(state);
  const card = p.hand[i];
  const rot = 0;
  const city = cityOf(state, p);
  // default position: nearest legal spot to the centre of the view
  const [vx, vy] = board.viewCenter();
  const b = city.bounds();
  let best = null, bestD = Infinity;
  for (let y = b.minY - 2; y <= b.maxY + 1; y++) for (let x = b.minX - 2; x <= b.maxX + 1; x++) {
    if (!city.check(card, rot, x, y).ok) continue;
    const ov = city.check(card, rot, x, y).overlap;
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
  const rots = allowedRotations();
  const i = rots.indexOf(((sel.rot % 4) + 4) % 4);
  sel.rot = rots[(i + 1 + rots.length) % rots.length];
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
  const chk = cityOf(state, p).check(card, sel.rot, sel.x, sel.y);
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
  const city = cityOf(state, p);
  if (sel.ok) {
    const before = scoreCity(city, state.goals).total;
    const undo = city.place(card, sel.rot, sel.x, sel.y);
    const after = scoreCity(city, state.goals).total;
    city.undo(undo);
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
  modal(`<h3>${escapeHtml(possessive(v.name))} score</h3>${breakdownHtml(scoreCity(cityOf(state, v), state.goals))}
    <p class="note">Each zone scores its single largest connected group. Each separate road network scores ${R.roadNetworkPoints}.</p>`);
};

function breakdownHtml(sc) {
  const row = (l, v) => `<div class="bd-row"><span>${l}</span><b>${v}</b></div>`;
  const target = sc.target !== undefined
    ? row('Target', sc.target) + row('Outcome', sc.win ? 'Win' : `${sc.target - sc.total} short`)
    : '';
  return ZONES.filter((z) => ZONE_INFO[z].largestGroupPoints).map((z) => row(`<i class="swatch" style="background:${ZONE_INFO[z].color}"></i>Largest ${ZONE_INFO[z].name}`, sc.zones[z])).join('')
    + row(`Road networks (${sc.roads})`, sc.roadPenalty)
    + sc.goals.map((g) => row('Goal · ' + g.name, g.pts)).join('')
    + target
    + `<div class="bd-row total"><span>Total</span><b>${sc.total}</b></div>`;
}

$('#btnCities').onclick = () => {
  const body = modal(`<h3>All cities</h3><div class="city-list">${state.players.map((p, i) =>
    `<div class="res-city"><canvas data-i="${i}"></canvas><b>${escapeHtml(p.name)}</b><span class="note">${scoreCity(cityOf(state, p), state.goals).total} pts</span></div>`).join('')}</div>`);
  body.querySelectorAll('canvas').forEach((cv) => renderCityThumb(cv, cityOf(state, state.players[+cv.dataset.i])));
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
  if (selectedData) loadRuleset(selectedData);
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
  const target = rows[0].target;
  if (target !== undefined) {
    // Target-based victory (Sprawl Jam): meet or beat the sum of the goal numbers.
    const win = rows[0].win;
    const short = target - rows[0].total;
    if (state.mode === 'sprawl') {
      $('#resTitle').textContent = win ? 'The city wins!' : 'The city falls short';
      $('#resSub').textContent = `${rows[0].total} points · target ${target}${win ? '' : ` — ${short} more needed`}`;
    } else {
      $('#resTitle').textContent = `${rows[0].total} points — ${win ? 'target met' : 'target missed'}`;
      $('#resSub').textContent = `Target ${target} = ${state.goals.map((id) => goalById(id).number).join(' + ')}${win ? '' : ` · ${short} more needed`}`;
    }
  } else if (solo) {
    $('#resTitle').textContent = `${rows[0].total} points — ${soloRank(rows[0].total)}`;
    const next = R.solo.ranks.find(([t]) => t > rows[0].total);
    $('#resSub').textContent = next ? `${next[0] - rows[0].total} more for ${next[1]}.` : 'Top rank! Can you beat your score?';
  } else {
    $('#resTitle').textContent = winners.length > 1 ? `Tie: ${winners.map((w) => w.name).join(' & ')}` : `${winners[0].name} wins!`;
    $('#resSub').textContent = winners.length > 1 ? `${winners[0].total} points each` : `with ${winners[0].total} points`;
  }
  $('#resCities').innerHTML = rows.map((r) =>
    `<div class="res-city ${r.winner && !solo ? 'win' : ''}"><canvas data-i="${r.i}"></canvas><b>${escapeHtml(r.name)}</b><span class="note">${r.total} pts</span></div>`).join('');
  $('#resCities').querySelectorAll('canvas').forEach((cv) => renderCityThumb(cv, cityOf(state, state.players[+cv.dataset.i])));
  const head = `<tr><th></th>${rows.map((r) => `<th>${escapeHtml(r.name)}</th>`).join('')}</tr>`;
  const line = (label, fn, cls = '') => `<tr class="${cls}"><td>${label}</td>${rows.map((r) => `<td>${fn(r)}</td>`).join('')}</tr>`;
  $('#resTable').innerHTML = head
    + ZONES.filter((z) => ZONE_INFO[z].largestGroupPoints).map((z) => line(`<i class="swatch" style="background:${ZONE_INFO[z].color}"></i>${ZONE_INFO[z].name}`, (r) => r.zones[z])).join('')
    + line('Roads', (r) => r.roadPenalty)
    + state.goals.map((id, gi) => line(goalById(id).name, (r) => r.goals[gi].pts)).join('')
    + (target !== undefined ? line('Target', (r) => r.target) + line('Outcome', (r) => (r.win ? 'Win' : 'Short')) : '')
    + line('Total', (r) => r.total, 'total');
}
$('#btnAgain').onclick = () => startGame(structuredClone(config));
$('#btnToMenu').onclick = toMenu;

// ---------- optional rule variants (easier / harder toggles) ----------
function renderVariants() {
  const box = $('#variantBox');
  if (!box) return;
  const has = !!R.variants;
  box.classList.toggle('hidden', !has);
  if (!has) { selectedVariants = []; return; }
  $('#varEasier').checked = selectedVariants.includes('easier');
  $('#varHarder').checked = selectedVariants.includes('harder');
}
function toggleVariant(name, on) {
  selectedVariants = on ? [...new Set([...selectedVariants, name])] : selectedVariants.filter((v) => v !== name);
}
$('#varEasier').onchange = (e) => toggleVariant('easier', e.target.checked);
$('#varHarder').onchange = (e) => toggleVariant('harder', e.target.checked);

// ---------- rules ----------
function showRules() {
  if (R.victory && R.victory.mode === 'score-at-least-target') return showSprawlRules();
  modal(`<h3>How to play</h3><p class="note">Rules: <b>${escapeHtml(R.name)}</b></p>
    <p>Every card is a 2×2 city block of zones:
      ${ZONES.map((z) => `<i class="swatch" style="background:${ZONE_INFO[z].color}"></i>${ZONE_INFO[z].name}`).join(' ')}.
      Some carry roads.</p>
    <h4>Building</h4>
    <ul>
      <li>Pick a card, then drag or tap the board to position it. Tap the card again (or ⟳) to rotate.</li>
      <li>It must touch your city, edge to edge or by overlapping it.</li>
      <li>You may cover up to ${R.maxOverlap} existing spaces — covered spaces are replaced.</li>
    </ul>
    <h4>Scoring</h4>
    <ul>
      <li>For each zone, score 1 point per space in your <b>largest</b> connected group of that zone.</li>
      <li>Each separate road network scores ${R.roadNetworkPoints}. Connect your roads!</li>
      <li>Plus ${R.goalsPerGame} random <b>goals</b> shown under your hand.</li>
    </ul>
    <h4>Solo</h4>
    <p>Hold ${R.solo.hand} cards; play one, draw one, until ${picksTotal({ mode: 'solo' })} cards are built. Ranks:
      ${R.solo.ranks.slice(1).map(([t, n]) => `${n} ${t}+`).join(', ')}.</p>
    <h4>Draft (2–4 players)</h4>
    <p>Everyone builds their own city. Each round you're dealt ${R.draft.hand} cards: build one and pass the rest
      (left, then right on alternate rounds) until one card is left, which is discarded.
      After ${R.draft.rounds} rounds the highest score wins. Bots and humans can mix; humans pass the device.</p>
    <h4>Controls</h4>
    <p>Drag to pan, pinch or scroll to zoom, ⤢ to fit the city.</p>`);
}

// Rules for the paired Sprawl Jam variant (schemaVersion 2).
function showSprawlRules() {
  const mp = R.multiplayer || {};
  const solo = setup.length === 1;
  modal(`<h3>How to play — Sprawl Jam</h3><p class="note">Rules: <b>${escapeHtml(R.name)}</b></p>
    <h4>Goals and target</h4>
    <ul>
      <li>${R.goalsPerGame} goal cards are chosen at random and set aside; their city faces cannot be built.</li>
      <li>The <b>target</b> is the sum of the three goal numbers. Meet or beat it to win.</li>
      <li>The other ${R.cards.length - R.goalsPerGame} cards form the city deck: one starts the city, ${R.solo.plays - 1} more are placed.</li>
    </ul>
    <h4>Building</h4>
    <ul>
      <li>Connect by a full block edge <b>or</b> overlap and cover blocks — corner-only touches are illegal.</li>
      <li>Covered blocks are replaced; only the top layer scores. Cards may rotate0° or 180° only.</li>
      <li>Up to ${R.maxOverlap} existing blocks may be covered. Never tuck a card underneath.</li>
    </ul>
    <h4>Scoring</h4>
    <ul>
      <li>1 point per block in the largest edge-connected group of each of the four zone types.</li>
      <li>Each separate continuous road scores ${R.roadNetworkPoints}. Roads join across cards when ports match.</li>
      <li>Plus the three goals. Final = groups − roads + goals; win at or above the target.</li>
    </ul>
    <h4>${solo ? 'Solo' : 'Co-op (2–4 players)'}</h4>
    ${solo
      ? `<p>Hold ${R.solo.hand} cards; play one, draw one while the deck lasts, until ${R.solo.plays} cards are built.</p>`
      : `<p>One shared city. The start player holds ${mp.startPlayerHand ?? 3} cards, everyone else ${mp.otherPlayerHand ?? 1}.
         On a turn: play one card, pass the rest (${mp.passUnplayed ?? 2}) to the left, then draw ${mp.drawAfterPlay ?? 1}.
         When the deck runs out, pass what remains. Play until all ${R.solo.plays} cards are built.
         ${mp.tableTalk !== false ? 'Discuss freely, but never reveal cards in hand — once revealed, a card must be played.' : ''}</p>`}
    <h4>Controls</h4>
    <p>Drag to pan, pinch or scroll to zoom, ⤢ to fit the city. Tap a selected card again to rotate it.</p>`);
}

// ---------- rulesets ----------
// Built-in rulesets are listed in data/rulesets.json. A custom JSON can be loaded from the device
// and is kept in localStorage.
const RS_KEY = 'blocktown.ruleset.v1';
const CUSTOM_KEY = 'blocktown.customRuleset.v1';
let rulesets = []; // [{key, name, data}]
let selectedData = null;
let selectedVariants = []; // optional rule variants chosen on the setup screen (e.g. easier/harder)

async function loadRulesets() {
  rulesets = [];
  let files = ['blocktown.json'];
  try { files = await (await fetch('data/rulesets.json', { cache: 'no-cache' })).json(); } catch { /* use default */ }
  for (const f of files) {
    try {
      const data = await (await fetch('data/' + f, { cache: 'no-cache' })).json();
      const errs = validateRuleset(data);
      if (errs.length) { console.warn(f, errs); rulesetError(`data/${f} has problems:`, errs); continue; }
      rulesets.push({ key: f, name: data.name || f, data });
    } catch (e) { rulesetError(`Could not read data/${f}:`, [e.message]); }
  }
  const custom = store.get(CUSTOM_KEY);
  if (custom) {
    try {
      const data = JSON.parse(custom);
      if (!validateRuleset(data).length) rulesets.push({ key: 'custom', name: 'Custom: ' + (data.name || 'my rules'), data });
    } catch { store.del(CUSTOM_KEY); }
  }
  const want = store.get(RS_KEY);
  selectRuleset((rulesets.find((r) => r.key === want) || rulesets[0])?.key);
}

function selectRuleset(k) {
  const rs = rulesets.find((r) => r.key === k);
  if (!rs) return;
  store.set(RS_KEY, k);
  selectedData = rs.data;
  selectedVariants = [];
  loadRuleset(rs.data);
  const sel = $('#rulesetSelect');
  sel.innerHTML = rulesets.map((r) => `<option value="${escapeHtml(r.key)}" ${r.key === k ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
  $('#rulesetInfo').textContent = `${rs.data.description ? rs.data.description + ' ' : ''}${R.cards.length} cards · ${R.goals.length} goals.`;
  renderSetup();
}

function rulesetError(title, errs) {
  modal(`<h3>Ruleset problem</h3><p>${escapeHtml(title)}</p><ul>${errs.slice(0, 30).map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`);
}

$('#rulesetSelect').onchange = (e) => selectRuleset(e.target.value);
$('#btnLoadRules').onclick = () => $('#rulesFile').click();
$('#rulesFile').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch (err) { return rulesetError(`${f.name} isn't valid JSON:`, [err.message]); }
  const errs = validateRuleset(data);
  if (errs.length) return rulesetError(`${f.name} has problems:`, errs);
  store.set(CUSTOM_KEY, JSON.stringify(data));
  rulesets = rulesets.filter((r) => r.key !== 'custom');
  rulesets.push({ key: 'custom', name: 'Custom: ' + (data.name || f.name), data });
  selectRuleset('custom');
};
$('#btnSaveRules').onclick = () => {
  const blob = new Blob([JSON.stringify(selectedData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (selectedData.name || 'rules').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// ---------- boot ----------
show('menu');
loadRulesets();
document.addEventListener('gesturestart', (e) => e.preventDefault());
