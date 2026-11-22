# Coalfield Trade Expo 2026 - Print King stall branding

- `portal/` - registration form (`index.html`), Google Apps Script backend (`Code.gs`, `appsscript.json`) and `SETUP.md`.
- `a4-pages/` - source of the A4 exhibitor pages (10x10, 20x10, 30x10 ft stalls). They reference images stored in the Claude artifact, so open the artifact to view/print them.
- `assets/` - event logo and payment QR code.
- `PRICING.md` - rate card.

## Deploy
The registration form (`portal/index.html`) is deployed automatically to GitHub Pages on every push to `main`
(see `.github/workflows/deploy.yml`). Only `index.html` is published.
Set `BACKEND_URL` in `portal/index.html` to the Apps Script web app URL, then push.
