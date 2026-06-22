# Game Structure Refactor and Optimization Plan

This plan breaks the prototype into smaller, safer improvements. Each step is intentionally self-contained: it can be implemented, reviewed, tested, and shipped without requiring a later step to make the game work.

1. **Create a runtime bootstrap module.**
   - Move startup wiring, DOM lookup, data loading, and initial event listener registration out of `game.js` into a dedicated bootstrap module such as `modules/game-bootstrap.js`.
   - Effect: `game.js` becomes easier to scan because it can focus on game rules and state orchestration, while browser-specific startup work lives in one place. This also makes it easier to add alternate launch paths for tests or future scenarios.

2. **Extract a state factory and default state schema.**
   - Introduce a module such as `modules/game-state.js` that exports a `createInitialGameState()` function and documents the expected shape of mutable state.
   - Effect: state fields stop being implicitly scattered through `game.js` and modules. New features can initialize their state in one predictable location, reducing accidental `undefined` reads and making save/load work easier later.

3. **Group constants by domain.**
   - Move large constant blocks from `game.js` into domain-specific modules, for example `modules/constants/dock.js`, `modules/constants/factions.js`, `modules/constants/ui.js`, and `modules/constants/tutorial.js`.
   - Effect: changing one gameplay domain no longer requires navigating a long mixed constant list. This reduces merge conflicts and clarifies which values tune docks, factions, command timing, or tutorial behavior.

4. **Split command parsing from command execution.**
   - Keep `modules/game-command-runtime.js` responsible for command effects, but extract token parsing, aliases, and command intent normalization into `modules/game-command-parser.js`.
   - Effect: command parsing can be unit tested with plain strings without building the whole game runtime. It also makes it safer to add shorthand commands because parsing changes are isolated from gameplay side effects.

5. **Introduce pure selectors for derived game data.**
   - Add `modules/game-selectors.js` for read-only helpers such as active contracts, selected ship, visible contacts, ship display labels, and route summaries.
   - Effect: UI rendering, command handlers, and NPC systems can share the same derived-data logic instead of recomputing it in slightly different ways. This reduces bugs where different screens disagree about the same game state.

6. **Add a lightweight event bus for cross-system notifications.**
   - Create a small pub/sub helper, then route messages such as contract completion, ship arrival, dock hazard, faction heat change, and NPC conflict updates through named events.
   - Effect: systems become less tightly coupled because they can respond to events rather than directly calling each other. This makes future features, logs, telemetry, or tutorials easier to attach without editing core gameplay functions.

7. **Normalize data loading and validation.**
   - Centralize JSON fetches in a data loader module and add validation helpers that check required fields for maps, contracts, ships, dialogue, almanac entries, and conflict outcomes.
   - Effect: malformed content fails early with clear console messages instead of causing delayed runtime errors during gameplay. Designers can edit JSON content with faster feedback.

8. **Cache route and graph calculations.**
   - Add memoization around route distance, safe route distance, and common candidate-destination lookups, invalidating caches only when the active map graph changes.
   - Effect: repeated command previews, fleet reports, and NPC decisions avoid recalculating the same graph paths. This should improve responsiveness as scenarios and ship counts grow.

9. **Separate simulation ticks by subsystem.**
   - Replace broad timer callbacks with subsystem tick functions such as `tickShips`, `tickContracts`, `tickDocks`, `tickFactionHeat`, and `tickNpcTraffic`.
   - Effect: each gameplay loop becomes independently understandable and measurable. A performance issue in NPC traffic or dock maintenance can be investigated without stepping through unrelated timer logic.

10. **Move UI rendering into view modules.**
    - Extract console output formatting, map rendering, fleet lists, contract boards, hail controls, and status panels into `modules/views/` files.
    - Effect: gameplay logic can return structured results while view modules decide how to present them. This prepares the project for future UI changes without rewriting simulation rules.

11. **Add deterministic random utilities.**
    - Replace direct `Math.random()` calls in gameplay systems with an injected random provider, defaulting to `Math.random()` in production.
    - Effect: tests can use seeded random values to reproduce contracts, NPC chatter, hazard rolls, and faction events. Bugs that depend on random rolls become much easier to reproduce.

12. **Create focused smoke and unit tests.**
    - Add tests for command parsing, contract generation constraints, route distance calculations, dock hazard thresholds, faction heat transitions, and NPC spawn limits.
    - Effect: future refactors can move code between modules with confidence. The test suite becomes a safety net that confirms each self-contained extraction preserved existing behavior.

13. **Add performance instrumentation behind a debug flag.**
    - Track timing for map building, route lookups, command handling, NPC ticks, and render updates when debug mode is enabled.
    - Effect: optimization decisions can be based on measured bottlenecks rather than guesswork. The instrumentation can remain disabled for players and enabled only during development.

14. **Document module ownership and extension points.**
    - Update the README or add an architecture note that explains which module owns maps, contracts, navigation, NPCs, commands, UI views, state, and data loading.
    - Effect: contributors can quickly decide where new logic belongs. This reduces the chance that `game.js` grows back into a monolith after the refactor.

15. **Perform a final cleanup pass.**
    - Remove temporary planning notes, migration checklists, debug-only scaffolding, and obsolete comments that were useful during the refactor but are not essential long-term documentation. Preserve concise architecture notes, module ownership guidance, and any user-facing setup instructions.
    - Effect: the repository stays approachable after the structural work is complete. Contributors keep the durable documentation they need without carrying stale implementation notes that could conflict with the final code.
