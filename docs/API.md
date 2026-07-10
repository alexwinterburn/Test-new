# Foresight Developer API

Read-only market data for newsrooms, quants, market makers and researchers.
The in-app portal at **`/#/developers`** mirrors this document with live examples.

## Authentication

Every request carries a bearer key issued by the Foresight team (sandbox keys
are instant from the portal; production keys after review):

```
Authorization: Bearer fsk_live_xxxxxxxxxxxx
```

Rate limits are per key (default **120 req/min**; market-maker tier up to
**600 req/min**). Limits and scopes are managed in Control Tower → API & widgets.

## REST endpoints

| Method | Path | Scope | Description |
|---|---|---|---|
| GET | `/v1/markets` | `read:markets` | List markets: id, question, type, status, prices, volume, closesAt |
| GET | `/v1/markets/:id` | `read:markets` | Full detail: outcomes, rules, oracle, fee, scalar range |
| GET | `/v1/markets/:id/book` | `read:prices` | **Order-book snapshot**: AMM depth + resting limit orders |
| GET | `/v1/markets/:id/history?from=&to=` | `read:prices` | Probability time series (1-min resolution) |
| GET | `/v1/markets/:id/trades?limit=` | `read:trades` | Recent public trades |
| GET | `/v1/leaderboard` | `read:markets` | Calibration-ranked forecasters |
| GET | `/embed/:id` | — | Key-less embeddable live-odds widget |

### Order-book snapshot shape

```json
{
  "marketId": "m-0",
  "price": 0.63,
  "amm": { "yesPool": 21742.1, "noPool": 7770.0, "depthUsd": 224310 },
  "restingOrders": [
    { "side": "yes", "direction": "buy", "limit": 0.35, "size": 300 }
  ],
  "seq": 184220,
  "asOf": "2026-07-10T14:02:11Z"
}
```

## Realtime stream — mirroring the book

Connect once, subscribe to channels:

```js
const ws = new WebSocket('wss://api.foresight.demo/v1/stream?key=fsk_live_…')
ws.onopen = () => ws.send(JSON.stringify({
  op: 'subscribe',
  channels: ['book:m-0', 'trades:m-0', 'markets'],
}))
```

| Channel | Payload |
|---|---|
| `book:{id}` | Sequenced depth deltas (`seq` strictly increasing). Apply in order; on a gap, refetch `/v1/markets/:id/book` and resume. |
| `trades:{id}` | Every fill: side, direction, shares, price, timestamp |
| `markets` | Lifecycle events: created / halted / resolved (with settlement) |

**Mirror recipe:** take one REST snapshot (note `seq`), subscribe to `book:{id}`,
buffer deltas until the snapshot `seq`, then apply forward. Idempotent and
restart-safe.

## Webhooks

Signed POSTs (HMAC-SHA256 in `X-Foresight-Signature`, 5 retries with backoff)
for: `market.created`, `market.halted`, `market.resolved`, `trade.executed`,
`kyc.approved`, `withdrawal.completed`. Registered per integration in
Control Tower → API & widgets.

## Status

In this prototype the endpoints are documented-but-simulated; the shapes match
the internal store exactly, so the production gateway is a thin layer over the
same domain model.
