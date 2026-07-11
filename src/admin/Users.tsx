import { useState } from 'react'
import { useStore } from '../lib/store'
import { Avatar, Empty, KycBadge, Modal } from '../components/ui'
import { fmtAgo, fmtDate, fmtUsd } from '../lib/format'
import type { User } from '../lib/types'

export const AdminUsers = () => {
  const { state, adminSetUserSuspended, adminAdjustBalance, openPositionCost } = useStore()
  const [q, setQ] = useState('')
  const [adjusting, setAdjusting] = useState<User | null>(null)
  const [adjAmount, setAdjAmount] = useState('')
  const [adjNote, setAdjNote] = useState('')

  const users = state.users.filter(u =>
    (u.name + u.email + u.handle).toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <>
      <div className="admin-head">
        <h1>Users</h1>
        <div className="right">
          <input className="input" style={{ width: 240 }} placeholder="Search name, email, handle…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>User</th><th>KYC</th><th className="num">Balance</th><th className="num">Open positions</th><th className="num">Deposited</th><th>Joined</th><th>Flags</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={u.suspended ? { opacity: 0.55 } : undefined}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar user={u} />
                      <div>
                        <div style={{ fontWeight: 650 }}>{u.name} {u.isAdmin && <span className="badge badge-accent">Ops</span>} {u.suspended && <span className="badge badge-critical">Suspended</span>}</div>
                        <div className="hint">@{u.handle} · {u.email} · {u.country}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="stack" style={{ gap: 4 }}>
                      <KycBadge user={u} />
                      {u.security.twoFactorEnabled && <span className="badge badge-good"><span className="dot" />2FA</span>}
                    </div>
                  </td>
                  <td className="num">{fmtUsd(u.balance)}</td>
                  <td className="num">{fmtUsd(openPositionCost(u.id))}</td>
                  <td className="num">{fmtUsd(u.totalDeposited, 0)}</td>
                  <td className="muted">{fmtDate(u.createdAt)}</td>
                  <td>
                    {u.riskFlags.length
                      ? <span className="badge badge-serious" title={u.riskFlags.join('\n')}><span className="dot" />{u.riskFlags.length} risk flag{u.riskFlags.length > 1 ? 's' : ''}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => { setAdjusting(u); setAdjAmount(''); setAdjNote('') }}>Adjust</button>
                      {!u.isAdmin && (
                        <button className={'btn btn-sm' + (u.suspended ? '' : ' btn-danger')} onClick={() => adminSetUserSuspended(u.id, !u.suspended)}>
                          {u.suspended ? 'Reinstate' : 'Suspend'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adjusting && (
        <Modal title={`Adjust balance — ${adjusting.name}`} onClose={() => setAdjusting(null)}>
          <p className="hint">Current balance: <strong>{fmtUsd(adjusting.balance)}</strong>. Positive credits, negative debits. Every adjustment is written to the audit log.</p>
          <div className="field">
            <label>Amount ($, use negative to debit)</label>
            <input className="input" type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Reason (required, audited)</label>
            <input className="input" value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="e.g. goodwill credit, chargeback reversal" />
          </div>
          <button
            className="btn btn-primary btn-lg"
            disabled={!parseFloat(adjAmount) || adjNote.trim().length < 3}
            onClick={() => { adminAdjustBalance(adjusting.id, parseFloat(adjAmount), adjNote.trim()); setAdjusting(null) }}
          >
            Apply adjustment
          </button>
        </Modal>
      )}
    </>
  )
}

export const AdminKyc = () => {
  const { state, adminReviewKyc, userById } = useStore()
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const pending = state.kycRequests.filter(r => r.status === 'pending')
  const reviewed = state.kycRequests.filter(r => r.status !== 'pending')

  return (
    <>
      <div className="admin-head">
        <h1>KYC queue</h1>
        <span className="hint">Progressive verification: users only hit this queue when they need higher limits or withdrawals.</span>
      </div>

      <div className="stack">
        {pending.length ? pending.map(r => {
          const u = userById(r.userId)
          if (!u) return null
          return (
            <div key={r.id} className="card card-pad row" style={{ gap: 14 }}>
              <Avatar user={u} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{u.name} <span className="muted">@{u.handle}</span> → requesting <strong>Tier {r.requestedTier}</strong></div>
                <div className="hint">
                  {r.docType} · {r.country} · submitted {fmtAgo(r.submittedAt)} · current tier {u.kycTier} ·
                  deposited {fmtUsd(u.totalDeposited, 0)} · balance {fmtUsd(u.balance, 0)}
                </div>
                {state.settings.geoBlocked.includes(r.country) && (
                  <div className="badge badge-critical" style={{ marginTop: 6 }}><span className="dot" />Geo-blocked jurisdiction — must reject</div>
                )}
                {u.riskFlags.length > 0 && (
                  <div className="badge badge-serious" style={{ marginTop: 6 }}><span className="dot" />{u.riskFlags[0]}</div>
                )}
              </div>
              <div className="row">
                <button className="btn btn-sm" style={{ background: 'var(--yes-soft)', color: 'var(--yes)' }} disabled={state.settings.geoBlocked.includes(r.country)} onClick={() => adminReviewKyc(r.id, true)}>Approve</button>
                <button className="btn btn-sm btn-danger" onClick={() => { setRejecting(r.id); setReason('') }}>Reject</button>
              </div>
            </div>
          )
        }) : <div className="card"><Empty icon="🪪" text="Queue is clear" sub="New verification requests appear here the moment users submit them." /></div>}

        {reviewed.length > 0 && (
          <div className="card">
            <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>Recently reviewed</div>
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {reviewed.slice(0, 8).map(r => {
                    const u = userById(r.userId)
                    return (
                      <tr key={r.id}>
                        <td>{u?.name} → Tier {r.requestedTier}</td>
                        <td>{r.status === 'approved' ? <span className="badge badge-good"><span className="dot" />Approved</span> : <span className="badge badge-critical"><span className="dot" />Rejected{r.rejectReason ? ` — ${r.rejectReason}` : ''}</span>}</td>
                        <td className="muted num">{r.reviewedAt ? fmtAgo(r.reviewedAt) : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {rejecting && (
        <Modal title="Reject verification" onClose={() => setRejecting(null)}>
          <div className="field">
            <label>Reason (sent to the user)</label>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. document unreadable, name mismatch" autoFocus />
          </div>
          <button className="btn btn-lg btn-danger" disabled={reason.trim().length < 3} onClick={() => { adminReviewKyc(rejecting, false, reason.trim()); setRejecting(null) }}>
            Reject request
          </button>
        </Modal>
      )}
    </>
  )
}
