import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useStore } from '../lib/store'
import { fmtDateTime, fmtUsd } from '../lib/format'
import { Empty, KycBadge, Tabs } from '../components/ui'
import { KycModal } from '../components/auth'

export const Wallet = () => {
  const { state, currentUser, deposit, withdraw, setSelfLimits } = useStore()
  const { openAuth } = useOutletContext<{ openAuth: () => void }>()
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('100')
  const [method, setMethod] = useState('Card •••• 4242')
  const [kycOpen, setKycOpen] = useState(false)
  const [kycReason, setKycReason] = useState<string | undefined>()
  const [error, setError] = useState('')
  const [lossCap, setLossCap] = useState('')

  if (!currentUser) {
    return (
      <main className="page-inner">
        <Empty icon="💳" text="Sign in to manage your wallet" />
        <div style={{ textAlign: 'center' }}><button className="btn btn-primary" onClick={openAuth}>Sign up / sign in</button></div>
      </main>
    )
  }

  const txs = state.txs.filter(t => t.userId === currentUser.id && ['deposit', 'withdrawal', 'adjustment', 'settlement'].includes(t.type))
  const amt = parseFloat(amount) || 0

  const doAction = () => {
    setError('')
    if (amt <= 0) { setError('Enter an amount.'); return }
    if (tab === 'deposit') { deposit(amt, method); return }
    const res = withdraw(amt, method)
    if (!res.ok) {
      if (res.needsKyc) { setKycReason(res.error); setKycOpen(true) }
      else setError(res.error ?? 'Withdrawal failed')
    }
  }

  return (
    <main className="page-inner">
      <div className="section-head" style={{ marginTop: 0 }}><h2 style={{ fontSize: 21 }}>Wallet</h2></div>
      <div className="detail-grid">
        <div className="stack">
          <div className="kpi-row">
            <div className="card kpi"><div className="l">Available balance</div><div className="v mono">{fmtUsd(currentUser.balance)}</div></div>
            <div className="card kpi"><div className="l">Lifetime deposits</div><div className="v mono">{fmtUsd(currentUser.totalDeposited)}</div></div>
            <div className="card kpi"><div className="l">Lifetime withdrawals</div><div className="v mono">{fmtUsd(currentUser.totalWithdrawn)}</div></div>
          </div>

          <div className="card">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--grid)', fontWeight: 700 }}>Activity</div>
            {txs.length ? (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>When</th><th>Type</th><th>Detail</th><th className="num">Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {txs.map(t => (
                      <tr key={t.id}>
                        <td className="muted">{fmtDateTime(t.createdAt)}</td>
                        <td style={{ textTransform: 'capitalize' }}>{t.type}</td>
                        <td className="muted">{t.note}</td>
                        <td className={'num ' + (t.amount >= 0 ? 'up' : '')}>{fmtUsd(t.amount)}</td>
                        <td>
                          {t.status === 'pending' ? <span className="badge badge-warning"><span className="dot" />Pending</span>
                            : t.status === 'rejected' ? <span className="badge badge-critical"><span className="dot" />Rejected</span>
                            : <span className="badge badge-good"><span className="dot" />Done</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty icon="🪙" text="No wallet activity yet" />}
          </div>

          <div className="card card-pad stack" style={{ gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Responsible trading</div>
            <p className="hint">Set voluntary guardrails on your own account. Only support can loosen them once set — by design.</p>
            <div className="row-wrap">
              <div className="field" style={{ width: 200 }}>
                <label>Daily loss cap ($)</label>
                <input className="input" type="number" placeholder={currentUser.selfLimits.dailyLossCap?.toString() ?? 'none'} value={lossCap} onChange={e => setLossCap(e.target.value)} />
              </div>
              <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={() => setSelfLimits({ ...currentUser.selfLimits, dailyLossCap: parseFloat(lossCap) || null })}>Save cap</button>
              <button
                className="btn btn-danger"
                style={{ alignSelf: 'flex-end' }}
                onClick={() => setSelfLimits({ ...currentUser.selfLimits, coolOffUntil: Date.now() + 7 * 86400000 })}
              >
                Start 7-day cool-off
              </button>
            </div>
            {currentUser.selfLimits.coolOffUntil && currentUser.selfLimits.coolOffUntil > Date.now() && (
              <div className="badge badge-warning"><span className="dot" />Cool-off active until {fmtDateTime(currentUser.selfLimits.coolOffUntil)}</div>
            )}
          </div>
        </div>

        <div className="trade-panel">
          <div className="card card-pad stack" style={{ gap: 12 }}>
            <Tabs value={tab} onChange={setTab} options={[{ value: 'deposit', label: 'Deposit' }, { value: 'withdraw', label: 'Withdraw' }]} />
            <div className="field">
              <label>Amount ($)</label>
              <input className="input" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="quick-amounts">
              {[50, 100, 500, 1000].map(v => <button key={v} onClick={() => setAmount(String(v))}>${v}</button>)}
            </div>
            <div className="field">
              <label>Method</label>
              <select className="select" value={method} onChange={e => setMethod(e.target.value)}>
                <option>Card •••• 4242</option>
                <option>Bank transfer (ACH)</option>
                <option>USDC on Base</option>
                <option>Apple Pay</option>
              </select>
            </div>
            {tab === 'withdraw' && (
              <div className="hint">
                Withdrawals require Tier 1 verification. Amounts over {fmtUsd(state.settings.withdrawalAutoApproveUnder, 0)} are reviewed by
                the finance team; your daily cap is {currentUser.kycTier >= 1 ? fmtUsd(state.settings.withdrawalDailyCap[currentUser.kycTier as 1 | 2], 0) : '—'}.
              </div>
            )}
            {error && <div style={{ color: 'var(--critical)', fontSize: 13 }}>{error}</div>}
            <button className="btn btn-primary btn-lg" onClick={doAction}>
              {tab === 'deposit' ? `Deposit ${fmtUsd(amt, 0)}` : `Withdraw ${fmtUsd(amt, 0)}`}
            </button>
            <div className="hint" style={{ textAlign: 'center' }}>Simulated — no real money moves in this prototype.</div>
          </div>

          <div className="card card-pad stack" style={{ gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Verification</div>
            <KycBadge user={currentUser} />
            {currentUser.kycTier < 2 && (
              <button className="btn btn-sm" onClick={() => { setKycReason(undefined); setKycOpen(true) }}>
                {currentUser.kycStatus === 'pending' ? 'View verification status' : `Upgrade to Tier ${currentUser.kycTier + 1}`}
              </button>
            )}
          </div>
        </div>
      </div>
      {kycOpen && <KycModal reason={kycReason} onClose={() => setKycOpen(false)} />}
    </main>
  )
}
