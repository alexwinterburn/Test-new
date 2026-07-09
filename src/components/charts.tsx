import { useMemo, useRef, useState } from 'react'
import type { PricePoint } from '../lib/types'
import { fmtDateTime, fmtPct, fmtUsdCompact } from '../lib/format'

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']

export interface Series { label: string; points: PricePoint[]; color?: string }

/** Multi-series probability line chart with crosshair + tooltip. ≤4 series. */
export const PriceChart = ({ series, height = 220 }: { series: Series[]; height?: number }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null)
  const [w, setW] = useState(600)

  const all = series.flatMap(s => s.points)
  const t0 = Math.min(...all.map(p => p.t))
  const t1 = Math.max(...all.map(p => p.t))
  const pad = { l: 34, r: 10, t: 10, b: 22 }
  const iw = w - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * iw
  const y = (p: number) => pad.t + (1 - p) * ih

  const paths = useMemo(
    () => series.map(s => s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.p).toFixed(1)}`).join(' ')),
    [series, w, height],
  )

  const nearest = (s: Series, t: number) => {
    let best = s.points[0]
    for (const p of s.points) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p
    return best
  }

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    const px = e.clientX - rect.left
    if (px < pad.l || px > w - pad.r) { setHover(null); return }
    const t = t0 + ((px - pad.l) / iw) * (t1 - t0)
    setHover({ x: px, t })
  }

  const gridY = [0, 0.25, 0.5, 0.75, 1]
  const single = series.length === 1

  return (
    <div
      className="viz-root"
      ref={el => { if (el && el.clientWidth !== w) setW(el.clientWidth); (ref as any).current = el }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Price history chart">
        {gridY.map(g => (
          <g key={g}>
            <line x1={pad.l} x2={w - pad.r} y1={y(g)} y2={y(g)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(g) + 4} fontSize={10.5} fill="var(--ink-3)" textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        {single && (
          <path
            d={`${paths[0]} L${x(series[0].points[series[0].points.length - 1].t)},${y(0)} L${x(series[0].points[0].t)},${y(0)} Z`}
            fill="var(--series-1)" opacity={0.08}
          />
        )}
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={series[i].color ?? SERIES[i % 4]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={pad.t} y2={height - pad.b} stroke="var(--baseline)" strokeWidth={1} strokeDasharray="3 3" />
            {series.map((s, i) => {
              const p = nearest(s, hover.t)
              return <circle key={i} cx={x(p.t)} cy={y(p.p)} r={4} fill={series[i].color ?? SERIES[i % 4]} stroke="var(--surface-1)" strokeWidth={2} />
            })}
          </>
        )}
        <text x={pad.l} y={height - 6} fontSize={10.5} fill="var(--ink-3)">{new Date(t0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>
        <text x={w - pad.r} y={height - 6} fontSize={10.5} fill="var(--ink-3)" textAnchor="end">now</text>
      </svg>
      {hover && (
        <div className="viz-tooltip" style={{ left: Math.min(hover.x + 12, w - 150), top: 8 }}>
          <div className="t">{fmtDateTime(hover.t)}</div>
          {series.map((s, i) => {
            const p = nearest(s, hover.t)
            return (
              <div className="row" key={i}>
                <span className="sw" style={{ background: series[i].color ?? SERIES[i % 4] }} />
                <span>{s.label}</span>
                <strong style={{ marginLeft: 'auto' }}>{fmtPct(p.p)}</strong>
              </div>
            )
          })}
        </div>
      )}
      {series.length > 1 && (
        <div className="viz-legend">
          {series.map((s, i) => {
            const last = s.points[s.points.length - 1]
            return (
              <span className="item" key={i}>
                <span className="sw" style={{ background: series[i].color ?? SERIES[i % 4] }} />
                {s.label} · <strong>{fmtPct(last.p)}</strong>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export const Sparkline = ({ points, width = 96, height = 30 }: { points: PricePoint[]; width?: number; height?: number }) => {
  if (points.length < 2) return null
  const t0 = points[0].t, t1 = points[points.length - 1].t
  const min = Math.min(...points.map(p => p.p)), max = Math.max(...points.map(p => p.p))
  const rng = Math.max(0.04, max - min)
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * width
  const y = (p: number) => 2 + (1 - (p - min) / rng) * (height - 4)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.p).toFixed(1)}`).join(' ')
  const up = points[points.length - 1].p >= points[0].p
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={up ? 'var(--delta-up)' : 'var(--delta-down)'} strokeWidth={1.75} strokeLinecap="round" />
    </svg>
  )
}

/** Daily bar chart for the admin dashboard, with per-bar hover tooltip. */
export const BarChart = ({
  data, height = 180, format = fmtUsdCompact,
}: { data: { label: string; value: number }[]; height?: number; format?: (n: number) => string }) => {
  const [hover, setHover] = useState<number | null>(null)
  const [w, setW] = useState(600)
  const pad = { l: 42, r: 8, t: 10, b: 20 }
  const iw = w - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const max = Math.max(...data.map(d => d.value), 1)
  const bw = iw / data.length
  const gridY = [0, 0.5, 1]
  return (
    <div className="viz-root" ref={el => { if (el && el.clientWidth !== w) setW(el.clientWidth) }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Bar chart">
        {gridY.map(g => (
          <g key={g}>
            <line x1={pad.l} x2={w - pad.r} y1={pad.t + (1 - g) * ih} y2={pad.t + (1 - g) * ih} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 6} y={pad.t + (1 - g) * ih + 4} fontSize={10.5} fill="var(--ink-3)" textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {format(max * g)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const bh = Math.max(2, (d.value / max) * ih)
          return (
            <rect
              key={i}
              x={pad.l + i * bw + 1}
              y={pad.t + ih - bh}
              width={Math.max(2, bw - 2)}
              height={bh}
              rx={3}
              fill="var(--series-1)"
              opacity={hover === null || hover === i ? 1 : 0.45}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}
        <text x={pad.l} y={height - 5} fontSize={10.5} fill="var(--ink-3)">{data[0]?.label}</text>
        <text x={w - pad.r} y={height - 5} fontSize={10.5} fill="var(--ink-3)" textAnchor="end">{data[data.length - 1]?.label}</text>
      </svg>
      {hover !== null && (
        <div className="viz-tooltip" style={{ left: Math.min(pad.l + hover * bw, w - 130), top: 4 }}>
          <div className="t">{data[hover].label}</div>
          <div className="row"><strong>{format(data[hover].value)}</strong></div>
        </div>
      )}
    </div>
  )
}
