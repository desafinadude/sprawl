# Blocktown

A fan-made, mobile-first card-laying city builder in the spirit of small "micro" city-building card games.
Plain HTML/CSS/JS, no build step. Works in portrait and landscape.

## Play

Serve the folder with any static server and open it on your phone or browser:

```bash
python3 -m http.server 8000
```

Modes (set up on the start screen, 1–4 players):

- **Solo**: hold 3 cards, play one and draw one, 15 plays, then get a rank from your score.
- **Draft vs bots / hot-seat**: everyone builds their own city. Each round you're dealt 4 cards, build one and pass the rest (left, then right on alternate rounds). Mix humans and Easy/Normal/Hard bots; human players pass the device between turns.

Games are auto-saved to the browser, so you can continue them later.

## Rules in short

- Each card is a 2×2 block with exactly one of each zone (Housing, Market, Industry, Park); most cards also carry roads.
- A new card must touch your city and may cover up to 2 existing spaces.
- Score: for each zone, the size of its largest connected group, minus 1 per separate road network, plus 3 random goals (13 in the pool).

## Code

| File | What it does |
| --- | --- |
| `js/rules.js` | Cards, deck generation, city grid, placement checks, goals, scoring (no DOM) |
| `js/game.js` | Solo and draft flow, save/load |
| `js/bot.js` | Greedy bots (tries every card, rotation and spot) |
| `js/board.js` | Canvas rendering, pan/pinch/zoom, ghost-card dragging |
| `js/app.js` | Screens and UI |
| `tools/sim.mjs` | Bot-vs-bot simulation for balancing: `node tools/sim.mjs 50` |

## Adding art

Tiles are drawn as flat colours with simple icons. To use generated art, put square images in `assets/`
and list them in `assets/art.json`:

```json
{ "home": "zones/home.png", "shop": "zones/shop.png", "work": "zones/work.png", "park": "zones/park.png" }
```

Listed zones are drawn with the image, and roads are still drawn on top, so keep the art road-free.
Each image should be a seamless square tile (about 256×256 px is enough).
