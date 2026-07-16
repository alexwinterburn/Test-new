import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { price } from '../lib/engine'
import { fmtDate, fmtUsdCompact } from '../lib/format'
import { Modal, StatusBadge, Tabs } from '../components/ui'
import type { Market, Side } from '../lib/types'

const FILTERS = ['all', 'active', 'halted', 'resolving', 'closed', 'resolved'] as const

export const AdminMarkets = () => {
  const { state, adminSetMarketStatus, adminToggleFeatured, adminProposeResolution, adminFinalizeResolution, adminCancelResolution } = useStore()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [q, setQ] = useState('')
  const [resolving, setResolving] = useState<Market | null>(null)
  const [haltTarget, setHaltTarget] = useState<Market | null>(null)
  const [haltReason, setHaltReason] = useState('')

  const markets = useMemo(() => {
    let ms = [...state.markets]
    if (filter !== 'all') ms = ms.filter(m => m.status === filter)
    if (q) ms = ms.filter(m => m.question.toLowerCase().includes(q.toLowerCase()))
    return ms
  }, [state.markets, filter, q])

  return (
    <>
      <div className="admin-head">
        <h1>Markets</h1>
        <div className="right">
          <input className="input" style={{ width: 220 }} placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
          <Link to="/admin/markets/new" className="btn btn-primary">+ Create market</Link>
        </div>
      </div>

      <Tabs value={filter} onChange={setFilter} options={FILTERS.map(f => ({ value: f, label: f[0].toUpperCase() + f.slice(1) }))} />

      <div className="card" style={{ marginTop: 12 }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Market</th><th>Status</th><th className="num">Price</th><th className="num">Volume</th><th>Closes</th><th>Oracle</th><th>Featured</th><th style={{ width: 260 }}>Actions</th></tr>
            </thead>
            <tbody>
              {markets.map(m => {
                const p = price(m.outcomes[0])
                return (
                  <tr key={m.id}>
                    <td>
                      <Link to={`/market/${m.id}`} style={{ fontWeight: 600, color: 'var(--accent)' }}>
                        {m.icon} {m.question.slice(0, 46)}{m.question.length > 46 ? '…' : ''}
                      </Link>
                      <div className="hint">{m.category} · {m.type} · {m.outcomes.length} outcome{m.outcomes.length > 1 ? 's' : ''}{m.creator !== 'foresight' ? ' · community' : ''}</div>
                    </td>
                    <td><StatusBadge status={m.status} /></td>
                    <td className="num">{m.type === 'multi' ? '—' : Math.round(p * 100) + '¢'}</td>
                    <td className="num">{fmtUsdCompact(m.volume)}</td>
                    <td className="muted">{fmtDate(m.closesAt)}</td>
                    <td className="muted" style={{ textTransform: 'capitalize' }}>{m.oracle}</td>
                    <td>
                      <button onClick={() => adminToggleFeatured(m.id)} title="Toggle featured" style={{ fontSize: 16 }}>
                        {m.featured ? '⭐' : '☆'}
                      </button>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {m.status === 'active' && (
                          <>
                            <button className="btn btn-sm" onClick={() => { setHaltTarget(m); setHaltReason('') }}>Halt</button>
                            <button className="btn btn-sm" onClick={() => adminSetMarketStatus(m.id, 'closed', 'Trading closed ahead of resolution')}>Close</button>
                          </>
                        )}
                        {m.status === 'halted' && <button className="btn btn-sm" onClick={() => adminSetMarketStatus(m.id, 'active')}>Resume</button>}
                        {m.status === 'draft' && <button className="btn btn-sm btn-primary" onClick={() => adminSetMarketStatus(m.id, 'active')}>Publish</button>}
                        {(m.status === 'closed' || m.status === 'active' || m.status === 'halted') && (
                          <button className="btn btn-sm btn-primary" onClick={() => setResolving(m)}>Resolve…</button>
                        )}
                        {(m.status === 'resolving' || m.status === 'disputed') && (
                          <>
                            <button className="btn btn-sm btn-primary" onClick={() => adminFinalizeResolution(m.id)}>Finalize & settle</button>
                            <button className="btn btn-sm" onClick={() => adminCancelResolution(m.id)}>Withdraw</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {haltTarget && (
        <Modal title="Halt trading" onClose={() => setHaltTarget(null)}>
          <p className="hint">Pauses all trading on “{haltTarget.question.slice(0, 70)}”. Open orders remain but cannot fill. The reason is shown publicly on the market page.</p>
          <div className="field">
            <label>Reason (public)</label>
            <input className="input" value={haltReason} onChange={e => setHaltReason(e.target.value)} placeholder="e.g. Awaiting clarification of resolution source" autoFocus />
          </div>
          <button className="btn btn-lg btn-primary" onClick={() => { adminSetMarketStatus(haltTarget.id, 'halted', haltReason || 'Halted by operator'); setHaltTarget(null) }}>
            Halt market
          </button>
        </Modal>
      )}

      {resolving && (
        <ResolveModal
          market={resolving}
          onClose={() => setResolving(null)}
          onPropose={(outcomeId, side, hours, scalarValue) => { adminProposeResolution(resolving.id, outcomeId, side, hours, scalarValue); setResolving(null) }}
        />
      )}
    </>
  )
}

const ResolveModal = ({ market, onClose, onPropose }: {
  market: Market
  onClose: () => void
  onPropose: (outcomeId: string, side: Side, hours: number, scalarValue?: number) => void
}) => {
  const { state } = useStore()
  const isMulti = market.type === 'multi'
  const isScalar = market.type === 'scalar' && !!market.scalarRange
  const [outcomeId, setOutcomeId] = useState(market.outcomes[0].id)
  const [side, setSide] = useState<Side>('yes')
  const [hours, setHours] = useState('24')
  const [scalarValue, setScalarValue] = useState(String(market.scalarRange ? (market.scalarRange.min + market.scalarRange.max) / 2 : 0))
  const aiOn = state.settings.featureFlags.aiResolutionAssist

  return (
    <Modal title="Propose resolution" onClose={onClose} wide>
      <p className="hint">
        “{market.question}” · Source: <strong>{market.resolutionSource}</strong> · Oracle: {market.oracle}
      </p>

      {aiOn && (
        <div className="card card-pad" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', fontSize: 13 }}>
          🤖 <strong>AI resolution memo (simulated):</strong> checked {market.resolutionSource} at proposal time; drafted determination
          with 2 citations and confidence 0.93. In production the memo, sources and diff-against-rules are attached here for the
          human resolver to countersign.
        </div>
      )}

      {isScalar ? (
        <div className="field">
          <label>Settlement value ({market.scalarRange!.min}–{market.scalarRange!.max}{market.scalarRange!.unit})</label>
          <input className="input" type="number" value={scalarValue} onChange={e => setScalarValue(e.target.value)} />
          <span className="hint">
            Longs pay {Math.round(Math.min(1, Math.max(0, ((parseFloat(scalarValue) || 0) - market.scalarRange!.min) / (market.scalarRange!.max - market.scalarRange!.min))) * 100)}¢ per share at this value; shorts the remainder.
          </span>
        </div>
      ) : isMulti ? (
        <div className="field">
          <label>Winning outcome</label>
          <select className="select" value={outcomeId} onChange={e => setOutcomeId(e.target.value)}>
            {market.outcomes.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      ) : (
        <div className="side-toggle">
          <button className={side === 'yes' ? 'on-yes' : ''} onClick={() => setSide('yes')}>Resolve YES</button>
          <button className={side === 'no' ? 'on-no' : ''} onClick={() => setSide('no')}>Resolve NO</button>
        </div>
      )}

      <div className="field">
        <label>Dispute window (hours)</label>
        <select className="select" value={hours} onChange={e => setHours(e.target.value)}>
          <option value="0">None — finalize immediately after proposing</option>
          <option value="24">24h — standard</option>
          <option value="48">48h — contentious markets</option>
          <option value="72">72h — high-value markets</option>
        </select>
        <span className="hint">During the window, traders can post a dispute bond to escalate to the resolution committee.</span>
      </div>

      <button className="btn btn-primary btn-lg" onClick={() => onPropose(outcomeId, isMulti || isScalar ? 'yes' : side, parseFloat(hours), isScalar ? parseFloat(scalarValue) || 0 : undefined)}>
        Propose resolution
      </button>
      <div className="hint">Settlement pays $1.00 per winning share and cancels open orders. This is reversible until “Finalize & settle”.</div>
    </Modal>
  )
}
