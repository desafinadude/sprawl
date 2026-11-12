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
  "zones": [ ... ],
  "rules": { ... },
  "goals": [ ... ],
  "cards": [ ... ]
}
```

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
| `spaces` | `zone`, `road` (true/false), `touchingEmpty` (true/false), `touching`: `{ "zone", "min", "max" }` | Spaces matching every option given. `touching` = number of side-by-side neighbours of that zone (min defaults to 1). |
| `groups` | `zone`, `minSize`, `maxSize` | Connected groups of the zone whose size is in range. |
| `groupSize` | `zone`, `rank` (1 = largest) | Size of the Nth largest group of a zone. |
| `pairs` | `a`, `b` | Side-by-side touching pairs of a zone-`a` and a zone-`b` space (use the same zone twice for same-zone pairs). |
| `emptyInBounds` | | Empty spaces inside the rectangle around the city. |
| `squares` | `zones` (default all), `minCards` | Full 2×2 areas containing every listed zone, made of spaces from at least `minCards` different cards. |
| `lines` | `zones` (default all), `direction`: `rows` / `cols` / `both` | Rows/columns that contain every listed zone. |
| `roadNetworks` | | Number of separate road networks. |
| `roadLength` | `rank` (1 = longest) | Spaces in the Nth longest road network. |
| `bounds` | `measure`: `width` / `height` / `area` / `spaces` | City size. |
| `cards` | `minVisible` | Cards with at least that many spaces still showing. |

Need a kind of count that isn't here? Counters live in `COUNTERS` in `js/rules.js`, each a small function.

## Testing balance

```bash
node tools/sim.mjs 20 data/blocktown.json
```

This plays bot games with your file and prints average scores, and the average for each goal.
