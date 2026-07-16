import { useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { price } from '../lib/engine'
import { fmtCountdown, fmtPct, fmtUsdCompact } from '../lib/format'
import { PriceChart } from '../components/charts'

/** Bare, chrome-less market widget for embedding in articles and newsletters. */
export const Embed = () => {
  const { id } = useParams()
  const { state } = useStore()
  const m = state.markets.find(x => x.id === id)
  if (!m) return <div style={{ padding: 20 }}>Market not found.</div>

  const p = price(m.outcomes[0])
  const series = (m.type === 'multi' ? m.outcomes.slice(0, 4) : [m.outcomes[0]]).map((o, i) => ({
    label: m.type === 'multi' ? o.label : 'Yes',
    points: (m.history[o.id] ?? []).slice(-160),
  }))

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <div className="card card-pad">
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <span className="mcard-icon" aria-hidden="true">{m.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{m.question}</div>
            <div className="hint">{fmtUsdCompact(m.volume)} vol · {fmtCountdown(m.closesAt)} · via Foresight</div>
          </div>
          {m.type !== 'multi' && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--series-1)' }}>{fmtPct(p)}</div>
              <div className="hint">chance</div>
            </div>
          )}
        </div>
        <PriceChart series={series} height={150} />
        <a
          href={`${location.origin}${location.pathname}#/market/${m.id}`}
          target="_blank" rel="noreferrer"
          className="btn btn-primary" style={{ width: '100%', marginTop: 10 }}
        >
          Trade this market on Foresight →
        </a>
      </div>
    </div>
  )
}
