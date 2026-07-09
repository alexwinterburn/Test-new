import type { AppState, Market, Outcome, PricePoint, User } from './types'
import { seedPools } from './engine'

// Deterministic RNG so demo data is stable between resets
const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const DAY = 86400000
const now = () => Date.now()

const walk = (rng: () => number, days: number, end: number, vol = 0.035): PricePoint[] => {
  const pts: PricePoint[] = []
  let p = end
  const t0 = now()
  const rev: number[] = [p]
  for (let i = 1; i < days * 4; i++) {
    p = Math.min(0.97, Math.max(0.03, p + (rng() - 0.5) * vol))
    rev.push(p)
  }
  rev.reverse()
  for (let i = 0; i < rev.length; i++) {
    pts.push({ t: t0 - (rev.length - 1 - i) * (DAY / 4), p: rev[i] })
  }
  return pts
}

interface MarketSpec {
  q: string; desc: string; rules: string; cat: string; tags: string[]; icon: string
  closesDays: number; source: string; oracle: Market['oracle']; featured?: boolean
  vol: number; liq: number; feeBps?: number
  outcomes: { label: string; p: number }[] // p = current YES probability
  type?: Market['type']; scalarRange?: Market['scalarRange']; status?: Market['status']
  creator?: string
}

const specs: MarketSpec[] = [
  {
    q: 'Will the Fed cut rates at the September 2026 FOMC meeting?',
    desc: 'Resolves YES if the FOMC lowers the target federal funds rate at its scheduled September 2026 meeting.',
    rules: 'Resolves YES if the target range upper bound is reduced by at least 25bps versus the prior meeting. An inter-meeting emergency cut before the September meeting also resolves YES. Source: federalreserve.gov official statement.',
    cat: 'Economics', tags: ['fed', 'rates', 'macro'], icon: '🏦', closesDays: 68,
    source: 'federalreserve.gov', oracle: 'ai-assisted', featured: true,
    vol: 2841503, liq: 240000, outcomes: [{ label: 'Yes', p: 0.63 }],
  },
  {
    q: 'Will Bitcoin close above $150,000 on December 31, 2026?',
    desc: 'Resolves to the BTC/USD closing price on the final day of 2026.',
    rules: 'Resolves YES if the Coinbase BTC-USD 1-minute candle close at 23:59 UTC on 2026-12-31 is strictly above $150,000. Fallback source: CF Benchmarks BRTI.',
    cat: 'Crypto', tags: ['bitcoin', 'btc'], icon: '₿', closesDays: 175,
    source: 'Coinbase BTC-USD', oracle: 'external', featured: true,
    vol: 5120990, liq: 410000, outcomes: [{ label: 'Yes', p: 0.41 }],
  },
  {
    q: 'Who will win the 2028 US Presidential Election?',
    desc: 'Multi-outcome market on the winner of the 2028 United States presidential election.',
    rules: 'Resolves to the candidate who wins 270+ electoral votes and is certified by Congress. If no candidate is certified by inauguration day, resolves per the person inaugurated.',
    cat: 'Politics', tags: ['us', 'election', '2028'], icon: '🗳️', closesDays: 850,
    source: 'AP / Congressional certification', oracle: 'committee', featured: true,
    vol: 9284310, liq: 780000, type: 'multi',
    outcomes: [
      { label: 'Democratic nominee', p: 0.46 },
      { label: 'Republican nominee', p: 0.47 },
      { label: 'Independent / other', p: 0.05 },
    ],
  },
  {
    q: 'Will a frontier lab announce an AI system passing a formal ARC-AGI-3 evaluation by mid-2027?',
    desc: 'Tracks whether any major AI lab publicly reports a verified passing score on the ARC-AGI-3 benchmark suite.',
    rules: 'Resolves YES on an official announcement from the ARC Prize Foundation verifying a score above the human baseline before 2027-07-01.',
    cat: 'AI & Tech', tags: ['ai', 'benchmarks'], icon: '🤖', closesDays: 350,
    source: 'ARC Prize Foundation', oracle: 'ai-assisted', featured: true,
    vol: 1873220, liq: 150000, outcomes: [{ label: 'Yes', p: 0.28 }],
  },
  {
    q: 'Will SpaceX Starship complete a fully successful orbital crew flight in 2026?',
    desc: 'Crewed Starship flight reaching orbit and landing with all crew safe, during calendar 2026.',
    rules: 'Resolves YES if SpaceX confirms a crewed Starship mission reached orbital velocity and returned all crew safely before 2027-01-01 UTC.',
    cat: 'Science', tags: ['space', 'spacex'], icon: '🚀', closesDays: 175,
    source: 'SpaceX / NASA', oracle: 'admin',
    vol: 942100, liq: 90000, outcomes: [{ label: 'Yes', p: 0.19 }],
  },
  {
    q: 'Premier League 2026-27: who wins the title?',
    desc: 'Multi-outcome market on the 2026–27 English Premier League champion.',
    rules: 'Resolves to the club awarded the 2026-27 Premier League trophy by the league.',
    cat: 'Sports', tags: ['football', 'epl'], icon: '⚽', closesDays: 320,
    source: 'premierleague.com', oracle: 'external',
    vol: 3310870, liq: 260000, type: 'multi',
    outcomes: [
      { label: 'Arsenal', p: 0.31 },
      { label: 'Manchester City', p: 0.27 },
      { label: 'Liverpool', p: 0.22 },
      { label: 'Other club', p: 0.20 },
    ],
  },
  {
    q: 'Will 2026 be the hottest year on record globally?',
    desc: 'Based on the NASA GISTEMP annual global mean surface temperature anomaly.',
    rules: 'Resolves YES if NASA GISS reports the 2026 annual anomaly as the highest in the instrumental record when first published in January 2027.',
    cat: 'Climate', tags: ['climate', 'nasa'], icon: '🌡️', closesDays: 190,
    source: 'NASA GISTEMP', oracle: 'external',
    vol: 512040, liq: 60000, outcomes: [{ label: 'Yes', p: 0.55 }],
  },
  {
    q: 'Will Apple ship a foldable iPhone before the end of 2027?',
    desc: 'First-party foldable iPhone generally available to consumers.',
    rules: 'Resolves YES if Apple begins consumer sales of an iPhone with a folding display before 2028-01-01 in at least one country.',
    cat: 'AI & Tech', tags: ['apple', 'hardware'], icon: '📱', closesDays: 540,
    source: 'apple.com', oracle: 'admin',
    vol: 689420, liq: 70000, outcomes: [{ label: 'Yes', p: 0.72 }],
  },
  {
    q: 'US CPI year-over-year for June 2026: above 3.0%?',
    desc: 'Headline CPI-U YoY as published by the BLS for June 2026.',
    rules: 'Resolves YES if the BLS June 2026 CPI-U 12-month unadjusted change first print is strictly above 3.0%.',
    cat: 'Economics', tags: ['cpi', 'inflation'], icon: '📈', closesDays: 6,
    source: 'bls.gov', oracle: 'external',
    vol: 1204930, liq: 130000, outcomes: [{ label: 'Yes', p: 0.34 }],
  },
  {
    q: 'Will the next James Bond actor be announced in 2026?',
    desc: 'Official announcement of the actor succeeding in the Bond role.',
    rules: 'Resolves YES on an official Amazon MGM / EON announcement naming the next Bond before 2027-01-01.',
    cat: 'Culture', tags: ['film'], icon: '🎬', closesDays: 175,
    source: 'Amazon MGM', oracle: 'admin',
    vol: 301220, liq: 30000, outcomes: [{ label: 'Yes', p: 0.58 }],
  },
  {
    q: 'Ethereum average gas fee below 1 gwei for a full week in 2026?',
    desc: 'A community-proposed market on sustained ultra-low L1 gas prices.',
    rules: 'Resolves YES if the 7-day simple average of Etherscan daily average gas price is below 1 gwei for any calendar week ending in 2026.',
    cat: 'Crypto', tags: ['ethereum', 'gas'], icon: '⛽', closesDays: 175,
    source: 'Etherscan', oracle: 'ai-assisted', creator: 'u-dana',
    vol: 154310, liq: 20000, outcomes: [{ label: 'Yes', p: 0.12 }],
  },
  {
    q: 'Will India win the 2026 T20 Cricket World Cup?',
    desc: 'Winner of the ICC Men\'s T20 World Cup 2026, hosted by India and Sri Lanka.',
    rules: 'Resolves YES if India wins the final of the 2026 ICC Men\'s T20 World Cup.',
    cat: 'Sports', tags: ['cricket'], icon: '🏏', closesDays: 220,
    source: 'ICC', oracle: 'external',
    vol: 782450, liq: 85000, outcomes: [{ label: 'Yes', p: 0.24 }],
  },
  {
    q: 'Will the EU AI Act general-purpose provisions be delayed beyond August 2026?',
    desc: 'Tracks a formal delay of GPAI obligations under the EU AI Act.',
    rules: 'Resolves YES if the European Commission formally postpones the application date of GPAI obligations past 2026-08-02.',
    cat: 'Politics', tags: ['eu', 'regulation', 'ai'], icon: '🇪🇺', closesDays: 24,
    source: 'Official Journal of the EU', oracle: 'committee',
    vol: 421870, liq: 45000, outcomes: [{ label: 'Yes', p: 0.44 }],
  },
  {
    q: 'What will US CPI year-over-year be for December 2026?',
    desc: 'Scalar market: settles proportionally across the 0%–6% range based on the BLS December 2026 CPI-U print.',
    rules: 'Settlement value = BLS CPI-U 12-month unadjusted change for December 2026, first print, clamped to [0%, 6%]. LONG shares pay the settled fraction of $1; SHORT shares pay the remainder. Example: a 3.0% print settles LONG at 50¢.',
    cat: 'Economics', tags: ['cpi', 'scalar'], icon: '🎯', closesDays: 180,
    source: 'bls.gov', oracle: 'external', featured: true,
    vol: 684200, liq: 90000, type: 'scalar',
    scalarRange: { min: 0, max: 6, unit: '%' },
    outcomes: [{ label: 'Forecast', p: 0.47 }],
  },
  {
    q: 'Did global EV sales exceed 20M units in 2025?',
    desc: 'Resolved example market: worldwide battery-electric + plug-in hybrid sales for calendar 2025.',
    rules: 'Resolves YES if the IEA Global EV Outlook 2026 reports combined BEV+PHEV sales above 20 million for 2025.',
    cat: 'Climate', tags: ['ev'], icon: '🚗', closesDays: -30,
    source: 'IEA', oracle: 'external', status: 'resolved',
    vol: 1893240, liq: 0, outcomes: [{ label: 'Yes', p: 0.97 }],
  },
]

const mkUser = (
  id: string, email: string, name: string, handle: string, hue: number, balance: number,
  tier: 0 | 1 | 2, kycStatus: User['kycStatus'], country: string, isAdmin = false,
  extras: Partial<User> = {},
): User => ({
  id, email, name, handle, avatarHue: hue, balance, kycTier: tier, kycStatus, country,
  createdAt: now() - 90 * DAY, isAdmin, suspended: false, riskFlags: [],
  selfLimits: { dailyLossCap: null, coolOffUntil: null },
  totalDeposited: balance * 1.4, totalWithdrawn: 0,
  watchlist: [],
  stats: { profit30d: 0, calibration: 0.5, resolvedCount: 0, winRate: 0, streak: 0 },
  referralCode: handle.toUpperCase().slice(0, 8),
  referredBy: null,
  referralRewardPaid: false,
  follows: [],
  notificationPrefs: { email: true, push: false },
  ...extras,
})

export const buildSeed = (): AppState => {
  const rng = mulberry32(20260709)
  const t = now()

  const markets: Market[] = specs.map((s, i) => {
    const outcomes: Outcome[] = s.outcomes.map((o, j) => ({
      id: `o-${i}-${j}`,
      label: o.label,
      ...seedPools(Math.max(s.liq, 1000) / s.outcomes.length, o.p),
      ...(s.status === 'resolved' ? { resolved: (j === 0 ? 'yes' : 'no') as 'yes' | 'no' } : {}),
    }))
    const history: Record<string, PricePoint[]> = {}
    outcomes.forEach((o, j) => {
      history[o.id] = walk(rng, 60, s.outcomes[j].p, s.type === 'multi' ? 0.02 : 0.035)
    })
    return {
      id: `m-${i}`,
      slug: s.q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60),
      question: s.q, description: s.desc, rules: s.rules, category: s.cat, tags: s.tags,
      icon: s.icon, type: s.type ?? 'binary', outcomes,
      ...(s.scalarRange ? { scalarRange: s.scalarRange } : {}),
      createdAt: t - (60 + Math.floor(rng() * 30)) * DAY,
      closesAt: t + s.closesDays * DAY,
      resolutionSource: s.source, oracle: s.oracle,
      status: s.status ?? 'active',
      ...(s.status === 'resolved' ? { resolvedAt: t - 12 * DAY } : {}),
      volume: s.vol, feeBps: s.feeBps ?? 100, featured: !!s.featured,
      creator: s.creator ?? 'foresight',
      history,
    }
  })

  const users: User[] = [
    mkUser('u-admin', 'ops@foresight.demo', 'Foresight Ops', 'foresight-ops', 260, 0, 2, 'approved', 'US', true),
    mkUser('u-demo', 'alex.winterburn@gmail.com', 'Alex Winterburn', 'alexw', 210, 2450.0, 0, 'none', 'GB', false, {
      totalDeposited: 3000, watchlist: ['m-0', 'm-2', 'm-3'],
      stats: { profit30d: 76.8, calibration: 0.71, resolvedCount: 4, winRate: 0.5, streak: 2 },
    }),
    mkUser('u-dana', 'dana@example.com', 'Dana Okafor', 'danapredicts', 150, 18240.5, 2, 'approved', 'NG', false, {
      totalDeposited: 40000, totalWithdrawn: 12000,
      stats: { profit30d: 4830.2, calibration: 0.88, resolvedCount: 62, winRate: 0.64, streak: 7 },
    }),
    mkUser('u-marcus', 'marcus@example.com', 'Marcus Lee', 'mlee', 30, 512.75, 1, 'approved', 'SG', false, {
      stats: { profit30d: 214.4, calibration: 0.79, resolvedCount: 18, winRate: 0.56, streak: 3 },
      referredBy: 'DANAPRED', referralRewardPaid: true,
    }),
    mkUser('u-priya', 'priya@example.com', 'Priya Sharma', 'priyafx', 320, 7311.2, 1, 'approved', 'IN', false, {
      riskFlags: ['velocity: 14 trades/hr on 2026-07-02'],
      stats: { profit30d: -389.5, calibration: 0.62, resolvedCount: 41, winRate: 0.44, streak: -2 },
    }),
    mkUser('u-jonas', 'jonas@example.com', 'Jonas Weber', 'jw_berlin', 80, 96.1, 0, 'pending', 'DE', false, {
      stats: { profit30d: 12.1, calibration: 0.55, resolvedCount: 3, winRate: 0.33, streak: 1 },
    }),
    mkUser('u-sam', 'sam@example.com', 'Sam Carter', 'samc', 10, 1204.9, 0, 'none', 'US', false, {
      stats: { profit30d: 508.9, calibration: 0.83, resolvedCount: 22, winRate: 0.59, streak: 5 },
      referredBy: 'DANAPRED', referralRewardPaid: true, follows: ['u-dana'],
    }),
  ]

  const positions = [
    { id: 'p-1', userId: 'u-demo', marketId: 'm-0', outcomeId: 'o-0-0', side: 'yes' as const, shares: 180, avgPrice: 0.55, realizedPnl: 0 },
    { id: 'p-2', userId: 'u-demo', marketId: 'm-1', outcomeId: 'o-1-0', side: 'no' as const, shares: 240, avgPrice: 0.52, realizedPnl: 0 },
    { id: 'p-3', userId: 'u-demo', marketId: 'm-2', outcomeId: 'o-2-0', side: 'yes' as const, shares: 95, avgPrice: 0.41, realizedPnl: 12.4 },
    { id: 'p-4', userId: 'u-dana', marketId: 'm-1', outcomeId: 'o-1-0', side: 'yes' as const, shares: 4200, avgPrice: 0.38, realizedPnl: 830.2 },
    { id: 'p-5', userId: 'u-marcus', marketId: 'm-5', outcomeId: 'o-5-0', side: 'yes' as const, shares: 150, avgPrice: 0.29, realizedPnl: 0 },
    { id: 'p-6', userId: 'u-priya', marketId: 'm-8', outcomeId: 'o-8-0', side: 'no' as const, shares: 900, avgPrice: 0.61, realizedPnl: -44.1 },
  ]

  const orders = [
    { id: 'or-1', userId: 'u-demo', marketId: 'm-1', outcomeId: 'o-1-0', side: 'yes' as const, direction: 'buy' as const, limitPrice: 0.35, shares: 300, filled: 0, status: 'open' as const, createdAt: t - 2 * DAY },
    { id: 'or-2', userId: 'u-dana', marketId: 'm-0', outcomeId: 'o-0-0', side: 'no' as const, direction: 'buy' as const, limitPrice: 0.3, shares: 1000, filled: 250, status: 'partial' as const, createdAt: t - 5 * DAY },
  ]

  const txs = [
    { id: 'tx-1', userId: 'u-demo', type: 'deposit' as const, amount: 3000, status: 'completed' as const, note: 'USDC on Base', asset: 'USDC', network: 'Base', txHash: '0x8f3a…c21b', confirmations: 12, confirmationsNeeded: 12, createdAt: t - 40 * DAY },
    { id: 'tx-2', userId: 'u-demo', type: 'trade' as const, amount: -99, status: 'completed' as const, note: 'Buy 180 YES @ 55¢ · Fed rate cut', createdAt: t - 33 * DAY },
    { id: 'tx-3', userId: 'u-demo', type: 'trade' as const, amount: -124.8, status: 'completed' as const, note: 'Buy 240 NO @ 52¢ · BTC $150k', createdAt: t - 20 * DAY },
    { id: 'tx-4', userId: 'u-dana', type: 'withdrawal' as const, amount: -5000, status: 'pending' as const, note: 'USDC on Ethereum — pending review', asset: 'USDC', network: 'Ethereum', createdAt: t - 0.3 * DAY },
    { id: 'tx-5', userId: 'u-priya', type: 'deposit' as const, amount: 2000, status: 'completed' as const, note: 'USDC on Base', asset: 'USDC', network: 'Base', txHash: '0x2b91…77de', confirmations: 12, confirmationsNeeded: 12, createdAt: t - 3 * DAY },
    { id: 'tx-6', userId: 'u-marcus', type: 'withdrawal' as const, amount: -250, status: 'completed' as const, note: 'USDT on Tron', asset: 'USDT', network: 'Tron', txHash: 'TXk4…9mQd', createdAt: t - 9 * DAY },
    { id: 'tx-7', userId: 'u-demo', type: 'settlement' as const, amount: 62.4, status: 'completed' as const, note: 'EV sales 2025 — resolved YES', createdAt: t - 12 * DAY },
  ]

  const kycRequests = [
    { id: 'k-1', userId: 'u-jonas', requestedTier: 1 as const, docType: 'Passport', country: 'DE', status: 'pending' as const, submittedAt: t - 1.2 * DAY },
    { id: 'k-2', userId: 'u-sam', requestedTier: 1 as const, docType: 'Driver license', country: 'US', status: 'pending' as const, submittedAt: t - 0.4 * DAY },
  ]

  const proposals = [
    { id: 'pr-1', userId: 'u-marcus', question: 'Will Singapore GDP growth exceed 3% in 2026?', category: 'Economics', resolutionSource: 'singstat.gov.sg', status: 'pending' as const, submittedAt: t - 2 * DAY },
    { id: 'pr-2', userId: 'u-priya', question: 'Will a Bollywood film gross over $200M worldwide in 2026?', category: 'Culture', resolutionSource: 'Box Office India', status: 'pending' as const, submittedAt: t - 4 * DAY },
  ]

  const audit = [
    { id: 'a-1', actorId: 'u-admin', actorName: 'Foresight Ops', action: 'market.resolve', detail: 'Resolved "Did global EV sales exceed 20M units in 2025?" → YES', at: t - 12 * DAY },
    { id: 'a-2', actorId: 'u-admin', actorName: 'Foresight Ops', action: 'kyc.approve', detail: 'Approved Tier 1 for @mlee (Passport, SG)', at: t - 30 * DAY },
    { id: 'a-3', actorId: 'u-admin', actorName: 'Foresight Ops', action: 'settings.fees', detail: 'Trading fee set to 1.00%', at: t - 45 * DAY },
    { id: 'a-4', actorId: 'u-admin', actorName: 'Foresight Ops', action: 'risk.flag', detail: 'Velocity flag added to @priyafx', at: t - 6 * DAY },
  ]

  // Recent public trade feed (most recent first)
  const traderIds = ['u-dana', 'u-marcus', 'u-priya', 'u-sam', 'u-demo']
  const activeMarketIdx = [0, 1, 2, 3, 5, 8, 11]
  const trades = Array.from({ length: 48 }, (_, i) => {
    const mi = activeMarketIdx[Math.floor(rng() * activeMarketIdx.length)]
    const m = markets[mi]
    const o = m.outcomes[Math.floor(rng() * m.outcomes.length)]
    const side = rng() > 0.45 ? ('yes' as const) : ('no' as const)
    const hist = m.history[o.id]
    const p = hist[hist.length - 1].p
    return {
      id: 'tr-' + i,
      marketId: m.id, userId: traderIds[Math.floor(rng() * traderIds.length)],
      outcomeId: o.id, side, direction: rng() > 0.25 ? ('buy' as const) : ('sell' as const),
      shares: Math.round(10 + rng() * 900),
      price: side === 'yes' ? p : 1 - p,
      at: t - i * (0.4 + rng() * 2.2) * 3600000,
    }
  })

  const complianceAlerts = [
    { id: 'ca-1', userId: 'u-priya', kind: 'velocity' as const, severity: 'serious' as const, status: 'open' as const, detail: '14 trades in 60 minutes on 2026-07-02 (threshold 10). Pattern consistent with API-driven activity on a retail account.', at: t - 6 * DAY },
    { id: 'ca-2', userId: 'u-sam', kind: 'structuring' as const, severity: 'critical' as const, status: 'open' as const, detail: '3 deposits of $980–$995 within 48h, each just under the $1,000 auto-review threshold.', at: t - 1.1 * DAY },
    { id: 'ca-3', userId: 'u-jonas', kind: 'sanctions' as const, severity: 'critical' as const, status: 'open' as const, detail: 'Fuzzy name match (87%) against consolidated screening list entry J. Webber. Manual review required before KYC approval.', at: t - 0.9 * DAY },
    { id: 'ca-4', userId: 'u-marcus', kind: 'chargeback' as const, severity: 'serious' as const, status: 'acknowledged' as const, detail: 'Card issuer inquiry on $250 deposit (resolved in user’s favour 2026-06-28).', at: t - 11 * DAY },
  ]

  // Liquidity-provider positions (the market-maker program)
  const lps = [
    { id: 'lp-1', userId: 'u-dana', marketId: 'm-0', amount: 40000, feesEarned: 612.4, addedAt: t - 45 * DAY },
    { id: 'lp-2', userId: 'u-dana', marketId: 'm-1', amount: 60000, feesEarned: 1104.8, addedAt: t - 40 * DAY },
    { id: 'lp-3', userId: 'u-marcus', marketId: 'm-5', amount: 5000, feesEarned: 88.1, addedAt: t - 20 * DAY },
  ]

  const apiKeys = [
    { id: 'ak-1', label: 'Polling desk — newsroom widget', key: 'fsk_live_9f2ab6c41e8d', scopes: ['read:markets', 'read:prices'], rateLimitPerMin: 120, createdAt: t - 30 * DAY, requests30d: 184220, lastUsedAt: t - 0.02 * DAY, revoked: false },
    { id: 'ak-2', label: 'Quant fund — market data', key: 'fsk_live_51c0de77aa19', scopes: ['read:markets', 'read:prices', 'read:trades'], rateLimitPerMin: 600, createdAt: t - 18 * DAY, requests30d: 951804, lastUsedAt: t - 0.001 * DAY, revoked: false },
    { id: 'ak-3', label: 'Deprecated test key', key: 'fsk_live_0000dead0000', scopes: ['read:markets'], rateLimitPerMin: 60, createdAt: t - 80 * DAY, requests30d: 0, lastUsedAt: t - 55 * DAY, revoked: true },
  ]

  // 30 days of platform metrics for the admin dashboard
  const dailyVolume = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(t - (29 - i) * DAY)
    const base = 240000 + i * 6200
    return {
      date: d.toISOString().slice(0, 10),
      volume: Math.round(base * (0.75 + rng() * 0.6)),
      trades: Math.round(1900 * (0.7 + rng() * 0.7)),
      signups: Math.round(120 * (0.5 + rng() * 1.2)),
    }
  })

  return {
    version: 5,
    sessionUserId: 'u-demo',
    users, markets, positions, orders, txs, kycRequests, proposals, audit,
    trades, complianceAlerts, alerts: [], slip: [], lps, apiKeys,
    settings: {
      tradingFeeBps: 100,
      withdrawalFeeFlat: 0,
      makerRebateBps: 20,
      lpFeeShareBps: 6000, // 60% of every trading fee goes to that market's LPs
      referralReward: 25,
      referralMinDeposit: 50,
      tierTradeCaps: { 0: 500, 1: 10000, 2: 1e12 }, // >= 1e12 renders as "Unlimited"
      withdrawalAutoApproveUnder: 1000,
      withdrawalDailyCap: { 1: 2500, 2: 50000 },
      circuitBreaker: { enabled: true, movePct: 15 },
      geoBlocked: ['KP', 'IR', 'SY'],
      featureFlags: {
        communityMarkets: true,
        aiResolutionAssist: true,
        limitOrders: true,
        leaderboard: true,
        scalarMarkets: true,
        negRiskBundles: true,
        copyTrading: true,
        referrals: true,
        lpProgram: true,
        publicApi: true,
      },
      dailyVolume,
      announcement: null,
    },
  }
}
