# Blocktown / Sprawl Jam — v2 JSON schema contract

This document is normative for `blocktown_sprawl_jam.json`. It freezes the **proposed** v2 field names so a coding agent can implement exactly the JSON supplied. The existing `RULESET.md` describes **v1**, which cannot load this file accurately without code changes. Implement backward compatibility with existing v1 rulesets.

Read in order: (1) `SPRAWL_JAM_IMPLEMENTATION_BRIEF.md` for goals and mechanics; (2) **this contract** for JSON keys and evaluation semantics; (3) `blocktown_sprawl_jam.json` as the golden fixture; (4) `sprawl-ideas.md` for the reference layouts and goal diagram descriptions.

## Versioning and existing schema

- `schemaVersion: 2` opts into extended validation and counters. Missing version means **legacy v1**; preserve old behavior.
- Preserve all v1 `zones`, `cards[*].layout`, `cards[*].roads`, `rules.maxOverlap`, `rules.roadNetworkPoints`, `rules.goalsPerGame`, `rules.solo`, goal `count` / `terms` / `points` / `per` / `base` / `min` / `max` / `enabled`.
- A goal uses either `scoreTable` together with `count`, or the existing arithmetic formula. A `terms` goal sums every term. `per` means `floor(count / per)` before multiplying by `points`.
- `goals[*].number` (integer 1–18) is used **only to compute the win target**; it is not a goal reward. `goals[*].cardId` links to one unique `cards[*].id`. Every physical card has one city face and one goal face. Do not use `number` as the goal ID.

## New game-level fields

| JSON path | Required semantics |
|---|---|
| `rules.goalSelection.mode: "paired-card-removal"` | Select `rules.goalsPerGame` distinct goals uniformly without replacement; remove their linked `cardId` city cards before dealing/starting the city. |
| `rules.goalSelection.target: "sum-goal-numbers"` | Target = sum of selected `goals[*].number`, not score amounts. |
| `rules.setup.startingCard: "draw-top"` | After the reserved goal cards are removed and players dealt hands, reveal the top remaining city card as the first placed card. |
| `rules.setup.startingCardCountsAsPlay: true` | Count this starting city card toward the 15 total; **14 subsequent placements**. |
| `rules.setup.visibleDrawDeckTop: true` | Display top draw card face-up for this variant. |
| `rules.placement.rotation: [0,180]` | Exactly those allowed in gameplay, **landscape only**. The supplied card arrays are already landscape. |
| `rules.placement.connection: "overlap-or-full-block-edge"` | First card is free. Every next card must overlap >=1 visible occupied block OR share >=1 entire block edge with visible city. Corner-only contact is illegal. |
| `rules.placement.overlap: "topmost-visible"` | Every occupied tile in the newly placed card replaces the zone and road of the previous topmost tile. No scoring from covered tiles. |
| `rules.placement.allowUnderlap: false` | Never place a new card beneath another. |
| `rules.maxOverlap: 4` | Up to four existing tiles may be covered. |
| `rules.scoring.blockGroups: "largest-per-zone"` | Base district score = size of largest orthogonally edge-connected component in **each** zone, added together. |
| `rules.scoring.zoneGroupAdjacency: "shared-edge"` | N/E/S/W adjacency only (unless specific goal asks for corners). |
| `rules.scoring.roads: "connected-visible-ports"` | Separate roads are graph components of visible road tiles, connected across an edge iff both directional ports agree. |
| `rules.scoring.roadSectionUnit: "visible-block"` | One road section = one visible occupied tile whose road string is nonempty; never count each line/port separately. |
| `rules.scoring.cityEdge: "exposed-sides-of-occupied-blocks"` | An occupied tile is on the edge if at least one of its four orthogonal neighbors is unoccupied; includes irregular outline/holes, not just bounding box. |
| `rules.roadNetworkPoints: -1` | Subtract one per distinct connected road component after all placements. |
| `rules.victory.mode: "score-at-least-target"` | Final = base district groups + road penalty + three drawn goal scores. Win iff final >= target. |
| `rules.solo.plays: 15` | Starting card + subsequent placements = all 15 non-reserved city cards. |
| `rules.solo.hand: 3` | Up to 3 concealed cards; replenish after each play while draw deck remains. |
| `rules.multiplayer.mode: "sprawlopolis-pass-left"` | Shared city, start player initially holds 3 cards, other players 1 each; active player plays 1 of 3, passes remaining 2 left, and then draws 1 top deck card; handle deck exhaustion and smaller hands. |
| `rules.multiplayer.{startPlayerHand,otherPlayerHand,passUnplayed,drawAfterPlay}` | Quantities 3,1,2,1 respectively. |
| `rules.multiplayer.{sharedCity,hiddenHands,tableTalk}` | One team city; do not reveal unplayed hand cards; discussion is permitted. |
| `rules.variants.easier.roadNetworkPoints: 0` | Optional, only when chosen, suppress base roads penalty. |
| `rules.variants.harder.blockGroups: "single-largest-zone"` | Optional, only when chosen, score only the largest group from one zone type (not all four). |

*Important:* `rules.draft` is deliberately **absent**: its current fixed-round draft is not the variant’s shared-hand flow. Keep that behavior for legacy files only. Do not reshuffle reused cards into the 18-card source deck just because a legacy game would recycle when short.

## Scoring terms and counters

The `count` object counts things, not points. All candidate blocks, roads, lines and groups are derived from **one canonical final visible grid**. Each qualifying block or road network counts once unless explicitly stated.

**Existing counters (still valid):** `spaces` with `zone`, `touching` (N/E/S/W by default), `groupSize` with `rank`, and `roadLength` with `rank`. For `roadLength`, the result must be the number of visible road blocks in the selected connected road; rank 1 = longest.

| `count.what` or extension | Semantics / required parameters | Goals |
|---|---|---|
| `roadNetworks` | Existing road network count with NEW optional filters: `hasCityEdgeEndpoint: boolean`; `traversesAllZones: [zone ids]`; `terminalZones: [zone ids]`, `terminals: number`, `distinctTerminalBlocks: boolean`. Filters combine with AND. An edge endpoint is a road port facing an unoccupied grid position. `terminalZones` matches the zones of terminal visible blocks (not merely any blocks on the route). | 1, 13, 16 |
| `lineMatches` | `direction: "rows"|"cols"|"both"`, `zone`, `exact`, `occupiedLinesOnly`. Count lines whose number of matching zone blocks equals `exact`. An eligible line contains >=1 occupied city block even when `exact:0`. | 2 |
| `monochromeSquares` | `size:2`, `includeOverlapping:true`: count each fully occupied 2×2 contiguous square whose four zones are identical. Each position counts separately even if squares overlap. | 4 |
| `spaces.adjacent` | `{relation:"side", onlyZones:[...], minOccupied:1}`: all **occupied** side neighbors must have an allowed zone and at least the given number must exist. Unoccupied sides are not disqualifying. | 5 |
| `spaces.cityEdge` | `true` = at least one unoccupied orthogonal neighbor; `false` = all four orthogonal neighbors occupied. | 7, 17 |
| `groupSelection` at goal level | `{zone:"home",rank:1,ties:"maximize-goal-score"}`: choose exactly one largest connected Residential group for the **whole** goal. If tied, choose the tied group yielding the greatest total goal score. | 8 |
| `adjacentToSelectedGroup` | `zone`, `relation:"side"`; count distinct blocks of specified zone with at least one shared edge to the selected group, not pairs of edges. All `terms` share the **same** group chosen above. | 8 |
| `spaces.touching.relation: "corner"` | Count diagonally adjacent neighbors only (four diagonal positions), not orthogonal neighbors; use `min`. | 9 |
| `bestLine` | `direction:"rows"|"cols"|"both"`, `measure:"zoneCount"` with `zone`, or `measure:"occupiedCount"` with no `zone`. Return the maximum **number of blocks** in one eligible row/column, not the number of qualifying lines. For `both`, take maximum across both axes. Empty positions/gaps never contribute. | 10, 18 |
| `roadTriplets` | `ends:["home","home"]`, `center:"shop"`, `allowTurns:true`, `countCenterOnce:true`. Count each unique Commercial road block with **two distinct directly adjacent Residential road blocks** connected to the Commercial by reciprocal road ports. The two road connections can be straight or a 90° turn. | 11 |
| `roadCycleSections` | `countSharedOnce:true`: find all road graph vertices that are part of any graph cycle; return union count (visible road sections). Connected road branches that are not on a cycle score zero. | 14 |
| `spaces.cornerEdge` | `true` iff the block has at least two perpendicular exposed N/E/S/W sides. Corner scoring is added to `cityEdge` scoring, so corner Commercial blocks yield 2. | 17 |

`scoreTable` (goal 4): Object keys `"0"`, `"1"`, … and a final lower-bound `"5+"`. The engine computes the `count` and looks up the exact key or the matching lower bound. It returns that **score directly** (do not apply `points`). For goal 4: `0→-8, 1→-5, 2→-2, 3→+1, 4→+4, >=5→+7`.

## Road graph endpoint rules and overlap

Road tiles have a 2×2 `roads` port string of `N/E/S/W`. Opposing ports on adjacent *visible* road tiles form one edge. Every unpaired road port is a road **terminal**: it is at the city edge only if the adjacent grid cell is entirely **unoccupied**. If a road port touches an occupied tile with no reciprocal road port, the terminal is internal. A road connected component can have two terminals (ordinary path), zero (loop), or—if future cards permit it—more (branches).

- Goal 1: a road with **any** edge-facing terminal qualifies as edge-ending and earns −1, otherwise +1. A closed loop has no edge-facing terminals and earns +1.
- Goal 13: a qualifying road has exactly **two terminal ends**, located in two different Park blocks. A road merely traversing two Parks without ending there is not sufficient.
- Goal 14: one visible road block scores once if it belongs to at least one complete cycle. Do not count a shared cycle block twice.
- Goal 16: a road qualifies once if among its traversed visible block zones are both `home` and `shop`.
- Recompute groups/roads/edges after every card overlap; the top layer replaces all four tile properties at its occupied coordinates.

## Reference-note ambiguities / explicit defaults for this variant

1. **Stacks and Scrapers:** The reference phrase "adjacent to only Commercial or Industrial" does not say whether an entirely isolated Industrial block scores. This JSON requires **at least one occupied adjacent block** (`minOccupied:1`) as the natural interpretation of "adjacent." If an alternative interpretation includes isolated blocks, set it to 0.
2. **The 'Burbs:** When several Residential groups tie for largest, the notes do not specify a tie choice. This JSON chooses the **single tied group with the best total goal score**. Do not independently optimize positive and negative terms using different Residential groups.
3. **Termini/edge holes:** The contract treats a road ending alongside a gap/hole as edge-ending and a Commercial block beside a gap as on the edge. Check the supplied diagrams for any special treatment of enclosed holes.

These uncertainties are **not** excuses to substitute simplified scoring. They are narrow choices that must be documented and testable.

## Acceptance checks the coding agent must run

1. JSON validates against v2 while all existing v1 rulesets continue to load unchanged.
2. Exactly 18 city cards and 18 numbered goals are paired 1:1; reserve 3 distinct pairs; there are 15 buildable cards, 1 initial + 14 later placements, target is the sum of three goal numbers.
3. On each configured card, zone tiles are one each of `park`, `home`, `shop`, `work`; road ports are all reciprocal across internal boundaries, and per-card connected road counts equal `1,2,2,1,1,2,2,2,1,2,2,2,2,1,2,2,2,1`.
4. Test 0/180° placements and overlap behavior; verify no scoring from a covered zone, road tile or unexposed edge. Illegal corner-only attachment and underlay must be rejected.
5. All 18 configured goal formulas score correctly, especially Goals 1 (internal vs external road ending), 2 (exact 3 and 0), 4 (overlapping squares/score table), 8 (single selected largest group), 11 (straight and stepped road triplets), 13 (distinct Park terminal blocks), 14 (broken/completed loops) and 18 (skip empty gaps).
6. Example-diagram sanity checks: Goal 4's 5+ squares yield **7**; Goal 6 with largest Residential 8 and Industrial 2 yields **6**; Goal 14's illustration shows a 12-section loop yielding **12**; the rulebook example's zone groups sum to **11**, with **7** roads and base score **4**. A selected trio numbered 2, 7, 14 yields **target 23**.
7. End score displays four largest connected-group sizes, road penalty, three goal subtotals, final score, target and win/loss. No leftover preview-only `"(adapted)"` goals remain.

## Implementation instruction

**Build the code to support this exact JSON. Do not change any field name, reinterpret a rule, or silently drop unsupported goal fields.** If a field isn't implemented, reject the ruleset with a precise diagnostic until it is. Finally update the application's `RULESET.md` and tests to document the v2 syntax.
