# bluFreight Indigo Ops Prototype

This prototype now follows the Indigo concept more closely: you are an **operations manager** issuing dispatch commands in a delayed-information logistics warzone.

## What changed

- Command-console interaction instead of click-only actions.
- Node-based transit map with distance ticks and communication delay.
- Contracts, late penalties, insurance risk, and escort posture.
- Ships run semi-autonomously once assigned.

## Run locally

```bash
python3 -m http.server 8080
```

Open in browser:

- http://localhost:8080

## Commands

- `help`
- `status`
- `map`
- `ships`
- `contracts`
- `assign <contract_id> <ship_id>`
- `send <ship_id> <node>`
- `escort on` / `escort off`
- `pause`

## Example session

1. `contracts`
2. `assign c-1 hauler-1`
3. `escort on`
4. `status`

## Win / lose

- **Lose** if reputation hits 0 or cash <= -600.
- **Win** by surviving 8 minutes of simulation time.
