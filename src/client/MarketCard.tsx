import { Link } from 'react-router-dom'
import type { Market } from '../lib/types'
import { price } from '../lib/engine'
import { fmtCountdown, fmtPct, fmtUsdCompact } from '../lib/format'
import { Sparkline } from '../components/charts'
import { StatusBadge } from '../components/ui'

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']

export const MarketCard = ({ market }: { market: Market }) => {
  const isMulti = market.type === 'multi'
  const primary = market.outcomes[0]
  const p = price(primary)
  const hist = market.history[primary.id] ?? []
  const sorted = isMulti ? [...market.outcomes].sort((a, b) => price(b) - price(a)) : market.outcomes

  return (
    <Link to={`/market/${market.id}`} className="card mcard">
      <div className="mcard-top">
        <span className="mcard-icon" aria-hidden="true">{market.icon}</span>
        <span className="mcard-q">{market.question}</span>
        {!isMulti && (
          <span className="mcard-prob">
            <span className="p">{fmtPct(p)}</span>
            <span className="l">chance</span>
          </span>
        )}
      </div>

      {isMulti ? (
        <div className="mcard-outcomes">
          {sorted.slice(0, 3).map(o => {
            const op = price(o)
            return (
              <div className="mcard-outcome" key={o.id}>
                <span style={{ width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                <span className="bar"><i style={{ width: `${op * 100}%`, background: SERIES[market.outcomes.indexOf(o) % 4] }} /></span>
                <strong className="mono" style={{ width: 34, textAlign: 'right' }}>{fmtPct(op)}</strong>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Sparkline points={hist.slice(-80)} width={150} height={34} />
          {market.status === 'active' ? (
            <div className="mcard-actions" style={{ width: 130 }}>
              <span className="btn btn-sm" style={{ background: 'var(--yes-soft)', color: 'var(--yes)', borderColor: 'transparent' }}>Yes {Math.round(p * 100)}¢</span>
              <span className="btn btn-sm" style={{ background: 'var(--no-soft)', color: 'var(--no)', borderColor: 'transparent' }}>No {Math.round((1 - p) * 100)}¢</span>
            </div>
          ) : (
            <StatusBadge status={market.status} />
          )}
        </div>
      )}

      <div className="mcard-meta">
        <span>{fmtUsdCompact(market.volume)} vol</span>
        <span>·</span>
        <span>{market.status === 'resolved' ? 'Resolved' : fmtCountdown(market.closesAt)}</span>
        <span style={{ marginLeft: 'auto' }} className="badge">{market.category}</span>
      </div>
    </Link>
  )
}
