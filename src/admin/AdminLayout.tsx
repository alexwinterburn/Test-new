import { Link, NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Avatar, ThemeToggle, Toasts } from '../components/ui'

const Item = ({ to, icon, label, count }: { to: string; icon: string; label: string; count?: number }) => (
  <NavLink to={to} end={to === '/admin'} className={({ isActive }) => (isActive ? 'on' : '')}>
    <span aria-hidden="true">{icon}</span><span>{label}</span>
    {count ? <span className="pill-count">{count}</span> : null}
  </NavLink>
)

export const AdminLayout = () => {
  const { state, currentUser, signInAsAdmin } = useStore()

  if (!currentUser?.isAdmin) {
    return (
      <div className="shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="card card-pad" style={{ maxWidth: 420, margin: '12vh auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 34 }} aria-hidden="true">🛡️</div>
          <h2>Foresight Control Tower</h2>
          <p className="hint">
            This area is for platform operators: market lifecycle, KYC review, treasury, risk controls and audit.
            {currentUser ? ' Your account does not have operator access.' : ' Sign in with an operator account.'}
          </p>
          <button className="btn btn-primary btn-lg" onClick={signInAsAdmin}>Enter as demo admin (Foresight Ops)</button>
          <Link to="/" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>← Back to the exchange</Link>
        </div>
        <Toasts />
      </div>
    )
  }

  const kycPending = state.kycRequests.filter(r => r.status === 'pending').length
  const wdPending = state.txs.filter(t => t.type === 'withdrawal' && t.status === 'pending').length
  const propPending = state.proposals.filter(p => p.status === 'pending').length
  const complianceOpen = state.complianceAlerts.filter(a => a.status === 'open').length
  const ticketsOpen = state.tickets.filter(t => t.status === 'open').length
  const resolving = state.markets.filter(m => m.status === 'resolving' || m.status === 'disputed').length

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link to="/admin" className="logo"><span className="mark">◆</span><span>Control Tower</span></Link>
        <Item to="/admin" icon="📊" label="Dashboard" />
        <div className="grp">Markets</div>
        <Item to="/admin/markets" icon="🧭" label="All markets" count={resolving} />
        <Item to="/admin/markets/new" icon="✨" label="Create market" />
        <Item to="/admin/proposals" icon="💡" label="Proposals" count={propPending} />
        <div className="grp">Customers</div>
        <Item to="/admin/users" icon="👥" label="Users" />
        <Item to="/admin/kyc" icon="🪪" label="KYC queue" count={kycPending} />
        <Item to="/admin/support" icon="🎫" label="Support desk" count={ticketsOpen} />
        <div className="grp">Treasury & risk</div>
        <Item to="/admin/finance" icon="🏦" label="Finance" count={wdPending} />
        <Item to="/admin/liquidity" icon="💧" label="Liquidity desk" />
        <Item to="/admin/risk" icon="⚠️" label="Risk controls" />
        <Item to="/admin/compliance" icon="🛡️" label="Compliance" count={complianceOpen} />
        <div className="grp">Platform</div>
        <Item to="/admin/analytics" icon="📈" label="Analytics" />
        <Item to="/admin/api" icon="🔑" label="API & widgets" />
        <Item to="/admin/comms" icon="✉️" label="Comms & notifs" />
        <Item to="/admin/announce" icon="📣" label="Announcements" />
        <Item to="/admin/data" icon="🗄️" label="Data studio" />
        <Item to="/admin/flags" icon="🚩" label="Feature flags" />
        <Item to="/admin/audit" icon="📜" label="Audit log" />
        <div style={{ marginTop: 'auto', padding: '14px 11px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar user={currentUser} size={26} />
          <div style={{ fontSize: 12, lineHeight: 1.2, flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700 }}>{currentUser.name}</div>
            <div className="muted">operator</div>
          </div>
          <ThemeToggle />
        </div>
        <Link to="/" style={{ color: 'var(--accent)' }}>↩ <span>Exchange</span></Link>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
      <Toasts />
    </div>
  )
}
