// Core rules for Blocktown: cards, city grid, placement and scoring.
// Pure logic, no DOM — shared by the UI, the bots and the node sim tool.

export const ZONES = ['home', 'shop', 'work', 'park'];
export const ZONE_INFO = {
  home: { name: 'Housing', short: 'Homes', color: '#f4c95d' },
  shop: { name: 'Market', short: 'Shops', color: '#5aa9e6' },
  work: { name: 'Industry', short: 'Works', color: '#b0a3b8' },
  park: { name: 'Park', short: 'Parks', color: '#7cc47f' },
};

// Road sides as a bitmask per cell. All sides present in a cell meet at its centre.
export const N = 1, E = 2, S = 4, W = 8;
export const DIRS = [
  { bit: N, dx: 0, dy: -1, opp: S },
  { bit: E, dx: 1, dy: 0, opp: W },
  { bit: S, dx: 0, dy: 1, opp: N },
  { bit: W, dx: -1, dy: 0, opp: E },
];
const rotSides = (m) => ((m << 1) | (m >> 3)) & 15; // N→E→S→W→N

export const MAX_OVERLAP = 2; // a new card may cover at most this many cells
export const DRAFT_ROUNDS = 5;
export const DRAFT_HAND = 4; // cards dealt per player per round (3 picked, 1 discarded)
export const SOLO_PLAYS = 15;
export const SOLO_HAND = 3;

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
const ROAD_TEMPLATES = [
  { w: 3, roads: [W | E, W | E, 0, 0] }, // straight
  { w: 3, roads: [W | S, 0, N | E, W | E] }, // S-bend
  { w: 2, roads: [W | E, W | S, 0, N | S] }, // corner
  { w: 2, roads: [W | E, W | E | S, 0, N | S] }, // tee
  { w: 1, roads: [0, 0, W | E, W] }, // dead end
  { w: 1, roads: [N | S, 0, N | S, 0] }, // straight (offset)
  { w: 1, roads: [0, 0, 0, 0] }, // no road
];

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

export function makeDeck(count, rng, idStart = 0) {
  const total = ROAD_TEMPLATES.reduce((s, t) => s + t.w, 0);
  const deck = [];
  for (let n = 0; n < count; n++) {
    let cells;
    do {
      cells = [0, 1, 2, 3].map(() => ZONES[Math.floor(rng() * 4)]);
    } while (new Set(cells).size < 2 || (new Set(cells).size === 2 && rng() < 0.4));
    let pick = rng() * total, tpl = ROAD_TEMPLATES[0];
    for (const t of ROAD_TEMPLATES) { if ((pick -= t.w) < 0) { tpl = t; break; } }
    const base = rotated({ cells: [0, 1, 2, 3], roads: tpl.roads }, Math.floor(rng() * 4));
    deck.push({ id: idStart + n, cells, roads: base.roads });
  }
  return deck;
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
    if (overlap > MAX_OVERLAP) return { ok: false, reason: `Can cover at most ${MAX_OVERLAP} spaces`, overlap };
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
  const groups = { home: [], shop: [], work: [], park: [] };
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
    groups[cell.z].push(members);
  }
  for (const z of ZONES) groups[z].sort((a, b) => b.length - a.length);

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

// ---------- Goals ----------
const countCells = (cells, fn) => { let n = 0; for (const [k, c] of cells) if (fn(c, k)) n++; return n; };

export const GOALS = [
  { id: 'quiet', name: 'Quiet Streets', text: '+1 per Housing space with no road.',
    score: ({ cells }) => countCells(cells, (c) => c.z === 'home' && !c.r) },
  { id: 'main', name: 'Main Street', text: '+1 per Market space with a road.',
    score: ({ cells }) => countCells(cells, (c) => c.z === 'shop' && c.r) },
  { id: 'freight', name: 'Freight Lines', text: '+1 per Industry space with a road.',
    score: ({ cells }) => countCells(cells, (c) => c.z === 'work' && c.r) },
  { id: 'belt', name: 'Green Belt', text: '+1 per Park space next to an empty space.',
    score: ({ cells }) => countCells(cells, (c, k) => c.z === 'park' && neighbours(cells, k).some((n) => !n)) },
  { id: 'corner', name: 'Corner Shops', text: '+1 per Market space touching 2 or more Housing spaces.',
    score: ({ cells }) => countCells(cells, (c, k) => c.z === 'shop' && neighbours(cells, k).filter((n) => n && n.z === 'home').length >= 2) },
  { id: 'air', name: 'Clean Air', text: '10, minus 1 for each pair of touching Housing and Industry spaces.',
    score: ({ cells }) => {
      let pairs = 0;
      for (const [k, c] of cells) if (c.z === 'home') pairs += neighbours(cells, k).filter((n) => n && n.z === 'work').length;
      return 10 - pairs;
    } },
  { id: 'estates', name: 'Industrial Estates', text: '+3 per Industry group of 3 or more spaces.',
    score: ({ groups }) => 3 * groups.work.filter((g) => g.length >= 3).length },
  { id: 'pocket', name: 'Pocket Parks', text: '+1 per Park group of exactly 1 space.',
    score: ({ groups }) => groups.park.filter((g) => g.length === 1).length },
  { id: 'compact', name: 'Compact City', text: '12, minus 1 per empty space inside your city\'s bounding box (min 0).',
    score: ({ city }) => {
      const b = city.bounds();
      const empty = (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1) - city.cells.size;
      return Math.max(0, 12 - empty);
    } },
  { id: 'mixed', name: 'Mixed Use', text: '+1 per 2×2 area containing all four zone types.',
    score: ({ city, cells }) => {
      const b = city.bounds(); let n = 0;
      for (let y = b.minY; y < b.maxY; y++) for (let x = b.minX; x < b.maxX; x++) {
        const s = new Set();
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const c = cells.get(key(x + dx, y + dy)); if (c) s.add(c.z); }
        if (s.size === 4) n++;
      }
      return n;
    } },
  { id: 'boulevard', name: 'Boulevard', text: '+1 per 2 road spaces in your largest road network.',
    score: ({ networks }) => Math.floor((networks[0]?.length || 0) / 2) },
  { id: 'rows', name: 'Full Spectrum', text: '+1 per row and per column containing all four zone types.',
    score: ({ city, cells }) => {
      const b = city.bounds(); let n = 0;
      for (let y = b.minY; y <= b.maxY; y++) { const s = new Set(); for (let x = b.minX; x <= b.maxX; x++) { const c = cells.get(key(x, y)); if (c) s.add(c.z); } if (s.size === 4) n++; }
      for (let x = b.minX; x <= b.maxX; x++) { const s = new Set(); for (let y = b.minY; y <= b.maxY; y++) { const c = cells.get(key(x, y)); if (c) s.add(c.z); } if (s.size === 4) n++; }
      return n;
    } },
  { id: 'twin', name: 'Twin Towns', text: '+2 per space in your second-largest Housing group.',
    score: ({ groups }) => 2 * (groups.home[1]?.length || 0) },
];
export const goalById = (id) => GOALS.find((g) => g.id === id);

// ---------- Scoring ----------
export function scoreCity(city, goalIds) {
  const a = analyse(city);
  const ctx = { city, cells: city.cells, ...a };
  const zones = {};
  let total = 0;
  for (const z of ZONES) { zones[z] = a.groups[z][0]?.length || 0; total += zones[z]; }
  const roadPenalty = -a.networks.length;
  total += roadPenalty;
  const goals = goalIds.map((id) => { const g = goalById(id); const pts = g.score(ctx); total += pts; return { id, name: g.name, pts }; });
  return { zones, roads: a.networks.length, roadPenalty, goals, total };
}

export const SOLO_RANKS = [
  [0, 'Ghost Town'], [30, 'Hamlet'], [38, 'Village'], [45, 'Town'], [52, 'City'], [60, 'Metropolis'],
];
export function soloRank(total) {
  let r = SOLO_RANKS[0][1];
  for (const [t, name] of SOLO_RANKS) if (total >= t) r = name;
  return r;
}
