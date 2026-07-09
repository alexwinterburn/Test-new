# Foresight — Prediction Markets Prototype

A working prototype of a full prediction-markets platform: a client-facing exchange
**and** an operator “Control Tower” admin panel, built to explore a product that can
compete with Polymarket and Kalshi without copying either.

Everything runs in the browser against a simulated exchange with seeded dummy data
(persisted to `localStorage`). **Admin → Feature flags → Reset demo data** erases it
and restores the seed — the intended clean slate for building the real product.

## Run it

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # type-check + production build
```

## What's inside

### Client (`/`)
- **Market discovery** — featured/trending, category chips, search, market cards with
  sparklines and live Yes/No prices.
- **Market page** — probability chart (1D/1W/1M/All, crosshair + tooltip), buy/sell
  YES/NO with a real CPMM (constant-product AMM: live avg price, slippage/price impact,
  fees, payout preview), limit orders that rest and fill when the price crosses,
  positions with live P&L, resolution rules, oracle transparency.
- **Multi-outcome markets** (elections, league winners) — each outcome its own book.
- **Portfolio** — positions, exposure-by-category, open orders, history.
- **Wallet** — instant demo deposits; withdrawals gated by KYC tier with an
  auto-approve threshold and an admin review queue above it.
- **Frictionless onboarding** — email-only signup with a welcome credit.
  **Progressive KYC**: Tier 0 (email) can trade up to a cap; Tier 1 (ID) raises limits
  and unlocks withdrawals; Tier 2 (enhanced) removes caps. Users are prompted to verify
  exactly when they hit a limit — never before.
- **Responsible trading** — self-imposed daily loss caps and one-way 7-day cool-off.

### Control Tower (`/admin`)
- **Dashboard** — volume/trades/signups KPIs, 30-day volume chart, custodial balances,
  settlement exposure, and a "needs attention" triage feed.
- **Market lifecycle** — create wizard (binary / multi-outcome / scalar-behind-flag,
  initial probability, seed liquidity, per-market fee, oracle choice), draft → publish,
  halt/resume with public reason, close, and a two-step resolution flow:
  **propose → dispute window → finalize & settle** (winning shares pay $1, positions
  settle to balances, everything audited).
- **Users** — search, KYC badges, risk flags, balance adjustments (reason required,
  audited), suspend/reinstate.
- **KYC queue** — approve/reject with geo-block enforcement and risk-flag surfacing.
- **Finance** — withdrawal approval queue, platform fee (bps) and auto-approve
  threshold configuration, fee income estimate.
- **Risk controls** — circuit breaker (auto-halts a market on an outsized single-trade
  move), per-tier position caps, per-tier withdrawal caps, geo-blocking.
- **Feature flags** — community markets, AI resolution assist, limit orders,
  leaderboards, scalar markets, neg-risk bundles. Ship dark, roll out gradually.
- **Audit log** — every operator action, filterable.

### Deliberately not a clone
- **Progressive KYC as product design** — Kalshi fronts KYC, Polymarket sidesteps it;
  here compliance friction is deferred to the exact moment it's needed, and the caps
  that drive it are operator-tunable risk controls.
- **AI-assisted resolution with human countersign** — agent drafts a cited resolution
  memo from the market's declared source; a human finalizes; memos are auditable.
  Faster than pure committees, more trustworthy than pure automation.
- **Community market pipeline** — user proposals → admin triage → wizard, with a
  creator badge (and room for creator fee share).
- **Operator-grade safety rails as first-class UI** — circuit breakers, dispute
  windows, immutable audit, responsible-trading self-limits.

## Architecture (prototype)

```
src/
  lib/
    types.ts     — domain model (markets, outcomes, positions, orders, KYC, audit…)
    engine.ts    — CPMM pricing: quotes, buys, sells, pool seeding
    seed.ts      — deterministic dummy data (erase via admin Danger zone)
    store.tsx    — React context "backend": all actions, localStorage persistence
  client/        — exchange UI
  admin/         — control tower UI
  components/    — charts (SVG, crosshair tooltips), modals, badges, toasts
```

React 18 + TypeScript + Vite + React Router. No UI framework — hand-rolled design
system with light/dark themes on a colorblind-validated palette. The store is a
drop-in seam: replacing `store.tsx` calls with real API calls is the migration path
to a production backend (matching engine, custody, IDV provider, oracle service).

> Prototype only: no real money, no real identity checks, simplified AMM-only
> matching. All figures are simulated.
