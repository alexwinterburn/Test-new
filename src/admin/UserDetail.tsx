import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { price } from '../lib/engine'
import { fmtAgo, fmtCents, fmtDate, fmtDateTime, fmtUsd } from '../lib/format'
import { Avatar, Empty, KycBadge, Modal, Tabs } from '../components/ui'
import { levelForXp } from '../lib/gamification'

type Tab = 'activity' | 'positions' | 'kyc' | 'security' | 'support' | 'referrals'

export const AdminUserDetail = () => {
  const { id } = useParams()
  const {
    state, userById, openPositionCost,
    adminSetUserSuspended, adminAdjustBalance, adminResetTwoFactor, adminAddRiskFlag, adminSendNotification,
  } = useStore()
  const [tab, setTab] = useState<Tab>('activity')
  const [modal, setModal] = useState<null | 'adjust' | 'flag' | 'message'>(null)
  const [f1, setF1] = useState('')
  const [f2, setF2] = useState('')

  const u = userById(id ?? '')
  if (!u) return <Empty icon="🤷" text="Customer not found" />

  const positions = state.positions.filter(p => p.userId === u.id).map(p => {
    const m = state.markets.find(x => x.id === p.marketId)!
    const o = m.outcomes.find(x => x.id === p.outcomeId)!
    const cur = price(o, p.side)
    return { ...p, m, o, cur, value: p.shares * cur }
  })
  const orders = state.orders.filter(o => o.userId === u.id && (o.status === 'open' || o.status === 'partial'))
  const txs = state.txs.filter(t => t.userId === u.id)
  const kycHistory = state.kycRequests.filter(k => k.userId === u.id)
  const tickets = state.tickets.filter(t => t.userId === u.id)
  const compliance = state.complianceAlerts.filter(c => c.userId === u.id)
  const lps = state.lps.filter(l => l.userId === u.id)
  const referred = state.users.filter(x => x.referredBy === u.referralCode)
  const trades30 = state.trades.filter(t => t.userId === u.id)
  const tradeVol = txs.filter(t => t.type === 'trade' && t.amount < 0).reduce((a, t) => a + -t.amount, 0)
  const unrealized = positions.reduce((a, p) => a + p.value - p.shares * p.avgPrice, 0)

  return (
    <>
      <div className="admin-head">
        <Link to="/admin/users" className="btn btn-sm">← Users</Link>
        <Avatar user={u} size={38} />
        <div>
          <h1 style={{ fontSize: 18 }}>{u.name} {u.suspended && <span className="badge badge-critical"><span className="dot" />Frozen</span>}</h1>
          <div className="hint">@{u.handle} · {u.email} · {u.country} · joined {fmtDate(u.createdAt)} · signs in via {u.authProvider}</div>
        </div>
        <div className="right row">
          <button
            className={'btn btn-sm' + (u.suspended ? '' : ' btn-danger')}
            onClick={() => adminSetUserSuspended(u.id, !u.suspended)}
          >
            {u.suspended ? '✓ Unfreeze account' : '🧊 Freeze account'}
          </button>
          <button className="btn btn-sm" onClick={() => { setModal('adjust'); setF1(''); setF2('') }}>Adjust balance</button>
          <button className="btn btn-sm" onClick={() => { setModal('message'); setF1(''); setF2('') }}>Message</button>
        </div>
      </div>

      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <div className="card kpi"><div className="l">Balance</div><div className="v mono">{fmtUsd(u.balance)}</div></div>
        <div className="card kpi"><div className="l">Open positions</div><div className="v mono">{fmtUsd(openPositionCost(u.id), 0)}</div><div className={'d ' + (unrealized >= 0 ? 'up' : 'down')}>{fmtUsd(unrealized)} unrealized</div></div>
        <div className="card kpi"><div className="l">Lifetime volume</div><div className="v mono">{fmtUsd(tradeVol, 0)}</div><div className="d muted">{trades30.length} recent trades</div></div>
        <div className="card kpi"><div className="l">Net deposits</div><div className="v mono">{fmtUsd(u.totalDeposited - u.totalWithdrawn, 0)}</div></div>
        <div className="card kpi"><div className="l">Calibration</div><div className="v mono">{Math.round(u.stats.calibration * 100)}%</div><div className="d muted">win rate {Math.round(u.stats.winRate * 100)}%</div></div>
        <div className="card kpi"><div className="l">Level</div><div className="v mono">{levelForXp(u.xp)}</div><div className="d muted">{u.xp.toLocaleString()} XP · 🔥{u.loginStreak}</div></div>
      </div>

      <div className="row-wrap" style={{ marginBottom: 14, gap: 8 }}>
        <KycBadge user={u} />
        {u.security.twoFactorEnabled ? <span className="badge badge-good"><span className="dot" />2FA on</span> : <span className="badge badge-warning"><span className="dot" />2FA off</span>}
        {u.selfLimits.coolOffUntil && u.selfLimits.coolOffUntil > Date.now() && <span className="badge badge-warning"><span className="dot" />Cool-off active</span>}
        {u.riskFlags.map((f, i) => <span key={i} className="badge badge-serious" title={f}><span className="dot" />{f.slice(0, 40)}</span>)}
        <button className="btn btn-sm btn-ghost" onClick={() => { setModal('flag'); setF1('') }}>+ risk flag</button>
      </div>

      <Tabs value={tab} onChange={setTab} options={[
        { value: 'activity', label: `Activity (${txs.length})` },
        { value: 'positions', label: `Positions (${positions.length})` },
        { value: 'kyc', label: `KYC (${kycHistory.length})` },
        { value: 'security', label: 'Security' },
        { value: 'support', label: `Support (${tickets.length})` },
        { value: 'referrals', label: `Referrals (${referred.length})` },
      ]} />

      <div className="card" style={{ marginTop: 12 }}>
        {tab === 'activity' && (txs.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>When</th><th>Type</th><th>Detail</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {txs.slice(0, 25).map(t => (
                  <tr key={t.id}>
                    <td className="muted">{fmtDateTime(t.createdAt)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{t.type}</td>
                    <td className="muted">{t.note}{t.txHash ? ` · ${t.txHash}` : ''}</td>
                    <td className={'num ' + (t.amount >= 0 ? 'up' : '')}>{fmtUsd(t.amount)}</td>
                    <td>{t.status === 'pending' ? <span className="badge badge-warning"><span className="dot" />Pending</span> : t.status === 'rejected' ? <span className="badge badge-critical"><span className="dot" />Rejected</span> : <span className="badge badge-good"><span className="dot" />Done</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon="🪙" text="No transactions" />)}

        {tab === 'positions' && (
          <>
            {positions.length ? (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Market</th><th>Side</th><th className="num">Shares</th><th className="num">Avg</th><th className="num">Now</th><th className="num">Value</th></tr></thead>
                  <tbody>
                    {positions.map(p => (
                      <tr key={p.id}>
                        <td>{p.m.icon} {p.m.question.slice(0, 50)}…{p.m.type === 'multi' && <div className="hint">{p.o.label}</div>}</td>
                        <td><strong style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)' }}>{p.side.toUpperCase()}</strong></td>
                        <td className="num">{p.shares.toFixed(1)}</td>
                        <td className="num">{fmtCents(p.avgPrice)}</td>
                        <td className="num">{fmtCents(p.cur)}</td>
                        <td className="num">{fmtUsd(p.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty icon="🌱" text="No open positions" />}
            {(orders.length > 0 || lps.length > 0) && (
              <div className="card-pad hint" style={{ borderTop: '1px solid var(--grid)' }}>
                {orders.length} resting order{orders.length === 1 ? '' : 's'} · {lps.length} LP position{lps.length === 1 ? '' : 's'} ({fmtUsd(lps.reduce((a, l) => a + l.amount, 0), 0)} principal, {fmtUsd(lps.reduce((a, l) => a + l.feesEarned, 0))} fees accrued)
              </div>
            )}
          </>
        )}

        {tab === 'kyc' && (
          <div className="card-pad stack" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <KycBadge user={u} />
              <span className="hint">Tier {u.kycTier} · status {u.kycStatus}</span>
            </div>
            {kycHistory.length ? kycHistory.map(k => (
              <div key={k.id} className="card card-pad row" style={{ gap: 12, background: 'var(--surface-2)' }}>
                <span style={{ fontSize: 20 }} aria-hidden="true">🪪</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 650 }}>Tier {k.requestedTier} request — {k.docType} ({k.country})</div>
                  <div className="hint">
                    Submitted {fmtDateTime(k.submittedAt)}
                    {k.reviewedAt ? ` · reviewed ${fmtDateTime(k.reviewedAt)} by ${userById(k.reviewedBy ?? '')?.name ?? 'ops'}` : ' · awaiting review'}
                    {k.rejectReason ? ` · reason: ${k.rejectReason}` : ''}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 6 }}>
                    <span className="badge" style={{ textTransform: 'none' }}>📄 {k.docType.toLowerCase()}-front.jpg</span>
                    <span className="badge" style={{ textTransform: 'none' }}>🤳 selfie-liveness.mp4</span>
                    <span className="hint">(simulated documents — production streams from the IDV provider vault)</span>
                  </div>
                </div>
                <span className={`badge ${k.status === 'approved' ? 'badge-good' : k.status === 'rejected' ? 'badge-critical' : 'badge-warning'}`}><span className="dot" />{k.status}</span>
              </div>
            )) : <Empty icon="🪪" text="No KYC submissions yet" />}
            {compliance.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Compliance history</div>
                {compliance.map(c => (
                  <div key={c.id} className="hint">• [{c.status}] {c.kind}: {c.detail}</div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'security' && (
          <div className="card-pad stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Two-factor authentication</div>
                <div className="hint">{u.security.twoFactorEnabled ? 'Enabled — withdrawals require an authenticator code.' : 'Not enabled.'}</div>
              </div>
              {u.security.twoFactorEnabled && (
                <button className="btn btn-sm btn-danger" onClick={() => adminResetTwoFactor(u.id)}>Reset 2FA (lost device)</button>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Withdrawal address book</div>
              {u.security.addressBook.length ? u.security.addressBook.map(a => (
                <div key={a.id} className="hint">• {a.label} — <code style={{ fontSize: 11 }}>{a.address}</code> ({a.asset} on {a.network}, added {fmtDate(a.addedAt)})</div>
              )) : <div className="hint">No saved addresses.</div>}
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Self-imposed limits</div>
              <div className="hint">Daily loss cap: {u.selfLimits.dailyLossCap ? fmtUsd(u.selfLimits.dailyLossCap, 0) : 'none'} · Cool-off: {u.selfLimits.coolOffUntil && u.selfLimits.coolOffUntil > Date.now() ? `until ${fmtDateTime(u.selfLimits.coolOffUntil)}` : 'none'}</div>
            </div>
          </div>
        )}

        {tab === 'support' && (tickets.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Ref</th><th>Subject</th><th>Status</th><th className="num">Updated</th></tr></thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id}>
                    <td className="mono muted">{t.ref}</td>
                    <td><Link to="/admin/support" style={{ color: 'var(--accent)', fontWeight: 600 }}>{t.subject}</Link></td>
                    <td><span className="badge"><span className="dot" />{t.status}</span></td>
                    <td className="num muted">{fmtAgo(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon="🎫" text="No support tickets" />)}

        {tab === 'referrals' && (
          <div className="card-pad stack" style={{ gap: 8 }}>
            <div className="hint">Code <code>{u.referralCode}</code> · referred by {u.referredBy ?? '—'}</div>
            {referred.length ? referred.map(r => (
              <div key={r.id} className="row" style={{ gap: 8, fontSize: 13 }}>
                <Avatar user={r} size={22} />
                <Link to={`/admin/users/${r.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>@{r.handle}</Link>
                <span className="hint">{r.referralRewardPaid ? 'converted — reward paid' : 'not yet converted'}</span>
              </div>
            )) : <Empty icon="🎁" text="No referrals yet" />}
          </div>
        )}
      </div>

      {modal === 'adjust' && (
        <Modal title={`Adjust balance — ${u.name}`} onClose={() => setModal(null)}>
          <p className="hint">Current balance: <strong>{fmtUsd(u.balance)}</strong>. Positive credits, negative debits. Audited.</p>
          <div className="field"><label>Amount ($)</label><input className="input" type="number" value={f1} onChange={e => setF1(e.target.value)} autoFocus /></div>
          <div className="field"><label>Reason (required)</label><input className="input" value={f2} onChange={e => setF2(e.target.value)} /></div>
          <button className="btn btn-primary btn-lg" disabled={!parseFloat(f1) || f2.trim().length < 3} onClick={() => { adminAdjustBalance(u.id, parseFloat(f1), f2.trim()); setModal(null) }}>Apply</button>
        </Modal>
      )}
      {modal === 'flag' && (
        <Modal title="Add risk flag" onClose={() => setModal(null)}>
          <div className="field"><label>Flag text (shows on the account and in compliance)</label><input className="input" value={f1} onChange={e => setF1(e.target.value)} placeholder="e.g. shared device with @otheruser" autoFocus /></div>
          <button className="btn btn-primary btn-lg" disabled={f1.trim().length < 5} onClick={() => { adminAddRiskFlag(u.id, f1.trim()); setModal(null) }}>Add flag</button>
        </Modal>
      )}
      {modal === 'message' && (
        <Modal title={`Message ${u.name}`} onClose={() => setModal(null)}>
          <div className="field"><label>Title</label><input className="input" value={f1} onChange={e => setF1(e.target.value)} autoFocus /></div>
          <div className="field"><label>Message</label><textarea className="input" rows={3} value={f2} onChange={e => setF2(e.target.value)} /></div>
          <button className="btn btn-primary btn-lg" disabled={f1.trim().length < 3 || f2.trim().length < 3} onClick={() => { adminSendNotification(u.id, f1.trim(), f2.trim()); setModal(null) }}>Send</button>
        </Modal>
      )}
    </>
  )
}
