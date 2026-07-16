import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Avatar, Empty, Switch } from '../components/ui'
import { fmtAgo } from '../lib/format'

// ---------------------------------------------------------------------------
// Comms: autonomous notification engine controls + manual blasts + log
// ---------------------------------------------------------------------------
export const AdminComms = () => {
  const { state, adminUpdateSettings, adminSendNotification, runNotificationEngine, adminSendTestEmail, userById } = useStore()
  const an = state.settings.autoNotify
  const em = state.settings.email
  const [fromAddr, setFromAddr] = useState(em.fromAddress)
  const [apiKey, setApiKey] = useState('')
  const [testTo, setTestTo] = useState('')
  const [inactivity, setInactivity] = useState(String(an.inactivityDays))
  const [movePts, setMovePts] = useState(String(an.moveThresholdPts))
  const [target, setTarget] = useState('all')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')

  const set = (patch: Partial<typeof an>) => adminUpdateSettings({ autoNotify: { ...an, ...patch } })

  const RULES: { key: keyof typeof an & string; label: string; desc: string }[] = [
    { key: 'kycReminders', label: 'KYC reminders', desc: 'Nudge Tier-0 users holding a balance to verify — removes the biggest conversion cliff.' },
    { key: 'tradeReminders', label: 'Trade-inactivity nudges', desc: `Remind users who haven't traded in ${an.inactivityDays} days that markets moved.` },
    { key: 'watchlistMovers', label: 'Watchlist movers', desc: `Alert users when a starred market moves ≥ ${an.moveThresholdPts}pts in 24h.` },
    { key: 'closingSoon', label: 'Closing-soon warnings', desc: 'Warn holders 48h before a market they have a position in stops trading.' },
  ]

  return (
    <>
      <div className="admin-head">
        <h1>Comms & notifications</h1>
        <div className="right">
          <button className="btn" onClick={runNotificationEngine}>⚙️ Run engine now</button>
        </div>
      </div>

      <div className="stack" style={{ maxWidth: 860 }}>
        <div className="card card-pad">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Autonomous rules</div>
          <p className="hint" style={{ marginBottom: 10 }}>
            The engine runs continuously (every 45s in this prototype) and delivers in-app — plus email/push per each user's own
            preferences. Every rule dedupes per user per day.
          </p>
          {RULES.map(r => (
            <div key={r.key} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--grid)' }}>
              <div style={{ paddingRight: 20 }}>
                <div style={{ fontWeight: 650, fontSize: 13.5 }}>{r.label}</div>
                <div className="hint">{r.desc}</div>
              </div>
              <Switch checked={an[r.key] as boolean} onChange={v => set({ [r.key]: v } as Partial<typeof an>)} label={r.label} />
            </div>
          ))}
          <div className="row-wrap" style={{ alignItems: 'flex-end', marginTop: 12 }}>
            <div className="field" style={{ width: 180 }}>
              <label>Inactivity threshold (days)</label>
              <input className="input" type="number" min={1} value={inactivity} onChange={e => setInactivity(e.target.value)} />
            </div>
            <div className="field" style={{ width: 180 }}>
              <label>Mover threshold (pts/24h)</label>
              <input className="input" type="number" min={1} value={movePts} onChange={e => setMovePts(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => set({ inactivityDays: parseFloat(inactivity) || 7, moveThresholdPts: parseFloat(movePts) || 5 })}>
              Save thresholds
            </button>
          </div>
        </div>

        <div className="card card-pad stack" style={{ gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Send a notification</div>
          <div className="row-wrap">
            <div className="field" style={{ width: 220 }}>
              <label>Audience</label>
              <select className="select" value={target} onChange={e => setTarget(e.target.value)}>
                <option value="all">All active users</option>
                {state.users.filter(u => !u.isAdmin).map(u => <option key={u.id} value={u.id}>@{u.handle}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 200 }}>
              <label>Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. New markets just dropped" />
            </div>
          </div>
          <div className="field">
            <label>Message</label>
            <textarea className="input" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Short, specific, one call to action." />
          </div>
          <button
            className="btn btn-primary"
            style={{ alignSelf: 'flex-start' }}
            disabled={title.trim().length < 3 || text.trim().length < 3}
            onClick={() => { adminSendNotification(target as 'all' | string, title.trim(), text.trim()); setTitle(''); setText('') }}
          >
            Send to {target === 'all' ? 'everyone' : '@' + userById(target)?.handle}
          </button>
        </div>

        <div className="card card-pad stack" style={{ gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700 }}>📧 Email delivery (SendGrid integration)</div>
            <span className={em.apiKeySet ? 'badge badge-good' : 'badge badge-critical'}>
              <span className="dot" />{em.apiKeySet ? `Connected · ${em.sandboxMode ? 'sandbox' : 'live'}` : 'Not configured'}
            </span>
          </div>
          <p className="hint">
            Every in-app notification with a user email preference on is handed to the provider here. Wire-up:
            set the API key, verify the from-domain (SPF/DKIM), map templates to notification kinds — the engine does the rest.
            {' '}{em.sent30d.toLocaleString()} emails sent in the last 30 days.
          </p>
          <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 150 }}>
              <label>Provider</label>
              <select className="select" value={em.provider} onChange={e => adminUpdateSettings({ email: { ...em, provider: e.target.value as typeof em.provider } })}>
                <option value="sendgrid">SendGrid</option>
                <option value="postmark">Postmark</option>
                <option value="ses">Amazon SES</option>
              </select>
            </div>
            <div className="field" style={{ width: 210 }}>
              <label>API key</label>
              <input className="input" type="password" placeholder={em.apiKeySet ? '•••••••••••• (set)' : 'SG.xxxxx'} value={apiKey} onChange={e => setApiKey(e.target.value)} />
            </div>
            <div className="field" style={{ width: 210 }}>
              <label>From address (verified domain)</label>
              <input className="input" value={fromAddr} onChange={e => setFromAddr(e.target.value)} />
            </div>
            <button
              className="btn btn-primary"
              onClick={() => { adminUpdateSettings({ email: { ...em, apiKeySet: em.apiKeySet || apiKey.length > 5, fromAddress: fromAddr } }); setApiKey('') }}
            >
              Save
            </button>
          </div>
          <div className="row-wrap" style={{ gap: 8 }}>
            {em.templates.map(t => (
              <span key={t.id} className="badge" style={{ textTransform: 'none' }}>{t.name} <span className="muted">→ {t.trigger}</span></span>
            ))}
          </div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 240 }}>
              <label>Send a test email</label>
              <input className="input" placeholder="you@example.com" value={testTo} onChange={e => setTestTo(e.target.value)} />
            </div>
            <button className="btn" disabled={!/.+@.+\..+/.test(testTo)} onClick={() => { adminSendTestEmail(testTo); setTestTo('') }}>Send test</button>
            <label className="row" style={{ gap: 6, marginLeft: 'auto', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={em.sandboxMode} onChange={e => adminUpdateSettings({ email: { ...em, sandboxMode: e.target.checked } })} />
              Sandbox mode (validate, don't deliver)
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>
            Recent deliveries ({state.notifications.length} stored)
          </div>
          {state.notifications.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>To</th><th>Kind</th><th>Title</th><th>Text</th><th className="num">When</th></tr></thead>
                <tbody>
                  {state.notifications.slice(0, 12).map(n => {
                    const u = userById(n.userId)
                    return (
                      <tr key={n.id}>
                        <td>{u ? <span className="row" style={{ gap: 6 }}><Avatar user={u} size={20} />@{u.handle}</span> : n.userId}</td>
                        <td><span className="badge badge-accent" style={{ textTransform: 'none' }}>{n.kind}</span></td>
                        <td style={{ fontWeight: 650 }}>{n.title.slice(0, 30)}</td>
                        <td className="muted" style={{ fontSize: 12 }}>{n.text.slice(0, 55)}…</td>
                        <td className="num muted">{fmtAgo(n.at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty icon="📭" text="No notifications yet" sub="Run the engine or send a blast." />}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Data Studio: entity browser, backup/restore, compaction
// ---------------------------------------------------------------------------
export const AdminData = () => {
  const { state, exportStateJson, importStateJson, pruneHistory, resetDemo, toast } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState('')

  const entities: { name: string; rows: number }[] = [
    { name: 'users', rows: state.users.length },
    { name: 'markets', rows: state.markets.length },
    { name: 'positions', rows: state.positions.length },
    { name: 'orders', rows: state.orders.length },
    { name: 'transactions', rows: state.txs.length },
    { name: 'trade events', rows: state.trades.length },
    { name: 'price points', rows: state.markets.reduce((a, m) => a + Object.values(m.history).reduce((b, h) => b + h.length, 0), 0) },
    { name: 'alerts', rows: state.alerts.length },
    { name: 'notifications', rows: state.notifications.length },
    { name: 'kyc requests', rows: state.kycRequests.length },
    { name: 'compliance alerts', rows: state.complianceAlerts.length },
    { name: 'lp positions', rows: state.lps.length },
    { name: 'copy links', rows: state.copyLinks.length },
    { name: 'api keys', rows: state.apiKeys.length },
    { name: 'audit entries', rows: state.audit.length },
  ]
  const sizeKb = Math.round(JSON.stringify(state).length / 1024)

  const doExport = () => {
    const blob = new Blob([exportStateJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = `foresight-backup-${new Date().toISOString().slice(0, 10)}.json`
    el.click()
    URL.revokeObjectURL(url)
    toast('success', 'Backup downloaded')
  }

  const doImport = (file: File) => {
    setImportError('')
    const reader = new FileReader()
    reader.onload = () => {
      const res = importStateJson(String(reader.result))
      if (!res.ok) setImportError(res.error ?? 'Import failed')
    }
    reader.readAsText(file)
  }

  return (
    <>
      <div className="admin-head">
        <h1>Data studio</h1>
        <span className="hint">The whole exchange is one versioned document (v{state.version}) — {sizeKb.toLocaleString()} KB in browser storage. In production: Postgres + object storage, same shapes.</span>
      </div>

      <div className="stack" style={{ maxWidth: 860 }}>
        <div className="grid-2">
          <div className="card">
            <div className="card-pad" style={{ fontWeight: 700, borderBottom: '1px solid var(--grid)' }}>Collections</div>
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {entities.map(e => (
                    <tr key={e.name}>
                      <td style={{ textTransform: 'capitalize' }}>{e.name}</td>
                      <td className="num mono">{e.rows.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="stack">
            <div className="card card-pad stack" style={{ gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Backup & restore</div>
              <p className="hint">Full JSON snapshot of every collection. Restore replaces the current state after validation — take a backup first.</p>
              <div className="row">
                <button className="btn btn-primary" onClick={doExport}>⬇ Export backup</button>
                <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Import backup</button>
                <input ref={fileRef} type="file" accept=".json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = '' }} />
              </div>
              {importError && <div style={{ color: 'var(--critical)', fontSize: 13 }}>{importError}</div>}
            </div>

            <div className="card card-pad stack" style={{ gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Compaction</div>
              <p className="hint">Trim price history to the last 240 points per outcome and cap the trade/audit logs. Keeps the demo fast; audited.</p>
              <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={pruneHistory}>🧹 Prune history</button>
            </div>

            <div className="card card-pad stack" style={{ gap: 10, borderColor: 'var(--critical)' }}>
              <div style={{ fontWeight: 700, color: 'var(--critical)' }}>Danger zone</div>
              <p className="hint">Erase everything and restore the original seed — the clean slate for building the real product.</p>
              <button className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => { if (confirm('Reset ALL demo data to the original seed?')) resetDemo() }}>
                Reset demo data
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
