export type KycTier = 0 | 1 | 2
export type KycStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type MarketType = 'binary' | 'multi' | 'scalar'
export type MarketStatus = 'draft' | 'active' | 'halted' | 'closed' | 'resolving' | 'disputed' | 'resolved'
export type OracleType = 'admin' | 'committee' | 'ai-assisted' | 'external'
export type Side = 'yes' | 'no'
export type Direction = 'buy' | 'sell'

export interface PricePoint {
  t: number // epoch ms
  p: number // probability 0..1
}

export interface Outcome {
  id: string
  label: string
  // Constant-product AMM pools (share tokens held by the pool)
  yesPool: number
  noPool: number
  resolved?: Side // set when market resolves: 'yes' if this outcome occurred
}

export interface Market {
  id: string
  slug: string
  question: string
  description: string
  rules: string
  category: string
  tags: string[]
  icon: string // emoji
  type: MarketType
  outcomes: Outcome[]
  scalarRange?: { min: number; max: number; unit: string }
  createdAt: number
  closesAt: number
  resolutionSource: string
  oracle: OracleType
  status: MarketStatus
  haltReason?: string
  proposedResolution?: { outcomeId: string; side: Side; proposedAt: number; disputeEndsAt: number; by: string; scalarValue?: number }
  settlementFraction?: number // scalar markets: 0..1 of the range at resolution
  resolvedAt?: number
  volume: number
  feeBps: number
  featured: boolean
  creator: string // 'foresight' | user id (community markets)
  history: Record<string, PricePoint[]> // outcomeId -> series
}

export interface Position {
  id: string
  userId: string
  marketId: string
  outcomeId: string
  side: Side
  shares: number
  avgPrice: number // cost per share paid on average
  realizedPnl: number
}

export interface Order {
  id: string
  userId: string
  marketId: string
  outcomeId: string
  side: Side
  direction: Direction
  limitPrice: number
  shares: number
  filled: number
  status: 'open' | 'filled' | 'partial' | 'cancelled'
  createdAt: number
}

export type TxType = 'deposit' | 'withdrawal' | 'trade' | 'settlement' | 'fee' | 'adjustment'
export type TxStatus = 'completed' | 'pending' | 'rejected'

export interface Tx {
  id: string
  userId: string
  type: TxType
  amount: number // positive = credit to user, negative = debit
  status: TxStatus
  note: string
  createdAt: number
  // crypto rails (deposits/withdrawals)
  asset?: string
  network?: string
  txHash?: string
  confirmations?: number
  confirmationsNeeded?: number
}

export interface LpPosition {
  id: string
  userId: string
  marketId: string
  amount: number // principal provided
  feesEarned: number
  addedAt: number
}

export interface ApiKey {
  id: string
  label: string
  key: string // public demo key, e.g. fsk_live_xxx
  scopes: string[]
  rateLimitPerMin: number
  createdAt: number
  requests30d: number
  lastUsedAt: number | null
  revoked: boolean
}

export interface KycRequest {
  id: string
  userId: string
  requestedTier: KycTier
  docType: string
  country: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: number
  reviewedAt?: number
  reviewedBy?: string
  rejectReason?: string
}

export interface User {
  id: string
  email: string
  name: string
  handle: string
  avatarHue: number
  balance: number
  kycTier: KycTier
  kycStatus: KycStatus
  country: string
  createdAt: number
  isAdmin: boolean
  suspended: boolean
  riskFlags: string[]
  selfLimits: { dailyLossCap: number | null; coolOffUntil: number | null }
  totalDeposited: number
  totalWithdrawn: number
  watchlist: string[] // market ids
  // Forecasting stats for the leaderboard (seeded; recomputed server-side in prod)
  stats: { profit30d: number; calibration: number; resolvedCount: number; winRate: number; streak: number }
  referralCode: string
  referredBy: string | null // referral code used at signup
  referralRewardPaid: boolean
  follows: string[] // user ids this account follows (copy-trading)
  notificationPrefs: { email: boolean; push: boolean }
  authProvider: 'email' | 'google' | 'apple' | 'x'
  // gamification
  xp: number
  achievements: string[] // achievement ids
  loginStreak: number
  lastLoginDay: string // YYYY-MM-DD
  lastTradeAt: number | null
}

export interface TradeEvent {
  id: string
  marketId: string
  userId: string
  outcomeId: string
  side: Side
  direction: Direction
  shares: number
  price: number
  at: number
}

export interface PriceAlert {
  id: string
  userId: string
  marketId: string
  outcomeId: string
  // above/below an absolute probability, or any 24h move of >= threshold pts
  condition: 'above' | 'below' | 'move'
  threshold: number // probability 0..1 (for 'move': the move size, e.g. 0.05)
  createdAt: number
  triggeredAt?: number
}

export type NotificationKind =
  | 'price-alert' | 'settlement' | 'kyc' | 'withdrawal' | 'reward'
  | 'reminder-kyc' | 'reminder-trade' | 'watchlist-move' | 'closing-soon'
  | 'achievement' | 'level-up' | 'admin-message' | 'copy-trade'

export interface AppNotification {
  id: string
  userId: string
  kind: NotificationKind
  title: string
  text: string
  link?: string // hash route
  read: boolean
  at: number
}

export interface SavedReport {
  id: string
  name: string
  metrics: string[] // metric ids from the report builder
  rangeDays: number
  createdAt: number
}

export interface CopyLink {
  id: string
  followerId: string
  leaderId: string
  perTradeCap: number // $ mirrored per leader trade
  active: boolean
  createdAt: number
  mirrored: number // total $ mirrored so far
}

export interface SlipLeg {
  marketId: string
  outcomeId: string
  side: Side
  amount: number
}

export interface ComplianceAlert {
  id: string
  userId: string
  kind: 'velocity' | 'structuring' | 'sanctions' | 'self-limit' | 'chargeback'
  severity: 'serious' | 'critical'
  detail: string
  status: 'open' | 'acknowledged' | 'dismissed'
  at: number
}

export interface AuditEntry {
  id: string
  actorId: string
  actorName: string
  action: string
  detail: string
  at: number
}

export interface MarketProposal {
  id: string
  userId: string
  question: string
  category: string
  resolutionSource: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: number
}

export interface Settings {
  tradingFeeBps: number
  withdrawalFeeFlat: number
  makerRebateBps: number // credited on resting limit-order fills
  lpFeeShareBps: number // share of each trading fee routed to that market's LPs (bps of the fee)
  referralReward: number // $ credited to referrer on referee's first confirmed deposit
  referralMinDeposit: number
  // KYC gating: max cumulative trade notional per tier ($). Withdrawals need tier >= 1.
  tierTradeCaps: { 0: number; 1: number; 2: number }
  withdrawalAutoApproveUnder: number
  withdrawalDailyCap: { 1: number; 2: number }
  circuitBreaker: { enabled: boolean; movePct: number }
  geoBlocked: string[]
  featureFlags: {
    communityMarkets: boolean
    aiResolutionAssist: boolean
    limitOrders: boolean
    leaderboard: boolean
    scalarMarkets: boolean
    negRiskBundles: boolean
    copyTrading: boolean
    referrals: boolean
    lpProgram: boolean
    publicApi: boolean
    gamification: boolean
  }
  autoNotify: {
    kycReminders: boolean
    tradeReminders: boolean
    watchlistMovers: boolean
    closingSoon: boolean
    inactivityDays: number // trade reminder after N days without trading
    moveThresholdPts: number // watchlist mover threshold, in probability points
  }
  webhooks: { id: string; url: string; events: string[]; active: boolean; deliveries30d: number }[]
  email: {
    provider: 'sendgrid' | 'postmark' | 'ses'
    apiKeySet: boolean
    fromAddress: string
    sandboxMode: boolean
    sent30d: number
    templates: { id: string; name: string; trigger: string }[]
  }
  savedReports: SavedReport[]
  dailyVolume: { date: string; volume: number; trades: number; signups: number }[]
  announcement: { text: string; kind: 'info' | 'warning' | 'critical'; at: number } | null
}

export interface AppState {
  version: number
  sessionUserId: string | null
  users: User[]
  markets: Market[]
  positions: Position[]
  orders: Order[]
  txs: Tx[]
  kycRequests: KycRequest[]
  proposals: MarketProposal[]
  audit: AuditEntry[]
  trades: TradeEvent[]
  alerts: PriceAlert[]
  complianceAlerts: ComplianceAlert[]
  slip: SlipLeg[]
  lps: LpPosition[]
  apiKeys: ApiKey[]
  notifications: AppNotification[]
  copyLinks: CopyLink[]
  settings: Settings
}
