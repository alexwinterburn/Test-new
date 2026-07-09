import { useState } from 'react'
import { useStore } from '../lib/store'
import { Modal } from './ui'
import { fmtUsd } from '../lib/format'
import type { KycTier } from '../lib/types'

// ---------------------------------------------------------------------------
// Sign in / sign up — deliberately frictionless: email only, no KYC up front.
// ---------------------------------------------------------------------------
export const AuthModal = ({ onClose, initialMode = 'signup' }: { onClose: () => void; initialMode?: 'signin' | 'signup' }) => {
  const { signIn, signUp } = useStore()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    setError('')
    if (!/.+@.+\..+/.test(email)) { setError('Enter a valid email address.'); return }
    if (mode === 'signup' && name.trim().length < 2) { setError('Enter your name.'); return }
    const res = mode === 'signin' ? signIn(email) : signUp(email, name.trim())
    if (!res.ok) { setError(res.error ?? 'Something went wrong'); return }
    onClose()
  }

  return (
    <Modal title={mode === 'signup' ? 'Create your account' : 'Welcome back'} onClose={onClose}>
      <p className="hint">
        {mode === 'signup'
          ? 'Just an email to get started — trade instantly with your welcome credit. Identity verification is only needed later, for higher limits or withdrawals.'
          : 'Demo accounts: alex.winterburn@gmail.com (trader) · dana@example.com (verified pro)'}
      </p>
      {mode === 'signup' && (
        <div className="field">
          <label>Full name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ada Lovelace" autoFocus />
        </div>
      )}
      <div className="field">
        <label>Email</label>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={e => e.key === 'Enter' && submit()} />
      </div>
      {error && <div style={{ color: 'var(--critical)', fontSize: 13 }}>{error}</div>}
      <button className="btn btn-primary btn-lg" onClick={submit}>
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>
      <div className="hint" style={{ textAlign: 'center' }}>
        {mode === 'signup' ? (
          <>Already have an account? <button style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={() => setMode('signin')}>Sign in</button></>
        ) : (
          <>New here? <button style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={() => setMode('signup')}>Create an account</button></>
        )}
      </div>
      <div className="hint" style={{ textAlign: 'center' }}>
        Prototype only — no real emails, passwords, or funds. In production this is a passkey / magic-link flow.
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// KYC — progressive tiers, requested only when a limit is actually hit.
// ---------------------------------------------------------------------------
const TIERS: { tier: KycTier; name: string; needs: string; unlocks: string }[] = [
  { tier: 0, name: 'Explorer', needs: 'Email only', unlocks: 'Browse & trade up to the starter cap' },
  { tier: 1, name: 'Verified', needs: 'Government ID + selfie', unlocks: 'Higher position caps & withdrawals' },
  { tier: 2, name: 'Pro', needs: 'Proof of address + source of funds', unlocks: 'Unlimited positions, high withdrawal caps' },
]

export const KycModal = ({ onClose, reason }: { onClose: () => void; reason?: string }) => {
  const { currentUser, submitKyc, state } = useStore()
  const [docType, setDocType] = useState('Passport')
  const [country, setCountry] = useState(currentUser?.country ?? 'US')
  const [uploaded, setUploaded] = useState(false)
  if (!currentUser) return null

  const targetTier = Math.min(2, currentUser.kycTier + 1) as KycTier
  const caps = state.settings.tierTradeCaps
  const capLabel = (t: KycTier) => (caps[t] >= 1e12 ? 'Unlimited' : fmtUsd(caps[t], 0))
  const pending = currentUser.kycStatus === 'pending'

  return (
    <Modal title="Verify your identity" onClose={onClose}>
      {reason && (
        <div className="card card-pad" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', fontSize: 13 }}>
          {reason}
        </div>
      )}
      <div className="stack" style={{ gap: 8 }}>
        {TIERS.map(t => (
          <div key={t.tier} className={'kyc-tier-card' + (t.tier === currentUser.kycTier ? ' current' : '')}>
            <span className="tno">{t.tier}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>
                {t.name}
                {t.tier === currentUser.kycTier && <span className="hint"> — your tier</span>}
              </div>
              <div className="hint">{t.needs} · {t.unlocks}</div>
            </div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{capLabel(t.tier)}</div>
          </div>
        ))}
      </div>

      {pending ? (
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>Verification under review</div>
          <div className="hint" style={{ marginTop: 4 }}>
            Your Tier upgrade is being reviewed by the compliance team. In this demo, approve it from Admin → KYC queue.
          </div>
        </div>
      ) : currentUser.kycTier >= 2 ? (
        <div className="hint" style={{ textAlign: 'center' }}>You're fully verified — no further steps needed.</div>
      ) : (
        <>
          <div className="grid-2">
            <div className="field">
              <label>Document type</label>
              <select className="select" value={docType} onChange={e => setDocType(e.target.value)}>
                <option>Passport</option>
                <option>Driver license</option>
                <option>National ID</option>
              </select>
            </div>
            <div className="field">
              <label>Country</label>
              <select className="select" value={country} onChange={e => setCountry(e.target.value)}>
                {['US', 'GB', 'DE', 'FR', 'SG', 'IN', 'NG', 'BR', 'JP', 'AU'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button
            className="btn"
            style={{ borderStyle: 'dashed', padding: 18, justifyContent: 'center' }}
            onClick={() => setUploaded(true)}
          >
            {uploaded ? '✅ document.jpg attached (simulated)' : '📄 Upload document photo (simulated)'}
          </button>
          <button
            className="btn btn-primary btn-lg"
            disabled={!uploaded}
            onClick={() => { submitKyc(targetTier, docType, country); onClose() }}
          >
            Submit for Tier {targetTier} verification
          </button>
          <div className="hint" style={{ textAlign: 'center' }}>
            In production this hands off to an IDV provider (Persona / Onfido / Sumsub) with liveness checks and sanctions screening.
          </div>
        </>
      )}
    </Modal>
  )
}
