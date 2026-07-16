import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { MarketCard } from './MarketCard'
import { Empty } from '../components/ui'
import { fmtUsdCompact } from '../lib/format'
import { DAILY_QUESTS, dayKey, levelProgress } from '../lib/gamification'

const CATEGORIES = ['All', 'Trending', '★ Watchlist', 'Politics', 'Economics', 'Crypto', 'AI & Tech', 'Sports', 'Science', 'Climate', 'Culture', 'Resolved']

export const Home = () => {
  const { state, currentUser } = useStore()
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').toLowerCase()
  const [cat, setCat] = useState('All')

  const visible = useMemo(() => {
    let ms = state.markets.filter(m => m.status !== 'draft')
    if (q) ms = ms.filter(m => (m.question + ' ' + m.tags.join(' ') + ' ' + m.category).toLowerCase().includes(q))
    if (cat === 'Trending') ms = [...ms].filter(m => m.status === 'active').sort((a, b) => b.volume - a.volume)
    else if (cat === '★ Watchlist') ms = ms.filter(m => currentUser?.watchlist.includes(m.id))
    else if (cat === 'Resolved') ms = ms.filter(m => m.status === 'resolved')
    else if (cat !== 'All') ms = ms.filter(m => m.category === cat)
    if (cat === 'All') ms = [...ms].sort((a, b) => Number(b.featured) - Number(a.featured) || b.volume - a.volume)
    return ms
  }, [state.markets, q, cat, currentUser])

  const totalVol = state.markets.reduce((a, m) => a + m.volume, 0)
  const active = state.markets.filter(m => m.status === 'active').length

  return (
    <main className="page-inner">
      {!q && (
        <div className="hero">
          <div>
            <h1>Trade on what happens next.</h1>
            <p>
              Foresight turns real-world questions into live markets. Prices are probabilities —
              buy YES or NO, and get paid $1 a share when you're right.
            </p>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><div className="v mono">{fmtUsdCompact(totalVol)}</div><div className="l">Volume traded</div></div>
            <div className="hero-stat"><div className="v mono">{active}</div><div className="l">Live markets</div></div>
            <div className="hero-stat"><div className="v mono">{state.users.length.toLocaleString()}</div><div className="l">Forecasters</div></div>
          </div>
        </div>
      )}

      {!q && currentUser && state.settings.featureFlags.gamification && <QuestsCard />}

      <div className="cat-row" role="tablist" aria-label="Categories">
        {CATEGORIES.map(c => (
          <button key={c} className={'chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)} role="tab" aria-selected={c === cat}>
            {c === 'Trending' ? '🔥 Trending' : c}
          </button>
        ))}
      </div>

      {q && (
        <div className="section-head">
          <h2>Results for “{q}”</h2>
          <span className="sub">{visible.length} market{visible.length === 1 ? '' : 's'}</span>
        </div>
      )}

      <div className="market-grid" style={{ marginTop: 14 }}>
        {visible.map(m => <MarketCard key={m.id} market={m} />)}
      </div>
      {!visible.length && (
        cat === '★ Watchlist'
          ? <Empty icon="⭐" text="Your watchlist is empty" sub="Star any market from its page to track it here." />
          : <Empty icon="🔍" text="No markets match" sub="Try a different search or category." />
      )}
    </main>
  )
}

const QuestsCard = () => {
  const { state, currentUser } = useStore()
  if (!currentUser) return null
  const today = dayKey()
  const done: Record<string, boolean> = {
    'q-trade': state.txs.some(t => t.userId === currentUser.id && t.type === 'trade' && dayKey(t.createdAt) === today),
    'q-alert': state.alerts.some(a => a.userId === currentUser.id && dayKey(a.createdAt) === today),
    'q-deposit': state.txs.some(t => t.userId === currentUser.id && t.type === 'deposit' && t.status === 'completed' && dayKey(t.createdAt) === today),
  }
  const prog = levelProgress(currentUser.xp)
  return (
    <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ minWidth: 190 }}>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
          <strong>Level {prog.level}</strong>
          <span className="hint mono">{prog.into}/{prog.needed} XP</span>
        </div>
        <div className="progress" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (prog.into / prog.needed) * 100)}%` }} /></div>
        <div className="hint" style={{ marginTop: 4 }}>🔥 {currentUser.loginStreak}-day streak · +20 XP daily</div>
      </div>
      <div className="row-wrap" style={{ flex: 1, gap: 8 }}>
        {DAILY_QUESTS.map(qd => (
          <span key={qd.id} className="badge" style={{ padding: '6px 12px', textTransform: 'none', fontSize: 12, ...(done[qd.id] ? { borderColor: 'var(--good)', color: 'var(--good)' } : {}) }}>
            {done[qd.id] ? '✅' : qd.icon} {qd.name} <span className="muted">+{qd.xp} XP</span>
          </span>
        ))}
      </div>
    </div>
  )
}
