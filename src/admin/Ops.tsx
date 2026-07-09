import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Avatar, Empty, Switch } from '../components/ui'
import { fmtAgo, fmtDateTime, fmtUsd } from '../lib/format'
import type { Settings } from '../lib/types'

// ---------------------------------------------------------------------------
// Finance: withdrawal approvals, fee configuration, treasury snapshot
// ---------------------------------------------------------------------------
export const AdminFinance = () => {
  const { state, adminReviewWithdrawal, adminUpdateSettings, userById } = useStore()
  const pending = state.txs.filter(t => t.type === 'withdrawal' && t.status === 'pending')
  const [fee, setFee] = useState(String(state.settings.tradingFeeBps))
  const [autoApprove, setAutoApprove] = useState(String(state.settings.withdrawalAutoApproveUnder))
  const custodial = state.users.reduce((a, u) => a + u.balance, 0)
  const feeIncome = state.settings.dailyVolume.reduce((a, d) => a + d.volume, 0) * (state.settings.tradingFeeBps / 10000)

  return (
    <>
      <div className="admin-head"><h1>Finance</h1></div>
      <div className="stack">
        <div className="kpi-row">
          <div className="card kpi"><div className="l">Custodial balances</div><div className="v mono">{fmtUsd(custodial, 0)}</div></div>
          <div className="card kpi"><div className="l">Fee income (30d est.)</div><div className="v mono">{fmtUsd(feeIncome, 0)}</div></div>
          <div className="card kpi"><div className="l">Pending withdrawals</div><div className="v mono">{pending.length}</div></div>
        </div>

        <div className="card">
          <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>Withdrawal approval queue</div>
          {pending.length ? pending.map(t => {
            const u = userById(t.userId)
            if (!u) return null
            return (
              <div key={t.id} className="row card-pad" style={{ borderBottom: '1px solid var(--grid)', gap: 14 }}>
                <Avatar user={u} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 650 }}>{fmtUsd(-t.amount)} — {u.name} <span className="muted">@{u.handle}</span></div>
                  <div className="hint">{t.note} · requested {fmtAgo(t.createdAt)} · Tier {u.kycTier} · lifetime net deposits {fmtUsd(u.totalDeposited - u.totalWithdrawn, 0)}</div>
                </div>
                <button className="btn btn-sm" style={{ background: 'var(--yes-soft)', color: 'var(--yes)' }} onClick={() => adminReviewWithdrawal(t.id, true)}>Approve & send</button>
                <button className="btn btn-sm btn-danger" onClick={() => adminReviewWithdrawal(t.id, false)}>Reject</button>
              </div>
            )
          }) : <Empty icon="🏦" text="No withdrawals awaiting review" sub={`Requests under ${fmtUsd(state.settings.withdrawalAutoApproveUnder, 0)} auto-approve.`} />}
        </div>

        <div className="card card-pad">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Fee & payout configuration</div>
          <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 190 }}>
              <label>Platform trading fee (bps)</label>
              <input className="input" type="number" value={fee} onChange={e => setFee(e.target.value)} />
            </div>
            <div className="field" style={{ width: 220 }}>
              <label>Auto-approve withdrawals under ($)</label>
              <input className="input" type="number" value={autoApprove} onChange={e => setAutoApprove(e.target.value)} />
            </div>
            <button
              className="btn btn-primary"
              onClick={() => adminUpdateSettings({ tradingFeeBps: parseFloat(fee) || 0, withdrawalAutoApproveUnder: parseFloat(autoApprove) || 0 })}
            >
              Save
            </button>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>New markets inherit the platform fee; per-market overrides are set in the create wizard.</div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Risk controls: circuit breaker, tier caps, geo-blocking
// ---------------------------------------------------------------------------
export const AdminRisk = () => {
  const { state, adminUpdateSettings } = useStore()
  const s = state.settings
  const [movePct, setMovePct] = useState(String(s.circuitBreaker.movePct))
  const [cap0, setCap0] = useState(String(s.tierTradeCaps[0]))
  const [cap1, setCap1] = useState(String(s.tierTradeCaps[1]))
  const [wd1, setWd1] = useState(String(s.withdrawalDailyCap[1]))
  const [wd2, setWd2] = useState(String(s.withdrawalDailyCap[2]))
  const [geo, setGeo] = useState(s.geoBlocked.join(', '))

  return (
    <>
      <div className="admin-head"><h1>Risk controls</h1></div>
      <div className="stack" style={{ maxWidth: 760 }}>
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700 }}>Circuit breaker</div>
              <div className="hint">Auto-halts a market when a single trade moves the price beyond the threshold. Halted markets need manual review to resume.</div>
            </div>
            <Switch checked={s.circuitBreaker.enabled} onChange={v => adminUpdateSettings({ circuitBreaker: { ...s.circuitBreaker, enabled: v } })} label="circuit breaker" />
          </div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 190 }}>
              <label>Max single-trade move (pts)</label>
              <input className="input" type="number" value={movePct} onChange={e => setMovePct(e.target.value)} />
            </div>
            <button className="btn" onClick={() => adminUpdateSettings({ circuitBreaker: { ...s.circuitBreaker, movePct: parseFloat(movePct) || 15 } })}>Save</button>
          </div>
        </div>

        <div className="card card-pad">
          <div style={{ fontWeight: 700 }}>KYC tier position caps</div>
          <div className="hint" style={{ marginBottom: 10 }}>Maximum open-position cost per account. Users hitting a cap are prompted to verify — this is what makes signup frictionless without loosening compliance.</div>
          <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 170 }}>
              <label>Tier 0 (email only) $</label>
              <input className="input" type="number" value={cap0} onChange={e => setCap0(e.target.value)} />
            </div>
            <div className="field" style={{ width: 170 }}>
              <label>Tier 1 (ID verified) $</label>
              <input className="input" type="number" value={cap1} onChange={e => setCap1(e.target.value)} />
            </div>
            <div className="field" style={{ width: 170 }}>
              <label>Tier 2</label>
              <input className="input" value="Unlimited" disabled />
            </div>
            <button className="btn" onClick={() => adminUpdateSettings({ tierTradeCaps: { 0: parseFloat(cap0) || 500, 1: parseFloat(cap1) || 10000, 2: 1e12 } })}>Save</button>
          </div>
        </div>

        <div className="card card-pad">
          <div style={{ fontWeight: 700 }}>Withdrawal daily caps</div>
          <div className="row-wrap" style={{ alignItems: 'flex-end', marginTop: 10 }}>
            <div className="field" style={{ width: 170 }}>
              <label>Tier 1 $/day</label>
              <input className="input" type="number" value={wd1} onChange={e => setWd1(e.target.value)} />
            </div>
            <div className="field" style={{ width: 170 }}>
              <label>Tier 2 $/day</label>
              <input className="input" type="number" value={wd2} onChange={e => setWd2(e.target.value)} />
            </div>
            <button className="btn" onClick={() => adminUpdateSettings({ withdrawalDailyCap: { 1: parseFloat(wd1) || 2500, 2: parseFloat(wd2) || 50000 } })}>Save</button>
          </div>
        </div>

        <div className="card card-pad">
          <div style={{ fontWeight: 700 }}>Geo-blocking</div>
          <div className="hint" style={{ marginBottom: 10 }}>ISO country codes blocked from KYC approval and trading. Enforced in the KYC queue.</div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Blocked jurisdictions (comma-separated)</label>
              <input className="input" value={geo} onChange={e => setGeo(e.target.value)} />
            </div>
            <button className="btn" onClick={() => adminUpdateSettings({ geoBlocked: geo.split(',').map(x => x.trim().toUpperCase()).filter(Boolean) })}>Save</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Feature flags + demo data reset
// ---------------------------------------------------------------------------
const FLAG_META: Record<keyof Settings['featureFlags'], { label: string; desc: string }> = {
  communityMarkets: { label: 'Community markets', desc: 'Users can propose markets; approved ones launch with a “community” badge and creator fee share.' },
  aiResolutionAssist: { label: 'AI resolution assist', desc: 'An agent drafts resolution memos with citations from the market’s source; humans countersign. Memos are published for audit.' },
  limitOrders: { label: 'Limit orders', desc: 'Resting orders that fill when the AMM price crosses the limit. Off = market orders only.' },
  leaderboard: { label: 'Leaderboards', desc: 'Public trader rankings by P&L and calibration score (Brier). Drives the social loop.' },
  scalarMarkets: { label: 'Scalar markets (beta)', desc: 'Range markets that settle proportionally between bounds — e.g. “CPI YoY in June”. Unlocks the wizard option.' },
  negRiskBundles: { label: 'Neg-risk bundles (beta)', desc: 'Trade a full multi-outcome book as one collateral-efficient bundle, like Polymarket’s neg-risk — but exposed as a one-click “hedge the field” button.' },
}

export const AdminFlags = () => {
  const { state, adminToggleFlag, resetDemo } = useStore()
  return (
    <>
      <div className="admin-head"><h1>Feature flags</h1><span className="hint">Ship dark, roll out gradually.</span></div>
      <div className="stack" style={{ maxWidth: 760 }}>
        {(Object.keys(FLAG_META) as (keyof Settings['featureFlags'])[]).map(k => (
          <div key={k} className="card card-pad row" style={{ justifyContent: 'space-between' }}>
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontWeight: 700 }}>{FLAG_META[k].label}</div>
              <div className="hint">{FLAG_META[k].desc}</div>
            </div>
            <Switch checked={state.settings.featureFlags[k]} onChange={() => adminToggleFlag(k)} label={FLAG_META[k].label} />
          </div>
        ))}

        <div className="card card-pad" style={{ borderColor: 'var(--critical)' }}>
          <div style={{ fontWeight: 700, color: 'var(--critical)' }}>Danger zone</div>
          <div className="hint" style={{ margin: '6px 0 10px' }}>
            Erase all demo data — markets, users, trades, settings — and restore the original seed. This is the “clean slate” for building the real product on top.
          </div>
          <button className="btn btn-danger" onClick={() => { if (confirm('Reset ALL demo data to the original seed?')) resetDemo() }}>
            Reset demo data
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Community market proposals
// ---------------------------------------------------------------------------
export const AdminProposals = () => {
  const { state, adminReviewProposal, userById } = useStore()
  const pending = state.proposals.filter(p => p.status === 'pending')
  const done = state.proposals.filter(p => p.status !== 'pending')

  return (
    <>
      <div className="admin-head">
        <h1>Market proposals</h1>
        <span className="hint">{state.settings.featureFlags.communityMarkets ? 'Community submissions awaiting triage.' : 'Community markets flag is OFF — users cannot submit right now.'}</span>
      </div>
      <div className="stack">
        {pending.length ? pending.map(p => {
          const u = userById(p.userId)
          return (
            <div key={p.id} className="card card-pad row" style={{ gap: 14 }}>
              {u && <Avatar user={u} size={32} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 650 }}>{p.question}</div>
                <div className="hint">{p.category} · source: {p.resolutionSource} · by @{u?.handle} · {fmtAgo(p.submittedAt)}</div>
              </div>
              <button className="btn btn-sm" style={{ background: 'var(--yes-soft)', color: 'var(--yes)' }} onClick={() => adminReviewProposal(p.id, true)}>Approve</button>
              <Link to="/admin/markets/new" className="btn btn-sm">Open wizard</Link>
              <button className="btn btn-sm btn-danger" onClick={() => adminReviewProposal(p.id, false)}>Reject</button>
            </div>
          )
        }) : <div className="card"><Empty icon="💡" text="No pending proposals" /></div>}
        {done.length > 0 && (
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {done.map(p => (
                    <tr key={p.id}>
                      <td>{p.question}</td>
                      <td>{p.status === 'approved' ? <span className="badge badge-good"><span className="dot" />Approved</span> : <span className="badge badge-critical"><span className="dot" />Rejected</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export const AdminAudit = () => {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const rows = state.audit.filter(a => (a.action + a.detail + a.actorName).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="admin-head">
        <h1>Audit log</h1>
        <div className="right"><input className="input" style={{ width: 240 }} placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id}>
                  <td className="muted mono">{fmtDateTime(a.at)}</td>
                  <td>{a.actorName}</td>
                  <td><span className="badge badge-accent" style={{ textTransform: 'none' }}>{a.action}</span></td>
                  <td>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty icon="📜" text="No matching entries" />}
      </div>
      <p className="hint" style={{ marginTop: 10 }}>Every operator action — market lifecycle, KYC decisions, balance adjustments, settings — is appended here. In production this is an immutable, exportable log.</p>
    </>
  )
}
