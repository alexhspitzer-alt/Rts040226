# bluFreight Architecture Notes

This document is the durable ownership map for the modular runtime. It replaces the temporary refactor plan with guidance for where new logic should live.

## Runtime composition

- `game.js` is the composition layer. It owns the live runtime wiring between state, modules, legacy compatibility adapters, and the browser bootstrap. New domain rules should move into modules instead of expanding this file.
- `modules/game-bootstrap.js` owns browser startup, DOM lookup, control binding, data-load sequencing, and the interval loop. Add new startup dependencies here only when they are needed to boot the UI.
- `modules/game-state.js` owns the initial mutable state schema. Add new persisted or cross-system state fields here so default values are explicit.

## Domain ownership

- `modules/constants/` owns shared tuning values and domain constants:
  - `core.js` for tutorial, command timing, operating costs, paths, and shared names.
  - `dock.js` for dock condition, hazard, maintenance, and port-authority values.
  - `factions.js` for heat, campaign, faction display, and faction home-base values.
- `modules/game-map.js` owns canonical map-model construction, map aliases, graph building, map node labels, and map normalization.
- `modules/game-navigation.js` owns route, signal, fuel, destination, and BUDDE advisory calculations.
- `modules/game-route-cache.js` owns cache wrappers for navigation calls. Invalidate the cache whenever the active map graph changes.
- `modules/game-contracts.js` owns contract generation and contract scoring helpers.
- `modules/game-npc-controller.js` owns NPC traffic, ambient NPCs, conflict simulation, and campaign combat behavior.
- `modules/game-hail.js` owns player hail channel state and hail response selection.

## Command and UI ownership

- `modules/game-command-parser.js` owns command tokenization, aliases, and confirmation parsing. Add syntax changes here before wiring command effects.
- `modules/game-command-runtime.js` owns command side effects and menu-state transitions. It should call parser and selector helpers rather than duplicating lookup logic.
- `modules/game-selectors.js` owns pure, read-only derived-state helpers used by commands, rendering, and tests.
- `modules/views/` owns DOM rendering helpers and view-model shaping:
  - `almanac-view.js` renders almanac content.
  - `game-dashboard-view.js` renders the dashboard, contracts, and fleet summaries.

## Data, events, and instrumentation

- `modules/game-data-loader.js` owns reference-data fetching and validation. Add new JSON/text assets to its path map and validation flow.
- `modules/game-events.js` owns lightweight pub/sub. Emit domain events when other systems may need to observe gameplay outcomes without tight coupling.
- `modules/game-ticks.js` owns the ordered simulation tick runner. Add a new subsystem tick here only after its function is independently testable.
- `modules/game-random.js` owns injectable randomness and seeded random helpers. Avoid direct `Math.random()` in gameplay modules.
- `modules/game-performance.js` owns optional sampling. Sampling is disabled by default and can be enabled with `?perf`, `?performance`, `/perf`, or `/performance`.

## Extension guidelines

1. Prefer adding pure helpers or module-level functions before editing `game.js`.
2. Add new state defaults in `modules/game-state.js` before reading them in runtime code.
3. Keep constants in the closest domain constants file; import them at each use site.
4. Route user text through the parser, then implement behavior in the command runtime.
5. Add tests for parser changes, deterministic random behavior, route-cache semantics, view-model shaping, and tick ordering when those areas change.
6. Keep compatibility comments short and actionable; remove them when the compatibility path is retired.
