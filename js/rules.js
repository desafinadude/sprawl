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
};

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
  'roadNetworks', 'roadLength', 'bounds', 'cards'];

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
    });
  });
  const ids = (d.goals || []).map((g) => g.id);
  if (new Set(ids).size !== ids.length) errs.push('Goal ids must be unique');
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
export function makeDeck(count, rng) {
  const pool = [];
  for (const c of R.cards) for (let i = 0; i < c.copies; i++) pool.push(c);
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
    if (this.cells.size === 0) return { ok: true, overlap: 0 };
    let overlap = 0, touch = false;
    for (const c of cardCells(card, rot, x, y)) {
      if (this.cells.has(key(c.x, c.y))) { overlap++; touch = true; continue; }
      for (const d of DIRS) if (this.cells.has(key(c.x + d.dx, c.y + d.dy))) touch = true;
    }
    if (!touch) return { ok: false, reason: 'Must touch your city', overlap };
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
  }
  networks.sort((a, b) => b.length - a.length);
  return { groups, networks };
}

const neighbours = (cells, k) => {
  const [x, y] = k.split(',').map(Number);
  return DIRS.map((d) => cells.get(key(x + d.dx, y + d.dy)));
};
const asList = (z) => (z === undefined ? null : Array.isArray(z) ? z : [z]);
const inZones = (list, z) => !list || list.includes(z);

// ---------- Goal counters ----------
// Each takes the analysis context and a `count` spec from the JSON, and returns a number.
const COUNTERS = {
  // Spaces matching filters: zone, road (true/false), touchingEmpty (true/false),
  // touching {zone, min, max} — number of orthogonal neighbours of that zone.
  spaces({ cells }, c) {
    const zones = asList(c.zone);
    const tz = c.touching && asList(c.touching.zone);
    let n = 0;
    for (const [k, cell] of cells) {
      if (!inZones(zones, cell.z)) continue;
      if (c.road !== undefined && !!cell.r !== c.road) continue;
      if (c.touchingEmpty !== undefined || c.touching) {
        const nb = neighbours(cells, k);
        if (c.touchingEmpty !== undefined && nb.some((x) => !x) !== c.touchingEmpty) continue;
        if (c.touching) {
          const m = nb.filter((x) => x && inZones(tz, x.z)).length;
          if (m < (c.touching.min ?? 1) || m > (c.touching.max ?? 4)) continue;
        }
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
  // Number of separate road networks.
  roadNetworks({ networks }) { return networks.length; },
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
};

// Goal score = base + Σ (points × floor(count / per)), then clamped to [min, max].
export function scoreGoal(goal, ctx) {
  const terms = goal.terms || [goal];
  let total = goal.base ?? 0;
  for (const t of terms) {
    const n = COUNTERS[t.count.what](ctx, t.count);
    total += (t.points ?? 1) * Math.floor(n / (t.per ?? 1));
  }
  if (goal.min !== undefined) total = Math.max(goal.min, total);
  if (goal.max !== undefined) total = Math.min(goal.max, total);
  return total;
}

export const goalById = (id) => R.goals.find((g) => g.id === id);

// ---------- Scoring ----------
export function scoreCity(city, goalIds) {
  const a = analyse(city);
  const ctx = { city, cells: city.cells, ...a };
  const zones = {};
  let total = 0;
  for (const z of ZONES) {
    zones[z] = (a.groups[z][0]?.length || 0) * ZONE_INFO[z].largestGroupPoints;
    total += zones[z];
  }
  const roadPenalty = a.networks.length * R.roadNetworkPoints;
  total += roadPenalty;
  const goals = goalIds.map((id) => {
    const g = goalById(id);
    const pts = g ? scoreGoal(g, ctx) : 0;
    total += pts;
    return { id, name: g ? g.name : id, pts };
  });
  return { zones, roads: a.networks.length, roadPenalty, goals, total };
}

export function soloRank(total) {
  const ranks = R.solo.ranks;
  let r = ranks[0]?.[1] || '';
  for (const [t, name] of ranks) if (total >= t) r = name;
  return r;
}
