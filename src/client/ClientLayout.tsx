import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { KB } from '../lib/kb'
import { price } from '../lib/engine'
import { fmtPct } from '../lib/format'
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
          <GlobalSearch />
          <div className="nav-right">
            <Link to="/help" className="btn btn-ghost btn-sm" aria-label="Help centre" title="Help & support">❓ Help</Link>
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
          <Link to="/help" style={{ color: 'var(--accent)' }}>Help & support →</Link>
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

// ---------------------------------------------------------------------------
// Global search: markets, help articles, pages, own tickets — with clear (✕).
// ---------------------------------------------------------------------------
const PAGES = [
  { label: 'Portfolio', to: '/portfolio', icon: '📊' },
  { label: 'Wallet — deposits & withdrawals', to: '/wallet', icon: '💳' },
  { label: 'Earn — provide liquidity', to: '/earn', icon: '💧' },
  { label: 'Leaderboard', to: '/leaderboard', icon: '🏆' },
  { label: 'Developers & API', to: '/developers', icon: '🛠️' },
  { label: 'Help & support', to: '/help', icon: '❓' },
]

const GlobalSearch = () => {
  const { state, currentUser } = useStore()
  const nav = useNavigate()
  const loc = useLocation()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  // stay in sync with the ?q= param so the box never gets "stuck"
  useEffect(() => {
    const urlQ = new URLSearchParams(loc.search).get('q') ?? ''
    if (loc.pathname === '/' && urlQ) setQ(urlQ)
  }, [loc])

  const clear = () => {
    setQ('')
    setOpen(false)
    if (new URLSearchParams(loc.search).get('q')) nav('/')
  }

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (needle.length < 2) return null
    const markets = state.markets
      .filter(m => m.status !== 'draft' && (m.question + ' ' + m.category + ' ' + m.tags.join(' ') + ' ' + m.outcomes.map(o => o.label).join(' ')).toLowerCase().includes(needle))
      .slice(0, 5)
    const articles = KB.filter(a => (a.title + ' ' + a.body.join(' ')).toLowerCase().includes(needle)).slice(0, 3)
    const pages = PAGES.filter(pg => pg.label.toLowerCase().includes(needle)).slice(0, 3)
    const tickets = currentUser ? state.tickets.filter(t => t.userId === currentUser.id && (t.subject + ' ' + t.ref).toLowerCase().includes(needle)).slice(0, 2) : []
    return { markets, articles, pages, tickets, any: markets.length + articles.length + pages.length + tickets.length > 0 }
  }, [q, state.markets, state.tickets, currentUser])

  return (
    <div className="nav-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false) }}>
      <span className="icon" aria-hidden="true">⌕</span>
      <input
        placeholder="Search everything…"
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter') { nav('/?q=' + encodeURIComponent(q)); setOpen(false) }
          if (e.key === 'Escape') clear()
        }}
        aria-label="Global search"
      />
      {q && <button className="search-clear" onMouseDown={e => e.preventDefault()} onClick={clear} aria-label="Clear search">✕</button>}
      {open && results && (
        <div className="search-pop">
          {!results.any && <div className="grp-label" style={{ padding: 14 }}>No matches for “{q}” — press Enter to search markets anyway.</div>}
          {results.markets.length > 0 && <div className="grp-label">Markets</div>}
          {results.markets.map(m => (
            <Link key={m.id} to={`/market/${m.id}`} onClick={clear}>
              <span aria-hidden="true">{m.icon}</span>
              <span style={{ flex: 1 }}>{m.question.slice(0, 55)}{m.question.length > 55 ? '…' : ''}</span>
              <strong style={{ color: 'var(--series-1)' }}>{m.type === 'multi' ? m.outcomes.length + ' outcomes' : fmtPct(price(m.outcomes[0]))}</strong>
            </Link>
          ))}
          {results.articles.length > 0 && <div className="grp-label">Help articles</div>}
          {results.articles.map(a => (
            <Link key={a.id} to={`/help?article=${a.id}`} onClick={clear}>
              <span aria-hidden="true">📖</span>
              <span style={{ flex: 1 }}>{a.title}</span>
              <span className="muted" style={{ fontSize: 11 }}>{a.category}</span>
            </Link>
          ))}
          {results.pages.length > 0 && <div className="grp-label">Pages</div>}
          {results.pages.map(pg => (
            <Link key={pg.to} to={pg.to} onClick={clear}>
              <span aria-hidden="true">{pg.icon}</span>
              <span>{pg.label}</span>
            </Link>
          ))}
          {results.tickets.length > 0 && <div className="grp-label">My support tickets</div>}
          {results.tickets.map(t => (
            <Link key={t.id} to="/help" onClick={clear}>
              <span aria-hidden="true">🎫</span>
              <span style={{ flex: 1 }}>{t.subject}</span>
              <span className="muted" style={{ fontSize: 11 }}>{t.ref} · {t.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
