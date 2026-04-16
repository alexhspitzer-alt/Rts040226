# refactor-game.js-into-smaller-files-mzpg10

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

## Input options

You can use either **short interactive input** (recommended) or **long-form commands**.

### Interactive flow (low typing)

1. `ships`
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
- `ships`
- `select <ship_id>`
- `contracts`
- `assign <contract_id> <ship_id>`
- `send <ship_id> <node>`
- `escort on` / `escort off`
- `pause`

## GitHub Pages deployment

This repo includes a Pages workflow at `.github/workflows/pages.yml` that deploys on pushes to `main` or `work`.
