import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppState, Direction, KycTier, Market, MarketStatus, Order, Outcome, Position, Settings, Side, User } from './types'
import { buildSeed } from './seed'
import { applyBuy, applySell, price, quoteBuy, quoteSell, seedPools } from './engine'
import { fmtCents, fmtUsd, shortId } from './format'

const LS_KEY = 'foresight-demo-state-v3'

const load = (): AppState => {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version === 3) return parsed
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
  signUp: (email: string, name: string) => { ok: boolean; error?: string }
  signOut: () => void
  signInAsAdmin: () => void

  openPositionCost: (userId: string) => number
  trade: (marketId: string, outcomeId: string, side: Side, direction: Direction, amount: number) => TradeResult
  placeLimitOrder: (marketId: string, outcomeId: string, side: Side, limitPrice: number, shares: number) => TradeResult
  cancelOrder: (orderId: string) => void

  deposit: (amount: number, method: string) => void
  withdraw: (amount: number, method: string) => { ok: boolean; error?: string; pending?: boolean; needsKyc?: boolean }
  submitKyc: (tier: KycTier, docType: string, country: string) => void
  setSelfLimits: (limits: User['selfLimits']) => void
  proposeMarket: (question: string, category: string, source: string) => void

  // Admin
  adminCreateMarket: (m: {
    question: string; description: string; rules: string; category: string; icon: string
    type: 'binary' | 'multi'; outcomes: { label: string; p: number }[]
    closesAt: number; resolutionSource: string; oracle: Market['oracle']
    liquidity: number; feeBps: number; featured: boolean; status: 'draft' | 'active'
  }) => void
  adminSetMarketStatus: (marketId: string, status: MarketStatus, reason?: string) => void
  adminToggleFeatured: (marketId: string) => void
  adminProposeResolution: (marketId: string, outcomeId: string, side: Side, disputeHours: number) => void
  adminFinalizeResolution: (marketId: string) => void
  adminCancelResolution: (marketId: string) => void
  adminReviewKyc: (requestId: string, approve: boolean, reason?: string) => void
  adminReviewWithdrawal: (txId: string, approve: boolean) => void
  adminReviewProposal: (proposalId: string, approve: boolean) => void
  adminSetUserSuspended: (userId: string, suspended: boolean) => void
  adminAdjustBalance: (userId: string, amount: number, note: string) => void
  adminUpdateSettings: (patch: Partial<Settings>) => void
  adminToggleFlag: (flag: keyof Settings['featureFlags']) => void
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
        const user = draft.users.find(u => u.id === ord.userId)!
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
        draft.txs.unshift({ id: shortId(), userId: user.id, type: 'trade', amount: -actualSpend, status: 'completed', note: `Limit fill: ${filled.toFixed(0)} ${ord.side.toUpperCase()} @ ${fmtCents(q.avgPrice)} · ${m.question.slice(0, 40)}`, createdAt: Date.now() })
      }
    }

    const settleMarket = (draft: AppState, m: Market) => {
      for (const pos of draft.positions.filter(p => p.marketId === m.id)) {
        const o = m.outcomes.find(x => x.id === pos.outcomeId)
        if (!o || !o.resolved) continue
        const wins = pos.side === o.resolved
        const payout = wins ? pos.shares : 0
        const user = draft.users.find(u => u.id === pos.userId)
        if (user && payout > 0) {
          user.balance += payout
          draft.txs.unshift({ id: shortId(), userId: user.id, type: 'settlement', amount: payout, status: 'completed', note: `Settlement: ${m.question.slice(0, 50)}`, createdAt: Date.now() })
        }
        pos.realizedPnl += payout - pos.shares * pos.avgPrice
      }
      draft.positions = draft.positions.filter(p => p.marketId !== m.id)
      draft.orders.forEach(o => { if (o.marketId === m.id && (o.status === 'open' || o.status === 'partial')) o.status = 'cancelled' })
    }

    const self: StoreApi = {
      state: s, toasts, toast, dismissToast, currentUser, userById, marketById, openPositionCost,

      signIn: (email) => {
        const u = s.users.find(x => x.email.toLowerCase() === email.toLowerCase())
        if (!u) return { ok: false, error: 'No account found for that email. Try signing up.' }
        if (u.suspended) return { ok: false, error: 'This account is suspended. Contact support.' }
        mutate(d => { d.sessionUserId = u.id })
        toast('success', `Welcome back, ${u.name.split(' ')[0]}!`)
        return { ok: true }
      },

      signUp: (email, name) => {
        if (s.users.some(x => x.email.toLowerCase() === email.toLowerCase()))
          return { ok: false, error: 'An account with that email already exists.' }
        mutate(d => {
          const u: User = {
            id: 'u-' + shortId(), email, name, handle: name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
            avatarHue: Math.floor(Math.random() * 360), balance: 100, kycTier: 0, kycStatus: 'none',
            country: 'US', createdAt: Date.now(), isAdmin: false, suspended: false, riskFlags: [],
            selfLimits: { dailyLossCap: null, coolOffUntil: null }, totalDeposited: 0, totalWithdrawn: 0,
          }
          d.users.push(u)
          d.sessionUserId = u.id
          d.txs.unshift({ id: shortId(), userId: u.id, type: 'adjustment', amount: 100, status: 'completed', note: 'Welcome credit', createdAt: Date.now() })
        })
        toast('success', 'Account created — $100 welcome credit added. Verify identity later, only when you need higher limits or withdrawals.')
        return { ok: true }
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
            d.txs.unshift({ id: shortId(), userId: du.id, type: 'trade', amount: -amount, status: 'completed', note: `Buy ${q.shares.toFixed(0)} ${side.toUpperCase()} @ ${fmtCents(q.avgPrice)} · ${m.question.slice(0, 40)}`, createdAt: Date.now() })
            if (fee > 0) d.txs.unshift({ id: shortId(), userId: du.id, type: 'fee', amount: 0, status: 'completed', note: `Trading fee ${fmtUsd(fee)} included`, createdAt: Date.now() })
            const newP = price(dm.outcomes[idx])
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

      deposit: (amount, method) => {
        if (!currentUser) return
        mutate(d => {
          const u = d.users.find(x => x.id === currentUser.id)!
          u.balance += amount
          u.totalDeposited += amount
          d.txs.unshift({ id: shortId(), userId: u.id, type: 'deposit', amount, status: 'completed', note: method, createdAt: Date.now() })
        })
        toast('success', `Deposited ${fmtUsd(amount)} via ${method}`)
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
        })
        toast('success', 'Market proposal submitted for review')
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

      adminProposeResolution: (marketId, outcomeId, side, disputeHours) => {
        mutate(d => {
          const m = d.markets.find(x => x.id === marketId)!
          m.status = 'resolving'
          m.proposedResolution = { outcomeId, side, proposedAt: Date.now(), disputeEndsAt: Date.now() + disputeHours * 3600000, by: d.sessionUserId ?? 'system' }
          const label = m.outcomes.find(o => o.id === outcomeId)?.label
          audit(d, 'market.resolution-proposed', `"${m.question.slice(0, 50)}" → ${label} ${side.toUpperCase()} (dispute window ${disputeHours}h)`)
        })
        toast('info', 'Resolution proposed — dispute window open')
      },

      adminFinalizeResolution: (marketId) => {
        mutate(d => {
          const m = d.markets.find(x => x.id === marketId)!
          const pr = m.proposedResolution
          if (!pr) return
          for (const o of m.outcomes) {
            if (m.type === 'multi') o.resolved = o.id === pr.outcomeId ? 'yes' : 'no'
            else o.resolved = pr.side
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

      resetDemo: () => {
        localStorage.removeItem(LS_KEY)
        setState(buildSeed())
        toast('success', 'Demo data reset to the original seed')
      },
    }
    return self
  }, [state, toasts, mutate, toast, dismissToast])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export const useStore = (): StoreApi => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}
