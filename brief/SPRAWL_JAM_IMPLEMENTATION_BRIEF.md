# Developer brief: Sprawl Jam — a personal city-building variant for Blocktown

**Purpose:** Extend Blocktown with a flexible, **personal, non-commercial city-building variant** informed by the layouts and gameplay ideas in `sprawl-ideas.md`. The aim is to support paired city/goal cards, richer road networks, and more varied scoring conditions. `RULESET.md` describes the current engine; the attached JSON is the example configuration to make playable.

**Core principle:** Treat this as a **general engine and schema extension**, not just a JSON edit. The earlier preview ruleset used simpler formulas for 14 goals; the new configuration defines more detailed gameplay tests. Implement those new capabilities instead of falling back to the preview approximations. Use existing Blocktown visuals and generic tiles; third-party artwork, branding, and printed components are not part of the requested deliverable.

## 1. Support the 18 configured city layouts and road topology

- Load the **18 configured two-by-two city layouts**, each containing one Park, Residential, Commercial and Industrial district. Keep their stable IDs and the intended card-to-goal links.
- Use the landscape-converted `layout` and `roads` already supplied in `blocktown_sprawl_jam.json`. Each tile stores its road ports (`N/E/S/W`), and roads connect between neighbouring visible tiles only when the ports reciprocally match.
- A road is a **connected component of visible road segments**, including connections across multiple cards. A road segment is a visible block/tile occupied by a road. Distinguish components, dead ends, edge-facing termini, paths and cycles.
- When a placed card covers existing blocks, **only topmost visible zones and road segments** participate in scoring. Recalculate connections after covering; previously connected roads may split, disappear or join.
- In this variant, gameplay cards stay horizontal; allow **0° or 180° rotation**, not 90°/270°.

The existing `roads` format can represent these card layouts; its **road graph evaluator** needs the additional measurements listed below. No need to replace the whole card schema if the graph is built correctly from the visible grid.

## 2. Change setup, deck handling and win conditions

This variant uses **18 logical card/goal pairs**. Each pair contains a city layout and a numbered scoring goal. Implement linked selection rather than drawing goals independently while keeping every matching city card in the deck.

1. Randomly choose **3 distinct cards** as this game's scoring goals. Set those cards aside; their corresponding city faces must **not** be available for placement.
2. Set the **target score** to the **sum of those three goal numbers** (e.g. 2 + 7 + 14 = 23). These numbers are *target values*, not points earned by a goal.
3. The remaining **15 cards** form the city deck. One becomes the starting card; **14 additional placements** complete the city (15 city cards total).
4. Score at the end: **sum of largest edge-connected group sizes, one for each of the four zone types − number of separate continuous roads + the three selected goal scores**. Achieving or exceeding the target is a win; otherwise it is a loss. Preserve negative goal scores.
5. Keep the easier variant (no road penalty) and harder variant (score only the largest connected group from one chosen zone type) as optional toggles, not the default.

**Existing fields that can stay:** `zones[*].largestGroupPoints = 1`, `roadNetworkPoints = -1`, `goalsPerGame = 3`, `solo.hand = 3`. The existing `solo.ranks` are a Blocktown addition and must not replace target-score victory. The legacy `draft.rounds`/`draft.hand` settings are **not** used by this variant’s passing flow.

**Proposed backward-compatible fields** (names are suggestions, to be finalized by the developer): `rules.goalSelection.mode = "paired-card-removal"`; `rules.goalSelection.target = "sum-goal-numbers"`; `rules.placement.rotation = [0,180]`; `rules.placement.overlap = "topmost-visible"`; `rules.victory.mode = "score-at-least-target"`; and `goals[*].number` (1–18). Use feature-specific rule modes so legacy Blocktown sets retain their current behaviour.

## 3. Implement the configured placement and turn flow

- Placed cards must connect by **at least one complete visible district edge** to an existing city district, **or overlap and cover** one or more districts. A corner-only touch does not count. The new card stays on top; it cannot be tucked underneath anything. This variant permits overlaps; do not let the legacy `maxOverlap: 2` limit exclude configured moves. The supplied JSON uses 4, but the gameplay validator must still enforce connection and topmost visibility.
- **Solo:** maintain three cards in hand; play one, replenish from the available deck, stop after all 15 city cards (including starting card) have been placed.
- **Cooperative multiplayer:** start player holds three city cards; other players hold one each, where there are enough cards. On a turn the active player places one of their three, passes the remaining two to the next player, and takes the visible top draw card into their own hand. Continue around the table and adapt appropriately as the draw deck empties. The game is one shared city and one shared target.
- Players may discuss placements but **cannot reveal cards in their hands**. Once a card is revealed for placement it must be played. Preserve a visible draw-deck top card.

**Implementation caveat:** Test the proposed setup/turn flow for 3–4 players when the deck is nearly exhausted, because some hand transitions need explicit empty-deck handling. Avoid hardcoding `draft.rounds: 5` as an equivalent.

## 4. Add reusable scoring capabilities for the 18 goal definitions

The existing `count.what` types in `RULESET.md` include spaces, groups, pairs, squares, lines, road networks/length, bounds and cards. They cannot express **14 of the 18 configured goals** without extensions. Implement reusable new count primitives and/or more expressive predicates/aggregators rather than making misleading approximations.

| # | Goal | Desired scoring behaviour | Engine/schema change |
|---|---|---|---|
| 01 | **The Outskirts** | +1 for each road that does **not** end at a city edge; −1 for each road that ends at an edge. | Each connected road needs an endpoint list and whether any endpoint faces outside the occupied city. Treat the road as the counted unit, not every tile. |
| 02 | **Bloom Boom** | +1 per row/column with **exactly 3** Parks; −1 per row/column with **0** Parks. | Count exact numbers of a zone per individual row/column, including negative matches. |
| 03 | **Go Green** | +1 per Park, −3 per Industrial block. | **Already expressible** with `terms`. |
| 04 | **Block Party** | Count every monochrome 2×2 district square, including overlapping squares. Score 0/1/2/3/4/5+ squares as −8/−5/−2/+1/+4/+7. | Same-zone 2×2 pattern detection and **lookup/table scoring** (cap at five). Existing `squares` only supports an all-four-zones test. |
| 05 | **Stacks and Scrapers** | +2 per Industrial block whose side-adjacent occupied neighbours are **only Commercial or Industrial**. | Universal neighbour-type exclusion, not merely “has a Commercial neighbour.” Define whether isolated blocks qualify (test against the supplied example). |
| 06 | **Master Planned** | Size of largest Residential group − size of largest Industrial group. | **Already expressible** with ranked `groupSize` terms. |
| 07 | **Central Perks** | +1 per interior Park, −2 per Park on city edge. | Can be expressed using the current 4-neighbour occupied test, if it is verified to match the game's treatment of city boundaries/holes. |
| 08 | **The ’Burbs** | +1 for each Park, and −2 for each Industrial block, side-adjacent to the **largest Residential group**. | Adjacency to a selected connected component, not to any Residential block. Resolve ties consistently. |
| 09 | **Concrete Jungle** | +1 per Industrial block sharing a **corner** with at least one other Industrial block. | Diagonal/corner neighbour predicate, counted once per qualifying Industrial block. |
| 10 | **The Strip** | Select **one** row or column; score +1 per Commercial block in that line. | Maximum count of Commercial in a single row **or** column (not number of lines containing a Commercial). |
| 11 | **Mini Marts** | +2 per Commercial block directly **between two Residential blocks along the same continuous road**, including straight and stepped configurations. | Ordered path/road graph pattern matching: Residential → Commercial → Residential. Mere zone adjacency is insufficient. |
| 12 | **Superhighway** | +1 per **two road sections** in the single longest continuous road (round down). | Verify `roadLength` counts visible road-containing **blocks/sections** and connects roads across cards. It may already be supported if so. |
| 13 | **Park Hopping** | +3 per road that begins at one Park and terminates at **a different Park**. | Inspect endpoints and the zone touching each terminus; do **not** count any arbitrary pair of parks with roads. |
| 14 | **Looping Lanes** | +1 per road section belonging to a **completed loop**; multiple loops can score. | Cycle detection in road graph; score loop sections without double-counting shared sections. |
| 15 | **Skid Row** | +2 per Residential block side-adjacent to 2+ Industrial blocks. | **Already expressible** with `spaces.touching.min = 2`. |
| 16 | **Morning Commute** | +2 per separate connected road that passes through **both Residential and Commercial** districts. | Road component predicate over *all* traversed zone types. |
| 17 | **Tourist Traps** | +1 per Commercial district on the actual city edge, +1 additional if it is on a city **corner edge**. | Exposed side(s) on the irregular city boundary; do not substitute bounding-box adjacency or presence of a road. |
| 18 | **Sprawlopolis** | Occupied block count in the longest row **plus** occupied block count in the longest column, **skipping gaps**. | Max occupied-cell count per row and per column, independent of bounding-box width/height. |

**Suggested reusable primitives:** `zoneCountInLine(exact/min/max)`, `bestLineCount(zone)`, `longestOccupiedLine(axis)`, `monochromeSquareCount`, `zoneNeighbours(mode=side/corner, allowed/disallowed, component=largest)`, `cityBoundary(exposedSides/corner)`, `roadComponent(endpoints, traversedZones, sectionCount)`, `roadPathPattern`, `roadCycles`, and a `scoreTable` mapping counts to points. Extend `COUNTERS` in `js/rules.js` and the JSON validator/documentation; naming is illustrative, not mandated.

## 5. Road graph and geometry semantics to test first

Build a **canonical final visible grid** after all overlaps and rotations, then derive zone groups, boundaries and road components from it. All counters should read that same state so the end score and goal scores agree.

1. **Edge adjacency:** only N/E/S/W counts for connected zone groups; diagonal adjacency is separate and used by Concrete Jungle.
2. **Road adjacency:** neighbouring visible road tiles connect **only if both ports face each other**. A tile with an unmatched port can terminate against either an occupied non-road neighbour (interior end) or missing city space (edge end).
3. **City edge:** test against *actual occupied visible tiles*, not only the surrounding bounding box. A boundary around a hole or an irregular outline matters; classify corners using two perpendicular exposed sides.
4. **Road length:** count road sections/visible tiles as defined by the scoring schema; avoid counting graphical curves or half-tiles as extra segments.
5. **Cycles:** detect completed closed circuits within the connected road graph. Disambiguate roads with branches or multiple overlapping loops with explicit tests and documenting a no-double-count rule.
6. **Overlaps:** after covering a road tile, recompute all graph properties; a removed section can break a loop, split a network or change an endpoint from interior to exposed.

## 6. JSON/UI changes for the optional variant

- Preserve existing Blocktown JSONs by making Sprawl Jam a **versioned optional mode** rather than changing global defaults.
- Give each goal a stable `id`, readable `name` and `text`, a `number` for target selection, and a structured scoring definition. Avoid misleading `(adapted)` labels once the configured formula is supported.
- Add support for multi-term calculations with exact predicates, maxima, conditionals and a score table; continue to support existing simple `count/points/per/base` goals.
- Start screen should show the three drawn goal cards, their numbers and **target total**. During play show the shared city, remaining cards and the goal rules; at the end show four base group scores, road penalty, each of the three goal scores, total, target and win/loss.
- For helpful in-game explanations, allow optional **new example diagrams drawn in Blocktown’s visual style** or sample-layout metadata. The supplied `sprawl-ideas.md` diagrams are implementation references, not assets to embed in the game UI.
- Add validation for `goals[*].number`, the paired 18-card goal/deck setup, goal counter schemas, permitted rotations and placement rules. Update `RULESET.md` and the example JSON to show the new capabilities.

## 7. Acceptance tests and delivery order

**Milestone A — rules/schema and setup:** Load a legacy Blocktown JSON unchanged; load the new paired-card mode; select 3 goals; confirm the matching 3 city cards are removed, 15 remain and target equals the selected numbers; deal and place exactly 15 cards total.

**Milestone B — board and roads:** Validate all 18 `sprawl-ideas.md` layouts and road endpoints; test 0°/180° only; reject corner-only attachments and underlaps; verify a cover can split a road, and matching ports join roads across cards.

**Milestone C — scoring:** Write at least one positive and one negative/boundary fixture per goal (18 goals × 2 minimum), using the supplied diagram descriptions as test inspiration. Specifically test: exact-3/zero Park lines; overlapping 2×2 groups; diagonal Industrial corners; max-one-line scoring; stepped Mini Marts; longest road rounding; Park-to-Park road termini; loops and overlap-broken loops; corner versus straight city edge; longest occupied lines with holes.

**Milestone D — game flow and UI:** Validate solo and 2–4-player hand passing/deck exhaustion, end-game scoring and target win/loss. Run `node tools/sim.mjs ...` after the engine supports the new rules; simulation and rank/balance evaluation should be done on the **configured goals**, not the earlier simplified preview formulas.

### Definition of done

A new ruleset based on `sprawl-ideas.md` loads without warnings; **all 18 configured goals are enabled and score according to their JSON definitions**; three selected goal cards are excluded from the playable city deck; all 15 other card faces are used; road and overlapping-card behaviour match the configured mechanics; and the game reports a correct target-based cooperative win/loss. Existing Blocktown rulesets continue to work as before.
