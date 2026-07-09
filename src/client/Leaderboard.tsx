import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { price } from '../lib/engine'
import { fmtPct, fmtUsd } from '../lib/format'
import { Avatar, Empty, Tabs } from '../components/ui'

type SortKey = 'profit' | 'calibration'

export const Leaderboard = () => {
  const { state, currentUser } = useStore()
  const [sort, setSort] = useState<SortKey>('profit')

  const rows = useMemo(() => {
    const traders = state.users.filter(u => !u.isAdmin && !u.suspended)
    const enriched = traders.map(u => {
      const unrealized = state.positions
        .filter(p => p.userId === u.id)
        .reduce((a, p) => {
          const m = state.markets.find(x => x.id === p.marketId)
          const o = m?.outcomes.find(x => x.id === p.outcomeId)
          return o ? a + p.shares * (price(o, p.side) - p.avgPrice) : a
        }, 0)
      return { ...u, totalPnl: u.stats.profit30d + unrealized }
    })
    return enriched.sort((a, b) => (sort === 'profit' ? b.totalPnl - a.totalPnl : b.stats.calibration - a.stats.calibration))
  }, [state, sort])

  if (!state.settings.featureFlags.leaderboard) {
    return <main className="page-inner"><Empty icon="🏆" text="Leaderboards are currently disabled" sub="An operator can re-enable them in Admin → Feature flags." /></main>
  }

  const podium = rows.slice(0, 3)
  const medals = ['🥇', '🥈', '🥉']

  return (
    <main className="page-inner">
      <div className="section-head" style={{ marginTop: 0 }}>
        <h2 style={{ fontSize: 21 }}>Leaderboard</h2>
        <span className="sub">30-day window. Calibration is a Brier-based score — it rewards being right for the right price, not just volume.</span>
      </div>

      <div className="grid-3" style={{ marginBottom: 18 }}>
        {podium.map((u, i) => (
          <div key={u.id} className="card kpi" style={{ display: 'flex', gap: 12, alignItems: 'center', borderColor: i === 0 ? 'var(--accent)' : undefined }}>
            <span style={{ fontSize: 28 }} aria-hidden="true">{medals[i]}</span>
            <Avatar user={u} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>{u.name}</div>
              <div className="hint">@{u.handle} · {u.stats.resolvedCount} resolved</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={'v mono ' + (u.totalPnl >= 0 ? 'up' : 'down')} style={{ fontSize: 18, fontWeight: 800 }}>{fmtUsd(u.totalPnl, 0)}</div>
              <div className="hint">calib {fmtPct(u.stats.calibration)}</div>
            </div>
          </div>
        ))}
      </div>

      <Tabs value={sort} onChange={setSort} options={[
        { value: 'profit', label: 'By profit' },
        { value: 'calibration', label: 'By calibration' },
      ]} />

      <div className="card" style={{ marginTop: 12 }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th style={{ width: 40 }}>#</th><th>Trader</th><th className="num">P&L (30d)</th><th className="num">Calibration</th><th className="num">Win rate</th><th className="num">Resolved</th><th className="num">Streak</th></tr>
            </thead>
            <tbody>
              {rows.map((u, i) => (
                <tr key={u.id} style={u.id === currentUser?.id ? { background: 'var(--accent-soft)' } : undefined}>
                  <td className="mono muted">{i + 1}</td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar user={u} />
                      <div>
                        <div style={{ fontWeight: 650 }}>{u.name} {u.id === currentUser?.id && <span className="badge badge-accent">You</span>}</div>
                        <div className="hint">@{u.handle}</div>
                      </div>
                    </div>
                  </td>
                  <td className={'num ' + (u.totalPnl >= 0 ? 'up' : 'down')}>{fmtUsd(u.totalPnl)}</td>
                  <td className="num">
                    <span className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                      <span className="progress" style={{ width: 70 }}><i style={{ width: `${u.stats.calibration * 100}%` }} /></span>
                      {fmtPct(u.stats.calibration)}
                    </span>
                  </td>
                  <td className="num">{fmtPct(u.stats.winRate)}</td>
                  <td className="num">{u.stats.resolvedCount}</td>
                  <td className="num">{u.stats.streak > 0 ? `🔥 ${u.stats.streak}` : u.stats.streak < 0 ? `❄️ ${-u.stats.streak}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        Calibration scores make Foresight a credibility engine, not just a casino: analysts and journalists can cite “top-decile calibrated forecasters,” which neither raw P&L nor follower counts can offer.
      </p>
    </main>
  )
}
