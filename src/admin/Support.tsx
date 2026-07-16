import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Avatar, Empty, Switch, Tabs } from '../components/ui'
import { fmtAgo, fmtDateTime } from '../lib/format'
import type { TicketPriority, TicketStatus } from '../lib/types'

const PRIORITY_CLS: Record<TicketPriority, string> = { low: '', normal: 'badge-accent', high: 'badge-serious', urgent: 'badge-critical' }
const STATUS_CLS: Record<TicketStatus, string> = { open: 'badge-critical', pending: 'badge-warning', solved: 'badge-good', closed: '' }
const FILTERS = ['all', 'open', 'pending', 'solved', 'closed'] as const

export const AdminSupport = () => {
  const { state, userById, adminReplyTicket, adminSetTicketStatus, adminSetTicketPriority, adminAssignTicket, adminUpdateSettings } = useStore()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [sel, setSel] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const zd = state.settings.zendesk

  const tickets = useMemo(() => {
    const order: Record<TicketStatus, number> = { open: 0, pending: 1, solved: 2, closed: 3 }
    const prio: Record<TicketPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
    let ts = [...state.tickets].sort((a, b) => order[a.status] - order[b.status] || prio[a.priority] - prio[b.priority] || b.updatedAt - a.updatedAt)
    if (filter !== 'all') ts = ts.filter(t => t.status === filter)
    return ts
  }, [state.tickets, filter])

  const ticket = state.tickets.find(t => t.id === sel)
  const open = state.tickets.filter(t => t.status === 'open')
  const agents = state.users.filter(u => u.isAdmin)
  const firstReplyMedian = '3.2h' // demo stat

  if (ticket) {
    const customer = userById(ticket.userId)
    return (
      <>
        <div className="admin-head">
          <button className="btn btn-sm" onClick={() => setSel(null)}>← Queue</button>
          <h1 style={{ fontSize: 17 }}>{ticket.ref} — {ticket.subject}</h1>
          <div className="right row">
            <select className="select" style={{ width: 120 }} value={ticket.priority} onChange={e => adminSetTicketPriority(ticket.id, e.target.value as TicketPriority)}>
              {(['low', 'normal', 'high', 'urgent'] as const).map(pp => <option key={pp} value={pp}>{pp}</option>)}
            </select>
            <select className="select" style={{ width: 130 }} value={ticket.status} onChange={e => adminSetTicketStatus(ticket.id, e.target.value as TicketStatus)}>
              {(['open', 'pending', 'solved', 'closed'] as const).map(ss => <option key={ss} value={ss}>{ss}</option>)}
            </select>
            <select className="select" style={{ width: 150 }} value={ticket.assignee ?? ''} onChange={e => adminAssignTicket(ticket.id, e.target.value || null)}>
              <option value="">Unassigned</option>
              {agents.map(a => <option key={a.id} value={a.id}>@{a.handle}</option>)}
            </select>
          </div>
        </div>

        <div className="detail-grid">
          <div className="stack">
            {ticket.messages.map(m => {
              const author = userById(m.authorId)
              const kind = m.from
              return (
                <div key={m.id} className="card card-pad" style={{
                  background: kind === 'note' ? 'rgba(250, 178, 25, 0.08)' : kind === 'agent' ? 'var(--accent-soft)' : 'var(--surface-1)',
                  borderColor: kind === 'note' ? 'var(--warning)' : undefined,
                }}>
                  <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                    {author && <Avatar user={author} size={22} />}
                    <strong style={{ fontSize: 13 }}>{kind === 'note' ? '🔒 Internal note' : kind === 'agent' ? `Agent @${author?.handle}` : `${customer?.name} (customer)`}</strong>
                    <span className="hint" style={{ marginLeft: 'auto' }}>{fmtDateTime(m.at)}</span>
                  </div>
                  <div style={{ fontSize: 13.5 }}>{m.text}</div>
                </div>
              )
            })}
            <div className="card card-pad stack" style={{ gap: 8 }}>
              <textarea className="input" rows={3} placeholder={internal ? 'Internal note — customer never sees this…' : 'Reply to the customer…'} value={reply} onChange={e => setReply(e.target.value)} />
              <div className="row">
                <button className="btn btn-primary" disabled={reply.trim().length < 2} onClick={() => { adminReplyTicket(ticket.id, reply.trim(), internal); setReply('') }}>
                  {internal ? 'Add internal note' : 'Send reply'}
                </button>
                <label className="row" style={{ gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} /> Internal note
                </label>
                <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => adminSetTicketStatus(ticket.id, 'solved')}>✓ Solve</button>
              </div>
            </div>
          </div>

          <div className="stack">
            {customer && (
              <div className="card card-pad stack" style={{ gap: 8 }}>
                <div className="row" style={{ gap: 10 }}>
                  <Avatar user={customer} size={36} />
                  <div>
                    <Link to={`/admin/users/${customer.id}`} style={{ fontWeight: 800, color: 'var(--accent)' }}>{customer.name}</Link>
                    <div className="hint">@{customer.handle} · {customer.email}</div>
                  </div>
                </div>
                <div className="hint">
                  Tier {customer.kycTier} · balance ${customer.balance.toFixed(0)} · {customer.suspended ? '🚫 suspended' : 'active'} ·
                  {customer.security.twoFactorEnabled ? ' 2FA on' : ' 2FA off'}
                </div>
                <Link to={`/admin/users/${customer.id}`} className="btn btn-sm">Open customer 360 →</Link>
              </div>
            )}
            <div className="card card-pad stack" style={{ gap: 6, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>Ticket</div>
              <div className="hint">Source: {ticket.source}{ticket.zendeskId ? ` · Zendesk #${ticket.zendeskId}` : ''}</div>
              <div className="hint">Opened {fmtDateTime(ticket.createdAt)} · updated {fmtAgo(ticket.updatedAt)}</div>
              <div className="hint">Category: {ticket.category}</div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="admin-head">
        <h1>Support desk</h1>
        <span className="hint">Web, email and Zendesk tickets in one queue. Urgent first.</span>
      </div>

      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <div className="card kpi"><div className="l">Open</div><div className="v mono" style={open.length ? { color: 'var(--critical)' } : undefined}>{open.length}</div></div>
        <div className="card kpi"><div className="l">Awaiting customer</div><div className="v mono">{state.tickets.filter(t => t.status === 'pending').length}</div></div>
        <div className="card kpi"><div className="l">Solved (all time)</div><div className="v mono">{state.tickets.filter(t => t.status === 'solved' || t.status === 'closed').length}</div></div>
        <div className="card kpi"><div className="l">Median first reply</div><div className="v mono">{firstReplyMedian}</div></div>
      </div>

      <Tabs value={filter} onChange={setFilter} options={FILTERS.map(f => ({ value: f, label: f[0].toUpperCase() + f.slice(1) }))} />

      <div className="card" style={{ marginTop: 12 }}>
        {tickets.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Ref</th><th>Subject</th><th>Customer</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Source</th><th className="num">Updated</th></tr></thead>
              <tbody>
                {tickets.map(t => {
                  const u = userById(t.userId)
                  return (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSel(t.id)}>
                      <td className="mono muted">{t.ref}</td>
                      <td style={{ fontWeight: 650 }}>{t.subject.slice(0, 46)}{t.subject.length > 46 ? '…' : ''}</td>
                      <td>{u ? <span className="row" style={{ gap: 6 }}><Avatar user={u} size={22} />@{u.handle}</span> : t.userId}</td>
                      <td><span className={`badge ${PRIORITY_CLS[t.priority]}`}><span className="dot" />{t.priority}</span></td>
                      <td><span className={`badge ${STATUS_CLS[t.status]}`}><span className="dot" />{t.status}</span></td>
                      <td className="muted">{t.assignee ? '@' + userById(t.assignee)?.handle : '—'}</td>
                      <td className="muted">{t.source}{t.zendeskId ? ` #${t.zendeskId}` : ''}</td>
                      <td className="num muted">{fmtAgo(t.updatedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty icon="🎉" text="Queue is clear" />}
      </div>

      <div className="card card-pad" style={{ marginTop: 14, maxWidth: 720 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Zendesk integration</div>
            <div className="hint">
              {zd.connected ? `Connected to ${zd.subdomain}.zendesk.com · last sync ${zd.lastSyncAt ? fmtAgo(zd.lastSyncAt) : 'never'}` : 'Not connected'}
              {' '}— tickets created there appear in this queue with their Zendesk number; replies sync both ways.
            </div>
          </div>
          <div className="row">
            <span className={zd.connected ? 'badge badge-good' : 'badge badge-critical'}><span className="dot" />{zd.connected ? 'Connected' : 'Off'}</span>
            <Switch checked={zd.syncEnabled} onChange={v => adminUpdateSettings({ zendesk: { ...zd, syncEnabled: v, lastSyncAt: v ? Date.now() : zd.lastSyncAt } })} label="zendesk sync" />
          </div>
        </div>
      </div>
    </>
  )
}
