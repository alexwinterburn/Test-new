import { useState } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import type { MarketStatus, User } from '../lib/types'

export const Modal = ({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) => (
  <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className={'modal' + (wide ? ' modal-wide' : '')} role="dialog" aria-label={title}>
      <div className="modal-head">
        <h3>{title}</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
)

export const Toasts = () => {
  const { toasts, dismissToast } = useStore()
  if (!toasts.length) return null
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>
          <span aria-hidden="true">{t.kind === 'success' ? '✅' : t.kind === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

export const Avatar = ({ user, size = 28 }: { user: Pick<User, 'name' | 'avatarHue'>; size?: number }) => (
  <span
    className="avatar"
    style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${user.avatarHue} 45% 45%)` }}
    aria-hidden="true"
  >
    {user.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
  </span>
)

const statusMeta: Record<MarketStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: '' },
  active: { label: 'Active', cls: 'badge-good' },
  halted: { label: 'Halted', cls: 'badge-serious' },
  closed: { label: 'Closed', cls: 'badge-warning' },
  resolving: { label: 'Resolving', cls: 'badge-accent' },
  disputed: { label: 'Disputed', cls: 'badge-critical' },
  resolved: { label: 'Resolved', cls: '' },
}

export const StatusBadge = ({ status }: { status: MarketStatus }) => {
  const m = statusMeta[status]
  return <span className={`badge ${m.cls}`}><span className="dot" />{m.label}</span>
}

export const KycBadge = ({ user }: { user: User }) => {
  if (user.kycStatus === 'pending') return <span className="badge badge-warning"><span className="dot" />KYC pending</span>
  if (user.kycStatus === 'rejected') return <span className="badge badge-critical"><span className="dot" />KYC rejected</span>
  if (user.kycTier === 0) return <span className="badge"><span className="dot" />Tier 0 · Unverified</span>
  return <span className="badge badge-good"><span className="dot" />Tier {user.kycTier} · Verified</span>
}

export const Tabs = <T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) => (
  <div className="tabs" role="tablist">
    {options.map(o => (
      <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
)

export const Empty = ({ icon, text, sub }: { icon: string; text: string; sub?: string }) => (
  <div className="empty">
    <div className="big" aria-hidden="true">{icon}</div>
    <div style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{text}</div>
    {sub && <div className="hint" style={{ marginTop: 4 }}>{sub}</div>}
  </div>
)

export const Switch = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) => (
  <span className="switch">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={label ?? 'toggle'} />
    <span className="track" />
  </span>
)

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (document.documentElement.dataset.theme as 'light' | 'dark') || 'dark',
  )
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem('foresight-theme', next)
    setTheme(next)
  }
  return (
    <button className="btn btn-ghost btn-sm" onClick={toggle} title="Toggle light/dark theme" aria-label="Toggle theme">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
