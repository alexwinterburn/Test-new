import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppState, ComplianceAlert, Direction, KycTier, Market, MarketStatus, NotificationKind, Order, Outcome, Position, Settings, Side, SlipLeg, User } from './types'
import { ACHIEVEMENTS, XP, dayKey, levelForXp } from './gamification'
import { buildSeed } from './seed'
import { applyBuy, applySell, price, quoteBuy, quoteSell, seedPools } from './engine'
import { fmtCents, fmtUsd, shortId } from './format'

const LS_KEY = 'foresight-demo-state-v7'

const load = (): AppState => {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version === 7) return parsed
    }
  } catch { /* fall through to reseed */ }
  return buildSeed()
}

export interface Toast { id: string; kind: 'success' | 'error' | 'info'; text: string }

export interface TradeResult { ok: boolean; error?: string; needsKyc?: KycTier }

interface StoreApi {
  state: AppState
  toasts: Toast[]
  toast: (kind: Toast['kind'], text: string) => void
  dismissToast: (id: string) => void

  currentUser: User | null
  userById: (id: string) => User | undefined
  marketById: (id: string) => Market | undefined

  signIn: (email: string) => { ok: boolean; error?: string }
  signUp: (email: string, name: string, referralCode?: string) => { ok: boolean; error?: string }
  signInWithProvider: (provider: 'google' | 'apple' | 'x') => void
  adminSendTestEmail: (to: string) => void
  signOut: () => void
  signInAsAdmin: () => void

  openPositionCost: (userId: string) => number
  trade: (marketId: string, outcomeId: string, side: Side, direction: Direction, amount: number) => TradeResult
  placeLimitOrder: (marketId: string, outcomeId: string, side: Side, limitPrice: number, shares: number) => TradeResult
  cancelOrder: (orderId: string) => void

  depositCrypto: (amount: number, asset: string, network: string) => string // returns tx id (pending until confirmed)
  confirmDeposit: (txId: string) => void
  withdraw: (amount: number, method: string) => { ok: boolean; error?: string; pending?: boolean; needsKyc?: boolean }
  setNotificationPrefs: (prefs: User['notificationPrefs']) => void

  addLiquidity: (marketId: string, amount: number) => TradeResult
  withdrawLiquidity: (lpId: string) => void

  toggleFollow: (userId: string) => void
  copyPortfolio: (leaderId: string, budget: number) => TradeResult
  createCopyLink: (leaderId: string, perTradeCap: number) => void
  cancelCopyLink: (linkId: string) => void

  markNotificationsRead: () => void
  dismissNotification: (id: string) => void
  runNotificationEngine: () => void
  submitKyc: (tier: KycTier, docType: string, country: string) => void
  setSelfLimits: (limits: User['selfLimits']) => void
  proposeMarket: (question: string, category: string, source: string) => void

  toggleWatch: (marketId: string) => void
  createAlert: (marketId: string, outcomeId: string, condition: 'above' | 'below' | 'move', threshold: number) => void
  deleteAlert: (alertId: string) => void

  addToSlip: (leg: SlipLeg) => void
  removeFromSlip: (index: number) => void
  setSlipAmount: (index: number, amount: number) => void
  clearSlip: () => void
  placeSlip: () => TradeResult

  // Admin
  adminCreateMarket: (m: {
    question: string; description: string; rules: string; category: string; icon: string
    type: 'binary' | 'multi' | 'scalar'; outcomes: { label: string; p: number }[]
    scalarRange?: { min: number; max: number; unit: string }
    closesAt: number; resolutionSource: string; oracle: Market['oracle']
    liquidity: number; feeBps: number; featured: boolean; status: 'draft' | 'active'
  }) => void
  adminSetMarketStatus: (marketId: string, status: MarketStatus, reason?: string) => void
  adminToggleFeatured: (marketId: string) => void
  adminProposeResolution: (marketId: string, outcomeId: string, side: Side, disputeHours: number, scalarValue?: number) => void
  adminFinalizeResolution: (marketId: string) => void
  adminCancelResolution: (marketId: string) => void
  adminReviewKyc: (requestId: string, approve: boolean, reason?: string) => void
  adminReviewWithdrawal: (txId: string, approve: boolean) => void
  adminReviewProposal: (proposalId: string, approve: boolean) => void
  adminSetUserSuspended: (userId: string, suspended: boolean) => void
  adminAdjustBalance: (userId: string, amount: number, note: string) => void
  adminUpdateSettings: (patch: Partial<Settings>) => void
  adminToggleFlag: (flag: keyof Settings['featureFlags']) => void
  adminAddLiquidity: (marketId: string, amount: number) => void
  adminReviewComplianceAlert: (alertId: string, status: ComplianceAlert['status']) => void
  adminSetAnnouncement: (text: string, kind: 'info' | 'warning' | 'critical') => void
  adminClearAnnouncement: () => void
  adminCreateApiKey: (label: string, scopes: string[], rateLimitPerMin: number) => void
  adminRevokeApiKey: (keyId: string) => void
  adminCreateWebhook: (url: string, events: string[]) => void
  adminToggleWebhook: (id: string) => void
  adminDeleteWebhook: (id: string) => void
  adminSendNotification: (target: 'all' | string, title: string, text: string) => void
  adminSaveReport: (name: string, metrics: string[], rangeDays: number) => void
  adminDeleteReport: (id: string) => void
  exportStateJson: () => string
  importStateJson: (raw: string) => { ok: boolean; error?: string }
  pruneHistory: () => void
  resetDemo: () => void
}

const Ctx = createContext<StoreApi | null>(null)

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(load)
  const [toasts, setToasts] = useState<Toast[]>([])
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* storage full — demo keeps running in memory */ }
  }, [state])

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = shortId()
    setToasts(ts => [...ts, { id, kind, text }])
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4200)
  }, [])
  const dismissToast = useCallback((id: string) => setToasts(ts => ts.filter(t => t.id !== id)), [])

  /** Clone state, mutate the draft freely, commit. */
  const mutate = useCallback((fn: (draft: AppState) => void) => {
    setState(prev => {
      const draft = clone(prev)
      fn(draft)
      return draft
    })
  }, [])

  const api = useMemo<StoreApi>(() => {
    const s = state
    const userById = (id: string) => s.users.find(u => u.id === id)
    const marketById = (id: string) => s.markets.find(m => m.id === id)
    const currentUser = s.sessionUserId ? userById(s.sessionUserId) ?? null : null

    const audit = (draft: AppState, action: string, detail: string) => {
      const actor = draft.users.find(u => u.id === draft.sessionUserId)
      draft.audit.unshift({ id: shortId(), actorId: actor?.id ?? 'system', actorName: actor?.name ?? 'System', action, detail, at: Date.now() })
    }

    const openPositionCost = (userId: string) =>
      s.positions.filter(p => p.userId === userId).reduce((a, p) => a + p.shares * p.avgPrice, 0)

    const pushHistory = (draft: AppState, m: Market, o: Outcome) => {
      const h = m.history[o.id] ?? (m.history[o.id] = [])
      h.push({ t: Date.now(), p: price(o) })
      if (h.length > 2000) h.splice(0, h.length - 2000)
    }

    /** Push an in-app notification, deduped per user+kind+link per day. */
    const notify = (draft: AppState, userId: string, kind: NotificationKind, title: string, text: string, link?: string) => {
      const today = dayKey()
      if (draft.notifications.some(n => n.userId === userId && n.kind === kind && n.link === link && dayKey(n.at) === today && n.title === title)) return
      draft.notifications.unshift({ id: shortId(), userId, kind, title, text, link, read: false, at: Date.now() })
      if (draft.notifications.length > 400) draft.notifications.length = 400
      const u = draft.users.find(x => x.id === userId)
      if (u?.notificationPrefs.email || u?.notificationPrefs.push) {
        // production: hand off to the delivery service here (email/push)
      }
    }

    const awardXp = (draft: AppState, userId: string, amount: number) => {
      if (!draft.settings.featureFlags.gamification) return
      const u = draft.users.find(x => x.id === userId)
      if (!u) return
      const before = levelForXp(u.xp)
      u.xp += amount
      const after = levelForXp(u.xp)
      if (after > before) {
        notify(draft, userId, 'level-up', `Level ${after} reached! 🎉`, `You crossed ${u.xp.toLocaleString()} XP. Keep forecasting.`, '#/portfolio')
        if (userId === draft.sessionUserId) queueMicrotask(() => toast('success', `🎉 Level up — you are now level ${after}`))
      }
    }

    const grantAchievement = (draft: AppState, userId: string, achId: string) => {
      if (!draft.settings.featureFlags.gamification) return
      const u = draft.users.find(x => x.id === userId)
      const def = ACHIEVEMENTS.find(a => a.id === achId)
      if (!u || !def || u.achievements.includes(achId)) return
      u.achievements.push(achId)
      u.xp += def.xp
      notify(draft, userId, 'achievement', `Achievement: ${def.name} ${def.icon}`, `${def.desc} (+${def.xp} XP)`, '#/portfolio')
      if (userId === draft.sessionUserId) queueMicrotask(() => toast('success', `${def.icon} Achievement unlocked: ${def.name} (+${def.xp} XP)`))
    }

    /** Daily login streak + XP; called when a session starts or resumes on a new day. */
    const touchLogin = (draft: AppState, userId: string) => {
      const u = draft.users.find(x => x.id === userId)
      if (!u) return
      const today = dayKey()
      if (u.lastLoginDay === today) return
      const yesterday = dayKey(Date.now() - 86400000)
      u.loginStreak = u.lastLoginDay === yesterday ? u.loginStreak + 1 : 1
      u.lastLoginDay = today
      awardXp(draft, userId, XP.dailyLogin)
      if (u.loginStreak >= 7) grantAchievement(draft, userId, 'streak-7')
    }

    /** The autonomous notification engine: reminders and watchers for every user. */
    const runEngine = (draft: AppState) => {
      const cfg = draft.settings.autoNotify
      const now = Date.now()
      for (const u of draft.users) {
        if (u.isAdmin || u.suspended) continue
        // KYC reminder: unverified users with a meaningful balance
        if (cfg.kycReminders && u.kycTier === 0 && u.kycStatus === 'none' && u.balance >= 100) {
          notify(draft, u.id, 'reminder-kyc', 'Unlock your full limits', `You have ${fmtUsd(u.balance, 0)} on the platform but are still Tier 0. Verify once and forget it — takes about two minutes.`, '#/wallet')
        }
        // trade-inactivity nudge
        if (cfg.tradeReminders && u.lastTradeAt && now - u.lastTradeAt > cfg.inactivityDays * 86400000) {
          notify(draft, u.id, 'reminder-trade', 'The markets moved without you', `You haven't traded in ${Math.floor((now - u.lastTradeAt) / 86400000)} days. ${draft.markets.filter(m => m.status === 'active').length} markets are live right now.`, '#/')
        }
        // watchlist movers
        if (cfg.watchlistMovers) {
          for (const mid of u.watchlist) {
            const m = draft.markets.find(x => x.id === mid)
            if (!m || m.status !== 'active') continue
            const h = m.history[m.outcomes[0].id] ?? []
            const nowP = h[h.length - 1]?.p
            const dayAgo = h.filter(x => x.t <= now - 86400000).slice(-1)[0]?.p
            if (nowP === undefined || dayAgo === undefined) continue
            const move = (nowP - dayAgo) * 100
            if (Math.abs(move) >= cfg.moveThresholdPts) {
              notify(draft, u.id, 'watchlist-move', 'Watchlist mover', `"${m.question.slice(0, 55)}" ${move > 0 ? 'rose' : 'fell'} ${Math.abs(move).toFixed(0)}pts in 24h — now ${Math.round(nowP * 100)}%.`, `#/market/${m.id}`)
            }
          }
        }
        // markets closing soon where the user holds a position
        if (cfg.closingSoon) {
          const held = new Set(draft.positions.filter(pn => pn.userId === u.id).map(pn => pn.marketId))
          for (const mid of held) {
            const m = draft.markets.find(x => x.id === mid)
            if (m && m.status === 'active' && m.closesAt - now < 48 * 3600000 && m.closesAt > now) {
              notify(draft, u.id, 'closing-soon', 'Position in a closing market', `"${m.question.slice(0, 55)}" closes in under 48h. Adjust or hold?`, `#/market/${m.id}`)
            }
          }
        }
      }
    }

    /** Route a share of the trading fee to the market's liquidity providers. */
    const distributeLpFees = (draft: AppState, marketId: string, fee: number) => {
      if (fee <= 0) return
      const lps = draft.lps.filter(l => l.marketId === marketId)
      const total = lps.reduce((a, l) => a + l.amount, 0)
      if (!total) return
      const pool = fee * (draft.settings.lpFeeShareBps / 10000)
      for (const l of lps) l.feesEarned += pool * (l.amount / total)
    }

    const recordTrade = (draft: AppState, userId: string, m: Market, outcomeId: string, side: Side, direction: Direction, shares: number, px: number) => {
      draft.trades.unshift({ id: shortId(), marketId: m.id, userId, outcomeId, side, direction, shares, price: px, at: Date.now() })
      if (draft.trades.length > 300) draft.trades.length = 300
    }

    /** Trigger any price alerts crossed by the latest move on this market. */
    const checkAlerts = (draft: AppState, m: Market) => {
      for (const a of draft.alerts) {
        if (a.marketId !== m.id || a.triggeredAt) continue
        const o = m.outcomes.find(x => x.id === a.outcomeId)
        if (!o) continue
        const p = price(o)
        let hit = false
        let desc = ''
        if (a.condition === 'move') {
          const h = m.history[o.id] ?? []
          const dayAgo = h.filter(x => x.t <= Date.now() - 86400000).slice(-1)[0]?.p ?? h[0]?.p
          if (dayAgo !== undefined && Math.abs(p - dayAgo) >= a.threshold) {
            hit = true
            desc = `moved ${(Math.abs(p - dayAgo) * 100).toFixed(0)}pts in 24h (now ${Math.round(p * 100)}%)`
          }
        } else if ((a.condition === 'above' && p >= a.threshold) || (a.condition === 'below' && p <= a.threshold)) {
          hit = true
          desc = `is now ${a.condition} ${Math.round(a.threshold * 100)}% (${Math.round(p * 100)}%)`
        }
        if (hit) {
          a.triggeredAt = Date.now()
          notify(draft, a.userId, 'price-alert', 'Price alert triggered', `"${m.question.slice(0, 55)}" ${desc}.`, `#/market/${m.id}`)
          if (a.userId === draft.sessionUserId) {
            const msg = `🔔 Alert: "${m.question.slice(0, 45)}…" ${desc}`
            queueMicrotask(() => toast('info', msg))
          }
        }
      }
    }

    const upsertPosition = (draft: AppState, userId: string, m: Market, outcomeId: string, side: Side, shares: number, costPerShare: number) => {
      let pos = draft.positions.find(p => p.userId === userId && p.marketId === m.id && p.outcomeId === outcomeId && p.side === side)
      if (!pos) {
        pos = { id: shortId(), userId, marketId: m.id, outcomeId, side, shares: 0, avgPrice: 0, realizedPnl: 0 }
        draft.positions.push(pos)
      }
      const totalCost = pos.shares * pos.avgPrice + shares * costPerShare
      pos.shares += shares
      pos.avgPrice = pos.shares > 0 ? totalCost / pos.shares : 0
      return pos
    }

    /** Fill any resting limit orders that now cross the AMM price. */
    const fillCrossable = (draft: AppState, marketId: string) => {
      const m = draft.markets.find(x => x.id === marketId)!
      if (m.status !== 'active') return
      for (const ord of draft.orders) {
        if (ord.marketId !== marketId || (ord.status !== 'open' && ord.status !== 'partial')) continue
        const o = m.outcomes.find(x => x.id === ord.outcomeId)!
        if (price(o, ord.side) > ord.limitPrice + 1e-9) continue
        const user = draft.users.find(u => u.id === ord.userId)
        if (!user || user.suspended) continue
        const remaining = ord.shares - ord.filled
        const cost = remaining * price(o, ord.side) * 1.02 // approx; capped by balance below
        const spend = Math.min(cost, user.balance)
        if (spend < 1) continue
        const q = quoteBuy(o, ord.side, spend)
        const filled = Math.min(q.shares, remaining)
        const actualSpend = filled * q.avgPrice
        const idx = m.outcomes.findIndex(x => x.id === o.id)
        m.outcomes[idx] = applyBuy(o, ord.side, actualSpend)
        user.balance -= actualSpend
        upsertPosition(draft, user.id, m, o.id, ord.side, filled, q.avgPrice)
        ord.filled += filled
        ord.status = ord.filled >= ord.shares - 0.01 ? 'filled' : 'partial'
        m.volume += actualSpend
        pushHistory(draft, m, m.outcomes[idx])
        recordTrade(draft, user.id, m, o.id, ord.side, 'buy', filled, q.avgPrice)
        checkAlerts(draft, m)
        draft.txs.unshift({ id: shortId(), userId: user.id, type: 'trade', amount: -actualSpend, status: 'completed', note: `Limit fill: ${filled.toFixed(0)} ${ord.side.toUpperCase()} @ ${fmtCents(q.avgPrice)} · ${m.question.slice(0, 40)}`, createdAt: Date.now() })
        // maker rebate: resting orders improve the book, so fills earn a rebate
        const rebate = actualSpend * (draft.settings.makerRebateBps / 10000)
        if (rebate > 0.001) {
          user.balance += rebate
          draft.txs.unshift({ id: shortId(), userId: user.id, type: 'adjustment', amount: rebate, status: 'completed', note: `Maker rebate (${draft.settings.makerRebateBps}bps) on resting fill`, createdAt: Date.now() })
        }
      }
    }

    const settleMarket = (draft: AppState, m: Market) => {
      for (const pos of draft.positions.filter(p => p.marketId === m.id)) {
        const o = m.outcomes.find(x => x.id === pos.outcomeId)
        if (!o) continue
        let payout = 0
        if (m.type === 'scalar' && m.settlementFraction !== undefined) {
          // scalar: LONG (yes) pays the settled fraction of $1, SHORT (no) the remainder
          payout = pos.shares * (pos.side === 'yes' ? m.settlementFraction : 1 - m.settlementFraction)
        } else {
          if (!o.resolved) continue
          payout = pos.side === o.resolved ? pos.shares : 0
        }
        const user = draft.users.find(u => u.id === pos.userId)
        if (user && payout > 0.005) {
          user.balance += payout
          draft.txs.unshift({ id: shortId(), userId: user.id, type: 'settlement', amount: payout, status: 'completed', note: `Settlement: ${m.question.slice(0, 50)}`, createdAt: Date.now() })
          notify(draft, user.id, 'settlement', 'Market settled — you got paid', `"${m.question.slice(0, 55)}" settled. ${fmtUsd(payout)} credited to your balance.`, '#/portfolio')
          if (payout > pos.shares * pos.avgPrice) {
            grantAchievement(draft, user.id, 'prophet')
            awardXp(draft, user.id, XP.settlementWin)
          }
        }
        pos.realizedPnl += payout - pos.shares * pos.avgPrice
      }
      draft.positions = draft.positions.filter(p => p.marketId !== m.id)
      draft.orders.forEach(o => { if (o.marketId === m.id && (o.status === 'open' || o.status === 'partial')) o.status = 'cancelled' })
      // return LP principal + accrued fees
      for (const lp of draft.lps.filter(l => l.marketId === m.id)) {
        const user = draft.users.find(u => u.id === lp.userId)
        if (user) {
          user.balance += lp.amount + lp.feesEarned
          draft.txs.unshift({ id: shortId(), userId: user.id, type: 'settlement', amount: lp.amount + lp.feesEarned, status: 'completed', note: `LP principal + fees returned: ${m.question.slice(0, 40)}`, createdAt: Date.now() })
        }
      }
      draft.lps = draft.lps.filter(l => l.marketId !== m.id)
    }

    const self: StoreApi = {
      state: s, toasts, toast, dismissToast, currentUser, userById, marketById, openPositionCost,

      signIn: (email) => {
        const u = s.users.find(x => x.email.toLowerCase() === email.toLowerCase())
        if (!u) return { ok: false, error: 'No account found for that email. Try signing up.' }
        if (u.suspended) return { ok: false, error: 'This account is suspended. Contact support.' }
        mutate(d => { d.sessionUserId = u.id; touchLogin(d, u.id) })
        toast('success', `Welcome back, ${u.name.split(' ')[0]}!`)
        return { ok: true }
      },

      signUp: (email, name, referralCode) => {
        if (s.users.some(x => x.email.toLowerCase() === email.toLowerCase()))
          return { ok: false, error: 'An account with that email already exists.' }
        const code = referralCode?.trim().toUpperCase()
        if (code && !s.users.some(x => x.referralCode === code))
          return { ok: false, error: 'That referral code was not recognised.' }
        mutate(d => {
          const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
          const u: User = {
            id: 'u-' + shortId(), email, name, handle,
            avatarHue: Math.floor(Math.random() * 360), balance: 100, kycTier: 0, kycStatus: 'none',
            country: 'US', createdAt: Date.now(), isAdmin: false, suspended: false, riskFlags: [],
            selfLimits: { dailyLossCap: null, coolOffUntil: null }, totalDeposited: 0, totalWithdrawn: 0,
            watchlist: [], stats: { profit30d: 0, calibration: 0.5, resolvedCount: 0, winRate: 0, streak: 0 },
            referralCode: (handle.toUpperCase() + shortId().toUpperCase()).slice(0, 8),
            referredBy: code || null, referralRewardPaid: false, follows: [],
            notificationPrefs: { email: true, push: false },
            xp: 0, achievements: [], loginStreak: 0, lastLoginDay: '', lastTradeAt: null,
            authProvider: 'email',
          }
          d.users.push(u)
          d.sessionUserId = u.id
          touchLogin(d, u.id)
          d.txs.unshift({ id: shortId(), userId: u.id, type: 'adjustment', amount: 100, status: 'completed', note: 'Welcome credit', createdAt: Date.now() })
        })
        toast('success', 'Account created — $100 welcome credit added. Verify identity later, only when you need higher limits or withdrawals.')
        return { ok: true }
      },

      signInWithProvider: (provider) => {
        // Simulated OAuth: production redirects to the provider and receives a
        // verified profile; here we mint/reuse a demo identity per provider.
        const personas = {
          google: { email: 'demo.google@gmail.com', name: 'Georgia Okonkwo' },
          apple: { email: 'demo.apple@icloud.com', name: 'Ana Petrov' },
          x: { email: 'demo.x@x.com', name: 'Xavier Reyes' },
        } as const
        const p = personas[provider]
        const existing = s.users.find(u => u.email === p.email)
        if (existing) {
          mutate(d => { d.sessionUserId = existing.id; touchLogin(d, existing.id) })
          toast('success', `Welcome back, ${existing.name.split(' ')[0]}! (via ${provider})`)
          return
        }
        mutate(d => {
          const handle = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '')
          const u: User = {
            id: 'u-' + shortId(), email: p.email, name: p.name, handle,
            avatarHue: Math.floor(Math.random() * 360), balance: 100, kycTier: 0, kycStatus: 'none',
            country: 'US', createdAt: Date.now(), isAdmin: false, suspended: false, riskFlags: [],
            selfLimits: { dailyLossCap: null, coolOffUntil: null }, totalDeposited: 0, totalWithdrawn: 0,
            watchlist: [], stats: { profit30d: 0, calibration: 0.5, resolvedCount: 0, winRate: 0, streak: 0 },
            referralCode: (handle.toUpperCase() + shortId().toUpperCase()).slice(0, 8),
            referredBy: null, referralRewardPaid: false, follows: [],
            notificationPrefs: { email: true, push: false },
            xp: 0, achievements: [], loginStreak: 0, lastLoginDay: '', lastTradeAt: null,
            authProvider: provider,
          }
          d.users.push(u)
          d.sessionUserId = u.id
          touchLogin(d, u.id)
          d.txs.unshift({ id: shortId(), userId: u.id, type: 'adjustment', amount: 100, status: 'completed', note: 'Welcome credit', createdAt: Date.now() })
        })
        toast('success', `Account created via ${provider[0].toUpperCase() + provider.slice(1)} — $100 welcome credit added.`)
      },

      adminSendTestEmail: (to) => {
        mutate(d => {
          d.settings.email.sent30d += 1
          audit(d, 'comms.email-test', `Test email sent to ${to} via ${d.settings.email.provider}${d.settings.email.sandboxMode ? ' (sandbox)' : ''}`)
        })
        toast('success', `Test email queued to ${to} — check the provider dashboard for delivery`)
      },

      signOut: () => { mutate(d => { d.sessionUserId = null }) },
      signInAsAdmin: () => {
        mutate(d => { d.sessionUserId = 'u-admin' })
        toast('info', 'Signed in as Foresight Ops (admin)')
      },

      trade: (marketId, outcomeId, side, direction, amount) => {
        const m = marketById(marketId)
        const user = currentUser
        if (!m || !user) return { ok: false, error: 'Sign in to trade.' }
        if (m.status !== 'active') return { ok: false, error: `Market is ${m.status}.` }
        if (user.selfLimits.coolOffUntil && user.selfLimits.coolOffUntil > Date.now())
          return { ok: false, error: 'You are in a self-imposed cool-off period.' }
        const o = m.outcomes.find(x => x.id === outcomeId)!

        if (direction === 'buy') {
          const feeRate = s.settings.tradingFeeBps / 10000
          const fee = amount * feeRate
          const spend = amount - fee
          if (amount <= 0) return { ok: false, error: 'Enter an amount.' }
          if (amount > user.balance) return { ok: false, error: 'Insufficient balance. Deposit funds first.' }
          const cap = s.settings.tierTradeCaps[user.kycTier]
          if (openPositionCost(user.id) + spend > cap) {
            return { ok: false, error: `Tier ${user.kycTier} accounts are limited to ${fmtUsd(cap, 0)} in open positions. Verify your identity to raise the limit.`, needsKyc: (user.kycTier + 1) as KycTier }
          }
          const q = quoteBuy(o, side, spend)
          const oldP = price(o)
          mutate(d => {
            const dm = d.markets.find(x => x.id === marketId)!
            const du = d.users.find(u2 => u2.id === user.id)!
            const idx = dm.outcomes.findIndex(x => x.id === outcomeId)
            dm.outcomes[idx] = applyBuy(dm.outcomes[idx], side, spend)
            du.balance -= amount
            dm.volume += spend
            upsertPosition(d, du.id, dm, outcomeId, side, q.shares, q.avgPrice)
            pushHistory(d, dm, dm.outcomes[idx])
            recordTrade(d, du.id, dm, outcomeId, side, 'buy', q.shares, q.avgPrice)
            checkAlerts(d, dm)
            d.txs.unshift({ id: shortId(), userId: du.id, type: 'trade', amount: -amount, status: 'completed', note: `Buy ${q.shares.toFixed(0)} ${side.toUpperCase()} @ ${fmtCents(q.avgPrice)} · ${m.question.slice(0, 40)}`, createdAt: Date.now() })
            if (fee > 0) d.txs.unshift({ id: shortId(), userId: du.id, type: 'fee', amount: 0, status: 'completed', note: `Trading fee ${fmtUsd(fee)} included`, createdAt: Date.now() })
            distributeLpFees(d, marketId, fee)
            const newP = price(dm.outcomes[idx])
            du.lastTradeAt = Date.now()
            awardXp(d, du.id, XP.trade)
            grantAchievement(d, du.id, 'first-trade')
            if (amount >= 500) grantAchievement(d, du.id, 'whale')
            const cats = new Set(d.positions.filter(pn => pn.userId === du.id).map(pn => d.markets.find(mm => mm.id === pn.marketId)?.category))
            if (cats.size >= 3) grantAchievement(d, du.id, 'diversified')
            // continuous copy-trading: mirror this buy for active followers
            if (d.settings.featureFlags.copyTrading) {
              for (const link of d.copyLinks.filter(l => l.active && l.leaderId === du.id)) {
                const follower = d.users.find(x => x.id === link.followerId)
                if (!follower || follower.suspended) continue
                const mirrorAmt = Math.min(link.perTradeCap, follower.balance)
                if (mirrorAmt < 1) continue
                // mirrored trades respect the follower's own KYC tier cap
                const followerCost = d.positions.filter(pn => pn.userId === follower.id).reduce((a2, pn) => a2 + pn.shares * pn.avgPrice, 0)
                if (followerCost + mirrorAmt > d.settings.tierTradeCaps[follower.kycTier]) {
                  notify(d, follower.id, 'copy-trade', 'Mirror skipped — tier limit', `A trade by @${du.handle} was not mirrored because it would exceed your Tier ${follower.kycTier} position cap. Verify to raise it.`, '#/wallet')
                  continue
                }
                const idx2 = dm.outcomes.findIndex(x => x.id === outcomeId)
                const q2 = quoteBuy(dm.outcomes[idx2], side, mirrorAmt * (1 - feeRate))
                dm.outcomes[idx2] = applyBuy(dm.outcomes[idx2], side, mirrorAmt * (1 - feeRate))
                follower.balance -= mirrorAmt
                dm.volume += mirrorAmt
                link.mirrored += mirrorAmt
                upsertPosition(d, follower.id, dm, outcomeId, side, q2.shares, q2.avgPrice)
                recordTrade(d, follower.id, dm, outcomeId, side, 'buy', q2.shares, q2.avgPrice)
                d.txs.unshift({ id: shortId(), userId: follower.id, type: 'trade', amount: -mirrorAmt, status: 'completed', note: `Auto-mirror @${du.handle}: ${q2.shares.toFixed(0)} ${side.toUpperCase()} @ ${fmtCents(q2.avgPrice)}`, createdAt: Date.now() })
                notify(d, follower.id, 'copy-trade', 'Trade mirrored', `Copied @${du.handle}: bought ${q2.shares.toFixed(0)} ${side.toUpperCase()} on "${dm.question.slice(0, 45)}" for ${fmtUsd(mirrorAmt)}.`, `#/market/${dm.id}`)
              }
            }
            if (d.settings.circuitBreaker.enabled && Math.abs(newP - oldP) * 100 >= d.settings.circuitBreaker.movePct) {
              dm.status = 'halted'
              dm.haltReason = `Circuit breaker: single trade moved price ${(Math.abs(newP - oldP) * 100).toFixed(1)}pts`
              audit(d, 'risk.circuit-breaker', `Auto-halted "${dm.question.slice(0, 50)}" (${(Math.abs(newP - oldP) * 100).toFixed(1)}pt move)`)
            } else {
              fillCrossable(d, marketId)
            }
          })
          toast('success', `Bought ${q.shares.toFixed(1)} ${side.toUpperCase()} shares @ ${fmtCents(q.avgPrice)}`)
          return { ok: true }
        } else {
          // amount = shares to sell
          const pos = s.positions.find(p => p.userId === user.id && p.marketId === marketId && p.outcomeId === outcomeId && p.side === side)
          if (!pos || pos.shares < amount - 0.01) return { ok: false, error: 'Not enough shares to sell.' }
          const q = quoteSell(o, side, amount)
          const feeRate = s.settings.tradingFeeBps / 10000
          const net = q.proceeds * (1 - feeRate)
          mutate(d => {
            const dm = d.markets.find(x => x.id === marketId)!
            const du = d.users.find(u2 => u2.id === user.id)!
            const idx = dm.outcomes.findIndex(x => x.id === outcomeId)
            dm.outcomes[idx] = applySell(dm.outcomes[idx], side, amount)
            du.balance += net
            dm.volume += q.proceeds
            const dp = d.positions.find(p => p.id === pos.id)!
            dp.shares -= amount
            dp.realizedPnl += net - amount * dp.avgPrice
            if (dp.shares < 0.01) d.positions = d.positions.filter(p => p.id !== dp.id)
            pushHistory(d, dm, dm.outcomes[idx])
            recordTrade(d, du.id, dm, outcomeId, side, 'sell', amount, q.avgPrice)
            du.lastTradeAt = Date.now()
            checkAlerts(d, dm)
            distributeLpFees(d, marketId, q.proceeds * feeRate)
            d.txs.unshift({ id: shortId(), userId: du.id, type: 'trade', amount: net, status: 'completed', note: `Sell ${amount.toFixed(0)} ${side.toUpperCase()} @ ${fmtCents(q.avgPrice)} · ${m.question.slice(0, 40)}`, createdAt: Date.now() })
            fillCrossable(d, marketId)
          })
          toast('success', `Sold ${amount.toFixed(1)} ${side.toUpperCase()} shares for ${fmtUsd(net)}`)
          return { ok: true }
        }
      },

      placeLimitOrder: (marketId, outcomeId, side, limitPrice, shares) => {
        const m = marketById(marketId)
        const user = currentUser
        if (!m || !user) return { ok: false, error: 'Sign in to trade.' }
        if (!s.settings.featureFlags.limitOrders) return { ok: false, error: 'Limit orders are currently disabled.' }
        if (m.status !== 'active') return { ok: false, error: `Market is ${m.status}.` }
        if (shares <= 0 || limitPrice <= 0 || limitPrice >= 1) return { ok: false, error: 'Enter a valid price (1–99¢) and size.' }
        const o = m.outcomes.find(x => x.id === outcomeId)!
        if (price(o, side) <= limitPrice) {
          // crosses immediately — execute as market buy for the equivalent spend
          return self.trade(marketId, outcomeId, side, 'buy', Math.min(shares * limitPrice, user.balance))
        }
        mutate(d => {
          d.orders.unshift({ id: shortId(), userId: user.id, marketId, outcomeId, side, direction: 'buy', limitPrice, shares, filled: 0, status: 'open', createdAt: Date.now() })
        })
        toast('info', `Limit order placed: ${shares} ${side.toUpperCase()} @ ${fmtCents(limitPrice)}`)
        return { ok: true }
      },

      cancelOrder: (orderId) => {
        mutate(d => { const o = d.orders.find(x => x.id === orderId); if (o) o.status = 'cancelled' })
        toast('info', 'Order cancelled')
      },

      depositCrypto: (amount, asset, network) => {
        const txId = shortId()
        if (!currentUser) return txId
        mutate(d => {
          d.txs.unshift({
            id: txId, userId: currentUser.id, type: 'deposit', amount, status: 'pending',
            note: `${asset} on ${network}`, asset, network,
            txHash: '0x' + Math.random().toString(16).slice(2, 6) + '…' + Math.random().toString(16).slice(2, 6),
            confirmations: 0, confirmationsNeeded: network === 'Bitcoin' ? 3 : 12,
            createdAt: Date.now(),
          })
        })
        toast('info', `Detected incoming ${asset} on ${network} — waiting for confirmations`)
        return txId
      },

      confirmDeposit: (txId) => {
        mutate(d => {
          const tx = d.txs.find(x => x.id === txId)
          if (!tx || tx.status !== 'pending' || tx.type !== 'deposit') return
          tx.status = 'completed'
          tx.confirmations = tx.confirmationsNeeded
          const u = d.users.find(x => x.id === tx.userId)!
          u.balance += tx.amount
          u.totalDeposited += tx.amount
          awardXp(d, u.id, XP.deposit)
          // referral reward: referrer is paid on the referee's first qualifying confirmed deposit
          if (d.settings.featureFlags.referrals && u.referredBy && !u.referralRewardPaid && tx.amount >= d.settings.referralMinDeposit) {
            const referrer = d.users.find(x => x.referralCode === u.referredBy)
            if (referrer) {
              u.referralRewardPaid = true
              referrer.balance += d.settings.referralReward
              d.txs.unshift({ id: shortId(), userId: referrer.id, type: 'adjustment', amount: d.settings.referralReward, status: 'completed', note: `Referral reward — @${u.handle} made their first deposit`, createdAt: Date.now() })
              notify(d, referrer.id, 'reward', 'Referral reward earned 🎁', `@${u.handle} made their first deposit — ${fmtUsd(d.settings.referralReward)} credited.`, '#/wallet')
              grantAchievement(d, referrer.id, 'social')
              awardXp(d, referrer.id, XP.referral)
            }
          }
        })
        toast('success', 'Deposit confirmed and credited')
      },

      setNotificationPrefs: (prefs) => {
        if (!currentUser) return
        mutate(d => { d.users.find(x => x.id === currentUser.id)!.notificationPrefs = prefs })
        toast('success', 'Notification preferences saved')
      },

      addLiquidity: (marketId, amount) => {
        const u = currentUser
        const m = marketById(marketId)
        if (!u || !m) return { ok: false, error: 'Sign in first.' }
        if (!s.settings.featureFlags.lpProgram) return { ok: false, error: 'The LP program is currently disabled.' }
        if (m.status !== 'active') return { ok: false, error: `Market is ${m.status}.` }
        if (amount <= 0 || amount > u.balance) return { ok: false, error: 'Invalid amount.' }
        mutate(d => {
          const du = d.users.find(x => x.id === u.id)!
          const dm = d.markets.find(x => x.id === marketId)!
          du.balance -= amount
          for (const o of dm.outcomes) {
            const p = o.noPool / (o.yesPool + o.noPool)
            const value = o.yesPool * p + o.noPool * (1 - p)
            const factor = 1 + (amount / dm.outcomes.length) / Math.max(1, value)
            o.yesPool *= factor
            o.noPool *= factor
          }
          const existing = d.lps.find(l => l.userId === u.id && l.marketId === marketId)
          if (existing) existing.amount += amount
          else d.lps.push({ id: shortId(), userId: u.id, marketId, amount, feesEarned: 0, addedAt: Date.now() })
          d.txs.unshift({ id: shortId(), userId: u.id, type: 'adjustment', amount: -amount, status: 'completed', note: `LP deposit · ${m.question.slice(0, 40)}`, createdAt: Date.now() })
          awardXp(d, u.id, XP.lpProvide)
          grantAchievement(d, u.id, 'market-maker')
        })
        toast('success', `Providing ${fmtUsd(amount)} of liquidity — you now earn ${(s.settings.lpFeeShareBps / 100).toFixed(0)}% of this market's trading fees pro-rata`)
        return { ok: true }
      },

      withdrawLiquidity: (lpId) => {
        mutate(d => {
          const lp = d.lps.find(l => l.id === lpId)
          if (!lp) return
          const m = d.markets.find(x => x.id === lp.marketId)!
          const u = d.users.find(x => x.id === lp.userId)!
          for (const o of m.outcomes) {
            const p = o.noPool / (o.yesPool + o.noPool)
            const value = o.yesPool * p + o.noPool * (1 - p)
            const factor = Math.max(0.05, 1 - (lp.amount / m.outcomes.length) / Math.max(1, value))
            o.yesPool *= factor
            o.noPool *= factor
          }
          u.balance += lp.amount + lp.feesEarned
          d.txs.unshift({ id: shortId(), userId: u.id, type: 'adjustment', amount: lp.amount + lp.feesEarned, status: 'completed', note: `LP withdrawal + ${fmtUsd(lp.feesEarned)} fees · ${m.question.slice(0, 35)}`, createdAt: Date.now() })
          d.lps = d.lps.filter(l => l.id !== lpId)
        })
        toast('success', 'Liquidity withdrawn with accrued fees')
      },

      toggleFollow: (userId) => {
        const u = currentUser
        if (!u) { toast('info', 'Sign in to follow traders'); return }
        mutate(d => {
          const du = d.users.find(x => x.id === u.id)!
          du.follows = du.follows.includes(userId) ? du.follows.filter(id => id !== userId) : [...du.follows, userId]
        })
      },

      copyPortfolio: (leaderId, budget) => {
        const u = currentUser
        if (!u) return { ok: false, error: 'Sign in first.' }
        if (!s.settings.featureFlags.copyTrading) return { ok: false, error: 'Copy-trading is currently disabled.' }
        if (budget <= 0 || budget > u.balance) return { ok: false, error: 'Invalid budget.' }
        const legs = s.positions
          .filter(p => p.userId === leaderId)
          .map(p => ({ ...p, market: s.markets.find(m => m.id === p.marketId)! }))
          .filter(p => p.market.status === 'active')
        if (!legs.length) return { ok: false, error: 'This trader has no open positions in active markets.' }
        const totalValue = legs.reduce((a, p) => {
          const o = p.market.outcomes.find(x => x.id === p.outcomeId)!
          return a + p.shares * price(o, p.side)
        }, 0)
        for (const p of legs) {
          const o = p.market.outcomes.find(x => x.id === p.outcomeId)!
          const w = (p.shares * price(o, p.side)) / totalValue
          const res = self.trade(p.marketId, p.outcomeId, p.side, 'buy', budget * w)
          if (!res.ok) { toast('error', `Copy stopped: ${res.error}`); return res }
        }
        toast('success', `Mirrored ${legs.length} position${legs.length > 1 ? 's' : ''} pro-rata with ${fmtUsd(budget)}`)
        return { ok: true }
      },

      withdraw: (amount, method) => {
        const u = currentUser
        if (!u) return { ok: false, error: 'Sign in first.' }
        if (u.kycTier < 1) return { ok: false, needsKyc: true, error: 'Identity verification (Tier 1) is required before withdrawing.' }
        if (amount <= 0 || amount > u.balance) return { ok: false, error: 'Invalid amount.' }
        const cap = s.settings.withdrawalDailyCap[u.kycTier as 1 | 2]
        if (amount > cap) return { ok: false, error: `Tier ${u.kycTier} daily withdrawal cap is ${fmtUsd(cap, 0)}. Upgrade to Tier 2 for higher limits.`, needsKyc: u.kycTier === 1 }
        const instant = amount < s.settings.withdrawalAutoApproveUnder
        mutate(d => {
          const du = d.users.find(x => x.id === u.id)!
          du.balance -= amount
          du.totalWithdrawn += amount
          d.txs.unshift({ id: shortId(), userId: du.id, type: 'withdrawal', amount: -amount, status: instant ? 'completed' : 'pending', note: method + (instant ? '' : ' — pending review'), createdAt: Date.now() })
        })
        toast(instant ? 'success' : 'info', instant ? `Withdrawal of ${fmtUsd(amount)} sent` : `Withdrawal of ${fmtUsd(amount)} submitted for review`)
        return { ok: true, pending: !instant }
      },

      submitKyc: (tier, docType, country) => {
        const u = currentUser
        if (!u) return
        mutate(d => {
          const du = d.users.find(x => x.id === u.id)!
          du.kycStatus = 'pending'
          d.kycRequests.unshift({ id: shortId(), userId: u.id, requestedTier: tier, docType, country, status: 'pending', submittedAt: Date.now() })
        })
        toast('info', 'Verification submitted — usually reviewed within minutes in this demo (see Admin → KYC queue).')
      },

      setSelfLimits: (limits) => {
        const u = currentUser
        if (!u) return
        mutate(d => { d.users.find(x => x.id === u.id)!.selfLimits = limits })
        toast('success', 'Responsible-trading limits updated')
      },

      proposeMarket: (question, category, source) => {
        const u = currentUser
        if (!u) return
        mutate(d => {
          d.proposals.unshift({ id: shortId(), userId: u.id, question, category, resolutionSource: source, status: 'pending', submittedAt: Date.now() })
          grantAchievement(d, u.id, 'scout')
        })
        toast('success', 'Market proposal submitted for review')
      },

      toggleWatch: (marketId) => {
        const u = currentUser
        if (!u) { toast('info', 'Sign in to build a watchlist'); return }
        mutate(d => {
          const du = d.users.find(x => x.id === u.id)!
          du.watchlist = du.watchlist.includes(marketId)
            ? du.watchlist.filter(id => id !== marketId)
            : [...du.watchlist, marketId]
        })
      },

      createAlert: (marketId, outcomeId, condition, threshold) => {
        const u = currentUser
        if (!u) { toast('info', 'Sign in to set alerts'); return }
        mutate(d => {
          d.alerts.unshift({ id: shortId(), userId: u.id, marketId, outcomeId, condition, threshold, createdAt: Date.now() })
          awardXp(d, u.id, XP.alertSet)
          if (d.alerts.filter(a => a.userId === u.id && !a.triggeredAt).length >= 3) grantAchievement(d, u.id, 'scholar')
        })
        toast('success', condition === 'move'
          ? `Alert set: notify on any ${Math.round(threshold * 100)}pt move in 24h`
          : `Alert set: notify when price goes ${condition} ${Math.round(threshold * 100)}%`)
      },

      deleteAlert: (alertId) => {
        mutate(d => { d.alerts = d.alerts.filter(a => a.id !== alertId) })
      },

      addToSlip: (leg) => {
        mutate(d => {
          const existing = d.slip.findIndex(l => l.marketId === leg.marketId && l.outcomeId === leg.outcomeId)
          if (existing >= 0) d.slip[existing] = leg
          else d.slip.push(leg)
        })
        toast('info', 'Added to combo slip')
      },
      removeFromSlip: (index) => { mutate(d => { d.slip.splice(index, 1) }) },
      setSlipAmount: (index, amount) => { mutate(d => { if (d.slip[index]) d.slip[index].amount = amount }) },
      clearSlip: () => { mutate(d => { d.slip = [] }) },

      placeSlip: () => {
        const u = currentUser
        if (!u) return { ok: false, error: 'Sign in to trade.' }
        const legs = s.slip
        if (!legs.length) return { ok: false, error: 'Slip is empty.' }
        const total = legs.reduce((a, l) => a + l.amount, 0)
        if (total > u.balance) return { ok: false, error: 'Insufficient balance for the full slip.' }
        for (const leg of legs) {
          const res = self.trade(leg.marketId, leg.outcomeId, leg.side, 'buy', leg.amount)
          if (!res.ok) { toast('error', `Slip stopped: ${res.error}`); return res }
        }
        mutate(d => {
          d.slip = []
          awardXp(d, u.id, XP.combo)
          if (legs.length >= 3) grantAchievement(d, u.id, 'combo-master')
        })
        toast('success', `Combo placed — ${legs.length} legs, ${fmtUsd(total)} total`)
        return { ok: true }
      },

      // ---- Admin actions -------------------------------------------------
      adminCreateMarket: (spec) => {
        mutate(d => {
          const i = d.markets.length
          const outcomes: Outcome[] = spec.outcomes.map((o, j) => ({
            id: `o-${shortId()}-${j}`, label: o.label,
            ...seedPools(Math.max(spec.liquidity, 500) / spec.outcomes.length, o.p),
          }))
          const history: Record<string, { t: number; p: number }[]> = {}
          outcomes.forEach((o, j) => { history[o.id] = [{ t: Date.now(), p: spec.outcomes[j].p }] })
          d.markets.unshift({
            id: 'm-' + shortId(),
            slug: spec.question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'market-' + i,
            question: spec.question, description: spec.description, rules: spec.rules,
            category: spec.category, tags: [], icon: spec.icon || '🔮', type: spec.type,
            ...(spec.type === 'scalar' && spec.scalarRange ? { scalarRange: spec.scalarRange } : {}),
            outcomes, createdAt: Date.now(), closesAt: spec.closesAt,
            resolutionSource: spec.resolutionSource, oracle: spec.oracle,
            status: spec.status, volume: 0, feeBps: spec.feeBps, featured: spec.featured,
            creator: 'foresight', history,
          })
          audit(d, 'market.create', `Created "${spec.question.slice(0, 60)}" (${spec.status})`)
        })
        toast('success', 'Market created')
      },

      adminSetMarketStatus: (marketId, status, reason) => {
        mutate(d => {
          const m = d.markets.find(x => x.id === marketId)!
          m.status = status
          m.haltReason = status === 'halted' ? (reason || 'Halted by operator') : undefined
          audit(d, 'market.status', `"${m.question.slice(0, 50)}" → ${status}${reason ? ` (${reason})` : ''}`)
        })
        toast('info', `Market ${status}`)
      },

      adminToggleFeatured: (marketId) => {
        mutate(d => {
          const m = d.markets.find(x => x.id === marketId)!
          m.featured = !m.featured
          audit(d, 'market.feature', `"${m.question.slice(0, 50)}" featured=${m.featured}`)
        })
      },

      adminProposeResolution: (marketId, outcomeId, side, disputeHours, scalarValue) => {
        mutate(d => {
          const m = d.markets.find(x => x.id === marketId)!
          m.status = 'resolving'
          m.proposedResolution = { outcomeId, side, proposedAt: Date.now(), disputeEndsAt: Date.now() + disputeHours * 3600000, by: d.sessionUserId ?? 'system', scalarValue }
          const label = m.type === 'scalar'
            ? `${scalarValue}${m.scalarRange?.unit ?? ''}`
            : `${m.outcomes.find(o => o.id === outcomeId)?.label} ${side.toUpperCase()}`
          audit(d, 'market.resolution-proposed', `"${m.question.slice(0, 50)}" → ${label} (dispute window ${disputeHours}h)`)
        })
        toast('info', 'Resolution proposed — dispute window open')
      },

      adminFinalizeResolution: (marketId) => {
        mutate(d => {
          const m = d.markets.find(x => x.id === marketId)!
          const pr = m.proposedResolution
          if (!pr) return
          if (m.type === 'scalar' && m.scalarRange && pr.scalarValue !== undefined) {
            const { min, max } = m.scalarRange
            m.settlementFraction = Math.min(1, Math.max(0, (pr.scalarValue - min) / (max - min)))
            m.outcomes[0].resolved = m.settlementFraction >= 0.5 ? 'yes' : 'no'
          } else {
            for (const o of m.outcomes) {
              if (m.type === 'multi') o.resolved = o.id === pr.outcomeId ? 'yes' : 'no'
              else o.resolved = pr.side
            }
          }
          m.status = 'resolved'
          m.resolvedAt = Date.now()
          settleMarket(d, m)
          audit(d, 'market.resolve', `Finalized "${m.question.slice(0, 50)}" — positions settled`)
        })
        toast('success', 'Market resolved and positions settled')
      },

      adminCancelResolution: (marketId) => {
        mutate(d => {
          const m = d.markets.find(x => x.id === marketId)!
          m.proposedResolution = undefined
          m.status = 'active'
          audit(d, 'market.resolution-cancelled', `Cancelled proposed resolution on "${m.question.slice(0, 50)}"`)
        })
        toast('info', 'Proposed resolution withdrawn')
      },

      adminReviewKyc: (requestId, approve, reason) => {
        mutate(d => {
          const r = d.kycRequests.find(x => x.id === requestId)!
          r.status = approve ? 'approved' : 'rejected'
          r.reviewedAt = Date.now()
          r.reviewedBy = d.sessionUserId ?? undefined
          r.rejectReason = approve ? undefined : reason
          const u = d.users.find(x => x.id === r.userId)!
          if (approve) { u.kycTier = r.requestedTier; u.kycStatus = 'approved' }
          else { u.kycStatus = 'rejected' }
          notify(d, u.id, 'kyc', approve ? `You're verified — Tier ${r.requestedTier} unlocked ✅` : 'Verification needs another look',
            approve ? 'Higher limits and withdrawals are now available.' : `Your submission was rejected${reason ? `: ${reason}` : ''}. You can resubmit anytime.`, '#/wallet')
          audit(d, approve ? 'kyc.approve' : 'kyc.reject', `${approve ? 'Approved' : 'Rejected'} Tier ${r.requestedTier} for @${u.handle}${reason ? ` — ${reason}` : ''}`)
        })
        toast(approve ? 'success' : 'info', approve ? 'KYC approved' : 'KYC rejected')
      },

      adminReviewWithdrawal: (txId, approve) => {
        mutate(d => {
          const tx = d.txs.find(x => x.id === txId)!
          tx.status = approve ? 'completed' : 'rejected'
          const u = d.users.find(x => x.id === tx.userId)!
          if (!approve) { u.balance += -tx.amount; u.totalWithdrawn -= -tx.amount; tx.note += ' — rejected, funds returned' }
          notify(d, u.id, 'withdrawal', approve ? 'Withdrawal approved' : 'Withdrawal rejected',
            approve ? `Your ${fmtUsd(-tx.amount)} withdrawal has been sent.` : `Your ${fmtUsd(-tx.amount)} withdrawal was rejected and funds were returned to your balance.`, '#/wallet')
          audit(d, approve ? 'finance.withdrawal-approve' : 'finance.withdrawal-reject', `${approve ? 'Approved' : 'Rejected'} ${fmtUsd(-tx.amount)} withdrawal for @${u.handle}`)
        })
        toast('success', approve ? 'Withdrawal approved' : 'Withdrawal rejected — funds returned')
      },

      adminReviewProposal: (proposalId, approve) => {
        mutate(d => {
          const p = d.proposals.find(x => x.id === proposalId)!
          p.status = approve ? 'approved' : 'rejected'
          audit(d, approve ? 'community.proposal-approve' : 'community.proposal-reject', `${approve ? 'Approved' : 'Rejected'} proposal "${p.question.slice(0, 50)}"`)
        })
        toast('info', approve ? 'Proposal approved — create the market from the wizard' : 'Proposal rejected')
      },

      adminSetUserSuspended: (userId, suspended) => {
        mutate(d => {
          const u = d.users.find(x => x.id === userId)!
          u.suspended = suspended
          audit(d, suspended ? 'user.suspend' : 'user.reinstate', `${suspended ? 'Suspended' : 'Reinstated'} @${u.handle}`)
        })
        toast('info', suspended ? 'User suspended' : 'User reinstated')
      },

      adminAdjustBalance: (userId, amount, note) => {
        mutate(d => {
          const u = d.users.find(x => x.id === userId)!
          u.balance += amount
          d.txs.unshift({ id: shortId(), userId, type: 'adjustment', amount, status: 'completed', note: note || 'Manual adjustment', createdAt: Date.now() })
          audit(d, 'finance.adjustment', `${amount >= 0 ? 'Credited' : 'Debited'} ${fmtUsd(Math.abs(amount))} ${amount >= 0 ? 'to' : 'from'} @${u.handle}: ${note}`)
        })
        toast('success', 'Balance adjusted')
      },

      adminUpdateSettings: (patch) => {
        mutate(d => {
          Object.assign(d.settings, patch)
          audit(d, 'settings.update', Object.keys(patch).join(', ') + ' updated')
        })
        toast('success', 'Settings saved')
      },

      adminToggleFlag: (flag) => {
        mutate(d => {
          d.settings.featureFlags[flag] = !d.settings.featureFlags[flag]
          audit(d, 'settings.flag', `${flag} → ${d.settings.featureFlags[flag] ? 'on' : 'off'}`)
        })
      },

      adminAddLiquidity: (marketId, amount) => {
        mutate(d => {
          const m = d.markets.find(x => x.id === marketId)!
          for (const o of m.outcomes) {
            // scale both pools proportionally: deepens the book without moving the price
            const value = o.yesPool * (o.noPool / (o.yesPool + o.noPool)) + o.noPool * (o.yesPool / (o.yesPool + o.noPool))
            const factor = 1 + (amount / m.outcomes.length) / Math.max(1, value)
            o.yesPool *= factor
            o.noPool *= factor
          }
          audit(d, 'liquidity.add', `Added ${fmtUsd(amount, 0)} house liquidity to "${m.question.slice(0, 50)}"`)
        })
        toast('success', 'Liquidity added — book deepened at the current price')
      },

      adminReviewComplianceAlert: (alertId, status) => {
        mutate(d => {
          const a = d.complianceAlerts.find(x => x.id === alertId)!
          a.status = status
          const u = d.users.find(x => x.id === a.userId)
          audit(d, 'compliance.review', `${a.kind} alert on @${u?.handle} → ${status}`)
        })
        toast('info', `Alert ${status}`)
      },

      adminSetAnnouncement: (text, kind) => {
        mutate(d => {
          d.settings.announcement = { text, kind, at: Date.now() }
          audit(d, 'platform.announce', `Published ${kind} banner: "${text.slice(0, 60)}"`)
        })
        toast('success', 'Announcement is live on the exchange')
      },

      adminClearAnnouncement: () => {
        mutate(d => {
          d.settings.announcement = null
          audit(d, 'platform.announce', 'Cleared site banner')
        })
        toast('info', 'Announcement removed')
      },

      adminCreateApiKey: (label, scopes, rateLimitPerMin) => {
        mutate(d => {
          d.apiKeys.unshift({
            id: shortId(), label, key: 'fsk_live_' + shortId() + shortId().slice(0, 4),
            scopes, rateLimitPerMin, createdAt: Date.now(), requests30d: 0, lastUsedAt: null, revoked: false,
          })
          audit(d, 'api.key-create', `Issued API key "${label}" (${scopes.join(', ')} @ ${rateLimitPerMin}/min)`)
        })
        toast('success', 'API key issued')
      },

      adminRevokeApiKey: (keyId) => {
        mutate(d => {
          const k = d.apiKeys.find(x => x.id === keyId)!
          k.revoked = true
          audit(d, 'api.key-revoke', `Revoked API key "${k.label}"`)
        })
        toast('info', 'API key revoked')
      },

      createCopyLink: (leaderId, perTradeCap) => {
        const u = currentUser
        if (!u) { toast('info', 'Sign in first'); return }
        mutate(d => {
          const existing = d.copyLinks.find(l => l.followerId === u.id && l.leaderId === leaderId)
          if (existing) { existing.active = true; existing.perTradeCap = perTradeCap }
          else d.copyLinks.push({ id: shortId(), followerId: u.id, leaderId, perTradeCap, active: true, createdAt: Date.now(), mirrored: 0 })
          const du = d.users.find(x => x.id === u.id)!
          if (!du.follows.includes(leaderId)) du.follows.push(leaderId)
        })
        const leader = userById(leaderId)
        toast('success', `Auto-mirroring @${leader?.handle} — up to ${fmtUsd(perTradeCap, 0)} per trade. Cancel anytime from the leaderboard.`)
      },

      cancelCopyLink: (linkId) => {
        mutate(d => { const l = d.copyLinks.find(x => x.id === linkId); if (l) l.active = false })
        toast('info', 'Auto-mirroring stopped')
      },

      markNotificationsRead: () => {
        const u = currentUser
        if (!u) return
        if (!s.notifications.some(n => n.userId === u.id && !n.read)) return
        mutate(d => { d.notifications.forEach(n => { if (n.userId === u.id) n.read = true }) })
      },

      dismissNotification: (id) => {
        mutate(d => { d.notifications = d.notifications.filter(n => n.id !== id) })
      },

      runNotificationEngine: () => {
        mutate(d => {
          if (d.sessionUserId) touchLogin(d, d.sessionUserId)
          runEngine(d)
        })
      },

      adminCreateWebhook: (url, events) => {
        mutate(d => {
          d.settings.webhooks.push({ id: shortId(), url, events, active: true, deliveries30d: 0 })
          audit(d, 'api.webhook-create', `Webhook ${url} (${events.join(', ')})`)
        })
        toast('success', 'Webhook registered')
      },

      adminToggleWebhook: (id) => {
        mutate(d => {
          const w = d.settings.webhooks.find(x => x.id === id)!
          w.active = !w.active
          audit(d, 'api.webhook-toggle', `${w.url} → ${w.active ? 'active' : 'paused'}`)
        })
      },

      adminDeleteWebhook: (id) => {
        mutate(d => {
          const w = d.settings.webhooks.find(x => x.id === id)
          d.settings.webhooks = d.settings.webhooks.filter(x => x.id !== id)
          if (w) audit(d, 'api.webhook-delete', w.url)
        })
        toast('info', 'Webhook deleted')
      },

      adminSendNotification: (target, title, text) => {
        mutate(d => {
          const targets = target === 'all' ? d.users.filter(u => !u.isAdmin && !u.suspended) : d.users.filter(u => u.id === target)
          for (const u of targets) notify(d, u.id, 'admin-message', title, text)
          audit(d, 'comms.notification', `Sent "${title}" to ${target === 'all' ? `${targets.length} users` : '@' + (targets[0]?.handle ?? target)}`)
        })
        toast('success', 'Notification sent')
      },

      adminSaveReport: (name, metrics, rangeDays) => {
        mutate(d => {
          d.settings.savedReports.unshift({ id: shortId(), name, metrics, rangeDays, createdAt: Date.now() })
          audit(d, 'analytics.report-save', `Saved report "${name}" (${metrics.join(', ')}, ${rangeDays}d)`)
        })
        toast('success', 'Report saved')
      },

      adminDeleteReport: (id) => {
        mutate(d => { d.settings.savedReports = d.settings.savedReports.filter(r => r.id !== id) })
        toast('info', 'Report deleted')
      },

      exportStateJson: () => JSON.stringify(s, null, 2),

      importStateJson: (raw) => {
        try {
          const parsed = JSON.parse(raw) as AppState
          if (typeof parsed !== 'object' || parsed === null) return { ok: false, error: 'Not a JSON object.' }
          if (parsed.version !== 7) return { ok: false, error: `Version mismatch: expected 7, got ${(parsed as any).version}.` }
          for (const key of ['users', 'markets', 'positions', 'orders', 'txs', 'notifications'] as const) {
            if (!Array.isArray(parsed[key])) return { ok: false, error: `Missing or invalid collection: ${key}` }
          }
          setState(parsed)
          toast('success', 'Backup imported — state restored')
          return { ok: true }
        } catch (e) {
          return { ok: false, error: 'Invalid JSON: ' + (e as Error).message }
        }
      },

      pruneHistory: () => {
        mutate(d => {
          let removed = 0
          for (const m of d.markets) {
            for (const oid of Object.keys(m.history)) {
              const h = m.history[oid]
              if (h.length > 240) { removed += h.length - 240; m.history[oid] = h.slice(-240) }
            }
          }
          d.trades = d.trades.slice(0, 100)
          d.audit = d.audit.slice(0, 200)
          audit(d, 'data.prune', `Pruned ${removed.toLocaleString()} price points; trimmed trade + audit logs`)
        })
        toast('success', 'History pruned — storage compacted')
      },

      resetDemo: () => {
        localStorage.removeItem(LS_KEY)
        setState(buildSeed())
        toast('success', 'Demo data reset to the original seed')
      },
    }
    return self
  }, [state, toasts, mutate, toast, dismissToast])

  // Autonomous notification engine: runs on load and every 45s.
  const apiRef = useRef(api)
  apiRef.current = api
  useEffect(() => {
    const t = setTimeout(() => apiRef.current.runNotificationEngine(), 800)
    const iv = setInterval(() => apiRef.current.runNotificationEngine(), 45000)
    return () => { clearTimeout(t); clearInterval(iv) }
  }, [])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export const useStore = (): StoreApi => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}
