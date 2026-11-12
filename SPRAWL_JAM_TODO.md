# Sprawl Jam implementation checklist

Work through one item per turn; tick off as completed.

- [x] 1. Read `brief/SPRAWL_JAM_IMPLEMENTATION_BRIEF.md` (features + acceptance tests)
- [x] 2. Read `brief/SPRAWL_JAM_V2_SCHEMA_CONTRACT.md` (keys, counters, edge cases)
- [x] 3. Read `brief/blocktown_sprawl_jam.json` (target config, 18 pairs)
- [x] 4. Read current v1 engine: `js/rules.js`, `js/game.js`, `RULESET.md`
- [x] 5. Read UI/integration: `js/app.js`, `js/board.js`, `js/bot.js`
- [x] 6. Design engine changes (schema v2 load, paired goals, road analysis, counters)
- [x] 7. Implement schema v2 parsing/loading (`validateRuleset`, `loadRuleset`, `City.check` rotation)
- [x] 8. Implement road-network analysis (terminals, edge/corner, cycles, netInfo)
- [x] 9. Implement extended scoring counters + `scoreTable` + `groupSelection`
- [x] 10. Wire paired goal selection + solo/sprawl game flow (`game.js`, `bot.js`, `sim.mjs`)
- [ ] 11. UI (app.js / index.html / style.css) — sub-steps, one per turn:
  - [x] 11a. shared-city wiring (`cityOf` everywhere) + rotation cycles allowed rots only
  - [x] 11b. goals panel: `#n` numbers + target header; start-of-game reveal modal
  - [x] 11c. status/deck counters for solo+sprawl; score modal breakdown w/ target
  - [x] 11d. results screen: target + win/loss rows (solo & sprawl)
  - [x] 11e. rules text + setup note branch for v2; variant toggles (easier/harder)
  - [x] 11f. index.html/style.css hooks (goal num style, variants box)
- [x] 12. Copy ruleset to `data/` + register in `data/rulesets.json`
- [x] 13. Tests: `tools/test.mjs` — setup, placements, overlap, roads, each goal, end-game (40 passing)
- [x] 14. Verify v1 rulesets still load/work (run sim + tests) — 40/40 tests, sims OK for both sets
- [x] 15. Update `RULESET.md` docs
- [x] 16. Report ambiguities/assumptions — delivered in final summary (see below)

## Assumptions / interpretations (for the record)

1. **Stacks & Scrapers:** isolated Industrial blocks do NOT score (`minOccupied: 1`, as the
   contract requires); unoccupied sides are not disqualifying.
2. **The 'Burbs ties:** single tied largest Residential group maximizing the *whole* goal score
   (never mixing groups between terms).
3. **Harder variant:** "one chosen zone type" = the best zone (its largest group only), since a
   player would always choose the max — strictly harder than summing all four.
4. **Road terminals** are unpaired ports only: a road cell with a lone paired port has no
   terminus (a park block must carry an unpaired port for Park Hopping).
5. **Corner edge** = two *perpendicular* exposed sides (north+south does not count).
6. **Holes count as edge** for both `cityEdge` and road termini (contract default3).
7. **cycle sections** = road blocks incident to at least one non-bridge edge; shared blocks
   counted once; non-loop branches score 0.
8. **`lineMatches.occupiedLinesOnly` defaults to true** when omitted (gap lines never count).
9. **`adjacentToSelectedGroup`** ignores blocks that are themselves in the selected group
   (irrelevant for the shipped goals: zone ≠ group zone).
10. **v2 `number` validation** requires a positive integer; the shipped set is checked to be
    exactly 1–18 by test rather than hard-coded in the validator.
11. **Deck/hand dealing order:** contract order (hands first, then starting card) for v2;
    legacy v1 keeps its original order so old sets behave identically.
12. **Reveal timing:** the three-goal/target reveal modal shows at game start (start screen
    shows them persistently in the Goals panel afterwards).

## FINAL STATUS: all items complete — 40/40 tests, sims green, browser smoke passed.

## Design (decided from brief + contract + code)

**rules.js**
- `schemaVersion` read at validate time; v1 files skip v2 checks. v2 checks: enums for
  `goalSelection/setup/placement/victory/scoring`, `rotation ⊆ {0,90,180,270}`, goal
  `number` int 1–18, `cardId` bijection with cards (paired mode), extended `count.what`
  + per-counter parameter validation, `scoreTable` keys.
- `COUNT_TYPES` += lineMatches, monochromeSquares, bestLine, roadTriplets, roadCycleSections,
  adjacentToSelectedGroup. New fields on existing counters validated too.
- `R` gains: schemaVersion, goalSelection, setup, placement, victory, scoring, variants, multiplayer.
- `City.check`: reject rot not in `R.placement.rotation` (rot units = degrees/90). Touch logic
  already == overlap-or-full-edge (corner-only already rejected).
- `analyse`: keep `networks` (arrays, sorted); add aligned `netInfo[]`:
  {members, size, terminals:[{k,dir,edge}], zones:Set, hasEdgeEndpoint, cycleSections}.
  Edge terminal = unpaired port with unoccupied neighbour; internal = occupied neighbour.
  Cycle sections = vertices incident to ≥1 non-bridge edge (Tarjan lowlink per network).
- Helpers: `isCityEdge(cells,k)` (any of 4 sides unoccupied), `isCornerEdge` (≥2 *perpendicular*).
- COUNTERS: `spaces` += adjacent{relation,onlyZones,minOccupied}, cityEdge, cornerEdge,
  touching.relation "corner" (diagonals). New: lineMatches, monochromeSquares (top-left scan),
  bestLine, roadTriplets (connected road neighbours matching ends multiset; allowTurns),
  roadCycleSections (sum netInfo.cycleSections), adjacentToSelectedGroup (needs ctx.selectedGroup).
- `roadNetworks` += filters hasCityEdgeEndpoint / traversesAllZones / terminals /
  terminalZones (+distinctTerminalBlocks: zones of unique terminal blocks, multiset match).
- `scoreGoal`: if `scoreTable` → compute count, exact key or greatest `n+` lower bound, return
  directly (then min/max). If `groupSelection` → candidates = groups with size of rank;
  evaluate terms per candidate with ctx.selectedGroup; keep max ("maximize-goal-score").
- `scoreCity(city, goalIds, variants?)`: easier → roadNetworkPoints 0; harder → only single
  largest group across all zones. Adds `target` (Σ goal.number) and `win` when victory mode set.

**game.js**
- Paired mode (`goalSelection.mode === 'paired-card-removal'`): pick 3 goal ids w/o replacement,
  reserve their cardIds, deck = other 15. Solo: top card starts (counts as play, placed=1),
  hand 3, draw while deck remains, over at placed==15 / hand empty. v1 solo unchanged.
- MP `sprawlopolis-pass-left` → mode 'sprawl': ONE shared `state.city`. Deal startPlayerHand=3
  to P0, otherPlayerHand=1 to rest. Turn: play 1 → pass min(2, held) left → draw 1 if deck.
  Over when current's hand empty at turn start. Results = single team row with target/win.
- v1 draft flow untouched.

**bot.js / sim.mjs**: iterate allowed rotations only; use shared city when mode==='sprawl'.

**app.js/html/css**: rotate cycles allowed rots only; goals panel shows `#n` + target line;
reveal modal at game start (3 goals, numbers, target); status shows remaining cards; results
show target + win/loss; rules text branches on v2; optional variant toggles on setup screen.

**data/**: copy `blocktown_sprawl_jam.json` → `data/`, add to `data/rulesets.json`.

**tools/test.mjs**: node assert suite — A: v1 load + paired setup/target/15 cards;
B: 18 per-card road counts [1,2,2,1,1,2,2,2,1,2,2,2,2,1,2,2,2,1], rot 90 rejected,
corner-only rejected, cover splits road, ports join across cards; C: 18 goals × ±fixtures
(incl. target 23, goal4→7, goal6→6, goal14→12, base example 11/7 roads → 4);
D: full solo bot game + sprawl MP bot game end with target win/loss.
