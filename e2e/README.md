# End-to-end verification suites

Browser tests that exercise the whole platform against a production build,
taking full-page screenshots as they go. Each run starts from a fresh browser
profile, so the app boots from its deterministic seed.

## Run

```bash
npm install
npx playwright-core --version || npm i -D playwright-core
# a Chromium/Chrome binary is needed; either let Playwright fetch one:
#   npm i -D playwright && npx playwright install chromium
# or point CHROMIUM_PATH at an existing install.

npm run build
npx vite preview --port 4173 &        # serve the built app

node e2e/platform.e2e.mjs             # full platform sweep (51 checks)
node e2e/support-search.e2e.mjs       # support desk, help centre, global search (29)
node e2e/security-2fa.e2e.mjs         # 2FA + withdrawal security (15)
node e2e/devportal-social-email.e2e.mjs # dev portal, social auth, email config (13)
```

Environment: `BASE_URL` (default `http://localhost:4173`), `CHROMIUM_PATH`
(optional explicit browser binary). Output: `PASS`/`FAIL` per check on stdout
(non-zero exit on any FAIL) and screenshots in `e2e/shots-*/`.

Note: suites mutate the demo state as they run (that's the point) and
`platform.e2e.mjs` ends by resetting the demo data. Run them one at a time.
