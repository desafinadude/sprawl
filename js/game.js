// Game flow: solo challenge and pass-the-hand drafting for 2–4 players (humans and/or bots).
import { City, makeDeck, makeRng, shuffle, scoreCity, R, loadRuleset, setVariants, goalById } from './rules.js';

// The city a player builds in: one shared city for the cooperative sprawl mode, own otherwise.
export const cityOf = (state, p) => (state.mode === 'sprawl' ? state.city : p.city);

// Uses the ruleset currently loaded with loadRuleset(); a copy is kept in the state for saves.
export function newGame({ players, seed = (Math.random() * 2 ** 32) >>> 0, goals, variants }) {
  const rng = makeRng(seed);
  setVariants(variants || []);
  const n = players.length;
  const paired = !!(R.goalSelection && R.goalSelection.mode === 'paired-card-removal');
  const shared = n > 1 && !!(R.multiplayer && R.multiplayer.mode === 'sprawlopolis-pass-left');
  const mode = n === 1 ? 'solo' : shared ? 'sprawl' : 'draft';
  const goalIds = goals || shuffle(R.goals.map((g) => g.id), rng).slice(0, R.goalsPerGame);

  // Paired mode: the chosen goals' linked city cards are set aside and never built.
  const reserved = paired ? new Set(goalIds.map((id) => goalById(id)?.cardId)) : null;
  let deck;
  if (paired) {
    const poolSize = R.cards.filter((c) => !reserved.has(c.def)).reduce((s, c) => s + c.copies, 0);
    deck = makeDeck(poolSize, rng, reserved);
  } else if (mode === 'solo') deck = makeDeck(1 + R.solo.plays, rng);
  else deck = makeDeck(n * (1 + R.draft.rounds * R.draft.hand), rng);

  const countsAsPlay = !!(R.setup && R.setup.startingCardCountsAsPlay);
  const state = { ruleset: R.data, seed, mode, goals: goalIds, variants: variants || [],
    players: [], deck, round: 0, pick: 0, turn: 0, over: false, discards: 0 };
  const mkPlayer = (p, i) => ({ name: p.name || `Player ${i + 1}`, type: p.type || 'human',
    level: p.level || 'normal', city: null, hand: [] });

  if (mode === 'draft') {
    // Legacy: everyone builds their own city with a free starting card.
    state.players = players.map((p, i) => {
      const pl = mkPlayer(p, i);
      pl.city = new City();
      pl.city.place(deck.shift(), 0, 0, 0);
      pl.city.placed = 0; // starting card doesn't count as a play
      return pl;
    });
    state.deck = deck;
    deal(state);
    return state;
  }

  if (mode === 'sprawl') {
    // Cooperative: one shared city; start player holds startPlayerHand, others otherPlayerHand.
    const mp = R.multiplayer;
    state.players = players.map(mkPlayer);
    state.players.forEach((pl, i) => { pl.hand = deck.splice(0, i === 0 ? (mp.startPlayerHand ?? 3) : (mp.otherPlayerHand ?? 1)); });
    state.city = new City();
    state.city.place(deck.shift(), 0, 0, 0); // rules.setup.startingCard = "draw-top"
    state.city.placed = countsAsPlay ? 1 : 0;
    state.deck = deck;
    return state;
  }

  // Solo: the hand is dealt first, then the top card is revealed as the starting placement.
  const pl = mkPlayer(players[0], 0);
  pl.city = new City();
  if (paired) {
    pl.hand = deck.splice(0, R.solo.hand);
    pl.city.place(deck.shift(), 0, 0, 0);
    pl.city.placed = countsAsPlay ? 1 : 0;
  } else {
    pl.city.place(deck.shift(), 0, 0, 0);
    pl.city.placed = 0; // starting card doesn't count as a play
    pl.hand = deck.splice(0, R.solo.hand);
  }
  state.players = [pl];
  state.deck = deck;
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
  const city = cityOf(state, p);
  const chk = city.check(card, rot, x, y);
  if (!chk.ok) throw new Error(chk.reason);
  city.place(card, rot, x, y);
  p.hand.splice(handIndex, 1);
  advance(state);
}

function advance(state) {
  if (state.mode === 'solo') {
    const p = state.players[0];
    if (state.deck.length) p.hand.push(state.deck.shift());
    if (!p.hand.length || p.city.placed >= R.solo.plays) state.over = true;
    return;
  }
  if (state.mode === 'sprawl') {
    // Play one, pass the rest left, draw the visible top card; adapt as the deck empties.
    const n = state.players.length;
    const mp = R.multiplayer || {};
    const cur = state.players[state.turn];
    const next = state.players[(state.turn + 1) % n];
    const pass = Math.min(mp.passUnplayed ?? 2, cur.hand.length);
    for (let i = 0; i < pass; i++) next.hand.unshift(cur.hand.shift());
    const draw = mp.drawAfterPlay ?? 1;
    for (let i = 0; i < draw && state.deck.length; i++) cur.hand.push(state.deck.shift());
    state.turn = (state.turn + 1) % n;
    // The player due to act has nothing left to place → all 15 city cards are built.
    if (!state.players[state.turn].hand.length) state.over = true;
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
  if (state.mode === 'sprawl') {
    // One shared city, one shared target: the team wins together.
    const sc = scoreCity(state.city, state.goals);
    return [{ i: 0, name: 'City', ...sc, winner: sc.win !== false }];
  }
  const rows = state.players.map((p, i) => ({ i, name: p.name, type: p.type, ...scoreCity(p.city, state.goals) }));
  const best = Math.max(...rows.map((r) => r.total));
  rows.forEach((r) => { r.winner = r.total === best; });
  return rows;
}

export function serialize(state) {
  return JSON.stringify({ ...state,
    city: state.city ? state.city.toJSON() : undefined,
    players: state.players.map((p) => ({ ...p, city: p.city ? p.city.toJSON() : undefined })) });
}
export function deserialize(json) {
  const o = JSON.parse(json);
  if (o.ruleset) loadRuleset(o.ruleset);
  setVariants(o.variants || []);
  if (o.city) o.city = City.fromJSON(o.city);
  o.players.forEach((p) => { if (p.city) p.city = City.fromJSON(p.city); });
  return o;
}
