# bluFreight Indigo Ops Prototype

Tutorial mode now focuses on learning dispatch gameplay without time pressure.

## Tutorial rules

- Contracts have **no deadlines**.
- The level has **no time limit**.
- Tutorial completes after **3 completed contracts**.
- Longer ship communications are sent during transit and on arrival.

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

## Suggested tutorial flow

1. `contracts`
2. `assign c-1 hauler-1`
3. `assign c-2 courier-1`
4. `status`
5. Repeat until 3 contracts complete.

## GitHub Pages deployment

This repo includes a Pages workflow at `.github/workflows/pages.yml` that deploys on pushes to `main` or `work`.

If the site is not updating:

1. Push your latest commits to GitHub.
2. In GitHub: **Settings → Pages** and set **Source = GitHub Actions**.
3. In GitHub: **Actions** tab, confirm the latest "Deploy static site to GitHub Pages" run is green.
4. Open the site URL and hard refresh (mobile browsers often cache aggressively).
