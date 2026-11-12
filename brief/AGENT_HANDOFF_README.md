# Agent handoff — Sprawl Jam for Blocktown

## Project framing

Extend **Blocktown** with an optional, fan-made city-building mode for **private, non-commercial play**. The supplied notes (`sprawl-ideas.md`) provide example card geometry, road patterns, and scoring ideas. This is an engine-feature task: build a general-purpose paired-card setup and flexible scoring counters, then load the attached variant JSON.

The visual presentation can use Blocktown's existing tile art and interface. **No external game artwork, logos, card scans, or publisher assets need to be recreated or distributed.** Use the reference descriptions as functional test cases, not as a request for visual duplication.

## Files to give the coding agent

1. `SPRAWL_JAM_IMPLEMENTATION_BRIEF.md` — features and acceptance tests.
2. `SPRAWL_JAM_V2_SCHEMA_CONTRACT.md` — the agreed JSON keys, counter definitions, and edge-case semantics. This document takes precedence over earlier suggestions of field names.
3. `blocktown_sprawl_jam.json` — target v2 example configuration. It **requires engine updates** and should not be treated as already compatible with v1.
4. `RULESET.md` — current v1 format to preserve for older sets.
5. `sprawl-ideas.md` — user's reference notes for layout and scoring behaviour.
6. `blocktown_layout_preview.png` — optional visual sanity-check of the 18 configured layouts.

## Assignment to the coding agent (copy/paste)

> I'd like to add a **Sprawl Jam** mode to my Blocktown project for personal, non-commercial play. Please extend its rules engine and JSON format using `SPRAWL_JAM_IMPLEMENTATION_BRIEF.md` and `SPRAWL_JAM_V2_SCHEMA_CONTRACT.md`.
>
> Make `blocktown_sprawl_jam.json` load as an optional ruleset, with its 18 linked layout/goal pairs, paired goal selection, road-network analysis, and specified scoring conditions. Treat the JSON as the target configuration and implement whatever general counters are needed rather than simplifying the formulas to fit existing functionality.
>
> Keep current Blocktown rulesets working. Add tests covering setup, placements, overlap, roads, each goal's scoring, and end-game results; then update `RULESET.md` to document the new features.
>
> Please use Blocktown's own UI and generic card visuals. The accompanying notes are reference material for game mechanics, not a request to recreate source artwork or assets. Flag meaningful ambiguities instead of guessing.

## Checks already performed

- 18 unique linked cards and goals; matching card IDs and numbers.
- Every card has one district each of Residential, Commercial, Industrial and Park.
- Internal road ports connect reciprocally; each card has the expected one or two road networks.
- All 18 scoring configurations use the extended counters described in the schema contract (not the earlier simplified preview formulas).

**Not yet tested:** Runtime scoring, user interface, gameplay, or application-side schema validation. These depend on code changes in the Blocktown repository.
