import { useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { KB, KB_CATEGORIES } from '../lib/kb'
import { fmtAgo, fmtDateTime } from '../lib/format'
import { Avatar, Empty, Tabs } from '../components/ui'
import type { SupportTicket, TicketPriority } from '../lib/types'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: 'Open — awaiting support', cls: 'badge-accent' },
  pending: { label: 'Support replied', cls: 'badge-warning' },
  solved: { label: 'Solved', cls: 'badge-good' },
  closed: { label: 'Closed', cls: '' },
}

export const Help = () => {
  const { state, currentUser, createTicket, replyTicket, userCloseTicket } = useStore()
  const { openAuth } = useOutletContext<{ openAuth: () => void }>()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [cat, setCat] = useState('All')
  const [openArticle, setOpenArticle] = useState<string | null>(params.get('article'))
  const [tab, setTab] = useState<'kb' | 'tickets'>('kb')
  const [openTicket, setOpenTicket] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  // new ticket form
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('Trading')
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [body, setBody] = useState('')

  const articles = useMemo(() => {
    let a = KB
    if (cat !== 'All') a = a.filter(x => x.category === cat)
    if (q.trim()) {
      const needle = q.toLowerCase()
      a = a.filter(x => (x.title + ' ' + x.body.join(' ')).toLowerCase().includes(needle))
    }
    return a
  }, [q, cat])

  const myTickets = currentUser ? state.tickets.filter(t => t.userId === currentUser.id) : []
  const selTicket = myTickets.find(t => t.id === openTicket)

  const submitTicket = () => {
    if (!currentUser) { openAuth(); return }
    createTicket(subject.trim(), category, priority, body.trim())
    setSubject(''); setBody(''); setTab('tickets')
  }

  return (
    <main className="page-inner">
      <div className="hero" style={{ marginBottom: 20 }}>
        <div>
          <h1>How can we help?</h1>
          <p>Search the knowledgebase — most answers are one click away. Still stuck? Log a ticket and our team replies here and by email.</p>
          <div className="nav-search" style={{ maxWidth: 460, marginTop: 12 }}>
            <span className="icon" aria-hidden="true">⌕</span>
            <input placeholder="Search articles… e.g. withdraw, 2FA, combo" value={q} onChange={e => setQ(e.target.value)} />
            {q && <button className="search-clear" onClick={() => setQ('')} aria-label="Clear search">✕</button>}
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><div className="v mono">{KB.length}</div><div className="l">Articles</div></div>
          <div className="hero-stat"><div className="v mono">&lt;4h</div><div className="l">Median first reply</div></div>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} options={[
        { value: 'kb', label: 'Knowledgebase' },
        { value: 'tickets', label: `My tickets (${myTickets.length})` },
      ]} />

      {tab === 'kb' ? (
        <div className="detail-grid" style={{ marginTop: 14 }}>
          <div className="stack">
            <div className="cat-row">
              {['All', ...KB_CATEGORIES].map(c => (
                <button key={c} className={'chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
            {articles.length ? articles.map(a => (
              <div key={a.id} className="card card-pad" style={{ cursor: 'pointer' }} onClick={() => setOpenArticle(openArticle === a.id ? null : a.id)}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <span className="badge" style={{ marginBottom: 6 }}>{a.category}</span>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                  </div>
                  <span className="muted" aria-hidden="true">{openArticle === a.id ? '▾' : '▸'}</span>
                </div>
                {openArticle === a.id && (
                  <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                    {a.body.map((par, i) => <p key={i} style={{ color: 'var(--ink-2)', fontSize: 13.5 }}>{par}</p>)}
                  </div>
                )}
              </div>
            )) : <Empty icon="🔍" text="No articles match" sub="Try different words, or log a ticket on the right." />}
          </div>

          <div className="trade-panel">
            <div className="card card-pad stack" style={{ gap: 10 }}>
              <div style={{ fontWeight: 700 }}>🎫 Log a support ticket</div>
              <div className="field">
                <label>Subject</label>
                <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="One line describing the issue" />
              </div>
              <div className="grid-2" style={{ gap: 10 }}>
                <div className="field">
                  <label>Category</label>
                  <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
                    {['Trading', 'Deposits', 'Withdrawals', 'Verification', 'Account & security', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Priority</label>
                  <select className="select" value={priority} onChange={e => setPriority(e.target.value as TicketPriority)}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent — funds at risk</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>What happened?</label>
                <textarea className="input" rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="Include market names, amounts, timestamps — the more detail the faster the fix." />
              </div>
              <button className="btn btn-primary btn-lg" disabled={subject.trim().length < 5 || body.trim().length < 10} onClick={submitTicket}>
                {currentUser ? 'Submit ticket' : 'Sign in to submit'}
              </button>
              <div className="hint">Tickets sync with our helpdesk (Zendesk) — replies land here and in your email.</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 14 }}>
          {!currentUser ? (
            <div className="card"><Empty icon="🎫" text="Sign in to see your tickets" /></div>
          ) : selTicket ? (
            <TicketThread
              ticket={selTicket}
              onBack={() => setOpenTicket(null)}
              reply={reply}
              setReply={setReply}
              onReply={() => { replyTicket(selTicket.id, reply.trim()); setReply('') }}
              onSolve={() => userCloseTicket(selTicket.id)}
            />
          ) : myTickets.length ? (
            myTickets.map(t => (
              <button key={t.id} className="card card-pad row" style={{ gap: 14, textAlign: 'left', width: '100%' }} onClick={() => setOpenTicket(t.id)}>
                <span className="mono muted">{t.ref}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{t.subject}</div>
                  <div className="hint">{t.category} · {t.messages.filter(mm => mm.from !== 'note').length} messages · updated {fmtAgo(t.updatedAt)}</div>
                </div>
                <span className={`badge ${STATUS_META[t.status].cls}`}><span className="dot" />{STATUS_META[t.status].label}</span>
              </button>
            ))
          ) : (
            <div className="card"><Empty icon="🎉" text="No tickets — nothing broken!" sub="Log one from the Knowledgebase tab if you need us." /></div>
          )}
        </div>
      )}
    </main>
  )
}

const TicketThread = ({ ticket, onBack, reply, setReply, onReply, onSolve }: {
  ticket: SupportTicket
  onBack: () => void
  reply: string
  setReply: (v: string) => void
  onReply: () => void
  onSolve: () => void
}) => {
  const { userById } = useStore()
  const visible = ticket.messages.filter(m => m.from !== 'note')
  return (
    <div className="card card-pad stack" style={{ gap: 12, maxWidth: 760 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-sm" onClick={onBack}>← All tickets</button>
        <span className={`badge ${STATUS_META[ticket.status].cls}`}><span className="dot" />{STATUS_META[ticket.status].label}</span>
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{ticket.subject}</div>
        <div className="hint">{ticket.ref} · {ticket.category} · opened {fmtDateTime(ticket.createdAt)}</div>
      </div>
      {visible.map(m => {
        const author = userById(m.authorId)
        const agent = m.from === 'agent'
        return (
          <div key={m.id} className="row" style={{ gap: 10, alignItems: 'flex-start', flexDirection: agent ? 'row-reverse' : 'row' }}>
            {author && <Avatar user={author} size={28} />}
            <div className="card card-pad" style={{ flex: 1, background: agent ? 'var(--accent-soft)' : 'var(--surface-2)', maxWidth: '85%' }}>
              <div className="hint" style={{ marginBottom: 4 }}>{agent ? 'Foresight Support' : 'You'} · {fmtAgo(m.at)}</div>
              <div style={{ fontSize: 13.5 }}>{m.text}</div>
            </div>
          </div>
        )
      })}
      {(ticket.status === 'open' || ticket.status === 'pending') && (
        <>
          <textarea className="input" rows={3} placeholder="Write a reply…" value={reply} onChange={e => setReply(e.target.value)} />
          <div className="row">
            <button className="btn btn-primary" disabled={reply.trim().length < 2} onClick={onReply}>Send reply</button>
            <button className="btn" onClick={onSolve}>✓ Mark as solved</button>
          </div>
        </>
      )}
    </div>
  )
}
