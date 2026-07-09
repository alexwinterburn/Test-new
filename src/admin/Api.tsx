import { useState } from 'react'
import { useStore } from '../lib/store'
import { fmtAgo, fmtDate } from '../lib/format'
import { Empty } from '../components/ui'

const ENDPOINTS = [
  { method: 'GET', path: '/v1/markets', desc: 'List markets with prices, volume, status', scope: 'read:markets' },
  { method: 'GET', path: '/v1/markets/:id', desc: 'Full market detail incl. outcomes and rules', scope: 'read:markets' },
  { method: 'GET', path: '/v1/markets/:id/history', desc: 'Price history (probability time series)', scope: 'read:prices' },
  { method: 'GET', path: '/v1/markets/:id/trades', desc: 'Recent public trades', scope: 'read:trades' },
  { method: 'GET', path: '/v1/leaderboard', desc: 'Calibration-ranked forecasters', scope: 'read:markets' },
  { method: 'GET', path: '/embed/:id', desc: 'Embeddable live-odds widget (no key needed)', scope: '—' },
]

const SCOPES = ['read:markets', 'read:prices', 'read:trades']

export const AdminApi = () => {
  const { state, adminCreateApiKey, adminRevokeApiKey } = useStore()
  const [label, setLabel] = useState('')
  const [scopes, setScopes] = useState<string[]>(['read:markets', 'read:prices'])
  const [limit, setLimit] = useState('120')
  const keys = state.apiKeys

  return (
    <>
      <div className="admin-head">
        <h1>API & widgets</h1>
        <span className="hint">Public read API for newsrooms, quants and integrators — distribution is a moat.</span>
      </div>

      <div className="stack">
        <div className="kpi-row">
          <div className="card kpi"><div className="l">Active keys</div><div className="v mono">{keys.filter(k => !k.revoked).length}</div></div>
          <div className="card kpi"><div className="l">Requests (30d)</div><div className="v mono">{keys.reduce((a, k) => a + k.requests30d, 0).toLocaleString()}</div></div>
          <div className="card kpi"><div className="l">Public endpoints</div><div className="v mono">{ENDPOINTS.length}</div></div>
        </div>

        <div className="card">
          <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>API keys</div>
          {keys.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Label</th><th>Key</th><th>Scopes</th><th className="num">Rate limit</th><th className="num">Requests 30d</th><th>Last used</th><th /></tr></thead>
                <tbody>
                  {keys.map(k => (
                    <tr key={k.id} style={k.revoked ? { opacity: 0.5 } : undefined}>
                      <td style={{ fontWeight: 650 }}>{k.label}{k.revoked && <span className="badge badge-critical" style={{ marginLeft: 8 }}><span className="dot" />Revoked</span>}</td>
                      <td><code style={{ fontSize: 12 }}>{k.key}</code></td>
                      <td className="muted" style={{ fontSize: 12 }}>{k.scopes.join(', ')}</td>
                      <td className="num">{k.rateLimitPerMin}/min</td>
                      <td className="num">{k.requests30d.toLocaleString()}</td>
                      <td className="muted">{k.lastUsedAt ? fmtAgo(k.lastUsedAt) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {!k.revoked && <button className="btn btn-sm btn-danger" onClick={() => adminRevokeApiKey(k.id)}>Revoke</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon="🔑" text="No API keys yet" />}
        </div>

        <div className="card card-pad">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Issue a new key</div>
          <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <label>Label (who is this for?)</label>
              <input className="input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. FT election dashboard" />
            </div>
            <div className="field">
              <label>Scopes</label>
              <div className="row" style={{ gap: 10 }}>
                {SCOPES.map(sc => (
                  <label key={sc} className="row" style={{ gap: 5, fontSize: 12.5, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={scopes.includes(sc)}
                      onChange={e => setScopes(s => (e.target.checked ? [...s, sc] : s.filter(x => x !== sc)))}
                    />
                    {sc}
                  </label>
                ))}
              </div>
            </div>
            <div className="field" style={{ width: 140 }}>
              <label>Rate limit (/min)</label>
              <input className="input" type="number" value={limit} onChange={e => setLimit(e.target.value)} />
            </div>
            <button
              className="btn btn-primary"
              disabled={label.trim().length < 3 || !scopes.length}
              onClick={() => { adminCreateApiKey(label.trim(), scopes, parseFloat(limit) || 60); setLabel('') }}
            >
              Issue key
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>Public endpoints (read-only)</div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Scope</th></tr></thead>
              <tbody>
                {ENDPOINTS.map(e => (
                  <tr key={e.path}>
                    <td><span className="badge badge-good"><span className="dot" />{e.method}</span></td>
                    <td><code style={{ fontSize: 12 }}>{e.path}</code></td>
                    <td className="muted">{e.desc}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{e.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="hint">
          Simulated in this prototype (usage counters are demo data). In production this is a gateway with per-key quotas,
          burst limits and signed webhooks for market lifecycle events. Issued keys appear here since {fmtDate(Math.min(...keys.map(k => k.createdAt)))}.
        </p>
      </div>
    </>
  )
}
