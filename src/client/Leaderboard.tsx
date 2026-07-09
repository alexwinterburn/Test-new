import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { price } from '../lib/engine'
import { fmtPct, fmtUsd } from '../lib/format'
import { Avatar, Empty, Modal, Tabs } from '../components/ui'
import type { User } from '../lib/types'

type SortKey = 'profit' | 'calibration'

export const Leaderboard = () => {
  const { state, currentUser, toggleFollow } = useStore()
  const [sort, setSort] = useState<SortKey>('profit')
  const [copying, setCopying] = useState<User | null>(null)

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
              <tr><th style={{ width: 40 }}>#</th><th>Trader</th><th className="num">P&L (30d)</th><th className="num">Calibration</th><th className="num">Win rate</th><th className="num">Resolved</th><th className="num">Streak</th>{state.settings.featureFlags.copyTrading && <th style={{ width: 150 }} />}</tr>
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
                  {state.settings.featureFlags.copyTrading && (
                    <td>
                      {u.id !== currentUser?.id && (
                        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-sm"
                            style={currentUser?.follows.includes(u.id) ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                            onClick={() => toggleFollow(u.id)}
                          >
                            {currentUser?.follows.includes(u.id) ? '✓ Following' : 'Follow'}
                          </button>
                          <button className="btn btn-sm btn-primary" onClick={() => setCopying(u)}>Copy</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        Calibration scores make Foresight a credibility engine, not just a casino: analysts and journalists can cite “top-decile calibrated forecasters,” which neither raw P&L nor follower counts can offer.
      </p>
      {copying && <CopyModal leader={copying} onClose={() => setCopying(null)} />}
    </main>
  )
}

const CopyModal = ({ leader, onClose }: { leader: User; onClose: () => void }) => {
  const { state, copyPortfolio, currentUser } = useStore()
  const [budget, setBudget] = useState('100')
  const [error, setError] = useState('')
  const legs = state.positions.filter(p => p.userId === leader.id)
    .map(p => ({ ...p, market: state.markets.find(m => m.id === p.marketId)! }))
    .filter(p => p.market.status === 'active')

  return (
    <Modal title={`Copy @${leader.handle}'s portfolio`} onClose={onClose}>
      <p className="hint">
        Mirrors their current open positions pro-rata with your budget, at today's prices. One-time copy — production adds
        continuous auto-mirroring with per-follower risk caps and a fee share for the leader.
      </p>
      <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
        {legs.length ? legs.map(p => {
          const o = p.market.outcomes.find(x => x.id === p.outcomeId)!
          return (
            <div key={p.id} className="row" style={{ fontSize: 13, justifyContent: 'space-between', padding: '3px 0' }}>
              <span>{p.market.icon} {p.market.question.slice(0, 42)}…</span>
              <strong style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)' }}>{p.side.toUpperCase()}{p.market.type === 'multi' ? ` · ${o.label.slice(0, 16)}` : ''}</strong>
            </div>
          )
        }) : <div className="hint">No open positions in active markets right now.</div>}
      </div>
      <div className="field">
        <label>Budget to allocate ($)</label>
        <input className="input" type="number" min={1} value={budget} onChange={e => setBudget(e.target.value)} />
        {currentUser && <span className="hint">Balance: {fmtUsd(currentUser.balance)}</span>}
      </div>
      {error && <div style={{ color: 'var(--critical)', fontSize: 13 }}>{error}</div>}
      <button
        className="btn btn-primary btn-lg"
        disabled={!legs.length}
        onClick={() => {
          const res = copyPortfolio(leader.id, parseFloat(budget) || 0)
          if (res.ok) onClose()
          else setError(res.error ?? 'Copy failed')
        }}
      >
        Mirror {legs.length} position{legs.length === 1 ? '' : 's'} now
      </button>
    </Modal>
  )
}
