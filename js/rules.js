// Core rules engine. All game content (zones, cards, goals, numbers) comes from a ruleset JSON
// loaded with loadRuleset(); see data/blocktown.json and the README for the format.
// Pure logic, no DOM — shared by the UI, the bots and the node sim tool.

// ---------- Active ruleset (mutated in place by loadRuleset) ----------
export const ZONES = [];
export const ZONE_INFO = {};
export const R = {
  name: '', maxOverlap: 2, roadNetworkPoints: -1, goalsPerGame: 3,
  solo: { plays: 15, hand: 3, ranks: [[0, 'Unranked']] },
  draft: { rounds: 5, hand: 4 },
  cards: [], goals: [], data: null,
  // schemaVersion 2 (Sprawl Jam) fields; null/undefined for legacy v1 sets.
  schemaVersion: 1, goalSelection: null, setup: null, placement: null,
  victory: null, scoring: null, variants: null, multiplayer: null,
};

// Rotations allowed by the loaded ruleset, in 90° units (e.g. [0,2] for [0,180]).
export function allowedRotations() {
  const rot = R.placement && R.placement.rotation;
  if (!Array.isArray(rot) || !rot.length) return [0, 1, 2, 3];
  return [...new Set(rot.map((a) => ((Math.round(a / 90) % 4) + 4) % 4))].sort();
}

// Road sides as a bitmask per cell. All sides present in a cell meet at its centre.
export const N = 1, E = 2, S = 4, W = 8;
export const DIRS = [
  { bit: N, dx: 0, dy: -1, opp: S },
  { bit: E, dx: 1, dy: 0, opp: W },
  { bit: S, dx: 0, dy: 1, opp: N },
  { bit: W, dx: -1, dy: 0, opp: E },
];
const SIDE_BITS = { N, E, S, W };
const rotSides = (m) => ((m << 1) | (m >> 3)) & 15; // N→E→S→W→N

// ---------- Ruleset loading & validation ----------
const COUNT_TYPES = ['spaces', 'groups', 'groupSize', 'pairs', 'emptyInBounds', 'squares', 'lines',
  'roadNetworks', 'roadLength', 'bounds', 'cards',
  'lineMatches', 'monochromeSquares', 'bestLine', 'roadTriplets', 'roadCycleSections', 'adjacentToSelectedGroup'];
const LINE_DIRS = ['rows', 'cols', 'both'];

// Deep parameter checks for counters (v2 fields included). Returns problems (empty = ok).
function validateCount(c, w, checkZone) {
  const errs = [];
  const lineDir = (d, what) => { if (!LINE_DIRS.includes(d)) errs.push(`${w}: ${what} "direction" must be rows, cols or both`); };
  switch (c.what) {
    case 'lineMatches':
      lineDir(c.direction ?? 'both', 'lineMatches');
      if (c.zone === undefined) errs.push(`${w}: lineMatches needs a "zone"`); else checkZone(c.zone, w);
      if (!Number.isInteger(c.exact)) errs.push(`${w}: lineMatches needs an integer "exact"`);
      if (c.occupiedLinesOnly !== undefined && typeof c.occupiedLinesOnly !== 'boolean') errs.push(`${w}: lineMatches "occupiedLinesOnly" must be true or false`);
      break;
    case 'monochromeSquares':
      if (c.size !== 2) errs.push(`${w}: monochromeSquares only supports "size": 2`);
      if (c.includeOverlapping !== true) errs.push(`${w}: monochromeSquares needs "includeOverlapping": true`);
      break;
    case 'bestLine':
      lineDir(c.direction ?? 'both', 'bestLine');
      if (c.measure === 'zoneCount') { if (c.zone === undefined) errs.push(`${w}: bestLine zoneCount needs a "zone"`); else checkZone(c.zone, w); }
      else if (c.measure !== 'occupiedCount') errs.push(`${w}: bestLine "measure" must be zoneCount or occupiedCount`);
      break;
    case 'roadTriplets':
      if (!Array.isArray(c.ends) || c.ends.length !== 2) errs.push(`${w}: roadTriplets "ends" must be a list of two zones`);
      else c.ends.forEach((z) => checkZone(z, w));
      if (c.center === undefined) errs.push(`${w}: roadTriplets needs a "center" zone`); else checkZone(c.center, w);
      if (c.allowTurns !== undefined && typeof c.allowTurns !== 'boolean') errs.push(`${w}: roadTriplets "allowTurns" must be true or false`);
      if (c.countCenterOnce !== undefined && typeof c.countCenterOnce !== 'boolean') errs.push(`${w}: roadTriplets "countCenterOnce" must be true or false`);
      break;
    case 'roadCycleSections':
      if (c.countSharedOnce !== true) errs.push(`${w}: roadCycleSections needs "countSharedOnce": true`);
      break;
    case 'adjacentToSelectedGroup':
      if (c.zone === undefined) errs.push(`${w}: adjacentToSelectedGroup needs a "zone"`); else checkZone(c.zone, w);
      if (c.relation !== undefined && c.relation !== 'side') errs.push(`${w}: adjacentToSelectedGroup only supports "relation": "side"`);
      break;
    case 'roadNetworks':
      if (c.hasCityEdgeEndpoint !== undefined && typeof c.hasCityEdgeEndpoint !== 'boolean') errs.push(`${w}: roadNetworks "hasCityEdgeEndpoint" must be true or false`);
      if (c.traversesAllZones !== undefined) checkZone(c.traversesAllZones, w);
      if (c.terminalZones !== undefined) checkZone(c.terminalZones, w);
      if (c.terminals !== undefined && !(Number.isInteger(c.terminals) && c.terminals >= 0)) errs.push(`${w}: roadNetworks "terminals" must be a whole number`);
      if (c.distinctTerminalBlocks !== undefined && typeof c.distinctTerminalBlocks !== 'boolean') errs.push(`${w}: roadNetworks "distinctTerminalBlocks" must be true or false`);
      break;
    case 'spaces':
      if (c.adjacent) {
        const a = c.adjacent;
        if (a.relation !== undefined && a.relation !== 'side') errs.push(`${w}: spaces.adjacent only supports "relation": "side"`);
        if (a.onlyZones !== undefined) checkZone(a.onlyZones, w);
        if (a.minOccupied !== undefined && !(Number.isInteger(a.minOccupied) && a.minOccupied >= 0)) errs.push(`${w}: spaces.adjacent "minOccupied" must be a whole number`);
      }
      if (c.cityEdge !== undefined && typeof c.cityEdge !== 'boolean') errs.push(`${w}: spaces "cityEdge" must be true or false`);
      if (c.cornerEdge !== undefined && typeof c.cornerEdge !== 'boolean') errs.push(`${w}: spaces "cornerEdge" must be true or false`);
      if (c.touching && c.touching.relation !== undefined && !['side', 'corner'].includes(c.touching.relation)) errs.push(`${w}: spaces.touching "relation" must be side or corner`);
      break;
    default: break;
  }
  return errs;
}

// schemaVersion 2 (Sprawl Jam) checks. `checkZone` validates zone id(s).
function validateV2(d, checkZone) {
  const errs = [];
  const r = d.rules || {};
  const enumCheck = (path, val, allowed) => { if (val !== undefined && !allowed.includes(val)) errs.push(`${path} must be one of ${allowed.join(' | ')}`); };
  if (!r.goalSelection || r.goalSelection.mode !== 'paired-card-removal') errs.push('schemaVersion 2 needs rules.goalSelection.mode = "paired-card-removal"');
  if (!r.goalSelection || r.goalSelection.target !== 'sum-goal-numbers') errs.push('schemaVersion 2 needs rules.goalSelection.target = "sum-goal-numbers"');
  const setup = r.setup || {};
  if (setup.startingCard !== 'draw-top') errs.push('schemaVersion 2 needs rules.setup.startingCard = "draw-top"');
  if (typeof setup.startingCardCountsAsPlay !== 'boolean') errs.push('schemaVersion 2 needs rules.setup.startingCardCountsAsPlay = true or false');
  if (setup.visibleDrawDeckTop !== undefined && typeof setup.visibleDrawDeckTop !== 'boolean') errs.push('rules.setup.visibleDrawDeckTop must be true or false');
  const pl = r.placement || {};
  if (!Array.isArray(pl.rotation) || !pl.rotation.length || pl.rotation.some((a) => !Number.isInteger(a) || a % 90 !== 0)) {
    errs.push('schemaVersion 2 needs rules.placement.rotation as a non-empty list of quarter-turn angles, e.g. [0,180]');
  }
  enumCheck('rules.placement.connection', pl.connection, ['overlap-or-full-block-edge']);
  enumCheck('rules.placement.overlap', pl.overlap, ['topmost-visible']);
  if (pl.allowUnderlap !== undefined && pl.allowUnderlap !== false) errs.push('rules.placement.allowUnderlap must be false');
  if (!r.victory || r.victory.mode !== 'score-at-least-target') errs.push('schemaVersion 2 needs rules.victory.mode = "score-at-least-target"');
  const sc = r.scoring || {};
  enumCheck('rules.scoring.blockGroups', sc.blockGroups, ['largest-per-zone', 'single-largest-zone']);
  enumCheck('rules.scoring.zoneGroupAdjacency', sc.zoneGroupAdjacency, ['shared-edge']);
  enumCheck('rules.scoring.roads', sc.roads, ['connected-visible-ports']);
  enumCheck('rules.scoring.roadSectionUnit', sc.roadSectionUnit, ['visible-block']);
  enumCheck('rules.scoring.cityEdge', sc.cityEdge, ['exposed-sides-of-occupied-blocks']);
  if (r.multiplayer) {
    enumCheck('rules.multiplayer.mode', r.multiplayer.mode, ['sprawlopolis-pass-left']);
    for (const k of ['startPlayerHand', 'otherPlayerHand', 'passUnplayed', 'drawAfterPlay']) {
      if (r.multiplayer[k] !== undefined && !(Number.isInteger(r.multiplayer[k]) && r.multiplayer[k] >= 0)) errs.push(`rules.multiplayer.${k} must be a whole number`);
    }
    for (const k of ['sharedCity', 'hiddenHands', 'tableTalk']) {
      if (r.multiplayer[k] !== undefined && typeof r.multiplayer[k] !== 'boolean') errs.push(`rules.multiplayer.${k} must be true or false`);
    }
  }
  if (r.variants) {
    if (r.variants.easier && r.variants.easier.roadNetworkPoints !== undefined && typeof r.variants.easier.roadNetworkPoints !== 'number') errs.push('rules.variants.easier.roadNetworkPoints must be a number');
    enumCheck('rules.variants.harder.blockGroups', r.variants.harder && r.variants.harder.blockGroups, ['single-largest-zone']);
  }
  // goals: numbers and paired card links
  const cardIds = new Set((d.cards || []).map((c) => c.id).filter(Boolean));
  const linked = [];
  (d.goals || []).forEach((g, i) => {
    const w = `goals[${i}]${g.id ? ` (${g.id})` : ''}`;
    if (!Number.isInteger(g.number) || g.number < 1) errs.push(`${w}: "number" must be a positive integer (the fixture uses 1–18)`);
    if (typeof g.cardId !== 'string' || !cardIds.has(g.cardId)) errs.push(`${w}: "cardId" must match a cards[*].id`);
    else linked.push(g.cardId);
    if (g.groupSelection) {
      const gs = g.groupSelection;
      if (gs.zone === undefined) errs.push(`${w}: groupSelection needs a "zone"`); else checkZone(gs.zone, w);
      if (gs.rank !== undefined && !(Number.isInteger(gs.rank) && gs.rank >= 1)) errs.push(`${w}: groupSelection "rank" must be a whole number >= 1`);
      enumCheck(`${w}: groupSelection "ties"`, gs.ties, ['maximize-goal-score']);
    }
    if (g.scoreTable !== undefined) {
      if (!g.count) errs.push(`${w}: "scoreTable" needs a "count"`);
      const keys = Object.keys(g.scoreTable);
      if (!keys.length) errs.push(`${w}: "scoreTable" must not be empty`);
      for (const k of keys) {
        if (!/^\d+\+?$/.test(k)) errs.push(`${w}: scoreTable key "${k}" must be a number or a lower bound like "5+"`);
        if (typeof g.scoreTable[k] !== 'number') errs.push(`${w}: scoreTable["${k}"] must be a number`);
      }
    }
  });
  if (new Set(linked).size !== linked.length) errs.push('goals[*].cardId values must be unique — each card pairs with exactly one goal');
  if (r.goalSelection && r.goalSelection.mode === 'paired-card-removal') {
    const nCards = (d.cards || []).length;
    if (linked.length !== nCards) errs.push(`paired mode needs one goal per card: ${linked.length} linked goal(s) for ${nCards} card(s)`);
  }
  return errs;
}

// Returns a list of human-readable problems (empty = valid).
export function validateRuleset(d) {
  const errs = [];
  if (!d || typeof d !== 'object') return ['Not a JSON object'];
  if (!Array.isArray(d.zones) || d.zones.length < 1) errs.push('"zones" must be a non-empty array');
  const zoneIds = new Set((d.zones || []).map((z) => z.id));
  (d.zones || []).forEach((z, i) => { if (!z.id) errs.push(`zones[${i}] needs an "id"`); });
  const checkZone = (z, where) => {
    const list = Array.isArray(z) ? z : [z];
    for (const id of list) if (!zoneIds.has(id)) errs.push(`${where}: unknown zone "${id}"`);
  };
  if (!Array.isArray(d.cards) || !d.cards.length) errs.push('"cards" must be a non-empty array');
  (d.cards || []).forEach((c, i) => {
    const w = `cards[${i}]${c.id ? ` (${c.id})` : ''}`;
    if (!Array.isArray(c.layout) || c.layout.length !== 2 || c.layout.some((r) => !Array.isArray(r) || r.length !== 2)) {
      errs.push(`${w}: "layout" must be 2 rows of 2 zones, e.g. [["home","shop"],["work","park"]]`);
    } else c.layout.flat().forEach((z) => checkZone(z, w));
    if (c.roads !== undefined) {
      if (!Array.isArray(c.roads) || c.roads.length !== 2 || c.roads.some((r) => !Array.isArray(r) || r.length !== 2)) {
        errs.push(`${w}: "roads" must be 2 rows of 2 strings, e.g. [["WE","WE"],["",""]]`);
      } else c.roads.flat().forEach((s) => { if (typeof s !== 'string' || /[^NESW]/i.test(s)) errs.push(`${w}: road "${s}" may only use the letters N, E, S, W`); });
    }
    if (c.copies !== undefined && !(Number.isInteger(c.copies) && c.copies >= 0)) errs.push(`${w}: "copies" must be a whole number`);
  });
  if (!Array.isArray(d.goals)) errs.push('"goals" must be an array (it can be empty)');
  (d.goals || []).forEach((g, i) => {
    const w = `goals[${i}]${g.id ? ` (${g.id})` : ''}`;
    if (!g.id) errs.push(`${w}: needs an "id"`);
    const terms = g.terms || [g];
    terms.forEach((t) => {
      const c = t.count;
      if (!c || !COUNT_TYPES.includes(c.what)) { errs.push(`${w}: "count.what" must be one of ${COUNT_TYPES.join(', ')}`); return; }
      for (const f of ['zone', 'a', 'b', 'zones']) if (c[f] !== undefined) checkZone(c[f], w);
      if (c.touching && c.touching.zone !== undefined) checkZone(c.touching.zone, w);
      errs.push(...validateCount(c, w, checkZone));
    });
    if (g.groupSelection) {
      if (g.terms === undefined) errs.push(`${w}: groupSelection needs a "terms" list to score`);
      if (g.groupSelection.zone !== undefined) checkZone(g.groupSelection.zone, w);
    }
  });
  const ids = (d.goals || []).map((g) => g.id);
  if (new Set(ids).size !== ids.length) errs.push('Goal ids must be unique');
  // schemaVersion handling: missing = legacy v1 (but v2-only fields must not appear silently)
  if (d.schemaVersion === undefined) {
    const r = d.rules || {};
    const v2Hints = r.goalSelection || r.victory || r.placement || r.multiplayer || r.scoring || r.variants
      || (d.goals || []).some((g) => g.number !== undefined || g.cardId !== undefined || g.scoreTable !== undefined || g.groupSelection !== undefined);
    if (v2Hints) errs.push('Found schemaVersion-2 fields but no "schemaVersion": 2 — add it to opt into the new engine');
  } else if (d.schemaVersion === 2) {
    errs.push(...validateV2(d, checkZone));
  } else if (d.schemaVersion !== 1) {
    errs.push(`Unsupported "schemaVersion": ${d.schemaVersion} (supported: 1, 2)`);
  }
  return errs;
}

export function loadRuleset(d) {
  const errs = validateRuleset(d);
  if (errs.length) throw new Error(errs.join('\n'));
  const r = d.rules || {};
  ZONES.length = 0;
  for (const k of Object.keys(ZONE_INFO)) delete ZONE_INFO[k];
  for (const z of d.zones) {
    ZONES.push(z.id);
    ZONE_INFO[z.id] = { name: z.name || z.id, color: z.color || '#cccccc', icon: z.icon || z.id.slice(0, 1).toUpperCase(),
      largestGroupPoints: z.largestGroupPoints ?? 1 };
  }
  R.name = d.name || 'Custom';
  R.maxOverlap = r.maxOverlap ?? 2;
  R.roadNetworkPoints = r.roadNetworkPoints ?? -1;
  R.goalsPerGame = r.goalsPerGame ?? 3;
  R.solo = { plays: 15, hand: 3, ranks: [[0, 'Unranked']], ...(r.solo || {}) };
  R.draft = { rounds: 5, hand: 4, ...(r.draft || {}) };
  R.schemaVersion = d.schemaVersion ?? 1;
  R.goalSelection = r.goalSelection ?? null;
  R.setup = r.setup ?? null;
  R.placement = r.placement ?? null;
  R.victory = r.victory ?? null;
  R.scoring = r.scoring ?? null;
  R.variants = r.variants ?? null;
  R.multiplayer = r.multiplayer ?? null;
  R.cards = d.cards.map((c, i) => ({
    def: c.id || 'card' + (i + 1),
    copies: c.copies ?? 1,
    cells: c.layout.flat(),
    roads: (c.roads || [['', ''], ['', '']]).flat().map((s) => [...s.toUpperCase()].reduce((m, ch) => m | SIDE_BITS[ch], 0)),
  }));
  R.goals = d.goals.filter((g) => g.enabled !== false);
  R.data = d;
  return R;
}

// ---------- RNG ----------
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Cards ----------
// A card is a 2×2 block. cells/roads are indexed 0=(top-left) 1=(top-right) 2=(bottom-left) 3=(bottom-right).

// Rotate a card's 4 cells 90° clockwise `times` times. Returns {cells, roads}.
export function rotated(card, times) {
  let cells = card.cells.slice();
  let roads = card.roads.slice();
  for (let t = 0; t < ((times % 4) + 4) % 4; t++) {
    // new[r][c] = old[1-c][r]  →  new index map: 0←2, 1←0, 2←3, 3←1
    cells = [cells[2], cells[0], cells[3], cells[1]];
    roads = [roads[2], roads[0], roads[3], roads[1]].map(rotSides);
  }
  return { cells, roads };
}

export function cardCells(card, rot, x, y) {
  const { cells, roads } = rotated(card, rot);
  return [0, 1, 2, 3].map((i) => ({ x: x + (i & 1), y: y + (i >> 1), z: cells[i], r: roads[i] }));
}

// Build a shuffled deck of `count` cards from the ruleset. If the ruleset has fewer cards than
// needed, further shuffled copies of the whole set are added. Each dealt card gets a unique id.
// `exclude` (optional) is a Set of card defs left out entirely (paired goal selection removes
// the city faces of the chosen goals).
export function makeDeck(count, rng, exclude) {
  const pool = [];
  for (const c of R.cards) {
    if (exclude && exclude.has(c.def)) continue;
    for (let i = 0; i < c.copies; i++) pool.push(c);
  }
  if (!pool.length) throw new Error('Ruleset has no cards');
  const deck = [];
  while (deck.length < count) deck.push(...shuffle(pool.slice(), rng));
  return deck.slice(0, count).map((c, i) => ({ id: i, def: c.def, cells: c.cells.slice(), roads: c.roads.slice() }));
}

// ---------- City ----------
export const key = (x, y) => x + ',' + y;

export class City {
  constructor(entries) {
    this.cells = new Map(entries || []);
    this.placed = 0;
  }
  get(x, y) { return this.cells.get(key(x, y)); }
  toJSON() { return { cells: [...this.cells.entries()], placed: this.placed }; }
  static fromJSON(o) { const c = new City(o.cells); c.placed = o.placed; return c; }
  bounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const k of this.cells.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (minX === Infinity) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    return { minX, minY, maxX, maxY };
  }
  // Check a placement. Returns {ok, reason, overlap}.
  check(card, rot, x, y) {
    const r4 = ((rot % 4) + 4) % 4;
    if (!allowedRotations().includes(r4)) {
      return { ok: false, reason: `Rotation ${r4 * 90}° is not allowed here (allowed: ${allowedRotations().map((a) => a * 90).join(', ')}°)`, overlap: 0 };
    }
    if (this.cells.size === 0) return { ok: true, overlap: 0 };
    let overlap = 0, touch = false;
    for (const c of cardCells(card, rot, x, y)) {
      if (this.cells.has(key(c.x, c.y))) { overlap++; touch = true; continue; }
      for (const d of DIRS) if (this.cells.has(key(c.x + d.dx, c.y + d.dy))) touch = true;
    }
    if (!touch) {
      const why = R.placement && R.placement.connection === 'overlap-or-full-block-edge'
        ? 'Must overlap a block or share a full block edge with the city (corner touches do not count)'
        : 'Must touch your city';
      return { ok: false, reason: why, overlap };
    }
    if (overlap > R.maxOverlap) {
      return { ok: false, reason: R.maxOverlap ? `Can cover at most ${R.maxOverlap} spaces` : 'Cards may not overlap', overlap };
    }
    return { ok: true, overlap };
  }
  // Place and return an undo record.
  place(card, rot, x, y) {
    const undo = [];
    for (const c of cardCells(card, rot, x, y)) {
      const k = key(c.x, c.y);
      undo.push([k, this.cells.get(k)]);
      this.cells.set(k, { z: c.z, r: c.r, id: card.id });
    }
    this.placed++;
    return undo;
  }
  undo(rec) {
    for (const [k, v] of rec) { if (v === undefined) this.cells.delete(k); else this.cells.set(k, v); }
    this.placed--;
  }
}

// ---------- Analysis ----------
// A road terminal is an unpaired road port: it faces an unoccupied grid cell (edge terminal)
// or an occupied cell without the reciprocal port (internal terminal).
function buildNetInfo(cells, members) {
  const memberSet = new Set(members);
  const zones = new Set();
  const terminals = [];
  for (const k of members) {
    const c = cells.get(k);
    zones.add(c.z);
    const [x, y] = k.split(',').map(Number);
    for (const d of DIRS) {
      if (!(c.r & d.bit)) continue;
      const n = cells.get(key(x + d.dx, y + d.dy));
      if (n && (n.r & d.opp)) continue; // reciprocal port → internal edge
      terminals.push({ k, dir: d.bit, edge: !n, zone: c.z });
    }
  }
  // Adjacency among this network's members (reciprocal road ports only).
  const adj = new Map(members.map((k) => [k, []]));
  for (const k of members) {
    const c = cells.get(k);
    const [x, y] = k.split(',').map(Number);
    for (const d of DIRS) {
      if (!(c.r & d.bit)) continue;
      const nk = key(x + d.dx, y + d.dy);
      const n = cells.get(nk);
      if (n && (n.r & d.opp) && memberSet.has(nk)) adj.get(k).push(nk);
    }
  }
  // Bridges (Tarjan lowlink). A section lies on some cycle iff it touches a non-bridge edge.
  const disc = new Map(), low = new Map();
  const bridges = new Set();
  let time = 0;
  const dfs = (u, parent) => {
    disc.set(u, ++time); low.set(u, time);
    for (const v of adj.get(u)) {
      if (v === parent) continue;
      if (disc.has(v)) low.set(u, Math.min(low.get(u), disc.get(v)));
      else {
        dfs(v, u);
        low.set(u, Math.min(low.get(u), low.get(v)));
        if (low.get(v) > disc.get(u)) bridges.add(u + '|' + v);
      }
    }
  };
  for (const k of members) if (!disc.has(k)) dfs(k, null);
  let cycleSections = 0;
  for (const k of members) {
    if (adj.get(k).some((v) => !bridges.has(k + '|' + v) && !bridges.has(v + '|' + k))) cycleSections++;
  }
  return {
    members, size: members.length, terminals, zones, adj,
    hasEdgeEndpoint: terminals.some((t) => t.edge),
    cycleSections,
  };
}

// An occupied block is on the city edge if any orthogonal neighbour is unoccupied
// (irregular outlines and holes count), and on a corner if two perpendicular sides are exposed.
export function isCityEdge(cells, k) {
  const [x, y] = k.split(',').map(Number);
  return DIRS.some((d) => !cells.has(key(x + d.dx, y + d.dy)));
}
export function isCornerEdge(cells, k) {
  const [x, y] = k.split(',').map(Number);
  const n = !cells.has(key(x, y - 1)), e = !cells.has(key(x + 1, y));
  const s = !cells.has(key(x, y + 1)), w = !cells.has(key(x - 1, y));
  return (n && e) || (e && s) || (s && w) || (w && n);
}

export function analyse(city) {
  const cells = city.cells;
  const groups = {};
  for (const z of ZONES) groups[z] = [];
  const seen = new Set();
  for (const [k, cell] of cells) {
    if (seen.has(k)) continue;
    const stack = [k]; seen.add(k);
    const members = [];
    while (stack.length) {
      const cur = stack.pop();
      members.push(cur);
      const [x, y] = cur.split(',').map(Number);
      for (const d of DIRS) {
        const nk = key(x + d.dx, y + d.dy);
        const n = cells.get(nk);
        if (n && n.z === cell.z && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
      }
    }
    (groups[cell.z] ||= []).push(members);
  }
  for (const z in groups) groups[z].sort((a, b) => b.length - a.length);

  // Road networks: cells with roads, linked where both sides meet.
  const roadSeen = new Set();
  const networks = [];
  const netInfo = [];
  for (const [k, cell] of cells) {
    if (!cell.r || roadSeen.has(k)) continue;
    const stack = [k]; roadSeen.add(k);
    const members = [];
    while (stack.length) {
      const cur = stack.pop();
      members.push(cur);
      const c = cells.get(cur);
      const [x, y] = cur.split(',').map(Number);
      for (const d of DIRS) {
        if (!(c.r & d.bit)) continue;
        const nk = key(x + d.dx, y + d.dy);
        const n = cells.get(nk);
        if (n && (n.r & d.opp) && !roadSeen.has(nk)) { roadSeen.add(nk); stack.push(nk); }
      }
    }
    networks.push(members);
    netInfo.push(buildNetInfo(cells, members));
  }
  // Longest first, keeping networks and their info aligned.
  const order = networks.map((_, i) => i).sort((a, b) => networks[b].length - networks[a].length);
  return { groups, networks: order.map((i) => networks[i]), netInfo: order.map((i) => netInfo[i]) };
}

const neighbours = (cells, k) => {
  const [x, y] = k.split(',').map(Number);
  return DIRS.map((d) => cells.get(key(x + d.dx, y + d.dy)));
};
const cornerNeighbours = (cells, k) => {
  const [x, y] = k.split(',').map(Number);
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => cells.get(key(x + dx, y + dy)));
};
const asList = (z) => (z === undefined ? null : Array.isArray(z) ? z : [z]);
const inZones = (list, z) => !list || list.includes(z);
const sameMultiset = (a, b) => {
  if (a.length !== b.length) return false;
  const cnt = {};
  for (const x of a) cnt[x] = (cnt[x] || 0) + 1;
  for (const x of b) { if (!cnt[x]) return false; cnt[x]--; }
  return true;
};

// ---------- Goal counters ----------
// Each takes the analysis context and a `count` spec from the JSON, and returns a number.
const COUNTERS = {
  // Spaces matching filters: zone, road (true/false), touchingEmpty (true/false),
  // touching {zone, min, max, relation: side|corner}, adjacent {relation, onlyZones, minOccupied},
  // cityEdge / cornerEdge (true/false).
  spaces({ cells }, c) {
    const zones = asList(c.zone);
    const tz = c.touching && asList(c.touching.zone);
    let n = 0;
    for (const [k, cell] of cells) {
      if (!inZones(zones, cell.z)) continue;
      if (c.road !== undefined && !!cell.r !== c.road) continue;
      if (c.cityEdge !== undefined && isCityEdge(cells, k) !== c.cityEdge) continue;
      if (c.cornerEdge !== undefined && isCornerEdge(cells, k) !== c.cornerEdge) continue;
      if (c.touchingEmpty !== undefined) {
        if (neighbours(cells, k).some((x) => !x) !== c.touchingEmpty) continue;
      }
      if (c.touching) {
        const nb = c.touching.relation === 'corner' ? cornerNeighbours(cells, k) : neighbours(cells, k);
        const m = nb.filter((x) => x && inZones(tz, x.z)).length;
        if (m < (c.touching.min ?? 1) || m > (c.touching.max ?? 4)) continue;
      }
      if (c.adjacent) {
        const occ = neighbours(cells, k).filter(Boolean);
        if (occ.length < (c.adjacent.minOccupied ?? 1)) continue;
        const allowed = asList(c.adjacent.onlyZones);
        if (allowed && occ.some((x) => !allowed.includes(x.z))) continue;
      }
      n++;
    }
    return n;
  },
  // Number of connected groups of a zone with size between minSize and maxSize.
  groups({ groups }, c) {
    let n = 0;
    for (const z of asList(c.zone) || ZONES) {
      n += (groups[z] || []).filter((g) => g.length >= (c.minSize ?? 1) && g.length <= (c.maxSize ?? Infinity)).length;
    }
    return n;
  },
  // Size of the Nth largest group of a zone (rank 1 = largest).
  groupSize({ groups }, c) {
    return (groups[c.zone] || [])[(c.rank ?? 1) - 1]?.length || 0;
  },
  // Pairs of orthogonally touching spaces, one of zone a and one of zone b (each pair counted once).
  pairs({ cells }, c) {
    let n = 0;
    for (const [k, cell] of cells) {
      const [x, y] = k.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const o = cells.get(key(x + dx, y + dy));
        if (!o) continue;
        if ((cell.z === c.a && o.z === c.b) || (cell.z === c.b && o.z === c.a)) n++;
      }
    }
    return n;
  },
  // Empty spaces inside the city's bounding rectangle.
  emptyInBounds({ city }) {
    const b = city.bounds();
    return (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1) - city.cells.size;
  },
  // 2×2 areas that contain every zone in `zones` (default: all) and spaces from at least `minCards` cards.
  squares({ city, cells }, c) {
    const need = asList(c.zones) || ZONES;
    const b = city.bounds(); let n = 0;
    for (let y = b.minY; y < b.maxY; y++) for (let x = b.minX; x < b.maxX; x++) {
      const s = new Set(), ids = new Set(); let filled = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const o = cells.get(key(x + dx, y + dy));
        if (o) { s.add(o.z); ids.add(o.id); filled++; }
      }
      if (filled === 4 && need.every((z) => s.has(z)) && ids.size >= (c.minCards ?? 1)) n++;
    }
    return n;
  },
  // Rows and/or columns ("rows" | "cols" | "both") containing every zone in `zones` (default: all).
  lines({ city, cells }, c) {
    const need = asList(c.zones) || ZONES;
    const dir = c.direction || 'both';
    const b = city.bounds(); let n = 0;
    const test = (s) => need.every((z) => s.has(z));
    if (dir !== 'cols') for (let y = b.minY; y <= b.maxY; y++) {
      const s = new Set(); for (let x = b.minX; x <= b.maxX; x++) { const o = cells.get(key(x, y)); if (o) s.add(o.z); }
      if (test(s)) n++;
    }
    if (dir !== 'rows') for (let x = b.minX; x <= b.maxX; x++) {
      const s = new Set(); for (let y = b.minY; y <= b.maxY; y++) { const o = cells.get(key(x, y)); if (o) s.add(o.z); }
      if (test(s)) n++;
    }
    return n;
  },
  // Number of separate road networks, optionally filtered (all filters combine with AND):
  // hasCityEdgeEndpoint, traversesAllZones, terminals, terminalZones + distinctTerminalBlocks.
  roadNetworks({ networks, netInfo }, c) {
    return (netInfo || []).filter((info) => {
      if (c.hasCityEdgeEndpoint !== undefined && info.hasEdgeEndpoint !== c.hasCityEdgeEndpoint) return false;
      if (c.traversesAllZones && !c.traversesAllZones.every((z) => info.zones.has(z))) return false;
      if (c.terminals !== undefined && info.terminals.length !== c.terminals) return false;
      if (c.terminalZones) {
        if (c.distinctTerminalBlocks) {
          const seen = new Set();
          const blockZones = [];
          for (const t of info.terminals) {
            if (seen.has(t.k)) return false; // two terminals in the same block
            seen.add(t.k); blockZones.push(t.zone);
          }
          if (!sameMultiset(blockZones, c.terminalZones)) return false;
        } else if (!sameMultiset(info.terminals.map((t) => t.zone), c.terminalZones)) return false;
      }
      return true;
    }).length;
  },
  // Road spaces in the Nth longest road network (rank 1 = longest).
  roadLength({ networks }, c) { return networks[(c.rank ?? 1) - 1]?.length || 0; },
  // City size: measure "width" | "height" | "area" (of bounding box) | "spaces" (filled spaces).
  bounds({ city }, c) {
    const b = city.bounds();
    const w = b.maxX - b.minX + 1, h = b.maxY - b.minY + 1;
    return { width: w, height: h, area: w * h, spaces: city.cells.size }[c.measure || 'spaces'] ?? 0;
  },
  // Cards with at least `minVisible` spaces (default 1) still showing.
  cards({ cells }, c) {
    const vis = new Map();
    for (const cell of cells.values()) vis.set(cell.id, (vis.get(cell.id) || 0) + 1);
    return [...vis.values()].filter((v) => v >= (c.minVisible ?? 1)).length;
  },
  // Rows/columns whose count of a zone equals `exact` (occupiedLinesOnly: lines need >=1 block).
  lineMatches({ city, cells }, c) {
    const b = city.bounds();
    const zones = asList(c.zone);
    const dir = c.direction || 'both';
    const occOnly = c.occupiedLinesOnly !== false;
    let n = 0;
    const test = (occ, hits) => { if ((!occOnly || occ > 0) && hits === c.exact) n++; };
    if (dir !== 'cols') for (let y = b.minY; y <= b.maxY; y++) {
      let occ = 0, hits = 0;
      for (let x = b.minX; x <= b.maxX; x++) { const o = cells.get(key(x, y)); if (o) { occ++; if (inZones(zones, o.z)) hits++; } }
      test(occ, hits);
    }
    if (dir !== 'rows') for (let x = b.minX; x <= b.maxX; x++) {
      let occ = 0, hits = 0;
      for (let y = b.minY; y <= b.maxY; y++) { const o = cells.get(key(x, y)); if (o) { occ++; if (inZones(zones, o.z)) hits++; } }
      test(occ, hits);
    }
    return n;
  },
  // Fully occupied 2×2 squares whose four blocks share one zone; overlapping squares each count.
  monochromeSquares({ cells }, c) {
    let n = 0;
    for (const [k, cell] of cells) {
      const [x, y] = k.split(',').map(Number);
      const a = cells.get(key(x + 1, y)), b2 = cells.get(key(x, y + 1)), d = cells.get(key(x + 1, y + 1));
      if (a && b2 && d && a.z === cell.z && b2.z === cell.z && d.z === cell.z) n++;
    }
    return n;
  },
  // Largest count in one row/column: zoneCount (of `zone`) or occupiedCount. Gaps never count.
  bestLine({ city, cells }, c) {
    const b = city.bounds();
    const zones = asList(c.zone);
    const dir = c.direction || 'both';
    const val = (o) => (o && (c.measure !== 'zoneCount' || inZones(zones, o.z))) ? 1 : 0;
    let best = 0;
    if (dir !== 'cols') for (let y = b.minY; y <= b.maxY; y++) {
      let s = 0; for (let x = b.minX; x <= b.maxX; x++) s += val(cells.get(key(x, y)));
      if (s > best) best = s;
    }
    if (dir !== 'rows') for (let x = b.minX; x <= b.maxX; x++) {
      let s = 0; for (let y = b.minY; y <= b.maxY; y++) s += val(cells.get(key(x, y)));
      if (s > best) best = s;
    }
    return best;
  },
  // Road blocks of `center` zone with two distinct connected road neighbours whose zones match
  // the `ends` multiset (straight or, with allowTurns, a 90° step).
  roadTriplets({ cells }, c) {
    const allowTurns = c.allowTurns !== false;
    let n = 0;
    for (const [k, cell] of cells) {
      if (cell.z !== c.center || !cell.r) continue;
      const [x, y] = k.split(',').map(Number);
      const conns = [];
      for (const d of DIRS) {
        if (!(cell.r & d.bit)) continue;
        const o = cells.get(key(x + d.dx, y + d.dy));
        if (o && (o.r & d.opp)) conns.push({ dir: d, zone: o.z });
      }
      let pairs = 0;
      for (let i = 0; i < conns.length; i++) for (let j = i + 1; j < conns.length; j++) {
        if (!sameMultiset([conns[i].zone, conns[j].zone], c.ends)) continue;
        if (!allowTurns && conns[i].dir.opp !== conns[j].dir.bit) continue;
        pairs++;
      }
      if (pairs) n += c.countCenterOnce === false ? pairs : 1;
    }
    return n;
  },
  // Visible road sections that belong to at least one completed loop (each section once).
  roadCycleSections({ netInfo }) {
    return (netInfo || []).reduce((s, info) => s + info.cycleSections, 0);
  },
  // Distinct blocks of a zone sharing an edge with the group chosen by goal.groupSelection.
  adjacentToSelectedGroup({ cells, selectedGroup }, c) {
    if (!selectedGroup) return 0;
    const inGroup = selectedGroup instanceof Set ? selectedGroup : new Set(selectedGroup);
    const zones = asList(c.zone);
    let n = 0;
    for (const [k, cell] of cells) {
      if (!inZones(zones, cell.z) || inGroup.has(k)) continue;
      const [x, y] = k.split(',').map(Number);
      if (DIRS.some((d) => inGroup.has(key(x + d.dx, y + d.dy)))) n++;
    }
    return n;
  },
};

function evalTerms(goal, ctx) {
  const terms = goal.terms || [goal];
  let total = goal.base ?? 0;
  for (const t of terms) {
    const n = COUNTERS[t.count.what](ctx, t.count);
    total += (t.points ?? 1) * Math.floor(n / (t.per ?? 1));
  }
  return total;
}

// Exact key, else the greatest "n+" lower bound that fits. Returns undefined if nothing matches.
function lookupScoreTable(table, n) {
  const exact = table[String(n)];
  if (exact !== undefined) return exact;
  let best, bestLb = -Infinity;
  for (const [k, v] of Object.entries(table)) {
    if (!k.endsWith('+')) continue;
    const lb = parseInt(k, 10);
    if (n >= lb && lb > bestLb) { bestLb = lb; best = v; }
  }
  return best;
}

// Goal score = base + Σ (points × floor(count / per)), clamped to [min, max].
// scoreTable goals return the looked-up value directly; groupSelection goals evaluate
// every group tied at the requested rank and keep the best total ("maximize-goal-score").
export function scoreGoal(goal, ctx) {
  const clamp = (v) => {
    if (goal.min !== undefined) v = Math.max(goal.min, v);
    if (goal.max !== undefined) v = Math.min(goal.max, v);
    return v;
  };
  if (goal.scoreTable) {
    const n = COUNTERS[goal.count.what](ctx, goal.count);
    return clamp(lookupScoreTable(goal.scoreTable, n) ?? 0);
  }
  if (goal.groupSelection) {
    const gs = goal.groupSelection;
    const list = ctx.groups[gs.zone] || [];
    const size = list[(gs.rank ?? 1) - 1]?.length || 0;
    const candidates = list.filter((g) => g.length === size);
    let best = -Infinity;
    for (const g of candidates) {
      ctx.selectedGroup = g;
      const s = clamp(evalTerms(goal, ctx));
      if (s > best) best = s;
    }
    ctx.selectedGroup = null;
    return best === -Infinity ? clamp(0) : best;
  }
  return clamp(evalTerms(goal, ctx));
}

export const goalById = (id) => R.goals.find((g) => g.id === id);

// ---------- Scoring ----------
// Optional variant toggles chosen at game start ("easier" / "harder"), set by game.js.
let ACTIVE_VARIANTS = [];
export function setVariants(v) { ACTIVE_VARIANTS = Array.isArray(v) ? v : []; }
export const activeVariants = () => ACTIVE_VARIANTS;

export function scoreCity(city, goalIds, variants) {
  const vlist = variants || ACTIVE_VARIANTS;
  const a = analyse(city);
  const ctx = { city, cells: city.cells, selectedGroup: null, ...a };
  const zones = {};
  let total = 0;
  if (vlist.includes('harder')) {
    // Score only the single largest group of one zone type (the best zone).
    let bestPts = 0;
    for (const z of ZONES) {
      const pts = (a.groups[z][0]?.length || 0) * ZONE_INFO[z].largestGroupPoints;
      if (pts > bestPts) bestPts = pts;
    }
    for (const z of ZONES) zones[z] = 0;
    for (const z of ZONES) {
      const pts = (a.groups[z][0]?.length || 0) * ZONE_INFO[z].largestGroupPoints;
      if (pts === bestPts && bestPts > 0) { zones[z] = pts; break; }
    }
    total = bestPts;
  } else {
    for (const z of ZONES) {
      zones[z] = (a.groups[z][0]?.length || 0) * ZONE_INFO[z].largestGroupPoints;
      total += zones[z];
    }
  }
  let roadNetPoints = R.roadNetworkPoints;
  if (vlist.includes('easier') && R.variants && R.variants.easier && R.variants.easier.roadNetworkPoints !== undefined) {
    roadNetPoints = R.variants.easier.roadNetworkPoints;
  }
  const roadPenalty = a.networks.length * roadNetPoints;
  total += roadPenalty;
  const goals = goalIds.map((id) => {
    const g = goalById(id);
    const pts = g ? scoreGoal(g, ctx) : 0;
    total += pts;
    return { id, name: g ? g.name : id, pts, number: g ? g.number : undefined };
  });
  const out = { zones, roads: a.networks.length, roadPenalty, goals, total };
  if (R.victory && R.victory.mode === 'score-at-least-target') {
    out.target = goalIds.reduce((s, id) => s + (goalById(id)?.number ?? 0), 0);
    out.win = total >= out.target;
  }
  return out;
}

export function soloRank(total) {
  const ranks = R.solo.ranks;
  let r = ranks[0]?.[1] || '';
  for (const [t, name] of ranks) if (total >= t) r = name;
  return r;
}
