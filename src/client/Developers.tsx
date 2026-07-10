import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'

const REST = [
  { m: 'GET', p: '/v1/markets', d: 'List markets: id, question, type, status, prices, volume, closesAt' },
  { m: 'GET', p: '/v1/markets/:id', d: 'Full market detail: outcomes, rules, oracle, fee, scalar range' },
  { m: 'GET', p: '/v1/markets/:id/book', d: 'Order book snapshot: AMM depth curve + resting limit orders' },
  { m: 'GET', p: '/v1/markets/:id/history?from=&to=', d: 'Probability time series (1-minute resolution)' },
  { m: 'GET', p: '/v1/markets/:id/trades?limit=', d: 'Recent public trades (side, size, price, timestamp)' },
  { m: 'GET', p: '/v1/leaderboard', d: 'Calibration-ranked forecasters' },
]

const WS_SAMPLE = `// Mirror the order book in real time
const ws = new WebSocket('wss://api.foresight.demo/v1/stream?key=fsk_live_…')

ws.onopen = () => ws.send(JSON.stringify({
  op: 'subscribe',
  channels: ['book:m-0', 'trades:m-0', 'markets'],
}))

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  switch (msg.channel) {
    case 'book:m-0':    // depth deltas — apply to your local book mirror
      applyBookDelta(localBook, msg.data) // { yesPool, noPool, restingOrders[] }
      break
    case 'trades:m-0':  // every fill as it happens
      onTrade(msg.data) // { side, direction, shares, price, ts }
      break
    case 'markets':     // lifecycle: created | halted | resolved
      onLifecycle(msg.data)
      break
  }
}`

const CURL_SAMPLE = `curl -s https://api.foresight.demo/v1/markets/m-0/book \\
  -H "Authorization: Bearer fsk_live_YOUR_KEY" | jq

{
  "marketId": "m-0",
  "price": 0.63,
  "amm": { "yesPool": 21742.1, "noPool": 7770.0, "depthUsd": 224310 },
  "restingOrders": [
    { "side": "yes", "direction": "buy", "limit": 0.35, "size": 300 },
    { "side": "no",  "direction": "buy", "limit": 0.30, "size": 750 }
  ],
  "asOf": "2026-07-10T14:02:11Z"
}`

export const Developers = () => {
  const { toast, state } = useStore()
  const [email, setEmail] = useState('')

  return (
    <main className="page-inner">
      <div className="hero">
        <div>
          <h1>Build on Foresight.</h1>
          <p>
            A read API and realtime stream for newsrooms, quants, market makers and researchers: mirror the order book,
            ingest every trade, embed live odds, and get lifecycle webhooks — the same data our own frontend runs on.
          </p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><div className="v mono">{REST.length}+</div><div className="l">REST endpoints</div></div>
          <div className="hero-stat"><div className="v mono">3</div><div className="l">Stream channels</div></div>
          <div className="hero-stat"><div className="v mono">{state.settings.webhooks.filter(w => w.active).length}</div><div className="l">Live webhooks</div></div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card">
            <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>REST API — read-only, keyed</div>
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {REST.map(e => (
                    <tr key={e.p}>
                      <td><span className="badge badge-good"><span className="dot" />{e.m}</span></td>
                      <td><code style={{ fontSize: 12 }}>{e.p}</code><div className="hint">{e.d}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-pad hint" style={{ borderTop: '1px solid var(--grid)' }}>
              Auth: <code>Authorization: Bearer fsk_live_…</code> · rate limits per key (default 120/min, market-maker tier up to 600/min) ·
              JSON everywhere · idempotent and cache-friendly.
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Order-book snapshot</div>
            <pre style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 14, fontSize: 12, overflowX: 'auto', lineHeight: 1.55 }}>{CURL_SAMPLE}</pre>
          </div>

          <div className="card card-pad stack" style={{ gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Webhooks</div>
            <p className="hint">
              Signed POSTs (HMAC-SHA256, <code>X-Foresight-Signature</code>) with automatic retries for:{' '}
              <code>market.created</code>, <code>market.halted</code>, <code>market.resolved</code>, <code>trade.executed</code>,{' '}
              <code>kyc.approved</code>, <code>withdrawal.completed</code>. Registered by the Foresight team per integration.
            </p>
          </div>
        </div>

        <div className="stack">
          <div className="card card-pad">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Realtime stream — mirror the book</div>
            <p className="hint" style={{ marginBottom: 8 }}>
              One WebSocket, channel-based subscriptions. Book deltas arrive in order with sequence numbers; replay gaps via REST.
            </p>
            <pre style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 14, fontSize: 12, overflowX: 'auto', lineHeight: 1.55 }}>{WS_SAMPLE}</pre>
          </div>

          <div className="card card-pad stack" style={{ gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Embed live odds — no key needed</div>
            <p className="hint">
              Every market has a chrome-less widget at <code>/embed/:id</code>. Copy the iframe snippet from any market page,
              or <Link to="/embed/m-0" style={{ color: 'var(--accent)', fontWeight: 600 }}>see a live example →</Link>
            </p>
          </div>

          <div className="card card-pad stack" style={{ gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Get a sandbox key</div>
            <p className="hint">
              Instant sandbox access against simulated data; production keys are issued after a short review
              (market makers: ask about the pro tier + maker rebates on the <Link to="/earn" style={{ color: 'var(--accent)' }}>Earn</Link> page).
            </p>
            <div className="row">
              <input className="input" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              <button
                className="btn btn-primary"
                disabled={!/.+@.+\..+/.test(email)}
                onClick={() => { toast('success', `Sandbox key sent to ${email} (simulated) — fsk_test_…`); setEmail('') }}
              >
                Request key
              </button>
            </div>
          </div>

          <div className="card card-pad hint">
            Prototype note: these endpoints are documented-but-simulated here. In production this page is generated from the
            OpenAPI spec, with a changelog and status page. Keys and webhooks are managed in the operator console.
          </div>
        </div>
      </div>
    </main>
  )
}
