// Acceptance tests for Blocktown v1 and Sprawl Jam (schemaVersion 2).
// Run: node tools/test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  loadRuleset, validateRuleset, City, analyse, scoreCity, scoreGoal, goalById,
  R, allowedRotations, rotated, isCityEdge, isCornerEdge,
} from '../js/rules.js';
import { newGame, current, playCard, results, cityOf, serialize, deserialize } from '../js/game.js';
import { chooseMove } from '../js/bot.js';

const v2 = JSON.parse(readFileSync(new URL('../brief/blocktown_sprawl_jam.json', import.meta.url), 'utf8'));
const v1 = JSON.parse(readFileSync(new URL('../data/blocktown.json', import.meta.url), 'utf8'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').join('\n       ')); }
}
const SIDES = { N: 1, E: 2, S: 4, W: 8 };
// Build a City from rows of [zone, roadString] cells (null/"" = empty space, [zone, road] = block).
function mk(grid) {
  const c = new City();
  grid.forEach((row, y) => row.forEach((cell, x) => {
    if (!cell) return;
    const [z, r] = cell;
    c.cells.set(x + ',' + y, { z, r: [...r].reduce((m, ch) => m | SIDES[ch], 0), id: 't' + x + '_' + y });
  }));
  c.placed = 1;
  return c;
}
function evalGoal(city, gid) {
  const a = analyse(city);
  return scoreGoal(goalById(gid), { city, cells: city.cells, selectedGroup: null, ...a });
}

// ---------- A. rules/schema and setup ----------
console.log('A. rules/schema and setup');
test('v1 ruleset validates and loads unchanged', () => {
  assert.deepEqual(validateRuleset(v1), []);
  loadRuleset(v1);
  assert.equal(R.schemaVersion, 1);
  assert.equal(R.goalSelection, null);
  assert.equal(R.placement, null);
  assert.deepEqual(allowedRotations(), [0, 1, 2, 3]);
});
test('v2 ruleset validates and loads', () => {
  assert.deepEqual(validateRuleset(v2), []);
  loadRuleset(v2);
  assert.equal(R.schemaVersion, 2);
  assert.equal(R.goalSelection.mode, 'paired-card-removal');
  assert.equal(R.victory.mode, 'score-at-least-target');
  assert.deepEqual(allowedRotations(), [0, 2]);
  assert.equal(R.cards.length, 18);
  assert.equal(R.goals.length, 18);
});
test('v2 validation rejects broken files', () => {
  const bad = structuredClone(v2);
  delete bad.rules.goalSelection;
  bad.goals[0].cardId = 'B02'; // duplicate link
  assert.ok(validateRuleset(bad).length >= 2);
  const noVer = structuredClone(v2); delete noVer.schemaVersion;
  assert.match(validateRuleset(noVer)[0], /schemaVersion/);
  const v3 = structuredClone(v2); v3.schemaVersion = 3;
  assert.match(validateRuleset(v3)[0], /Unsupported/);
  const badCount = structuredClone(v2);
  badCount.goals[3].count.what = 'nope';
  assert.ok(validateRuleset(badCount).some((e) => e.includes('count.what')));
});
test('18 paired cards/goals, numbers 1–18, unique cardIds', () => {
  const ids = v2.goals.map((g) => g.cardId);
  assert.equal(new Set(ids).size, 18);
  assert.deepEqual(v2.goals.map((g) => g.number).sort((a, b) => a - b), [...Array(18)].map((_, i) => i + 1));
  const cardIds = new Set(v2.cards.map((c) => c.id));
  for (const id of ids) assert.ok(cardIds.has(id));
});
test('paired setup: 3 goals, city faces removed, target = sum of numbers', () => {
  loadRuleset(v2);
  const s = newGame({ players: [{ type: 'bot', level: 'hard' }], seed: 42 });
  assert.equal(s.mode, 'solo');
  assert.equal(s.goals.length, 3);
  assert.equal(new Set(s.goals).size, 3);
  const reserved = new Set(s.goals.map((id) => goalById(id).cardId));
  assert.equal(reserved.size, 3);
  const dealt = [...s.deck, ...s.players[0].hand].map((c) => c.def);
  assert.equal(dealt.length, 14);
  assert.equal(new Set(dealt).size, 14);
  for (const d of dealt) assert.ok(!reserved.has(d), 'reserved card ' + d + ' must not be dealt');
  const all = new Set(v2.cards.map((c) => c.id));
  const missing = [...all].filter((id) => !dealt.includes(id) && !reserved.has(id));
  assert.equal(missing.length, 1, 'exactly the starting card is missing from hands/deck');
  const r = results(s)[0];
  const expect = s.goals.reduce((t, id) => t + goalById(id).number, 0);
  assert.equal(r.target, expect);
  assert.equal(s.players[0].city.placed, 1, 'starting card counts as a play');
  assert.equal(s.players[0].hand.length, 3);
});

// ---------- B. board, rotation, overlap, roads ----------
console.log('B. board, rotation, overlap, roads');
test('every card has one of each zone', () => {
  for (const c of v2.cards) {
    assert.deepEqual([...c.layout.flat()].sort(), ['home', 'park', 'shop', 'work'], c.id);
  }
});
test('internal road ports are reciprocal on every card', () => {
  const has = (s, ch) => s.includes(ch);
  for (const c of v2.cards) {
    const r = c.roads;
    assert.equal(has(r[0][0], 'E'), has(r[0][1], 'W'), c.id + ' top row');
    assert.equal(has(r[1][0], 'E'), has(r[1][1], 'W'), c.id + ' bottom row');
    assert.equal(has(r[0][0], 'S'), has(r[1][0], 'N'), c.id + ' left col');
    assert.equal(has(r[0][1], 'S'), has(r[1][1], 'N'), c.id + ' right col');
  }
});
test('per-card connected road counts match the contract', () => {
  loadRuleset(v2);
  const expect = [1, 2, 2, 1, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 1];
  const got = v2.cards.map((c) => {
    const city = new City();
    const card = R.cards.find((rc) => rc.def === c.id);
    city.place(card, 0, 0, 0);
    return analyse(city).networks.length;
  });
  assert.deepEqual(got, expect);
});
test('only 0°/180° rotations are allowed; 90° is rejected', () => {
  loadRuleset(v2);
  const card = R.cards[0];
  const city = new City();
  city.place(R.cards[1], 0, 0, 0);
  assert.equal(city.check(card, 0, 2, 0).ok, true);
  assert.equal(city.check(card, 2, 2, 0).ok, true);
  const r1 = city.check(card, 1, 2, 0);
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /not allowed/);
  assert.equal(city.check(card, 3, 2, 0).ok, false);
  // 180° flips the cell order
  const c = { cells: ['a', 'b', 'c', 'd'], roads: [0, 0, 0, 0] };
  assert.deepEqual(rotated(c, 2).cells, ['d', 'c', 'b', 'a']);
});
test('corner-only attachment is rejected; full edge and overlap accepted', () => {
  loadRuleset(v2);
  const city = new City();
  city.place(R.cards[0], 0, 0, 0); // occupies (0,0)(1,0)(0,1)(1,1)
  const other = R.cards[1];
  const corner = city.check(other, 0, 2, 2); // touches only at (1,1)-(2,2) corner
  assert.equal(corner.ok, false);
  assert.match(corner.reason, /corner/);
  assert.equal(city.check(other, 0, 2, 0).ok, true);   // shares edge with (1,0)
  assert.equal(city.check(other, 0, 1, 1).ok, true);   // overlaps 1 block
  const full = city.check(other, 0, 0, 0);             // covers all 4 blocks
  assert.equal(full.ok, true);
  assert.equal(full.overlap, 4);
});
test('overlap is topmost-visible: covered zone and road disappear', () => {
  loadRuleset(v2);
  const city = mk([[['home', 'EW'], ['home', '']], [['work', ''], ['work', '']]]);
  assert.equal(analyse(city).networks.length, 1);
  assert.equal(scoreCity(city, []).zones.home, 2, 'two home blocks joined');
  // cover the road block (0,0) with a non-road park
  city.cells.set('0,0', { z: 'park', r: 0, id: 'cover' });
  assert.equal(analyse(city).networks.length, 0, 'covered road no longer scores');
  assert.equal(scoreCity(city, []).zones.home, 1, 'covered home no longer scores');
});
test('a cover can split a road; matching ports join roads across cards', () => {
  loadRuleset(v2);
  const city = mk([[['home', 'EW'], ['work', 'EW'], ['shop', 'EW'], ['park', '']]]);
  assert.equal(analyse(city).networks.length, 1, 'joined across three different card ids');
  assert.equal(analyse(city).networks[0].length, 3);
  // cover the middle section → two separate roads
  city.cells.set('1,0', { z: 'work', r: 0, id: 'cover' });
  assert.equal(analyse(city).networks.length, 2, 'covering the middle splits the road');
  // replacing it with matching E/W ports reconnects both halves (new id on top)
  city.cells.set('1,0', { z: 'work', r: SIDES.E | SIDES.W, id: 'cover2' });
  assert.equal(analyse(city).networks.length, 1, 'reciprocal ports connect across ids');
});
test('city edge / corner detection uses occupied cells, not the bounding box', () => {
  loadRuleset(v2);
  const city = mk([
    [['home', ''], ['home', ''], ['home', ''], ['home', '']],
    [['home', ''], ['home', ''], ['home', ''], ['home', '']],
    [['work', ''], null, ['work', ''], ['work', '']],
  ]);
  // (2,1) is interior: every orthogonal neighbour is occupied
  assert.equal(isCityEdge(city.cells, '2,1'), false);
  assert.equal(isCornerEdge(city.cells, '2,1'), false);
  // (0,0) faces north and west → a corner edge
  assert.equal(isCityEdge(city.cells, '0,0'), true);
  assert.equal(isCornerEdge(city.cells, '0,0'), true);
  // (1,1) sits beside the hole at (1,2): edge by reality, interior by bounding box
  assert.equal(isCityEdge(city.cells, '1,1'), true);
  assert.equal(isCornerEdge(city.cells, '1,1'), false, 'only one exposed side');
  // (1,0) has only its north side exposed → edge but not a corner
  assert.equal(isCityEdge(city.cells, '1,0'), true);
  assert.equal(isCornerEdge(city.cells, '1,0'), false);
});

// ---------- C. scoring: every goal, positive and negative ----------
console.log('C. scoring — 18 goals');
test('G01 The Outskirts: internal +1, edge −1', () => {
  loadRuleset(v2);
  // road points west at an occupied non-road block → internal terminal
  assert.equal(evalGoal(mk([[['work', ''], ['home', 'W']]]), 'sprawl01'), 1);
  assert.equal(evalGoal(mk([[['home', 'W']]]), 'sprawl01'), -1);
  assert.equal(evalGoal(mk([[['home', 'EW'], ['work', 'EW']]]), 'sprawl01'), -1, 'both ends at the city edge');
});
test('G02 Bloom Boom: exact-3 lines +1, zero-park lines −1, gap rows skipped', () => {
  loadRuleset(v2);
  // 3×3 all park: 3 rows + 3 columns with exactly 3 parks
  const allPark = [0, 1, 2].map(() => [['park', ''], ['park', ''], ['park', '']]);
  assert.equal(evalGoal(mk(allPark), 'sprawl02'), 6);
  // 2×2 all home: 4 lines with 0 parks
  assert.equal(evalGoal(mk([[['home', ''], ['home', '']], [['home', ''], ['home', '']]]), 'sprawl02'), -4);
  // rows y=0/y=2 occupied with 0 parks, empty gap row y=1 must NOT count
  assert.equal(evalGoal(mk([
    [['home', ''], ['home', '']],
    [],
    [['home', ''], ['home', '']],
  ]), 'sprawl02'), -4);
  // mixed: row of exactly 3 parks (+1), row of 0 (−1), column of 0 (−1)
  assert.equal(evalGoal(mk([
    [['park', ''], ['park', ''], ['park', ''], ['home', '']],
    [['home', ''], ['work', ''], ['shop', ''], ['home', '']],
  ]), 'sprawl02'), -1);
});
test('G03 Go Green: +1 park, −3 industry', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['park', ''], ['park', '']], [['park', ''], ['park', '']]]), 'sprawl03'), 4);
  assert.equal(evalGoal(mk([[['work', ''], ['home', '']], [['home', ''], ['work', '']]]), 'sprawl03'), -6);
});
test('G04 Block Party: overlapping squares and score table', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['park', ''], ['shop', '']], [['home', ''], ['work', '']]]), 'sprawl04'), -8, '0 squares');
  assert.equal(evalGoal(mk([[['park', ''], ['park', '']], [['park', ''], ['park', '']]]), 'sprawl04'), -5, '1 square');
  // 3×3 all park = 4 overlapping squares → +4
  const nine = [0, 1, 2].map(() => [['park', ''], ['park', ''], ['park', '']]);
  assert.equal(evalGoal(mk(nine), 'sprawl04'), 4);
  // 2×6 all park = 5 squares → +7 (cap)
  const wide = [Array(6).fill(['park', '']), Array(6).fill(['park', ''])];
  assert.equal(evalGoal(mk(wide), 'sprawl04'), 7, '5+ squares → 7');
});
test('G05 Stacks and Scrapers: +2 for industry next to only shop/industry (min 1 occupied)', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['shop', ''], ['work', '']], [['shop', ''], ['work', '']]]), 'sprawl05'), 4);
  assert.equal(evalGoal(mk([[['home', ''], ['work', '']], [['park', ''], ['park', '']]]), 'sprawl05'), 0, 'home neighbour disqualifies');
  assert.equal(evalGoal(mk([[['work', '']]]), 'sprawl05'), 0, 'isolated block needs minOccupied 1');
});
test('G06 Master Planned: largest residential − largest industry (acceptance: 8 − 2 = 6)', () => {
  loadRuleset(v2);
  const city = mk([
    [['home', ''], ['home', ''], ['home', ''], ['home', '']],
    [['home', ''], ['home', ''], ['home', ''], ['home', '']],
    [['work', ''], ['work', ''], ['park', ''], ['shop', '']],
  ]);
  assert.equal(evalGoal(city, 'sprawl06'), 6);
  assert.equal(evalGoal(mk([[['home', ''], ['work', '']], [['work', ''], ['work', '']], [['work', ''], ['work', '']]]), 'sprawl06'), -4, '1 − 5');
});
test('G07 Central Perks: +1 interior park, −2 edge park', () => {
  loadRuleset(v2);
  const interior = [0, 1, 2].map((y) => [0, 1, 2].map((x) => [x === 1 && y === 1 ? 'park' : 'home', '']));
  assert.equal(evalGoal(mk(interior), 'sprawl07'), 1);
  const edge = [0, 1, 2].map((y) => [0, 1, 2].map((x) => [x === 0 && y === 0 ? 'park' : 'home', '']));
  assert.equal(evalGoal(mk(edge), 'sprawl07'), -2);
});
test("G08 The 'Burbs: adjacency to the single selected largest home group", () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['home', ''], ['park', '']], [['home', ''], ['park', '']]]), 'sprawl08'), 2);
  assert.equal(evalGoal(mk([[['home', ''], ['work', '']], [['home', ''], ['work', '']]]), 'sprawl08'), -4);
  // tied largest home groups: the engine picks the group giving the better total (+2, not −1)
  assert.equal(evalGoal(mk([
    [['home', ''], ['park', '']],
    [['park', ''], ['shop', '']],
    [['home', ''], ['work', '']],
  ]), 'sprawl08'), 2);
});
test('G09 Concrete Jungle: corner-only industry counts, edge-only does not', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['work', ''], ['home', '']], [['home', ''], ['work', '']]]), 'sprawl09'), 2);
  assert.equal(evalGoal(mk([[['work', ''], ['work', '']], [['home', ''], ['home', '']]]), 'sprawl09'), 0);
});
test('G10 The Strip: max Commercial in ONE line', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([
    [['shop', ''], ['home', ''], ['work', '']],
    [['shop', ''], ['park', ''], ['home', '']],
    [['shop', ''], ['work', ''], ['park', '']],
  ]), 'sprawl10'), 3);
  assert.equal(evalGoal(mk([[['home', ''], ['park', '']], [['work', ''], ['home', '']]]), 'sprawl10'), 0);
});
test('G11 Mini Marts: straight and stepped road triplets', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['home', 'E'], ['shop', 'EW'], ['home', 'W']]]), 'sprawl11'), 2, 'straight');
  assert.equal(evalGoal(mk([
    [['home', 'E'], ['shop', 'WS']],
    [['park', ''], ['home', 'N']],
  ]), 'sprawl11'), 2, 'stepped');
  assert.equal(evalGoal(mk([[['home', 'E'], ['shop', 'EW'], ['park', 'W']]]), 'sprawl11'), 0, 'second end is not residential');
  assert.equal(evalGoal(mk([[['home', 'E'], ['shop', ''], ['home', '']]]), 'sprawl11'), 0, 'no road connection');
});
test('G12 Superhighway: longest road / 2, rounded down', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['home', 'EW'], ['work', 'EW'], ['shop', 'EW'], ['park', 'EW'], ['home', 'EW']]]), 'sprawl12'), 2, 'length 5 → 2');
  assert.equal(evalGoal(mk([[['home', 'E']]]), 'sprawl12'), 0, 'length 1 → 0');
  assert.equal(evalGoal(mk([[['home', 'EW'], ['work', 'EW'], ['shop', 'W']]]), 'sprawl12'), 1, 'length 3 → 1');
});
test('G13 Park Hopping: exactly two terminals in two different park blocks', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['park', 'WE'], ['shop', 'EW'], ['park', 'WE']]]), 'sprawl13'), 3);
  assert.equal(evalGoal(mk([[['park', 'E'], ['shop', 'EW'], ['park', 'W']]]), 'sprawl13'), 0, 'parks traversed but not ending there');
  assert.equal(evalGoal(mk([[['shop', 'WE'], ['home', 'EW'], ['work', 'WE']]]), 'sprawl13'), 0, 'terminals not in parks');
});
test('G14 Looping Lanes: 12-section loop → 12; broken loop → 0', () => {
  loadRuleset(v2);
  const ringCells = [];
  for (let x = 0; x < 4; x++) ringCells.push([x, 0]);
  for (let y = 1; y < 4; y++) ringCells.push([3, y]);
  for (let x = 2; x >= 0; x--) ringCells.push([x, 3]);
  for (let y = 2; y >= 1; y--) ringCells.push([0, y]);
  assert.equal(ringCells.length, 12);
  const city = new City();
  const inRing = new Set(ringCells.map(([x, y]) => x + ',' + y));
  for (const [x, y] of ringCells) {
    let r = 0;
    if (inRing.has(x + ',' + (y - 1))) r |= SIDES.N;
    if (inRing.has((x + 1) + ',' + y)) r |= SIDES.E;
    if (inRing.has(x + ',' + (y + 1))) r |= SIDES.S;
    if (inRing.has((x - 1) + ',' + y)) r |= SIDES.W;
    city.cells.set(x + ',' + y, { z: 'home', r, id: 'ring' });
  }
  assert.equal(evalGoal(city, 'sprawl14'), 12, 'acceptance: 12-section loop → 12');
  city.cells.delete('0,0'); // break the loop → path, no cycle
  assert.equal(evalGoal(city, 'sprawl14'), 0, 'broken loop scores 0');
  // small 4-loop
  assert.equal(evalGoal(mk([
    [['park', 'ES'], ['home', 'WS']],
    [['work', 'EN'], ['shop', 'WN']],
  ]), 'sprawl14'), 4);
});
test('G15 Skid Row: +2 per home next to 2+ industry', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['park', ''], ['work', '']], [['work', ''], ['home', '']]]), 'sprawl15'), 2);
  assert.equal(evalGoal(mk([[['work', ''], ['home', '']], [['park', ''], ['park', '']]]), 'sprawl15'), 0, 'only 1 industry neighbour');
});
test('G16 Morning Commute: per road through both home and shop', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['home', 'E'], ['shop', 'W']]]), 'sprawl16'), 2);
  assert.equal(evalGoal(mk([
    [['home', 'E'], ['shop', 'W']],
    [['shop', 'E'], ['home', 'W']],
  ]), 'sprawl16'), 4, 'two qualifying roads');
  assert.equal(evalGoal(mk([[['home', 'E'], ['work', 'W']]]), 'sprawl16'), 0, 'no shop on the road');
});
test('G17 Tourist Traps: edge shop +1, corner bonus +1, interior 0', () => {
  loadRuleset(v2);
  assert.equal(evalGoal(mk([[['shop', '']]]), 'sprawl17'), 2, 'lone block is a corner');
  // shop in the middle of the top edge: only the north side is exposed → 1
  const topMid = [0, 1, 2].map((y) => [0, 1, 2].map((x) => [x === 1 && y === 0 ? 'shop' : 'home', '']));
  assert.equal(evalGoal(mk(topMid), 'sprawl17'), 1, 'straight edge, not a corner');
  const inner = [0, 1, 2].map((y) => [0, 1, 2].map((x) => [x === 1 && y === 1 ? 'shop' : 'home', '']));
  assert.equal(evalGoal(mk(inner), 'sprawl17'), 0, 'interior shop scores nothing');
  // two corner shops + one straight edge shop
  assert.equal(evalGoal(mk([
    [['shop', ''], ['home', ''], ['park', '']],
    [['home', ''], ['shop', ''], ['work', '']],
    [['park', ''], ['work', ''], ['shop', '']],
  ]), 'sprawl17'), 4, 'corners (0,0) and (2,2) = 2+2; (1,1) interior = 0');
});
test('G18 Sprawlopolis: longest row + longest column, gaps skipped', () => {
  loadRuleset(v2);
  // row y=0 has a gap (counts 2): best row 3, best col 2 → 5
  assert.equal(evalGoal(mk([
    [['home', ''], null, ['work', '']],
    [['park', ''], ['shop', ''], ['park', '']],
  ]), 'sprawl18'), 5);
  // explicit gap fixture: cells (0,0), (2,0), (1,1) → best row 2, best col 1 → 3
  assert.equal(evalGoal(mk([[['home', ''], null, ['work', '']], [null, ['shop', ''], null]]), 'sprawl18'), 3);
});
test('G18 acceptance: full 3×3 → 3 + 3 = 6; single block → 2', () => {
  loadRuleset(v2);
  const zones = [
    ['home', 'park', 'work'],
    ['shop', 'home', 'park'],
    ['work', 'park', 'home'],
  ];
  const full = zones.map((row) => row.map((z) => [z, '']));
  assert.equal(evalGoal(mk(full), 'sprawl18'), 6);
  assert.equal(evalGoal(mk([[['home', '']]]), 'sprawl18'), 2);
});
test('acceptance: rulebook example → 11 group points, 7 roads, base 4', () => {
  loadRuleset(v2);
  const city = mk([
    [['park', 'N'], ['park', 'N'], ['home', 'N'], ['home', 'E']],
    [['park', 'W'], ['park', 'E'], ['home', 'S'], ['shop', '']],
    [['work', ''], ['work', ''], null, ['shop', '']],
  ]);
  const sc = scoreCity(city, []);
  const sum = Object.values(sc.zones).reduce((a, b) => a + b, 0);
  assert.equal(sum, 11, 'largest groups: park 4 + home 3 + shop 2 + work 2');
  assert.equal(sc.roads, 7, 'seven separate roads');
  assert.equal(sc.total, 4, 'base score 11 − 7 = 4');
});
test('acceptance: goals 2 + 7 + 14 give target 23', () => {
  loadRuleset(v2);
  const sc = scoreCity(mk([[['home', '']]]), ['sprawl02', 'sprawl07', 'sprawl14']);
  assert.equal(sc.target, 23);
  assert.equal(sc.win, false);
});

// ---------- D. game flow and end games ----------
console.log('D. game flow and end games');
function playBotGame(s, limit = 400) {
  let turns = 0;
  while (!s.over) {
    const p = current(s);
    const m = chooseMove(cityOf(s, p), p.hand, s.goals, p.level);
    assert.ok(m, 'bot must always have a legal move');
    playCard(s, m.hi, m.rot, m.x, m.y);
    if (++turns > limit) throw new Error('game did not finish');
  }
  return turns;
}
test('solo paired game: exactly 15 cards placed, results carry target and win/loss', () => {
  loadRuleset(v2);
  const s = newGame({ players: [{ name: 'You', type: 'bot', level: 'hard' }], seed: 42 });
  const turns = playBotGame(s);
  assert.equal(turns, 14, '14 placements after the starting card');
  assert.equal(s.players[0].city.placed, 15);
  assert.equal(s.deck.length, 0);
  assert.equal(s.players[0].hand.length, 0);
  const r = results(s)[0];
  assert.equal(typeof r.target, 'number');
  assert.equal(r.win, r.total >= r.target);
  // save/resume round trip
  const back = deserialize(serialize(s));
  assert.equal(back.city, undefined);
  assert.equal(back.players[0].city.cells.size, s.players[0].city.cells.size);
  assert.deepEqual(back.goals, s.goals);
});
for (const n of [2, 3, 4]) {
  test(`sprawl ${n}P: shared city, pass-left flow, deck exhaustion, team result`, () => {
    loadRuleset(v2);
    const players = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, type: 'bot', level: ['hard', 'normal', 'easy', 'normal'][i] }));
    const s = newGame({ players, seed: 100 + n });
    assert.equal(s.mode, 'sprawl');
    assert.deepEqual(s.players.map((p) => p.hand.length), [3, ...Array(n - 1).fill(1)]);
    assert.equal(s.city.placed, 1);
    assert.equal(s.deck.length, 15 - 1 - (3 + (n - 1)));
    assert.ok(s.players.every((p) => cityOf(s, p) === s.city), 'everyone builds the same city');
    const turns = playBotGame(s);
    assert.equal(turns, 14, '14 placements after the starting card');
    assert.equal(s.city.placed, 15);
    assert.equal(s.deck.length, 0, 'deck fully exhausted');
    assert.ok(s.players.every((p) => p.hand.length === 0), 'hands empty at the end');
    const rows = results(s);
    assert.equal(rows.length, 1, 'one shared team score');
    assert.equal(rows[0].win, rows[0].total >= rows[0].target);
    // serialize/deserialize keeps the shared city
    const back = deserialize(serialize(s));
    assert.equal(back.city.cells.size, s.city.cells.size);
  });
}
test('legacy v1 solo game still plays 15 cards and scores without a target', () => {
  loadRuleset(v1);
  const s = newGame({ players: [{ type: 'bot', level: 'hard' }], seed: 1 });
  const turns = playBotGame(s);
  assert.equal(turns, 15);
  assert.equal(s.players[0].city.placed, 15);
  const r = results(s)[0];
  assert.equal(r.target, undefined);
  assert.equal(r.win, undefined);
});
test('legacy v1 draft game still completes', () => {
  loadRuleset(v1);
  const s = newGame({ players: [
    { name: 'A', type: 'bot', level: 'hard' }, { name: 'B', type: 'bot', level: 'normal' }, { name: 'C', type: 'bot', level: 'easy' },
  ], seed: 5 });
  assert.equal(s.mode, 'draft');
  const turns = playBotGame(s, 600);
  assert.equal(turns, 45, '3 players × 15 placements');
  const rows = results(s);
  assert.equal(rows.length, 3);
  assert.ok(rows.some((r) => r.winner));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
