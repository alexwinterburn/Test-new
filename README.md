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
- **Combo slip** — build a basket of positions across markets and place it in one
  click, with total stake, payout-if-all-win and market-implied combo odds. Legs
  settle independently (a basket, not an all-or-nothing parlay).
- **Watchlists & price alerts** — star markets, filter the home feed to them, and
  get notified when a probability crosses a threshold (alerts bell in the nav).
- **Leaderboard with calibration** — traders ranked by 30-day P&L *and* a
  Brier-based calibration score, streaks and win rates. Calibration is the
  credibility metric competitors don't surface.
- **Market intelligence panel** — per-market activity feed, top holders (with
  their calibration scores, so you can see if smart money agrees with you), and a
  simulated AI brief: momentum, source watch, base rates, and order-flow signals.
- **Crypto-only funding** — per-asset deposit addresses (USDC/USDT/BTC/ETH/SOL
  across Base, Ethereum, Tron, Bitcoin, Solana) with simulated on-chain
  confirmations before crediting; withdrawals to an address, still KYC-gated.
- **Referral program** — every account has an invite code; the referrer is paid
  automatically on the referee's first qualifying confirmed deposit. Stats on the
  wallet page; program overview in admin Analytics.
- **Earn (LP program)** — anyone can provide liquidity to any book and earn a
  configurable share of that market's trading fees pro-rata (plus a maker rebate
  on resting limit-order fills). Principal + accrued fees are returned
  automatically at resolution. This page is the market-maker recruiting pitch.
- **Copy-trading** — follow leaderboard traders and mirror their open portfolio
  pro-rata with a chosen budget.
- **Scalar markets** — numeric-range markets (e.g. CPI YoY) that settle
  proportionally: longs get the settled fraction of $1, shorts the remainder.
- **Neg-risk “Hedge the field”** — one click adds NO on every other outcome of a
  multi-outcome market to your combo slip.
- **Embeddable widget** — `/embed/:id` is a chrome-less live-odds card for
  articles and newsletters, with copy-paste iframe code on every market page.
- **Gamification** — XP with levels (nav chip + progress bar), 10 achievements,
  daily login streaks, and daily quests on the home page. Feature-flagged.
- **Notifications inbox** — a bell with two tabs: an inbox fed by the autonomous
  engine and platform events, and self-serve price alerts (above/below a price,
  or any N-point move in 24h) per market.
- **Continuous copy-trading** — beyond one-time mirroring, start an auto-mirror
  on any leader: every future buy they make is copied instantly, capped per
  trade and guarded by your own KYC tier cap.

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
- **Liquidity desk** — pool depth and cost-to-move per market, thin-book flags,
  one-click house liquidity injections that deepen books without moving price,
  an external-LP roster with fees paid out, and the two market-maker levers
  (LP fee share %, maker rebate bps) editable in place.
- **API & widgets** — issue/revoke read-API keys with scopes and per-key rate
  limits, usage counters, and the public endpoint catalogue.
- **Compliance center** — AML alert queue (trade velocity, deposit structuring,
  sanctions screening, chargebacks) with acknowledge/dismiss workflow, active
  cool-off monitoring, and a one-click CSV export for regulators.
- **Analytics** — signups and trades per day, volume mix by category, and top
  traders with calibration, feeding market-making and marketing decisions.
- **Announcements** — compose a site-wide banner (info/warning/critical) with
  live preview; it appears instantly at the top of the exchange.
- **Feature flags** — community markets, AI resolution assist, limit orders,
  leaderboards, scalar markets, neg-risk bundles. Ship dark, roll out gradually.
- **Comms & notifications** — the autonomous engine's rules (KYC reminders,
  trade-inactivity nudges, watchlist movers, closing-soon warnings) with
  operator-tunable thresholds, manual blasts to everyone or one user, and a
  delivery log. Runs every 45s; dedupes per user per day.
- **Analytics report builder** — compose views from volume/trades/signups/fees
  over 7/14/30 days, export CSV, and save personalised named reports.
- **Data studio** — collection browser with row counts, one-click JSON backup
  export, validated restore/import, history compaction, and demo reset.
- **Webhooks** — register/pause/delete signed event webhooks (market lifecycle,
  trades, KYC, withdrawals) alongside API keys.
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
