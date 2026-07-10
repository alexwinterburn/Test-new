import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Avatar, KycBadge, ThemeToggle, Toasts } from '../components/ui'
import { AuthModal, KycModal } from '../components/auth'
import { NotificationsBell, SlipDrawer } from './extras'
import { fmtUsd } from '../lib/format'
import { levelForXp } from '../lib/gamification'

export const ClientLayout = () => {
  const { currentUser, signOut, state } = useStore()
  const [auth, setAuth] = useState<null | 'signin' | 'signup'>(null)
  const [kyc, setKyc] = useState(false)
  const [menu, setMenu] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  const nav = useNavigate()
  const ann = state.settings.announcement

  return (
    <div className="shell">
      {ann && (
        <div className={`banner banner-${ann.kind}`} role="status">
          <span aria-hidden="true">{ann.kind === 'critical' ? '🚨' : ann.kind === 'warning' ? '⚠️' : '📣'}</span>
          <span>{ann.text}</span>
        </div>
      )}
      <header className="topnav">
        <div className="topnav-inner">
          <Link to="/" className="logo"><span className="mark">◆</span>Foresight</Link>
          <nav className="nav-links">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'on' : '')}>Markets</NavLink>
            <NavLink to="/portfolio" className={({ isActive }) => (isActive ? 'on' : '')}>Portfolio</NavLink>
            {state.settings.featureFlags.leaderboard && (
              <NavLink to="/leaderboard" className={({ isActive }) => (isActive ? 'on' : '')}>Leaderboard</NavLink>
            )}
            {state.settings.featureFlags.lpProgram && (
              <NavLink to="/earn" className={({ isActive }) => (isActive ? 'on' : '')}>Earn</NavLink>
            )}
            <NavLink to="/wallet" className={({ isActive }) => (isActive ? 'on' : '')}>Wallet</NavLink>
            <NavLink to="/developers" className={({ isActive }) => (isActive ? 'on' : '')}>Developers</NavLink>
          </nav>
          <div className="nav-search">
            <span className="icon" aria-hidden="true">⌕</span>
            <input
              placeholder="Search markets…"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  nav('/?q=' + encodeURIComponent((e.target as HTMLInputElement).value))
                }
              }}
            />
          </div>
          <div className="nav-right">
            <button className="btn btn-ghost btn-sm" style={{ position: 'relative' }} onClick={() => setSlipOpen(o => !o)} aria-label="Combo slip">
              🧾{state.slip.length > 0 && <span className="bell-dot">{state.slip.length}</span>}
            </button>
            <NotificationsBell />
            <ThemeToggle />
            {currentUser ? (
              <>
                {state.settings.featureFlags.gamification && (
                  <Link to="/portfolio" className="badge badge-accent" title={`${currentUser.xp.toLocaleString()} XP · ${currentUser.loginStreak}-day streak`}>
                    <span className="dot" />Lv {levelForXp(currentUser.xp)}{currentUser.loginStreak >= 3 ? ` · 🔥${currentUser.loginStreak}` : ''}
                  </Link>
                )}
                <Link to="/wallet" className="balance-chip">
                  <span className="v mono">{fmtUsd(currentUser.balance)}</span>
                  <span className="l">Balance</span>
                </Link>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setMenu(m => !m)} aria-label="Account menu" style={{ display: 'flex' }}>
                    <Avatar user={currentUser} size={32} />
                  </button>
                  {menu && (
                    <div
                      className="card"
                      style={{ position: 'absolute', right: 0, top: 40, width: 240, padding: 12, boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 60 }}
                      onMouseLeave={() => setMenu(false)}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{currentUser.name}</div>
                        <div className="hint">{currentUser.email}</div>
                      </div>
                      <KycBadge user={currentUser} />
                      <button className="btn btn-sm" onClick={() => { setKyc(true); setMenu(false) }}>
                        {currentUser.kycTier < 2 ? 'Verify identity / raise limits' : 'Verification status'}
                      </button>
                      <Link to="/portfolio" className="btn btn-sm" onClick={() => setMenu(false)}>Portfolio</Link>
                      {currentUser.isAdmin && <Link to="/admin" className="btn btn-sm" onClick={() => setMenu(false)}>Admin console</Link>}
                      <button className="btn btn-sm btn-ghost" style={{ color: 'var(--critical)' }} onClick={() => { signOut(); setMenu(false) }}>Sign out</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => setAuth('signin')}>Sign in</button>
                <button className="btn btn-primary" onClick={() => setAuth('signup')}>Sign up</button>
              </>
            )}
          </div>
        </div>
      </header>

      <Outlet context={{ openAuth: () => setAuth('signup'), openKyc: () => setKyc(true) }} />

      <footer className="footer">
        <div className="footer-inner">
          <span><strong>Foresight</strong> — prediction markets prototype. All data is simulated demo data.</span>
          <span>Fee: {(state.settings.tradingFeeBps / 100).toFixed(2)}%</span>
          <Link to="/developers" style={{ color: 'var(--accent)' }}>Developers & API →</Link>
          <Link to="/admin" style={{ color: 'var(--accent)' }}>Admin console →</Link>
        </div>
      </footer>

      {auth && <AuthModal initialMode={auth} onClose={() => setAuth(null)} />}
      {kyc && <KycModal onClose={() => setKyc(false)} />}
      {slipOpen && <SlipDrawer onClose={() => setSlipOpen(false)} />}
      <Toasts />
    </div>
  )
}
