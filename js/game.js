// Game flow: solo challenge and pass-the-hand drafting for 2–4 players (humans and/or bots).
import { City, makeDeck, makeRng, shuffle, scoreCity, R, loadRuleset } from './rules.js';

// Uses the ruleset currently loaded with loadRuleset(); a copy is kept in the state for saves.
export function newGame({ players, seed = (Math.random() * 2 ** 32) >>> 0, goals }) {
  const rng = makeRng(seed);
  const mode = players.length === 1 ? 'solo' : 'draft';
  const goalIds = goals || shuffle(R.goals.map((g) => g.id), rng).slice(0, R.goalsPerGame);
  const n = players.length;
  const deck = mode === 'solo'
    ? makeDeck(1 + R.solo.plays, rng)
    : makeDeck(n * (1 + R.draft.rounds * R.draft.hand), rng);

  const ps = players.map((p, i) => {
    const city = new City();
    const start = deck.shift();
    city.place(start, 0, 0, 0);
    city.placed = 0; // starting card doesn't count as a play
    return { name: p.name || `Player ${i + 1}`, type: p.type || 'human', level: p.level || 'normal', city, hand: [] };
  });

  const state = { ruleset: R.data, seed, mode, goals: goalIds, players: ps, deck, round: 0, pick: 0, turn: 0, over: false, discards: 0 };
  if (mode === 'solo') ps[0].hand = deck.splice(0, R.solo.hand);
  else deal(state);
  return state;
}

function deal(state) {
  for (const p of state.players) p.hand = state.deck.splice(0, R.draft.hand);
}

export const current = (state) => state.players[state.turn];
export const humans = (state) => state.players.filter((p) => p.type === 'human').length;

export function picksTotal(state) {
  return state.mode === 'solo' ? R.solo.plays : R.draft.rounds * (R.draft.hand - 1);
}

export function playCard(state, handIndex, rot, x, y) {
  const p = current(state);
  const card = p.hand[handIndex];
  if (!card) throw new Error('No such card');
  const chk = p.city.check(card, rot, x, y);
  if (!chk.ok) throw new Error(chk.reason);
  p.city.place(card, rot, x, y);
  p.hand.splice(handIndex, 1);
  advance(state);
}

function advance(state) {
  if (state.mode === 'solo') {
    const p = state.players[0];
    if (state.deck.length) p.hand.push(state.deck.shift());
    if (!p.hand.length) state.over = true;
    return;
  }
  const n = state.players.length;
  state.turn++;
  if (state.turn < n) return;
  state.turn = 0;
  state.pick++;
  if (state.pick >= R.draft.hand - 1) {
    state.discards += n;
    state.round++;
    state.pick = 0;
    if (state.round >= R.draft.rounds) { state.over = true; for (const p of state.players) p.hand = []; return; }
    deal(state);
  } else {
    // pass hands: left on even rounds, right on odd rounds
    const dir = state.round % 2 === 0 ? 1 : -1;
    const hands = state.players.map((p) => p.hand);
    state.players.forEach((p, i) => { p.hand = hands[(i - dir + n) % n]; });
  }
}

export function passDirection(state) {
  return state.round % 2 === 0 ? 'left' : 'right';
}

export function results(state) {
  const rows = state.players.map((p, i) => ({ i, name: p.name, type: p.type, ...scoreCity(p.city, state.goals) }));
  const best = Math.max(...rows.map((r) => r.total));
  rows.forEach((r) => { r.winner = r.total === best; });
  return rows;
}

export function serialize(state) {
  return JSON.stringify({ ...state, players: state.players.map((p) => ({ ...p, city: p.city.toJSON() })) });
}
export function deserialize(json) {
  const o = JSON.parse(json);
  if (o.ruleset) loadRuleset(o.ruleset);
  o.players.forEach((p) => { p.city = City.fromJSON(p.city); });
  return o;
}
