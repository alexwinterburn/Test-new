import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useStore } from '../lib/store'
import { fmtDateTime, fmtUsd } from '../lib/format'
import { Empty, KycBadge, Modal, Switch, Tabs } from '../components/ui'
import { KycModal } from '../components/auth'

const ASSETS = [
  { asset: 'USDC', network: 'Base', addr: '0xF0re51ghtBa5e', confs: 12, eta: '~10s' },
  { asset: 'USDC', network: 'Ethereum', addr: '0xF0re51ghtEth1', confs: 12, eta: '~3 min' },
  { asset: 'USDT', network: 'Tron', addr: 'TFore5ightTr0n', confs: 20, eta: '~1 min' },
  { asset: 'BTC', network: 'Bitcoin', addr: 'bc1qforesight0', confs: 3, eta: '~30 min' },
  { asset: 'ETH', network: 'Ethereum', addr: '0xF0re51ghtEth1', confs: 12, eta: '~3 min' },
  { asset: 'SOL', network: 'Solana', addr: 'FoRes1ghtSoL11', confs: 32, eta: '~15s' },
]

/** Fake per-user deposit address for the demo. */
const depositAddress = (tpl: string, userId: string) =>
  tpl + userId.replace(/[^a-z0-9]/gi, '').slice(-6).padEnd(6, '0')

export const Wallet = () => {
  const { state, currentUser, depositCrypto, confirmDeposit, withdraw, setSelfLimits, setNotificationPrefs, setTwoFactor, addAddress, removeAddress, toast } = useStore()
  const { openAuth } = useOutletContext<{ openAuth: () => void }>()
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('100')
  const [assetIdx, setAssetIdx] = useState(0)
  const [destAddr, setDestAddr] = useState('')
  const [pendingTxId, setPendingTxId] = useState<string | null>(null)
  const [kycOpen, setKycOpen] = useState(false)
  const [kycReason, setKycReason] = useState<string | undefined>()
  const [error, setError] = useState('')
  const [lossCap, setLossCap] = useState('')
  const [twoFaCode, setTwoFaCode] = useState('')
  const [twoFaModal, setTwoFaModal] = useState<null | 'enable' | 'disable'>(null)
  const [twoFaModalCode, setTwoFaModalCode] = useState('')
  const [addrLabel, setAddrLabel] = useState('')
  const [saveAddr, setSaveAddr] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) }, [])

  // the component stays mounted across sign-in/out — reset per-user UI state
  const userKey = currentUser?.id
  useEffect(() => {
    setTab('deposit'); setPendingTxId(null); setError(''); setDestAddr(''); setAmount('100'); setTwoFaCode(''); setTwoFaModal(null)
  }, [userKey])

  if (!currentUser) {
    return (
      <main className="page-inner">
        <Empty icon="💳" text="Sign in to manage your wallet" />
        <div style={{ textAlign: 'center' }}><button className="btn btn-primary" onClick={openAuth}>Sign up / sign in</button></div>
      </main>
    )
  }

  const sel = ASSETS[assetIdx]
  const txs = state.txs.filter(t => t.userId === currentUser.id && ['deposit', 'withdrawal', 'adjustment', 'settlement'].includes(t.type))
  const amt = parseFloat(amount) || 0
  const pendingTx = pendingTxId ? state.txs.find(t => t.id === pendingTxId && t.status === 'pending') : null

  const referrals = state.users.filter(u => u.referredBy === currentUser.referralCode)
  const converted = referrals.filter(u => u.referralRewardPaid)
  const flags = state.settings.featureFlags

  const simulateDeposit = () => {
    setError('')
    if (amt <= 0) { setError('Enter an amount.'); return }
    const id = depositCrypto(amt, sel.asset, sel.network)
    setPendingTxId(id)
    confirmTimer.current = setTimeout(() => { confirmDeposit(id); setPendingTxId(null) }, 2600)
  }

  const doWithdraw = () => {
    setError('')
    if (amt <= 0) { setError('Enter an amount.'); return }
    if (destAddr.trim().length < 8) { setError('Enter or select a destination address.'); return }
    const res = withdraw(amt, `${sel.asset} on ${sel.network} → ${destAddr.trim().slice(0, 10)}…`, twoFaCode || undefined)
    if (!res.ok) {
      if (res.needsKyc) { setKycReason(res.error); setKycOpen(true) }
      else setError(res.error ?? 'Withdrawal failed')
      return
    }
    if (saveAddr && !knownAddr) addAddress(addrLabel.trim() || 'My wallet', destAddr.trim(), sel.asset, sel.network)
    setTwoFaCode(''); setSaveAddr(false); setAddrLabel('')
  }
  const knownAddr = currentUser.security.addressBook.some(a => a.address === destAddr.trim() && destAddr.trim().length >= 8)

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
                        <td className="muted">
                          {t.note}
                          {t.txHash && <span className="mono"> · {t.txHash}</span>}
                          {t.status === 'pending' && t.confirmationsNeeded ? ` · ${t.confirmations ?? 0}/${t.confirmationsNeeded} confs` : ''}
                        </td>
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

          {flags.referrals && (
            <div className="card card-pad stack" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700 }}>🎁 Refer & earn</div>
                <span className="badge badge-accent"><span className="dot" />{fmtUsd(state.settings.referralReward, 0)} per friend</span>
              </div>
              <p className="hint">
                Share your code. When a friend signs up and makes their first deposit of {fmtUsd(state.settings.referralMinDeposit, 0)}+,
                you get {fmtUsd(state.settings.referralReward, 0)} credited instantly.
              </p>
              <div className="row">
                <code style={{ background: 'var(--surface-2)', padding: '8px 14px', borderRadius: 8, fontWeight: 800, letterSpacing: '0.08em' }}>
                  {currentUser.referralCode}
                </code>
                <button
                  className="btn btn-sm"
                  onClick={() => { navigator.clipboard?.writeText(`https://foresight.demo/join?ref=${currentUser.referralCode}`); toast('success', 'Referral link copied') }}
                >
                  Copy invite link
                </button>
              </div>
              <div className="row" style={{ gap: 24 }}>
                <span><strong className="mono">{referrals.length}</strong> <span className="hint">invited</span></span>
                <span><strong className="mono">{converted.length}</strong> <span className="hint">converted</span></span>
                <span><strong className="mono up">{fmtUsd(converted.length * state.settings.referralReward, 0)}</strong> <span className="hint">earned</span></span>
              </div>
            </div>
          )}

          <div className="card card-pad stack" style={{ gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Notifications</div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>Email — price alerts, settlements, withdrawals</span>
              <Switch checked={currentUser.notificationPrefs.email} onChange={v => setNotificationPrefs({ ...currentUser.notificationPrefs, email: v })} label="email notifications" />
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>Push — instant alert delivery to your devices</span>
              <Switch checked={currentUser.notificationPrefs.push} onChange={v => setNotificationPrefs({ ...currentUser.notificationPrefs, push: v })} label="push notifications" />
            </div>
            <div className="hint">Delivery is simulated in this prototype; alerts always appear in the in-app bell.</div>
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
              <label>Asset & network</label>
              <select className="select" value={assetIdx} onChange={e => setAssetIdx(parseInt(e.target.value))}>
                {ASSETS.map((a, i) => <option key={i} value={i}>{a.asset} · {a.network}</option>)}
              </select>
            </div>

            {tab === 'deposit' ? (
              <>
                <div className="field">
                  <label>Your {sel.asset} deposit address ({sel.network})</label>
                  <div className="row">
                    <code style={{ background: 'var(--surface-2)', padding: '8px 10px', borderRadius: 8, fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {depositAddress(sel.addr, currentUser.id)}
                    </code>
                    <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(depositAddress(sel.addr, currentUser.id)); toast('success', 'Address copied') }}>Copy</button>
                  </div>
                  <span className="hint">Credited after {sel.confs} confirmations ({sel.eta}). Send only {sel.asset} on {sel.network}.</span>
                </div>
                <div className="field">
                  <label>Amount (USD value)</label>
                  <input className="input" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className="quick-amounts">
                  {[50, 100, 500, 1000].map(v => <button key={v} onClick={() => setAmount(String(v))}>${v}</button>)}
                </div>
                {error && <div style={{ color: 'var(--critical)', fontSize: 13 }}>{error}</div>}
                {pendingTx ? (
                  <div className="card card-pad" style={{ background: 'var(--surface-2)', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>⛓️ Confirming on {sel.network}…</div>
                    <div className="progress" style={{ margin: '10px 0 6px' }}><i className="indet" style={{ width: '60%' }} /></div>
                    <div className="hint">{fmtUsd(pendingTx.amount)} · waiting for {pendingTx.confirmationsNeeded} confirmations</div>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-lg" onClick={simulateDeposit}>
                    Simulate incoming {sel.asset} deposit
                  </button>
                )}
                <div className="hint" style={{ textAlign: 'center' }}>
                  Demo-only: in production this address is watched by the custody service and credits automatically.
                </div>
              </>
            ) : (
              <>
                {currentUser.security.addressBook.length > 0 && (
                  <div className="field">
                    <label>Saved addresses</label>
                    <select className="select" value={knownAddr ? destAddr : ''} onChange={e => setDestAddr(e.target.value)}>
                      <option value="">— paste a new address —</option>
                      {currentUser.security.addressBook.map(a => (
                        <option key={a.id} value={a.address}>{a.label} · {a.asset} ({a.network}) · {a.address}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label>Destination address</label>
                  <input className="input" placeholder={sel.network === 'Bitcoin' ? 'bc1q…' : '0x…'} value={destAddr} onChange={e => setDestAddr(e.target.value)} />
                </div>
                {destAddr.trim().length >= 8 && !knownAddr && (
                  <>
                    <div className="badge badge-warning" style={{ textTransform: 'none' }}><span className="dot" />New address — double-check it. Transfers are irreversible.</div>
                    <label className="row" style={{ gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={saveAddr} onChange={e => setSaveAddr(e.target.checked)} />
                      Save to address book as
                      <input className="input" style={{ width: 130, padding: '4px 8px' }} placeholder="label" value={addrLabel} onChange={e => setAddrLabel(e.target.value)} onClick={e => e.stopPropagation()} />
                    </label>
                  </>
                )}
                <div className="field">
                  <label>Amount ($)</label>
                  <input className="input" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className="hint">
                  Withdrawals require Tier 1 verification. Amounts over {fmtUsd(state.settings.withdrawalAutoApproveUnder, 0)} are reviewed by
                  the finance team; your daily cap is {currentUser.kycTier >= 1 ? fmtUsd(state.settings.withdrawalDailyCap[currentUser.kycTier as 1 | 2], 0) : '—'}.
                  Network fee is paid by the platform.
                </div>
                {currentUser.security.twoFactorEnabled && (
                  <div className="field">
                    <label>🔐 Authenticator code (2FA)</label>
                    <input className="input" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={twoFaCode} onChange={e => setTwoFaCode(e.target.value.replace(/[^0-9]/g, ''))} />
                    <span className="hint">Required for every withdrawal. Demo: any 6 digits — production verifies TOTP (RFC 6238).</span>
                  </div>
                )}
                {error && <div style={{ color: 'var(--critical)', fontSize: 13 }}>{error}</div>}
                <button className="btn btn-primary btn-lg" onClick={doWithdraw}>
                  Withdraw {fmtUsd(amt, 0)} in {sel.asset}
                </button>
              </>
            )}
          </div>

          <div className="card card-pad stack" style={{ gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>🔐 Security</div>
              {currentUser.security.twoFactorEnabled
                ? <span className="badge badge-good"><span className="dot" />2FA on</span>
                : <span className="badge badge-warning"><span className="dot" />2FA off</span>}
            </div>
            <button className="btn btn-sm" onClick={() => { setTwoFaModal(currentUser.security.twoFactorEnabled ? 'disable' : 'enable'); setTwoFaModalCode('') }}>
              {currentUser.security.twoFactorEnabled ? 'Disable two-factor authentication' : 'Enable two-factor authentication'}
            </button>
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>Address book</div>
            {currentUser.security.addressBook.length ? currentUser.security.addressBook.map(a => (
              <div key={a.id} className="row" style={{ fontSize: 12.5, justifyContent: 'space-between' }}>
                <span><strong>{a.label}</strong> <span className="muted">· {a.asset} ({a.network})</span><br /><code style={{ fontSize: 11 }}>{a.address}</code></span>
                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--critical)' }} onClick={() => removeAddress(a.id)} aria-label={`Remove ${a.label}`}>✕</button>
              </div>
            )) : <span className="hint">No saved addresses yet — save one during your next withdrawal.</span>}
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
      {twoFaModal && (
        <Modal title={twoFaModal === 'enable' ? 'Enable two-factor authentication' : 'Disable two-factor authentication'} onClose={() => setTwoFaModal(null)}>
          {twoFaModal === 'enable' ? (
            <>
              <p className="hint">
                Scan this secret with Google Authenticator, Authy or 1Password, then enter the 6-digit code it shows.
                Once enabled, every withdrawal requires a fresh code.
              </p>
              <div className="card card-pad" style={{ textAlign: 'center', background: 'var(--surface-2)' }}>
                <div style={{ fontSize: 40, letterSpacing: 2 }} aria-hidden="true">▦</div>
                <code style={{ fontWeight: 800, letterSpacing: '0.15em' }}>FRST-2K9L-XM4P-QW7Z</code>
                <div className="hint" style={{ marginTop: 4 }}>(simulated QR / secret — production issues a real TOTP seed)</div>
              </div>
            </>
          ) : (
            <p className="hint">Enter a current authenticator code to confirm turning 2FA off. Withdrawals will no longer require a code — not recommended.</p>
          )}
          <div className="field">
            <label>6-digit code</label>
            <input className="input" inputMode="numeric" maxLength={6} placeholder="123456" value={twoFaModalCode} onChange={e => setTwoFaModalCode(e.target.value.replace(/[^0-9]/g, ''))} autoFocus />
            <span className="hint">Demo accepts any 6 digits.</span>
          </div>
          <button
            className={'btn btn-lg ' + (twoFaModal === 'enable' ? 'btn-primary' : 'btn-danger')}
            disabled={twoFaModalCode.length !== 6}
            onClick={() => { const r = setTwoFactor(twoFaModal === 'enable', twoFaModalCode); if (r.ok) setTwoFaModal(null) }}
          >
            {twoFaModal === 'enable' ? 'Verify & enable 2FA' : 'Disable 2FA'}
          </button>
        </Modal>
      )}
    </main>
  )
}
