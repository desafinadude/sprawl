# Ruleset JSON format

Everything about the game's content lives in a JSON file: zones, cards, rule numbers and goals.
The built-in sets are in `data/`, and `data/rulesets.json` lists which files appear in the
**Rules & cards** dropdown on the start screen.

You can edit a file in `data/` (and add it to `data/rulesets.json`), or, on any device, use
**Download JSON**, edit the file, then **Load JSON…** to play with it. A loaded file is remembered by
the browser and shows up as "Custom: …". If something is wrong, the game lists every problem it found.

Saved games keep a copy of the rules they started with, so editing a file never breaks a game in progress.

## Top level

```json
{
  "name": "Blocktown",
  "description": "Shown under the dropdown.",
  "schemaVersion": 2,
  "zones": [ ... ],
  "rules": { ... },
  "goals": [ ... ],
  "cards": [ ... ]
}
```

`schemaVersion` is optional. Missing (or `1`) = the classic format below, exactly as before.
`2` opts into the extended **Sprawl Jam** engine: paired goal selection, landscape-only
rotation, topmost-overlap placement, target-score victory and the extra counters — see the
[schemaVersion 2](#schemaversion-2-sprawl-jam) section. A file that uses v2-only fields without
declaring the version is rejected with a hint rather than loading half-working.

## zones

```json
{ "id": "home", "name": "Housing", "color": "#f4c95d", "icon": "house", "largestGroupPoints": 1 }
```

| Field | Meaning |
| --- | --- |
| `id` | Short name used by cards and goals. |
| `name` | Shown to players. |
| `color` | Tile colour. |
| `icon` | `house`, `shop`, `factory` or `tree` for built-in drawings, or any letter or emoji (e.g. `"🐄"`). |
| `largestGroupPoints` | Points per space in this zone's largest connected group (default 1; use 0 to not score it). |

You can have any number of zones.

## rules

```json
{
  "maxOverlap": 2,
  "roadNetworkPoints": -1,
  "goalsPerGame": 3,
  "solo": { "plays": 15, "hand": 3, "ranks": [[0, "Ghost Town"], [25, "Hamlet"], [50, "Metropolis"]] },
  "draft": { "rounds": 5, "hand": 4 }
}
```

| Field | Meaning |
| --- | --- |
| `maxOverlap` | How many existing spaces a new card may cover (0–4; 0 = no overlapping). |
| `roadNetworkPoints` | Points for each separate road network (usually negative). |
| `goalsPerGame` | How many goals are drawn at random each game. |
| `solo.plays` / `solo.hand` | Cards played in a solo game and hand size. |
| `solo.ranks` | `[minimum score, title]` pairs, lowest first. |
| `draft.rounds` / `draft.hand` | Multiplayer rounds, and cards dealt each round (you keep all but one). |

### v2-only rules fields

Present only with `"schemaVersion": 2` (see `data/blocktown_sprawl_jam.json` for a full example):

| Field | Meaning |
| --- | --- |
| `goalSelection.mode: "paired-card-removal"` | Each goal is linked to one city card (`goals[*].cardId`). The `goalsPerGame` chosen goals are set aside and their linked city faces are removed from the deck. |
| `goalSelection.target: "sum-goal-numbers"` | Win target = sum of the chosen goals' `number` values (not their point values). |
| `setup.startingCard: "draw-top"` | After hands are dealt, the top remaining city card starts the city. |
| `setup.startingCardCountsAsPlay` | `true` = the starting card counts toward `solo.plays` (15 total cards = 1 start + 14 placements). |
| `setup.visibleDrawDeckTop` | Show the top draw card face-up. |
| `placement.rotation: [0,180]` | Only these angles are legal in play (landscape cards). |
| `placement.connection: "overlap-or-full-block-edge"` | Every card after the first must overlap ≥1 block or share ≥1 full block edge. Corner-only contact is rejected. |
| `placement.overlap: "topmost-visible"` | A cover replaces the zone and road of the covered tile; only the top layer scores. |
| `placement.allowUnderlap: false` | A new card can never go beneath another (enforced — placement is always on top). |
| `victory.mode: "score-at-least-target"` | Final = zone groups − roads + goals; win iff final ≥ target. |
| `scoring.*` | Documents the shared scoring model: `largest-per-zone`, `shared-edge`, `connected-visible-ports`, `visible-block`, `exposed-sides-of-occupied-blocks`. |
| `multiplayer.mode: "sprawlopolis-pass-left"` | Cooperative mode: **one shared city**, start player holds `startPlayerHand` (3), others `otherPlayerHand` (1) each; on a turn play one card, pass `passUnplayed` (2) left, draw `drawAfterPlay` (1); deck exhaustion passes what remains. `rules.draft` is ignored in this mode. |
| `variants.easier.roadNetworkPoints: 0` | Optional toggle: no road penalty. |
| `variants.harder.blockGroups: "single-largest-zone"` | Optional toggle: only the single largest group (best zone) scores instead of all four. |

## cards

```json
{ "id": "B01", "layout": [["home", "shop"], ["work", "park"]], "roads": [["WE", "WE"], ["", ""]], "copies": 1 }
```

- `layout`: the 2×2 card as two rows (top row first), each with a left and a right space.
- `roads`: the same 2×2 shape. Each space lists the sides its road reaches: `N` (top), `E` (right),
  `S` (bottom), `W` (left). All sides in one space meet in the middle. `"WE"` is straight across,
  `"NE"` is a bend, `"NES"` is a T-junction, a single letter like `"W"` is a dead end, `""` is no road.
  Roads on neighbouring spaces connect only when both sides meet (an `E` next to a `W`).
- `copies` (optional, default 1): how many of this card are in the deck. Use 0 to switch a card off.
- `id` (optional): just for your reference and error messages.

If a game needs more cards than the set has (e.g. 4 players), the whole set is shuffled in again.

## goals

A goal counts something in the city and turns the count into points:

```
score = base + points × floor(count ÷ per),  then clamped to min…max
```

```json
{
  "id": "air",
  "name": "Clean Air",
  "text": "10, minus 1 for each pair of touching Housing and Industry spaces.",
  "count": { "what": "pairs", "a": "home", "b": "work" },
  "base": 10, "points": -1
}
```

| Field | Default | Meaning |
| --- | --- | --- |
| `id`, `name`, `text` | | Identifier, title and the description players read. The text is only shown, not checked against the maths, so keep them in sync. |
| `count` | | What to count (see below). |
| `points` | 1 | Points per counted thing (can be negative). |
| `per` | 1 | Count in batches, e.g. `2` = 1 point per 2 things. |
| `base` | 0 | Starting value. |
| `min`, `max` | none | Limits on the final score. |
| `terms` | | Instead of `count`/`points`/`per`, a list of several `{ "count", "points", "per" }` that are added up. |
| `enabled` | true | Set to `false` to remove a goal without deleting it. |
| `number` (v2) | | Integer used **only** to compute the win target (1–18 in the shipped set). Never used as the goal's identity. |
| `cardId` (v2) | | The `cards[*].id` whose city face is set aside when this goal is drawn. Must be unique — cards and goals pair 1:1. |
| `scoreTable` (v2) | | Object mapping a counted value to points, e.g. `{"0": -8, "1": -5, "5+": 7}`. The `count` result is looked up exactly, or by the greatest `n+` lower bound; the value is returned **directly** (`points` is not applied). Requires `count`. |
| `groupSelection` (v2) | | `{"zone": "home", "rank": 1, "ties": "maximize-goal-score"}`: evaluate every group tied at that rank and keep the highest total goal score. All `terms` then see the same chosen group via `adjacentToSelectedGroup`. |

Example with several terms ("+1 per Park with a road, −2 per Industry next to a Park"):

```json
{ "id": "mix", "name": "Example", "text": "...",
  "terms": [
    { "count": { "what": "spaces", "zone": "park", "road": true }, "points": 1 },
    { "count": { "what": "pairs", "a": "work", "b": "park" }, "points": -2 }
  ] }
```

### What can be counted (`count.what`)

Wherever a `zone` is accepted you can give one id (`"home"`) or a list (`["home", "shop"]`).

| `what` | Options | Counts |
| --- | --- | --- |
| `spaces` | `zone`, `road` (true/false), `touchingEmpty` (true/false), `touching`: `{ "zone", "min", "max", "relation" }`, `adjacent`: `{ "relation", "onlyZones", "minOccupied" }`, `cityEdge` (true/false), `cornerEdge` (true/false) | Spaces matching every option given. `touching` = neighbours of that zone (`relation: "side"` default, or `"corner"` for the four diagonals; min defaults to 1). `adjacent` (v2): **every occupied** side neighbour must be in `onlyZones` and at least `minOccupied` must exist (unoccupied sides are fine). `cityEdge` (v2): an unoccupied orthogonal neighbour. `cornerEdge` (v2): at least two *perpendicular* exposed sides. |
| `groups` | `zone`, `minSize`, `maxSize` | Connected groups of the zone whose size is in range. |
| `groupSize` | `zone`, `rank` (1 = largest) | Size of the Nth largest group of a zone. |
| `pairs` | `a`, `b` | Side-by-side touching pairs of a zone-`a` and a zone-`b` space (use the same zone twice for same-zone pairs). |
| `emptyInBounds` | | Empty spaces inside the rectangle around the city. |
| `squares` | `zones` (default all), `minCards` | Full 2×2 areas containing every listed zone, made of spaces from at least `minCards` different cards. |
| `lines` | `zones` (default all), `direction`: `rows` / `cols` / `both` | Rows/columns that contain every listed zone. |
| `roadNetworks` | `hasCityEdgeEndpoint` (true/false), `traversesAllZones`, `terminals`, `terminalZones`, `distinctTerminalBlocks` | Number of separate road networks, optionally filtered (v2; filters combine with AND). A road's *terminals* are its unpaired ports; an edge terminal faces a completely unoccupied cell. `terminalZones` matches the zones of the blocks holding the terminals — with `distinctTerminalBlocks: true` each terminal must sit in its own block. |
| `roadLength` | `rank` (1 = longest) | Visible road blocks in the Nth longest road network. |
| `bounds` | `measure`: `width` / `height` / `area` / `spaces` | City size. |
| `cards` | `minVisible` | Cards with at least that many spaces still showing. |
| `lineMatches` (v2) | `direction`, `zone`, `exact`, `occupiedLinesOnly` | Rows/columns whose count of that zone equals `exact` (both signs work: use a second term for `exact: 0`). Lines need ≥1 occupied block when `occupiedLinesOnly` (default true). |
| `monochromeSquares` (v2) | `size: 2`, `includeOverlapping: true` | Fully occupied 2×2 squares whose four blocks share one zone; overlapping squares each count. Pair with `scoreTable` for lookup scoring. |
| `bestLine` (v2) | `direction`, `measure`: `zoneCount` (+`zone`) / `occupiedCount` | The **largest** count in any one row or column (not how many lines qualify). Gaps never count. |
| `roadTriplets` (v2) | `ends` (two zones), `center`, `allowTurns`, `countCenterOnce` | Road blocks of the `center` zone with two distinct connected road neighbours matching the `ends` multiset — straight or (with `allowTurns`) a 90° step. |
| `roadCycleSections` (v2) | `countSharedOnce: true` | Visible road blocks that lie on at least one completed loop (each block once; branches off a loop don't count). |
| `adjacentToSelectedGroup` (v2) | `zone`, `relation: "side"` | Distinct blocks of a zone sharing an edge with the group chosen by the goal's `groupSelection`. |

Need a kind of count that isn't here? Counters live in `COUNTERS` in `js/rules.js`, each a small function.

## schemaVersion 2 (Sprawl Jam)

The shipped example is `data/blocktown_sprawl_jam.json` (a copy of the brief's
`brief/blocktown_sprawl_jam.json`). A v2 game differs from classic Blocktown in four ways:

1. **Paired goals.** Goals and city cards pair 1:1 via `cardId`. Three goals are chosen without
   replacement; their city faces never enter the deck, leaving 15 buildable cards. The **target**
   is the sum of the three `number` values (e.g. 2 + 7 + 14 = 23).
2. **Setup and turns.** Hands are dealt first, then the top card starts the city (counts as a
   play). Solo: hold 3, play one, draw while the deck lasts, stop at 15 placements. Co-op (2–4):
   one shared city, start player holds 3, others 1; play one → pass 2 left → draw 1; when the
   deck empties pass what remains. The start screen reveals the three goals, their numbers and
   the target; hands stay hidden and table talk is allowed.
3. **Placement.** Only 0°/180° rotation. A card must overlap ≥1 block or share a full block edge
   (corner-only touches are rejected, tucking underneath is impossible). Covers replace the
   covered zone/road — groups, roads, edges and loops are all recomputed from the top layer.
4. **Scoring and victory.** Base = sum of the four largest zone groups + `roadNetworkPoints` per
   separate road (each road = connected components of visible road tiles joined by reciprocal
   ports; sections are visible blocks) + the three goal scores. Win iff total ≥ target.
   The optional `rules.variants` toggles (easier: no road penalty; harder: only the best zone's
   largest group scores) can be ticked on the start screen.

Invalid v2 files are rejected up front with a precise message — an unknown counter, a missing
`goalSelection`, a duplicated `cardId`, a bad `scoreTable` key etc. — rather than loading with
silently ignored fields.

## Testing balance

```bash
node tools/sim.mjs 20 data/blocktown.json
node tools/sim.mjs 20 data/blocktown_sprawl_jam.json
```

This plays bot games with your file and prints average scores, and the average for each goal.
(The co-op set runs its games against the shared city.)

## Tests

```bash
node tools/test.mjs
```

Acceptance suite: v1/v2 loading and validation, paired setup, rotation/overlap/road rules,
one positive and one negative fixture per configured goal (plus the rulebook's worked
examples), and full solo/co-op/legacy games to completion.
