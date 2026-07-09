import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useStore } from '../lib/store'
import { poolValue, price } from '../lib/engine'
import { fmtPct1, fmtUsd, fmtUsdCompact } from '../lib/format'
import { Empty } from '../components/ui'

export const Earn = () => {
  const { state, currentUser, addLiquidity, withdrawLiquidity } = useStore()
  const { openAuth } = useOutletContext<{ openAuth: () => void }>()
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const flags = state.settings.featureFlags

  if (!flags.lpProgram) {
    return <main className="page-inner"><Empty icon="💧" text="The LP program is currently disabled" sub="An operator can re-enable it in Admin → Feature flags." /></main>
  }

  const feeRate = state.settings.tradingFeeBps / 10000
  const lpShare = state.settings.lpFeeShareBps / 10000
  const markets = state.markets.filter(m => m.status === 'active')
  const myLps = currentUser ? state.lps.filter(l => l.userId === currentUser.id) : []
  const myPrincipal = myLps.reduce((a, l) => a + l.amount, 0)
  const myFees = myLps.reduce((a, l) => a + l.feesEarned, 0)

  // crude but honest APR estimate: 30d volume share × fee × LP share, annualised on pool depth
  const estApr = (m: (typeof markets)[number]) => {
    const depth = m.outcomes.reduce((a, o) => a + poolValue(o), 0)
    const vol30 = m.volume * 0.25 // assume a quarter of lifetime volume in the last 30d
    return depth > 0 ? ((vol30 * feeRate * lpShare) / depth) * 12 : 0
  }

  return (
    <main className="page-inner">
      <div className="hero" style={{ marginBottom: 20 }}>
        <div>
          <h1>Earn by making markets.</h1>
          <p>
            Provide liquidity to any market and earn <strong>{Math.round(lpShare * 100)}% of its trading fees</strong>, pro-rata,
            plus a <strong>{state.settings.makerRebateBps}bps maker rebate</strong> on every resting limit order that fills.
            Principal and accrued fees are returned automatically at resolution.
          </p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><div className="v mono">{Math.round(lpShare * 100)}%</div><div className="l">Fee share to LPs</div></div>
          <div className="hero-stat"><div className="v mono">{state.settings.makerRebateBps}bps</div><div className="l">Maker rebate</div></div>
          <div className="hero-stat"><div className="v mono">{fmtUsdCompact(state.lps.reduce((a, l) => a + l.amount, 0))}</div><div className="l">LP capital live</div></div>
        </div>
      </div>

      {currentUser && myLps.length > 0 && (
        <>
          <div className="section-head"><h2>Your liquidity</h2></div>
          <div className="kpi-row" style={{ marginBottom: 12 }}>
            <div className="card kpi"><div className="l">Principal deployed</div><div className="v mono">{fmtUsd(myPrincipal, 0)}</div></div>
            <div className="card kpi"><div className="l">Fees accrued</div><div className="v mono up">{fmtUsd(myFees)}</div></div>
            <div className="card kpi"><div className="l">Books you're making</div><div className="v mono">{myLps.length}</div></div>
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Market</th><th className="num">Principal</th><th className="num">Fees earned</th><th /></tr></thead>
                <tbody>
                  {myLps.map(l => {
                    const m = state.markets.find(x => x.id === l.marketId)!
                    return (
                      <tr key={l.id}>
                        <td><Link to={`/market/${m.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>{m.icon} {m.question.slice(0, 55)}…</Link></td>
                        <td className="num">{fmtUsd(l.amount, 0)}</td>
                        <td className="num up">{fmtUsd(l.feesEarned)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-sm" onClick={() => withdrawLiquidity(l.id)}>Withdraw + fees</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="section-head"><h2>Live books</h2><span className="sub">Thin books pay the best — that's where your capital matters most.</span></div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Market</th><th className="num">Price</th><th className="num">Pool depth</th><th className="num">Est. fee APR</th><th style={{ width: 230 }}>Provide liquidity</th></tr></thead>
            <tbody>
              {markets.map(m => {
                const depth = m.outcomes.reduce((a, o) => a + poolValue(o), 0)
                const apr = estApr(m)
                return (
                  <tr key={m.id}>
                    <td>
                      <Link to={`/market/${m.id}`} style={{ fontWeight: 600 }}>{m.icon} {m.question.slice(0, 50)}{m.question.length > 50 ? '…' : ''}</Link>
                      {depth < 25000 && <span className="badge badge-serious" style={{ marginLeft: 8 }}><span className="dot" />Thin — boosted share</span>}
                    </td>
                    <td className="num">{m.type === 'multi' ? '—' : Math.round(price(m.outcomes[0]) * 100) + '¢'}</td>
                    <td className="num">{fmtUsdCompact(depth)}</td>
                    <td className="num" style={{ color: apr > 0.08 ? 'var(--delta-up)' : undefined, fontWeight: 700 }}>{fmtPct1(apr)}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <input
                          className="input" type="number" min={100} placeholder="$"
                          style={{ width: 100, padding: '5px 8px' }}
                          value={amounts[m.id] ?? ''}
                          onChange={e => setAmounts(a => ({ ...a, [m.id]: e.target.value }))}
                        />
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={!(parseFloat(amounts[m.id]) > 0)}
                          onClick={() => {
                            if (!currentUser) { openAuth(); return }
                            const res = addLiquidity(m.id, parseFloat(amounts[m.id]))
                            if (res.ok) setAmounts(a => ({ ...a, [m.id]: '' }))
                          }}
                        >
                          Provide
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 20 }}>
        <div className="card card-pad">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>💸 Real yield, not emissions</div>
          <p className="hint">LP returns come from actual trading fees — no token printing. What you see accrue is what you withdraw.</p>
        </div>
        <div className="card card-pad">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🛡️ Bounded risk</div>
          <p className="hint">Pools rebalance passively; at resolution your principal plus accrued fees are returned automatically. (Prototype simplifies impermanent loss; production uses an LP-share vault model.)</p>
        </div>
        <div className="card card-pad">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🤝 Pro programme</div>
          <p className="hint">Firms quoting two-sided size get negotiated rebate tiers, a dedicated API key with high rate limits, and direct access to the liquidity desk.</p>
        </div>
      </div>
    </main>
  )
}
