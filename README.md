# first NPC controller

# bluFreight Indigo Ops Prototype

Tutorial mode focuses on learning dispatch gameplay without time pressure.

## Tutorial rules

- Contracts have **no deadlines**.
- The level has **no time limit**.
- Tutorial completes after **3 completed contracts**.
- Ship comms include delayed mid-route and arrival updates.
- Ship queries/orders are now constrained by signal travel time (round-trip delay).
- BASIL gives command-time latency estimates when you issue ship commands.

## Run locally

```bash
python3 -m http.server 8080
```

Open in browser:

- http://localhost:8080

## Architecture and extension points

The current module ownership map lives in [`docs/architecture.md`](docs/architecture.md). Use it when adding new gameplay rules, command flows, UI views, data assets, or instrumentation so `game.js` remains a composition layer rather than growing back into a monolith.

## Input options

### Location terminals

- **Anchor Station dispatch** is always open and is the only place to type orders. BASIL, BUDDE, command menus, deliberate hails, and urgent gameplay alerts stay here alongside Anchor's local chatter. Fleet ships at Anchor are listed below its title.
- Each other occupied location has one **read-only terminal**, shared by every fleet ship there. Its header lists the ships, and its feed receives their reports and locally audible sensor chatter.
- In flight, ships use a channel for their current route. Contract pickup and delivery legs use their respective routes; a docked tug follows its host. Boosted instruments still monitor destination traffic through the observing ship's route channel.
- Click a location header to minimize or expand it. Minimized live feeds keep receiving transmissions and show a new-message count. **Minimize live** quiets the whole bank without affecting dispatch.
- When the last ship leaves a location, its terminal freezes and collapses into the expandable **Signal log**. History remains readable, and returning ships reopen the same terminal. Delayed display callbacks cannot update an unoccupied terminal or leak into a later visit.
- Every terminal has independent scrolling, follow controls, message pacing, and ambient throttling. Sensor muting affects local chatter while captain reports remain audible. **Copy all terminal logs** includes dispatch, live locations, and retained history.

Run `node scripts/run-tests.mjs` to check runtime and terminal behavior. The Pages workflow runs these checks before deployment.

You can use either **short interactive input** (recommended) or **long-form commands**.

### Interactive flow (low typing)

1. `fleet`
2. `1` (select first ship)
3. `A` (assign contract) or `S` (send destination) or `R` (report)
4. If prompted, choose numbered options like `1`, `2`, `3`

### Long-form commands

- `help`
- `status`
- `lore` (brief setting summary sourced from `bluFreight text RTS.txt`)
- `factions`
- `comms` (show known NPC comms contacts from dialogue JSON)
- `hail <name>` (open a channel with a known character)
- `map`
- `fleet`
- `select <ship_id or B-1>`
- `contracts`
- `assign <contract_id> <ship_id or B-1>`
- `send <ship_id or B-1> <node>`
- Flexible chains such as `a B1 c3` or `F 1 a 3`
- `escort on` / `escort off`
- `pause`

## GitHub Pages deployment

This repo includes a Pages workflow at `.github/workflows/pages.yml` that deploys on pushes to `main`, `work`, or the current live development branch, `codex/plan-refactor-and-optimize-game-structure-47kv4k`.

## Quick smoke test after merges

1. Open the deployed page and confirm the footer `last updated` timestamp is recent.
2. Open **Handbook** tab:
   - verify entries for the starting fleet, contracts, and briefing are present,
   - verify the unread counter starts at `0`,
   - verify later-scenario ships and cargo remain hidden until encountered,
   - verify a visible contract destination stays hidden until a ship's arrival there is confirmed.
   - verify a visible cargo type stays hidden until its assigned ship actually loads it.
   - advance a scenario, verify newly discovered entries are marked unread, and open one to decrement the counter.
3. Open **Inbox** and verify each new message keeps its **NEW** marker until that message is opened.
4. Run `fleet`, select a ship, and issue `send`:
   - captain should send two departure messages,
   - first message contains acknowledgement + destination + action,
   - second message contains route callout in future tense (`will ...`).
5. Assign a contract and confirm first departure action line says pickup or delivery as appropriate.

Inactive transit routes and transfer lanes are hidden. Departure acknowledgements are copied to both the departure location and the ship’s current channel, including when the departure terminal has just become inactive. Other inactive-channel traffic remains frozen.
