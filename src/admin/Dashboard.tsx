import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { BarChart } from '../components/charts'
import { fmtUsd, fmtUsdCompact, fmtAgo } from '../lib/format'
import { price } from '../lib/engine'

export const Dashboard = () => {
  const { state } = useStore()
  const dv = state.settings.dailyVolume
  const today = dv[dv.length - 1]
  const yesterday = dv[dv.length - 2]
  const volDelta = ((today.volume - yesterday.volume) / yesterday.volume) * 100

  const activeMarkets = state.markets.filter(m => m.status === 'active')
  const kycPending = state.kycRequests.filter(r => r.status === 'pending')
  const wdPending = state.txs.filter(t => t.type === 'withdrawal' && t.status === 'pending')
  const halted = state.markets.filter(m => m.status === 'halted')
  const custodial = state.users.reduce((a, u) => a + u.balance, 0)
  // platform exposure: what we'd pay out if every current favourite resolves YES
  const exposure = state.positions.reduce((a, p) => a + p.shares, 0)

  const needsAttention: { icon: string; text: string; to: string; sev: 'warning' | 'critical' | 'accent' }[] = [
    ...halted.map(m => ({ icon: '⏸️', text: `Halted: ${m.question.slice(0, 60)} — ${m.haltReason ?? ''}`, to: '/admin/markets', sev: 'critical' as const })),
    ...(kycPending.length ? [{ icon: '🪪', text: `${kycPending.length} KYC verification${kycPending.length > 1 ? 's' : ''} awaiting review`, to: '/admin/kyc', sev: 'warning' as const }] : []),
    ...(wdPending.length ? [{ icon: '🏦', text: `${wdPending.length} withdrawal${wdPending.length > 1 ? 's' : ''} (${fmtUsd(wdPending.reduce((a, t) => a + -t.amount, 0), 0)}) pending approval`, to: '/admin/finance', sev: 'warning' as const }] : []),
    ...state.markets.filter(m => m.status === 'resolving').map(m => ({ icon: '⚖️', text: `Dispute window open: ${m.question.slice(0, 55)}`, to: '/admin/markets', sev: 'accent' as const })),
    ...state.markets.filter(m => m.status === 'active' && m.closesAt < Date.now() + 7 * 86400000).map(m => ({ icon: '⏳', text: `Closing soon: ${m.question.slice(0, 55)}`, to: '/admin/markets', sev: 'accent' as const })),
  ]

  return (
    <>
      <div className="admin-head">
        <h1>Dashboard</h1>
        <span className="hint">Live view of the exchange — all figures are simulated demo data.</span>
      </div>

      <div className="stack">
        <div className="kpi-row">
          <div className="card kpi">
            <div className="l">Volume (24h)</div>
            <div className="v mono">{fmtUsdCompact(today.volume)}</div>
            <div className={'d ' + (volDelta >= 0 ? 'up' : 'down')}>{volDelta >= 0 ? '▲' : '▼'} {Math.abs(volDelta).toFixed(1)}% vs yesterday</div>
          </div>
          <div className="card kpi"><div className="l">Trades (24h)</div><div className="v mono">{today.trades.toLocaleString()}</div></div>
          <div className="card kpi"><div className="l">Signups (24h)</div><div className="v mono">{today.signups}</div></div>
          <div className="card kpi"><div className="l">Active markets</div><div className="v mono">{activeMarkets.length}</div></div>
          <div className="card kpi"><div className="l">Custodial balances</div><div className="v mono">{fmtUsdCompact(custodial)}</div></div>
          <div className="card kpi"><div className="l">Max settlement exposure</div><div className="v mono">{fmtUsdCompact(exposure)}</div></div>
        </div>

        <div className="grid-2">
          <div className="card card-pad">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Daily volume — last 30 days</div>
            <BarChart data={dv.map(d => ({ label: d.date.slice(5), value: d.volume }))} />
          </div>
          <div className="card card-pad">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Needs attention</div>
            <div className="stack" style={{ gap: 8 }}>
              {needsAttention.length ? needsAttention.slice(0, 6).map((n, i) => (
                <Link key={i} to={n.to} className="row" style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 13 }}>
                  <span aria-hidden="true">{n.icon}</span>
                  <span style={{ flex: 1 }}>{n.text}</span>
                  <span className={`badge badge-${n.sev}`}><span className="dot" />{n.sev === 'critical' ? 'Act now' : n.sev === 'warning' ? 'Review' : 'Watch'}</span>
                </Link>
              )) : <div className="hint">All clear — nothing pending. ✅</div>}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>Top markets by volume</div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Market</th><th className="num">Price</th><th className="num">Volume</th></tr></thead>
                <tbody>
                  {[...state.markets].sort((a, b) => b.volume - a.volume).slice(0, 6).map(m => (
                    <tr key={m.id}>
                      <td>{m.icon} {m.question.slice(0, 52)}{m.question.length > 52 ? '…' : ''}</td>
                      <td className="num">{Math.round(price(m.outcomes[0]) * 100)}¢</td>
                      <td className="num">{fmtUsdCompact(m.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>Recent operator activity</div>
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {state.audit.slice(0, 6).map(a => (
                    <tr key={a.id}>
                      <td><span className="badge badge-accent" style={{ textTransform: 'none' }}>{a.action}</span></td>
                      <td className="muted">{a.detail.slice(0, 60)}</td>
                      <td className="muted num">{fmtAgo(a.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
