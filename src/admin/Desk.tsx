import { useState } from 'react'
import { useStore } from '../lib/store'
import { costToMove, poolValue, price } from '../lib/engine'
import { fmtAgo, fmtDateTime, fmtPct, fmtUsd, fmtUsdCompact } from '../lib/format'
import { Avatar, Empty, StatusBadge } from '../components/ui'
import { BarChart } from '../components/charts'

// ---------------------------------------------------------------------------
// Liquidity desk — pool depth per market, house liquidity injections
// ---------------------------------------------------------------------------
export const AdminLiquidity = () => {
  const { state, adminAddLiquidity, adminUpdateSettings, userById } = useStore()
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [rebate, setRebate] = useState(String(state.settings.makerRebateBps))
  const [lpShare, setLpShare] = useState(String(state.settings.lpFeeShareBps / 100))
  const markets = state.markets.filter(m => m.status === 'active' || m.status === 'halted')
  const totalDepth = markets.reduce((a, m) => a + m.outcomes.reduce((b, o) => b + poolValue(o), 0), 0)
  const thin = markets.filter(m => m.outcomes.some(o => poolValue(o) < 25000))

  return (
    <>
      <div className="admin-head">
        <h1>Liquidity desk</h1>
        <span className="hint">Deepen books where slippage is hurting traders. Injections keep the current price.</span>
      </div>

      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <div className="card kpi"><div className="l">Total pool depth</div><div className="v mono">{fmtUsdCompact(totalDepth)}</div></div>
        <div className="card kpi"><div className="l">Live books</div><div className="v mono">{markets.length}</div></div>
        <div className="card kpi">
          <div className="l">Thin books (&lt;$25k)</div>
          <div className="v mono" style={thin.length ? { color: 'var(--serious)' } : undefined}>{thin.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Market</th><th>Status</th><th className="num">Price</th><th className="num">Pool depth</th><th className="num">+5pts costs</th><th style={{ width: 240 }}>Add house liquidity</th></tr>
            </thead>
            <tbody>
              {markets.map(m => {
                const o = m.outcomes[0]
                const depth = m.outcomes.reduce((a, x) => a + poolValue(x), 0)
                const isThin = depth < 25000
                return (
                  <tr key={m.id}>
                    <td>
                      {m.icon} {m.question.slice(0, 48)}{m.question.length > 48 ? '…' : ''}
                      {isThin && <span className="badge badge-serious" style={{ marginLeft: 8 }}><span className="dot" />Thin</span>}
                    </td>
                    <td><StatusBadge status={m.status} /></td>
                    <td className="num">{m.type === 'multi' ? '—' : Math.round(price(o) * 100) + '¢'}</td>
                    <td className="num">{fmtUsdCompact(depth)}</td>
                    <td className="num">{fmtUsdCompact(costToMove(o, 0.05))}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <input
                          className="input" type="number" min={100} placeholder="$"
                          style={{ width: 110, padding: '5px 8px' }}
                          value={amounts[m.id] ?? ''}
                          onChange={e => setAmounts(a => ({ ...a, [m.id]: e.target.value }))}
                        />
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={!(parseFloat(amounts[m.id]) > 0)}
                          onClick={() => { adminAddLiquidity(m.id, parseFloat(amounts[m.id])); setAmounts(a => ({ ...a, [m.id]: '' })) }}
                        >
                          Inject
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
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>
            External LPs (market-maker program)
          </div>
          {state.lps.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Provider</th><th>Market</th><th className="num">Principal</th><th className="num">Fees paid</th></tr></thead>
                <tbody>
                  {state.lps.map(l => {
                    const u = userById(l.userId)
                    const m = state.markets.find(x => x.id === l.marketId)
                    return (
                      <tr key={l.id}>
                        <td>@{u?.handle}</td>
                        <td className="muted">{m?.question.slice(0, 34)}…</td>
                        <td className="num">{fmtUsd(l.amount, 0)}</td>
                        <td className="num up">{fmtUsd(l.feesEarned)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty icon="🤝" text="No external LPs yet" />}
        </div>

        <div className="card card-pad stack" style={{ gap: 12 }}>
          <div style={{ fontWeight: 700 }}>Market-maker incentives</div>
          <p className="hint">
            The two levers that attract professional liquidity: a share of every trading fee routed to LPs pro-rata,
            and a rebate on resting limit-order fills. Both apply platform-wide and take effect immediately.
          </p>
          <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 180 }}>
              <label>LP fee share (% of each fee)</label>
              <input className="input" type="number" min={0} max={100} value={lpShare} onChange={e => setLpShare(e.target.value)} />
            </div>
            <div className="field" style={{ width: 180 }}>
              <label>Maker rebate (bps)</label>
              <input className="input" type="number" min={0} max={100} value={rebate} onChange={e => setRebate(e.target.value)} />
            </div>
            <button
              className="btn btn-primary"
              onClick={() => adminUpdateSettings({ makerRebateBps: parseFloat(rebate) || 0, lpFeeShareBps: (parseFloat(lpShare) || 0) * 100 })}
            >
              Save
            </button>
          </div>
          <div className="hint">
            Currently: LPs earn {(state.settings.lpFeeShareBps / 100).toFixed(0)}% of every fee · makers rebated {state.settings.makerRebateBps}bps on fills.
            The public pitch lives at <strong>Exchange → Earn</strong>.
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Compliance center — AML alert queue, cool-offs, exportable report
// ---------------------------------------------------------------------------
const KIND_META = {
  velocity: { icon: '⚡', label: 'Trade velocity' },
  structuring: { icon: '💵', label: 'Deposit structuring' },
  sanctions: { icon: '🛑', label: 'Sanctions screening' },
  'self-limit': { icon: '🧘', label: 'Self-limit event' },
  chargeback: { icon: '↩️', label: 'Chargeback' },
} as const

export const AdminCompliance = () => {
  const { state, adminReviewComplianceAlert, userById } = useStore()
  const open = state.complianceAlerts.filter(a => a.status === 'open')
  const closed = state.complianceAlerts.filter(a => a.status !== 'open')
  const coolOffs = state.users.filter(u => u.selfLimits.coolOffUntil && u.selfLimits.coolOffUntil > Date.now())

  const exportCsv = () => {
    const lines = [
      'id,kind,severity,status,user,handle,country,detail,at',
      ...state.complianceAlerts.map(a => {
        const u = userById(a.userId)
        return [a.id, a.kind, a.severity, a.status, u?.name, u?.handle, u?.country, '"' + a.detail.replace(/"/g, '""') + '"', new Date(a.at).toISOString()].join(',')
      }),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = `foresight-compliance-${new Date().toISOString().slice(0, 10)}.csv`
    el.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="admin-head">
        <h1>Compliance center</h1>
        <div className="right"><button className="btn" onClick={exportCsv}>⬇ Export CSV report</button></div>
      </div>

      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <div className="card kpi"><div className="l">Open alerts</div><div className="v mono" style={open.length ? { color: 'var(--critical)' } : undefined}>{open.length}</div></div>
        <div className="card kpi"><div className="l">Active cool-offs</div><div className="v mono">{coolOffs.length}</div></div>
        <div className="card kpi"><div className="l">Blocked jurisdictions</div><div className="v mono">{state.settings.geoBlocked.length}</div></div>
      </div>

      <div className="stack">
        {open.length ? open.map(a => {
          const u = userById(a.userId)
          const meta = KIND_META[a.kind]
          return (
            <div key={a.id} className="card card-pad row" style={{ gap: 14, borderLeft: `3px solid var(--${a.severity})` }}>
              <span style={{ fontSize: 20 }} aria-hidden="true">{meta.icon}</span>
              <div style={{ flex: 1 }}>
                <div className="row" style={{ gap: 8 }}>
                  <strong>{meta.label}</strong>
                  <span className={`badge badge-${a.severity}`}><span className="dot" />{a.severity}</span>
                  {u && <span className="muted">@{u.handle} · {u.country} · Tier {u.kycTier}</span>}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{a.detail}</div>
                <div className="hint" style={{ marginTop: 2 }}>{fmtAgo(a.at)}</div>
              </div>
              <div className="row">
                <button className="btn btn-sm" onClick={() => adminReviewComplianceAlert(a.id, 'acknowledged')}>Acknowledge</button>
                <button className="btn btn-sm btn-ghost" onClick={() => adminReviewComplianceAlert(a.id, 'dismissed')}>Dismiss</button>
              </div>
            </div>
          )
        }) : <div className="card"><Empty icon="🛡️" text="No open compliance alerts" /></div>}

        <div className="grid-2">
          <div className="card">
            <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>Responsible-trading cool-offs</div>
            {coolOffs.length ? coolOffs.map(u => (
              <div key={u.id} className="row card-pad" style={{ gap: 10 }}>
                <Avatar user={u} />
                <span style={{ flex: 1 }}>{u.name} <span className="muted">@{u.handle}</span></span>
                <span className="hint">until {fmtDateTime(u.selfLimits.coolOffUntil!)}</span>
              </div>
            )) : <Empty icon="🧘" text="No active cool-offs" />}
          </div>
          <div className="card">
            <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>Recently closed</div>
            {closed.length ? closed.map(a => {
              const u = userById(a.userId)
              return (
                <div key={a.id} className="row card-pad" style={{ gap: 10, fontSize: 13 }}>
                  <span aria-hidden="true">{KIND_META[a.kind].icon}</span>
                  <span style={{ flex: 1 }}>{KIND_META[a.kind].label} · @{u?.handle}</span>
                  <span className="badge"><span className="dot" />{a.status}</span>
                </div>
              )
            }) : <Empty icon="📁" text="Nothing closed yet" />}
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Analytics — growth & category mix
// ---------------------------------------------------------------------------
export const AdminAnalytics = () => {
  const { state } = useStore()
  const dv = state.settings.dailyVolume

  const byCategory = state.markets.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] ?? 0) + m.volume
    return acc
  }, {})
  const cats = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const catTotal = cats.reduce((a, [, v]) => a + v, 0)

  const topTraders = [...state.users]
    .filter(u => !u.isAdmin)
    .sort((a, b) => b.stats.profit30d - a.stats.profit30d)
    .slice(0, 5)

  const referrers = state.users
    .map(u => {
      const invited = state.users.filter(x => x.referredBy === u.referralCode)
      return { u, invited: invited.length, converted: invited.filter(x => x.referralRewardPaid).length }
    })
    .filter(r => r.invited > 0)
    .sort((a, b) => b.converted - a.converted)

  return (
    <>
      <div className="admin-head"><h1>Analytics</h1><span className="hint">Growth and mix — the inputs for market-making and marketing spend.</span></div>
      <div className="stack">
        <div className="grid-2">
          <div className="card card-pad">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Signups per day — last 30 days</div>
            <BarChart data={dv.map(d => ({ label: d.date.slice(5), value: d.signups }))} format={n => Math.round(n).toString()} />
          </div>
          <div className="card card-pad">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Trades per day — last 30 days</div>
            <BarChart data={dv.map(d => ({ label: d.date.slice(5), value: d.trades }))} format={n => Math.round(n).toLocaleString()} />
          </div>
        </div>

        <div className="grid-2">
          <div className="card card-pad">
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Lifetime volume by category</div>
            {cats.map(([cat, v]) => (
              <div key={cat} className="row" style={{ marginBottom: 7 }}>
                <span style={{ width: 96, fontSize: 13 }}>{cat}</span>
                <span className="progress" style={{ flex: 1 }}><i style={{ width: `${(v / cats[0][1]) * 100}%` }} /></span>
                <span className="mono" style={{ width: 66, textAlign: 'right', fontSize: 13 }}>{fmtUsdCompact(v)}</span>
                <span className="muted mono" style={{ width: 42, textAlign: 'right', fontSize: 12 }}>{fmtPct(v / catTotal)}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>
              Referral program
              <span className="hint" style={{ fontWeight: 400, marginLeft: 8 }}>
                {fmtUsd(state.settings.referralReward, 0)} per conversion · min first deposit {fmtUsd(state.settings.referralMinDeposit, 0)}
              </span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Referrer</th><th>Code</th><th className="num">Invited</th><th className="num">Converted</th><th className="num">Paid out</th></tr></thead>
                <tbody>
                  {referrers.length ? referrers.map(r => (
                    <tr key={r.u.id}>
                      <td><div className="row" style={{ gap: 8 }}><Avatar user={r.u} size={24} />@{r.u.handle}</div></td>
                      <td><code style={{ fontSize: 12 }}>{r.u.referralCode}</code></td>
                      <td className="num">{r.invited}</td>
                      <td className="num">{r.converted}</td>
                      <td className="num">{fmtUsd(r.converted * state.settings.referralReward, 0)}</td>
                    </tr>
                  )) : <tr><td colSpan={5} className="muted">No referral activity yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>Top traders (30d P&L)</div>
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {topTraders.map((u, i) => (
                    <tr key={u.id}>
                      <td className="mono muted" style={{ width: 30 }}>{i + 1}</td>
                      <td><div className="row" style={{ gap: 8 }}><Avatar user={u} size={24} />@{u.handle}</div></td>
                      <td className={'num ' + (u.stats.profit30d >= 0 ? 'up' : 'down')}>{fmtUsd(u.stats.profit30d, 0)}</td>
                      <td className="num muted">calib {fmtPct(u.stats.calibration)}</td>
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

// ---------------------------------------------------------------------------
// Announcements — site-wide banner composer
// ---------------------------------------------------------------------------
export const AdminAnnounce = () => {
  const { state, adminSetAnnouncement, adminClearAnnouncement } = useStore()
  const cur = state.settings.announcement
  const [text, setText] = useState('')
  const [kind, setKind] = useState<'info' | 'warning' | 'critical'>('info')

  return (
    <>
      <div className="admin-head"><h1>Announcements</h1><span className="hint">One banner, shown at the top of the exchange for every visitor.</span></div>
      <div className="stack" style={{ maxWidth: 680 }}>
        {cur && (
          <div className="card card-pad">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Currently live</div>
            <div className={`banner banner-${cur.kind}`} style={{ borderRadius: 8, border: '1px solid var(--border)' }}>
              <span aria-hidden="true">{cur.kind === 'critical' ? '🚨' : cur.kind === 'warning' ? '⚠️' : '📣'}</span>
              <span>{cur.text}</span>
            </div>
            <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
              <span className="hint">Published {fmtDateTime(cur.at)}</span>
              <button className="btn btn-sm btn-danger" onClick={adminClearAnnouncement}>Take down</button>
            </div>
          </div>
        )}

        <div className="card card-pad stack" style={{ gap: 12 }}>
          <div className="field">
            <label>Banner text</label>
            <input className="input" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Scheduled maintenance Sunday 02:00–03:00 UTC — trading paused briefly." />
          </div>
          <div className="field">
            <label>Severity</label>
            <select className="select" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
              <option value="info">Info — product news, new markets</option>
              <option value="warning">Warning — maintenance, degraded service</option>
              <option value="critical">Critical — incident, trading halted</option>
            </select>
          </div>
          {text && (
            <div className={`banner banner-${kind}`} style={{ borderRadius: 8, border: '1px solid var(--border)' }}>
              <span aria-hidden="true">{kind === 'critical' ? '🚨' : kind === 'warning' ? '⚠️' : '📣'}</span>
              <span>{text}</span>
            </div>
          )}
          <button className="btn btn-primary btn-lg" disabled={text.trim().length < 5} onClick={() => { adminSetAnnouncement(text.trim(), kind); setText('') }}>
            {cur ? 'Replace live banner' : 'Publish banner'}
          </button>
        </div>
      </div>
    </>
  )
}
