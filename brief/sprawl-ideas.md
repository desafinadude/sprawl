# SPRAWL JAM BAORD WORK IN PROGRESS IDEAS


## Zone & notation key

| Code | Colour | Printed district |
|---|---|---|
| P | Green 🟩 | Park |
| R | Orange 🟧 | Residential |
| C | Blue 🟦 | Commercial |
| I | Grey ◻️ | Industrial |

All **18 faces contain exactly one district of each type**.

## 1. Compact city-face inventory

| ID | PDF | Printed top / bottom | Road 1 (printed) | Road 2 (printed) | Goals |
|---|---:|---|---|---|---|
| 01 | 2 | `PR` / `CI` | `N-R → W-B` | `—` | 1 |
| 02 | 2 | `PC` / `IR` | `N-R → S-R` | `W-B → S-L` | 2 |
| 03 | 2 | `PR` / `CI` | `N-R → S-R` | `W-B → S-L` | 3 |
| 04 | 2 | `CI` / `PR` | `W-T → S-R` | `—` | 4 |
| 05 | 2 | `PI` / `RC` | `N-R → W-B` | `—` | 5 |
| 06 | 2 | `CR` / `IP` | `W-T → E-T` | `W-B → S-L` | 6 |
| 07 | 4 | `RC` / `PI` | `W-T → N-L` | `N-R → S-R` | 7 |
| 08 | 4 | `IR` / `PC` | `W-T → E-T` | `E-B → S-R` | 8 |
| 09 | 4 | `RC` / `PI` | `W-T → S-R` | `—` | 9 |
| 10 | 4 | `IR` / `PC` | `W-T → N-L` | `N-R → S-R` | 10 |
| 11 | 4 | `CI` / `PR` | `W-T → N-L` | `N-R → S-R` | 11 |
| 12 | 4 | `RC` / `PI` | `W-T → E-T` | `E-B → S-R` | 12 |
| 13 | 6 | `RI` / `CP` | `W-T → E-T` | `W-B → S-L` | 13 |
| 14 | 6 | `IR` / `PC` | `W-T → S-R` | `—` | 14 |
| 15 | 6 | `IC` / `RP` | `W-T → E-T` | `W-B → S-L` | 15 |
| 16 | 6 | `PI` / `RC` | `N-R → S-R` | `W-B → S-L` | 16 |
| 17 | 6 | `CI` / `PR` | `W-T → E-T` | `E-B → S-R` | 17 |
| 18 | 6 | `PC` / `IR` | `N-R → W-B` | `—` | 18 |

**Example:** `PR / CI` = top-left Park, top-right Residential, bottom-left Commercial, bottom-right Industrial.

## 2. Each city card in detail (printed portrait orientation)

### Card 01 — city face p. 2, row 1, column 1


- **Print zones:** TL park, TR residential, BL commercial, BR industrial.
- **Landscape zones (90° clockwise):** TL commercial, TR park, BL industrial, BR residential.
- **Independent continuous roads:** 1.
- **Road 1:** N-R → W-B; crosses districts TR → BR → BL (residential → industrial → commercial). In chosen landscape orientation: E-B → N-L.

### Card 02 — city face p. 2, row 1, column 2


- **Print zones:** TL park, TR commercial, BL industrial, BR residential.
- **Landscape zones (90° clockwise):** TL industrial, TR park, BL residential, BR commercial.
- **Independent continuous roads:** 2.
- **Road 1:** N-R → S-R; crosses districts TR → BR (commercial → residential). In chosen landscape orientation: E-B → W-B.
- **Road 2:** W-B → S-L; crosses districts BL (industrial). In chosen landscape orientation: N-L → W-T.

### Card 03 — city face p. 2, row 1, column 3


- **Print zones:** TL park, TR residential, BL commercial, BR industrial.
- **Landscape zones (90° clockwise):** TL commercial, TR park, BL industrial, BR residential.
- **Independent continuous roads:** 2.
- **Road 1:** N-R → S-R; crosses districts TR → BR (residential → industrial). In chosen landscape orientation: E-B → W-B.
- **Road 2:** W-B → S-L; crosses districts BL (commercial). In chosen landscape orientation: N-L → W-T.

### Card 04 — city face p. 2, row 2, column 1

- **Print zones:** TL commercial, TR industrial, BL park, BR residential.
- **Landscape zones (90° clockwise):** TL park, TR commercial, BL residential, BR industrial.
- **Independent continuous roads:** 1.
- **Road 1:** W-T → S-R; crosses districts TL → TR → BR (commercial → industrial → residential). In chosen landscape orientation: N-R → W-B.

### Card 05 — city face p. 2, row 2, column 2


- **Print zones:** TL park, TR industrial, BL residential, BR commercial.
- **Landscape zones (90° clockwise):** TL residential, TR park, BL commercial, BR industrial.
- **Independent continuous roads:** 1.
- **Road 1:** N-R → W-B; crosses districts TR → BR → BL (industrial → commercial → residential). In chosen landscape orientation: E-B → N-L.

### Card 06 — city face p. 2, row 2, column 3


- **Print zones:** TL commercial, TR residential, BL industrial, BR park.
- **Landscape zones (90° clockwise):** TL industrial, TR commercial, BL park, BR residential.
- **Independent continuous roads:** 2.
- **Road 1:** W-T → E-T; crosses districts TL → TR (commercial → residential). In chosen landscape orientation: N-R → S-R.
- **Road 2:** W-B → S-L; crosses districts BL (industrial). In chosen landscape orientation: N-L → W-T.

### Card 07 — city face p. 4, row 1, column 1


- **Print zones:** TL residential, TR commercial, BL park, BR industrial.
- **Landscape zones (90° clockwise):** TL park, TR residential, BL industrial, BR commercial.
- **Independent continuous roads:** 2.
- **Road 1:** W-T → N-L; crosses districts TL (residential). In chosen landscape orientation: N-R → E-T.
- **Road 2:** N-R → S-R; crosses districts TR → BR (commercial → industrial). In chosen landscape orientation: E-B → W-B.

### Card 08 — city face p. 4, row 1, column 2


- **Print zones:** TL industrial, TR residential, BL park, BR commercial.
- **Landscape zones (90° clockwise):** TL park, TR industrial, BL commercial, BR residential.
- **Independent continuous roads:** 2.
- **Road 1:** W-T → E-T; crosses districts TL → TR (industrial → residential). In chosen landscape orientation: N-R → S-R.
- **Road 2:** E-B → S-R; crosses districts BR (commercial). In chosen landscape orientation: S-L → W-B.

### Card 09 — city face p. 4, row 1, column 3


- **Print zones:** TL residential, TR commercial, BL park, BR industrial.
- **Landscape zones (90° clockwise):** TL park, TR residential, BL industrial, BR commercial.
- **Independent continuous roads:** 1.
- **Road 1:** W-T → S-R; crosses districts TL → TR → BR (residential → commercial → industrial). In chosen landscape orientation: N-R → W-B.

### Card 10 — city face p. 4, row 2, column 1


- **Print zones:** TL industrial, TR residential, BL park, BR commercial.
- **Landscape zones (90° clockwise):** TL park, TR industrial, BL commercial, BR residential.
- **Independent continuous roads:** 2.
- **Road 1:** W-T → N-L; crosses districts TL (industrial). In chosen landscape orientation: N-R → E-T.
- **Road 2:** N-R → S-R; crosses districts TR → BR (residential → commercial). In chosen landscape orientation: E-B → W-B.

### Card 11 — city face p. 4, row 2, column 2

- **Print zones:** TL commercial, TR industrial, BL park, BR residential.
- **Landscape zones (90° clockwise):** TL park, TR commercial, BL residential, BR industrial.
- **Independent continuous roads:** 2.
- **Road 1:** W-T → N-L; crosses districts TL (commercial). In chosen landscape orientation: N-R → E-T.
- **Road 2:** N-R → S-R; crosses districts TR → BR (industrial → residential). In chosen landscape orientation: E-B → W-B.

### Card 12 — city face p. 4, row 2, column 3


- **Print zones:** TL residential, TR commercial, BL park, BR industrial.
- **Landscape zones (90° clockwise):** TL park, TR residential, BL industrial, BR commercial.
- **Independent continuous roads:** 2.
- **Road 1:** W-T → E-T; crosses districts TL → TR (residential → commercial). In chosen landscape orientation: N-R → S-R.
- **Road 2:** E-B → S-R; crosses districts BR (industrial). In chosen landscape orientation: S-L → W-B.

### Card 13 — city face p. 6, row 1, column 1


- **Print zones:** TL residential, TR industrial, BL commercial, BR park.
- **Landscape zones (90° clockwise):** TL commercial, TR residential, BL park, BR industrial.
- **Independent continuous roads:** 2.
- **Road 1:** W-T → E-T; crosses districts TL → TR (residential → industrial). In chosen landscape orientation: N-R → S-R.
- **Road 2:** W-B → S-L; crosses districts BL (commercial). In chosen landscape orientation: N-L → W-T.

### Card 14 — city face p. 6, row 1, column 2


- **Print zones:** TL industrial, TR residential, BL park, BR commercial.
- **Landscape zones (90° clockwise):** TL park, TR industrial, BL commercial, BR residential.
- **Independent continuous roads:** 1.
- **Road 1:** W-T → S-R; crosses districts TL → TR → BR (industrial → residential → commercial). In chosen landscape orientation: N-R → W-B.

### Card 15 — city face p. 6, row 1, column 3


- **Print zones:** TL industrial, TR commercial, BL residential, BR park.
- **Landscape zones (90° clockwise):** TL residential, TR industrial, BL park, BR commercial.
- **Independent continuous roads:** 2.
- **Road 1:** W-T → E-T; crosses districts TL → TR (industrial → commercial). In chosen landscape orientation: N-R → S-R.
- **Road 2:** W-B → S-L; crosses districts BL (residential). In chosen landscape orientation: N-L → W-T.

### Card 16 — city face p. 6, row 2, column 1


- **Print zones:** TL park, TR industrial, BL residential, BR commercial.
- **Landscape zones (90° clockwise):** TL residential, TR park, BL commercial, BR industrial.
- **Independent continuous roads:** 2.
- **Road 1:** N-R → S-R; crosses districts TR → BR (industrial → commercial). In chosen landscape orientation: E-B → W-B.
- **Road 2:** W-B → S-L; crosses districts BL (residential). In chosen landscape orientation: N-L → W-T.

### Card 17 — city face p. 6, row 2, column 2


- **Print zones:** TL commercial, TR industrial, BL park, BR residential.
- **Landscape zones (90° clockwise):** TL park, TR commercial, BL residential, BR industrial.
- **Independent continuous roads:** 2.
- **Road 1:** W-T → E-T; crosses districts TL → TR (commercial → industrial). In chosen landscape orientation: N-R → S-R.
- **Road 2:** E-B → S-R; crosses districts BR (residential). In chosen landscape orientation: S-L → W-B.

### Card 18 — city face p. 6, row 2, column 3


- **Print zones:** TL park, TR commercial, BL industrial, BR residential.
- **Landscape zones (90° clockwise):** TL industrial, TR park, BL residential, BR commercial.
- **Independent continuous roads:** 1.
- **Road 1:** N-R → W-B; crosses districts TR → BR → BL (commercial → residential → industrial). In chosen landscape orientation: E-B → N-L.

## 3. The 18 scoring conditions — all rule text and diagram descriptions

The rule lines below preserve the printed scoring wording as closely as possible (with typography normalized); diagram notes describe what the accompanying illustration shows. Each unmodified goal-face image is linked.

### 01. THE OUTSKIRTS — goal face p. 3


- **Rule:** +1 pt(s) — Road that does not end at the edge of the city.
- **Rule:** -1 pt(s) — Road that ends at the edge of the city.
- **Diagram:** The black lines depict connected roads in an irregular city. Two internal-ended roads are labelled +1pt; three edge-ending roads are labelled -1pt. The scoring unit is a whole continuous road, not a road segment.

### 02. BLOOM BOOM — goal face p. 3


- **Rule:** +1 pt(s) — Each row & column with exactly 3 Park blocks in it.
- **Rule:** -1 pt(s) — Each row & column with exactly 0 Park blocks in it.
- **Diagram:** An irregular block grid marks qualifying 3-park rows/columns with +1pt and empty-of-park rows/columns with -1pt. Both horizontal rows and vertical columns are counted; other park counts earn nothing.

### 03. GO GREEN — goal face p. 3


- **Rule:** +1 pt(s) — Park block in your city.
- **Rule:** -3 pt(s) — Industrial block in your city.
- **Diagram:** One green Park square is shown as +1pt; one grey Industrial square as -3pts.

### 04. BLOCK PARTY — goal face p. 3


- **Rule:** Score points per group of 4 “corner to corner” blocks of the same type. You may score multiple groups of the same type and a block may apply to more than one group.
- **Diagram:** Four monochrome 2x2 examples (Residential, Commercial, Industrial, Park). Scoring table: 0 groups = -8; 1 = -5; 2 = -2; 3 = +1; 4 = +4; 5+ = +7. A 2x2 group may overlap another counted group.

### 05. STACKS AND SCRAPERS — goal face p. 3


- **Rule:** +2 pt(s) — Industrial block adjacent to only Commercial or Industrial blocks.
- **Diagram:** A grey Industrial block sits beside blue Commercial blocks and a grey Industrial block; arrows show eligible neighbouring types. The shown Industrial block earns 2pts. No residential or park neighbour is shown.

### 06. MASTER PLANNED — goal face p. 3


- **Rule:** Subtract the number of blocks in your largest Industrial group from the number of blocks in your largest Residential group. Score that many points.
- **Diagram:** A large orange Residential group is marked 8pts, the largest grey Industrial group -2pts, giving 6pts (8 - 2). The size of each largest edge-connected group matters, not all blocks citywide.

### 07. CENTRAL PERKS — goal face p. 5


- **Rule:** +1 pt(s) — Park block located on the interior of the city.
- **Rule:** -2 pt(s) — Park block on the edge of the city.
- **Diagram:** An irregular city outline contains three green interior Park blocks labelled 1pt each and one green edge Park block labelled -2pts. Interior/edge depends on the city shape, not the card border.

### 08. THE ‘BURBS — goal face p. 5


- **Rule:** +1 pt(s) — Park block adjacent to your largest group of Residential blocks.
- **Rule:** -2 pt(s) — Industrial block adjacent to your largest group of Residential blocks.
- **Diagram:** An orange largest Residential group is shown, with an adjacent green Park labelled +1pt and grey Industrial labelled -2pts. Callout arrows point toward the contiguous orange group.

### 09. CONCRETE JUNGLE — goal face p. 5


- **Rule:** +1 pt(s) — Industrial block that shares a corner with at least 1 other Industrial block.
- **Diagram:** Three grey Industrial blocks in a 2x3 diagram: two touch diagonally and each scores 1pt; one marked X does not score because it only shares an edge with another Industrial block, not a corner.

### 10. THE STRIP — goal face p. 5


- **Rule:** +1 pt(s) — Commercial block in any 1 Row or Column of your choice. You may only score for 1 Row or Column.
- **Diagram:** One illustrated row contains six blue Commercial blocks and two non-commercial/blank positions, giving 6pts. Count just one selected row OR one selected column.

### 11. MINI MARTS — goal face p. 5


- **Rule:** +2 pt(s) — Commercial block directly between two Residential blocks with the same road connecting all three blocks. Blocks may be a straight line or in a “stepped” pattern.
- **Diagram:** Two separate orange–blue–orange examples: three blocks in a straight horizontal row and a stepped L-shaped group. A black road runs through all three; each blue commercial middle block earns 2pts.

### 12. SUPERHIGHWAY — goal face p. 5


- **Rule:** +1 pt(s) — Every 2 Road sections (rounded down) that are part of your longest road.
- **Diagram:** A multi-bend black road on a block grid is annotated 1pt at each pair of sections; extra single section is rounded down. The thick black line traverses multiple city blocks and turns.

### 13. PARK HOPPING — goal face p. 7


- **Rule:** +3 pt(s) — Road that begins at one Park and ends at a different Park.
- **Diagram:** A single thick road starts in a green Park at upper left, runs horizontally across several blocks, turns down, and terminates in another green Park at lower right. The qualifying road earns 3pts.

### 14. LOOPING LANES — goal face p. 7


- **Rule:** +1 pt(s) — Road section in a completed loop. You may score multiple loops in your city.
- **Diagram:** A closed black road circuit on a multirow grid is annotated 12pts; it includes 12 scoring road sections. The route closes on itself instead of having loose endpoints.

### 15. SKID ROW — goal face p. 7


- **Rule:** +2 pt(s) — Residential block adjacent to 2 or more Industrial blocks.
- **Diagram:** An orange Residential block has a grey Industrial block immediately to its right and another directly below; arrows show two edge-adjacencies, so the Residential scores 2pts.

### 16. MORNING COMMUTE — goal face p. 7


- **Rule:** +2 pt(s) — Road that passes through both a Residential block and a Commercial block.
- **Diagram:** A diagram shows two different qualifying roads, each marked 2pts. One road passes through blue Commercial and orange Residential among other blocks; another takes a different route but also touches both colours.

### 17. TOURIST TRAPS — goal face p. 7


- **Rule:** +1 pt(s) — Commercial block on the edge of the city.
- **Rule:** +1 pt(s) — Additional point for a Commercial block on a corner edge.
- **Diagram:** An irregular grid shows blue Commercial blocks at exposed city corners labelled 2pts (1 edge + 1 corner bonus), a blue Commercial edge block labelled 1pt, and an interior blue block with no scoring annotation.

### 18. SPRAWLOPOLIS — goal face p. 7


- **Rule:** Add the number of blocks in your longest Row to the number of blocks in your longest Column (skipping any gaps). Score that many points.
- **Diagram:** An irregular outline of occupied block cells has its longest row marked with repeated 1pt labels and its longest column marked with 1pt labels; X marks indicate gaps skipped while counting. The two counts are added.

## 4. Page 1 — rulebook text, summarized

### Basic information and goal

- **Title:** Sprawlopolis. **Players:** 1–4. **Duration:** 15 minutes. **Age:** 8+. **Components:** 18 double-sided cards, each with four city blocks on one side and an individually numbered scoring condition on the other.
- **Theme/objective:** Players cooperate to grow one city under three scoring conditions selected each game. The **target score** is the sum of the numbers on the selected goal faces. The city wins if its final score meets or exceeds the target.

### Setup

1. Shuffle the 18 cards. Randomly select **three** goals, leave them scoring-condition side up, and total their numbers for the target score. Ignore the goal sides of the other cards.
2. Choose a start player. Give that player **three cards**, blocks-side face down. Deal **one card** to each other player, blocks-side face down. Players hold their cards without revealing their blocks to teammates.
3. Place the other cards as a draw deck **blocks-side face up**. All players can preview its top card.
4. Place the top card from that deck face up in a Build Area to start the city.
5. Play proceeds clockwise.

### Blocks and roads

- Each card contains four blocks, one of each: **Commercial (blue), Park (green), Industrial (grey), Residential (orange)**.
- A **block** is a rectangular quadrant. A **block group** consists of same-type districts connected by at least one **shared edge**; mere corner contact does not connect groups.
- Each card has **one or two roads**. A road is a **continuous stretch of roadway** that may extend one block or across several blocks, until it ends at a block/city boundary. Road lengths, endings, and connections matter for scoring.

### Turn sequence

- The active player chooses one of their three cards, reveals it, and places it blocks-side up in the city.
- They then pass their **two remaining** cards to the player on their left; that player combines them with their one held card to have three for their next turn.
- The previous active player draws the top card into their hand, so they have one for the next time cards are passed.
- When the deck is empty, the game continues with the cards remaining in players’ hands; if fewer than two cards are available to pass, pass what remains.
- Continue until **all 15 available city cards** have been placed. (Three of the original 18 were reserved as scoring-goal cards.)

### Placement rules (important to code)

- Newly placed card must share **at least one complete block edge** with an existing city block, **or** overlap and cover one or more existing blocks.
- You **cannot tuck** a new card beneath an existing card.
- You **cannot** attach a card so that it is connected **only at a corner**.
- You may rotate a card **180°**, but it must remain **horizontal** in play; 90° sideways placements are not permitted.
- Gaps are legal if all other placement rules are met. Printed legal/illegal diagrams show a valid overlapping/edge-joining city versus two separate cards connected only at a corner.

### Table talk, end scoring, variants

- **Table talk:** discussing card placement and strategy is encouraged, but players may not show their hands; once a card is revealed it must be placed.
- **Base block score:** score **1 point per block in the largest edge-connected group of each of the four zone types** (one biggest group per type, ties may be resolved either way).
- **Base road score:** subtract **1 point for each separate continuous road** anywhere in your completed city.
- **Final score:** block score − road count + all three scoring-condition results. Win at or above the target score. Some scoring cards can subtract points.
- **Example on page 1:** Commercial 2 + Industrial 2 + Park 4 + Residential 3 = 11 block points; 7 roads = −7; therefore **base score = 4**, before the three goals. The setup example chooses goals **2 + 7 + 14 = target 23**.
- **Solo play:** Same rules, but maintain your own hand of three; after a placement draw a replacement while cards remain.
- **Easier variant:** do not subtract road points. **Harder variant:** score only the largest block group of one zone type rather than of all four.

