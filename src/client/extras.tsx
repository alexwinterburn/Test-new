import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { price, quoteBuy } from '../lib/engine'
import { fmtAgo, fmtCents, fmtPct, fmtPct1, fmtUsd } from '../lib/format'
import { Empty } from '../components/ui'

// ---------------------------------------------------------------------------
// Combo slip — build a multi-market basket and place it in one click.
// ---------------------------------------------------------------------------
export const SlipDrawer = ({ onClose }: { onClose: () => void }) => {
  const { state, marketById, removeFromSlip, setSlipAmount, clearSlip, placeSlip, currentUser } = useStore()
  const legs = state.slip

  const enriched = legs.map(l => {
    const m = marketById(l.marketId)!
    const o = m.outcomes.find(x => x.id === l.outcomeId)!
    const p = price(o, l.side)
    const q = l.amount > 0 ? quoteBuy(o, l.side, l.amount * (1 - state.settings.tradingFeeBps / 10000)) : null
    return { ...l, m, o, p, shares: q?.shares ?? 0 }
  })
  const total = enriched.reduce((a, l) => a + l.amount, 0)
  const payout = enriched.reduce((a, l) => a + l.shares, 0)
  const comboProb = enriched.reduce((a, l) => a * l.p, enriched.length ? 1 : 0)

  return (
    <div className="drawer card" role="dialog" aria-label="Combo slip">
      <div className="row" style={{ padding: '14px 16px', borderBottom: '1px solid var(--grid)', justifyContent: 'space-between' }}>
        <strong>🧾 Combo slip</strong>
        <div className="row" style={{ gap: 6 }}>
          {legs.length > 0 && <button className="btn btn-sm btn-ghost" onClick={clearSlip}>Clear</button>}
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close slip">✕</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {enriched.length ? enriched.map((l, i) => (
          <div key={l.marketId + l.outcomeId} className="card card-pad" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Link to={`/market/${l.m.id}`} style={{ fontWeight: 650, fontSize: 13, flex: 1 }} onClick={onClose}>
                {l.m.icon} {l.m.question.slice(0, 55)}{l.m.question.length > 55 ? '…' : ''}
              </Link>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--critical)' }} onClick={() => removeFromSlip(i)} aria-label="Remove leg">✕</button>
            </div>
            <div className="hint" style={{ margin: '4px 0 8px' }}>
              {l.m.type === 'multi' ? l.o.label + ' — ' : ''}
              <strong style={{ color: l.side === 'yes' ? 'var(--yes)' : 'var(--no)' }}>{l.side.toUpperCase()}</strong> @ {fmtCents(l.p)}
            </div>
            <div className="row">
              <span className="hint">$</span>
              <input
                className="input" type="number" min={1} style={{ width: 90, padding: '5px 8px' }}
                value={l.amount}
                onChange={e => setSlipAmount(i, parseFloat(e.target.value) || 0)}
              />
              <span className="hint" style={{ marginLeft: 'auto' }}>→ {l.shares.toFixed(1)} shares</span>
            </div>
          </div>
        )) : (
          <Empty icon="🧺" text="Slip is empty" sub="Use “+ Slip” on any market to build a combo across markets, then place it in one click." />
        )}
      </div>

      {enriched.length > 0 && (
        <div style={{ padding: 14, borderTop: '1px solid var(--grid)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="quote-rows">
            <div><span className="k">Total stake</span><span className="v">{fmtUsd(total)}</span></div>
            <div><span className="k">Payout if all {enriched.length} legs win</span><span className="v up">{fmtUsd(payout)} ({total > 0 ? '+' + fmtPct1((payout - total) / total) : '—'})</span></div>
            <div><span className="k">Market-implied combo odds</span><span className="v">{fmtPct1(comboProb)}</span></div>
          </div>
          <div className="hint">Legs settle independently — this is a basket, not an all-or-nothing parlay, so partial wins still pay.</div>
          <button className="btn btn-primary btn-lg" disabled={!currentUser || total <= 0} onClick={() => { const r = placeSlip(); if (r.ok) onClose() }}>
            {currentUser ? `Place ${enriched.length}-leg combo · ${fmtUsd(total)}` : 'Sign in to place'}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Notifications bell: inbox (autonomous + event notifications) + price alerts
// ---------------------------------------------------------------------------
const KIND_ICON: Record<string, string> = {
  'price-alert': '🔔', settlement: '💰', kyc: '🪪', withdrawal: '🏦', reward: '🎁',
  'reminder-kyc': '🪪', 'reminder-trade': '📈', 'watchlist-move': '⭐', 'closing-soon': '⏳',
  achievement: '🏅', 'level-up': '🎉', 'admin-message': '📣', 'copy-trade': '🪞',
}

export const NotificationsBell = () => {
  const { state, currentUser, deleteAlert, marketById, markNotificationsRead, dismissNotification } = useStore()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'inbox' | 'alerts'>('inbox')
  if (!currentUser) return null
  const inbox = state.notifications.filter(n => n.userId === currentUser.id)
  const unread = inbox.filter(n => !n.read).length
  const myAlerts = state.alerts.filter(a => a.userId === currentUser.id)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) markNotificationsRead()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" style={{ position: 'relative', fontSize: 15 }} onClick={toggle} aria-label="Notifications">
        🔔
        {unread > 0 && <span className="bell-dot">{unread}</span>}
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, top: 38, width: 360, boxShadow: 'var(--shadow)', zIndex: 60 }} onMouseLeave={() => setOpen(false)}>
          <div className="row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--grid)', justifyContent: 'space-between' }}>
            <strong>Notifications</strong>
            <div className="tabs" style={{ padding: 2 }}>
              <button className={tab === 'inbox' ? 'on' : ''} onClick={() => setTab('inbox')}>Inbox</button>
              <button className={tab === 'alerts' ? 'on' : ''} onClick={() => setTab('alerts')}>My alerts ({myAlerts.length})</button>
            </div>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {tab === 'inbox' ? (
              inbox.length ? inbox.slice(0, 30).map(n => (
                <div key={n.id} className="row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--grid)', gap: 10, alignItems: 'flex-start' }}>
                  <span aria-hidden="true">{KIND_ICON[n.kind] ?? '🔷'}</span>
                  <div style={{ flex: 1, fontSize: 12.5 }}>
                    {n.link ? (
                      <Link to={n.link.replace('#', '')} style={{ fontWeight: 700 }} onClick={() => setOpen(false)}>{n.title}</Link>
                    ) : <span style={{ fontWeight: 700 }}>{n.title}</span>}
                    <div className="hint">{n.text}</div>
                    <div className="hint" style={{ marginTop: 2 }}>{fmtAgo(n.at)}</div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => dismissNotification(n.id)} aria-label="Dismiss">✕</button>
                </div>
              )) : <Empty icon="📭" text="Inbox zero" sub="Reminders, settlements and alerts land here automatically." />
            ) : (
              myAlerts.length ? myAlerts.map(a => {
                const m = marketById(a.marketId)
                if (!m) return null
                const o = m.outcomes.find(x => x.id === a.outcomeId)!
                return (
                  <div key={a.id} className="row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--grid)', gap: 10 }}>
                    <span aria-hidden="true">{a.triggeredAt ? '✅' : '⏳'}</span>
                    <div style={{ flex: 1, fontSize: 12.5 }}>
                      <Link to={`/market/${m.id}`} style={{ fontWeight: 650 }} onClick={() => setOpen(false)}>{m.question.slice(0, 45)}…</Link>
                      <div className="hint">
                        {a.condition === 'move' ? `any ${Math.round(a.threshold * 100)}pt move / 24h` : `${a.condition} ${Math.round(a.threshold * 100)}%`}
                        {' · now '}{fmtPct(price(o))}{a.triggeredAt ? ' · triggered' : ' · watching'}
                      </div>
                    </div>
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--critical)' }} onClick={() => deleteAlert(a.id)} aria-label="Delete alert">✕</button>
                  </div>
                )
              }) : <Empty icon="🔕" text="No alerts set" sub="Create one from any market page — above/below a price, or any big 24h move." />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
