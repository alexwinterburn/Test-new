import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useStore } from '../lib/store'
import { price } from '../lib/engine'
import { fmtCents, fmtDateTime, fmtUsd } from '../lib/format'
import { Empty, Tabs } from '../components/ui'
import { ACHIEVEMENTS, levelProgress } from '../lib/gamification'

export const Portfolio = () => {
  const { state, currentUser, cancelOrder } = useStore()
  const { openAuth } = useOutletContext<{ openAuth: () => void }>()
  const [tab, setTab] = useState<'positions' | 'orders' | 'history'>('positions')

  const data = useMemo(() => {
    if (!currentUser) return null
    const positions = state.positions
      .filter(p => p.userId === currentUser.id)
      .map(p => {
        const m = state.markets.find(x => x.id === p.marketId)!
        const o = m.outcomes.find(x => x.id === p.outcomeId)!
        const cur = price(o, p.side)
        return { ...p, market: m, outcome: o, cur, value: p.shares * cur, cost: p.shares * p.avgPrice }
      })
    const orders = state.orders.filter(o => o.userId === currentUser.id && (o.status === 'open' || o.status === 'partial'))
    const txs = state.txs.filter(t => t.userId === currentUser.id && (t.type === 'trade' || t.type === 'settlement'))
    return { positions, orders, txs }
  }, [state, currentUser])

  if (!currentUser || !data) {
    return (
      <main className="page-inner">
        <Empty icon="📊" text="Sign in to see your portfolio" />
        <div style={{ textAlign: 'center' }}><button className="btn btn-primary" onClick={openAuth}>Sign up / sign in</button></div>
      </main>
    )
  }

  const totalValue = data.positions.reduce((a, p) => a + p.value, 0)
  const totalCost = data.positions.reduce((a, p) => a + p.cost, 0)
  const unrealized = totalValue - totalCost
  const byCategory = data.positions.reduce<Record<string, number>>((acc, p) => {
    acc[p.market.category] = (acc[p.market.category] ?? 0) + p.value
    return acc
  }, {})

  return (
    <main className="page-inner">
      <div className="section-head" style={{ marginTop: 0 }}><h2 style={{ fontSize: 21 }}>Portfolio</h2></div>
      <div className="kpi-row" style={{ marginBottom: 18 }}>
        <div className="card kpi"><div className="l">Cash balance</div><div className="v mono">{fmtUsd(currentUser.balance)}</div></div>
        <div className="card kpi"><div className="l">Positions value</div><div className="v mono">{fmtUsd(totalValue)}</div></div>
        <div className="card kpi">
          <div className="l">Unrealized P&L</div>
          <div className={'v mono ' + (unrealized >= 0 ? 'up' : 'down')}>{fmtUsd(unrealized)}</div>
          <div className="d muted">{totalCost > 0 ? ((unrealized / totalCost) * 100).toFixed(1) + '% on cost' : '—'}</div>
        </div>
        <div className="card kpi"><div className="l">Open orders</div><div className="v mono">{data.orders.length}</div></div>
      </div>

      {state.settings.featureFlags.gamification && (
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>🏅 Forecaster progress</div>
            <span className="hint mono">Level {levelProgress(currentUser.xp).level} · {currentUser.xp.toLocaleString()} XP · 🔥 {currentUser.loginStreak}-day streak</span>
          </div>
          <div className="progress" style={{ marginBottom: 12 }}>
            <i style={{ width: `${Math.min(100, (levelProgress(currentUser.xp).into / levelProgress(currentUser.xp).needed) * 100)}%` }} />
          </div>
          <div className="row-wrap" style={{ gap: 8 }}>
            {ACHIEVEMENTS.map(a => {
              const earned = currentUser.achievements.includes(a.id)
              return (
                <span
                  key={a.id}
                  className="badge"
                  title={`${a.desc} (+${a.xp} XP)`}
                  style={{ padding: '6px 12px', textTransform: 'none', fontSize: 12, opacity: earned ? 1 : 0.45, ...(earned ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
                >
                  {a.icon} {a.name}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {Object.keys(byCategory).length > 1 && (
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Exposure by category</div>
          {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
            <div key={cat} className="row" style={{ marginBottom: 6 }}>
              <span style={{ width: 110, fontSize: 13 }}>{cat}</span>
              <div className="progress" style={{ flex: 1 }}><i style={{ width: `${(v / totalValue) * 100}%` }} /></div>
              <span className="mono" style={{ width: 80, textAlign: 'right', fontSize: 13 }}>{fmtUsd(v)}</span>
            </div>
          ))}
        </div>
      )}

      <Tabs value={tab} onChange={setTab} options={[
        { value: 'positions', label: `Positions (${data.positions.length})` },
        { value: 'orders', label: `Open orders (${data.orders.length})` },
        { value: 'history', label: 'History' },
      ]} />

      <div className="card" style={{ marginTop: 12 }}>
        {tab === 'positions' && (
          data.positions.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Market</th><th>Side</th><th className="num">Shares</th><th className="num">Avg</th><th className="num">Now</th><th className="num">Value</th><th className="num">P&L</th></tr></thead>
                <tbody>
                  {data.positions.map(p => {
                    const pnl = p.value - p.cost
                    return (
                      <tr key={p.id}>
                        <td><Link to={`/market/${p.market.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>{p.market.icon} {p.market.question.slice(0, 56)}{p.market.question.length > 56 ? '…' : ''}</Link>
                          {p.market.type === 'multi' && <div className="hint">{p.outcome.label}</div>}
                        </td>
                        <td><strong style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)' }}>{p.side.toUpperCase()}</strong></td>
                        <td className="num">{p.shares.toFixed(1)}</td>
                        <td className="num">{fmtCents(p.avgPrice)}</td>
                        <td className="num">{fmtCents(p.cur)}</td>
                        <td className="num">{fmtUsd(p.value)}</td>
                        <td className={'num ' + (pnl >= 0 ? 'up' : 'down')}>{fmtUsd(pnl)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty icon="🌱" text="No open positions" sub="Find a market you have a view on and take a side." />
        )}

        {tab === 'orders' && (
          data.orders.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Market</th><th>Order</th><th className="num">Filled</th><th>Placed</th><th /></tr></thead>
                <tbody>
                  {data.orders.map(o => {
                    const m = state.markets.find(x => x.id === o.marketId)!
                    return (
                      <tr key={o.id}>
                        <td><Link to={`/market/${m.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>{m.question.slice(0, 48)}…</Link></td>
                        <td>Buy {o.shares} <strong style={{ color: o.side === 'yes' ? 'var(--yes)' : 'var(--no)' }}>{o.side.toUpperCase()}</strong> @ {fmtCents(o.limitPrice)}</td>
                        <td className="num">{o.filled.toFixed(0)}/{o.shares}</td>
                        <td className="muted">{fmtDateTime(o.createdAt)}</td>
                        <td><button className="btn btn-sm btn-ghost" style={{ color: 'var(--critical)' }} onClick={() => cancelOrder(o.id)}>Cancel</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty icon="📋" text="No open orders" />
        )}

        {tab === 'history' && (
          data.txs.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>When</th><th>Activity</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {data.txs.map(t => (
                    <tr key={t.id}>
                      <td className="muted">{fmtDateTime(t.createdAt)}</td>
                      <td>{t.note}</td>
                      <td className={'num ' + (t.amount >= 0 ? 'up' : '')}>{fmtUsd(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon="🕰️" text="No trading history yet" />
        )}
      </div>
    </main>
  )
}
