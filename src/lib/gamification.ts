// Gamification catalogue: XP rules, levels, achievements, daily quests.

export const XP = {
  trade: 15,
  combo: 25,
  lpProvide: 30,
  alertSet: 5,
  deposit: 10,
  referral: 100,
  settlementWin: 50,
  dailyLogin: 20,
} as const

/** Level 1 at 0 XP; each level needs progressively more. */
export const levelForXp = (xp: number) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 50))
export const xpForLevel = (level: number) => 50 * Math.pow(level - 1, 2)
export const levelProgress = (xp: number) => {
  const lvl = levelForXp(xp)
  const cur = xpForLevel(lvl)
  const next = xpForLevel(lvl + 1)
  return { level: lvl, into: xp - cur, needed: next - cur, next }
}

export interface AchievementDef {
  id: string
  icon: string
  name: string
  desc: string
  xp: number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-trade', icon: '🎯', name: 'First position', desc: 'Place your first trade', xp: 25 },
  { id: 'whale', icon: '🐋', name: 'Whale', desc: 'Place a single trade of $500 or more', xp: 75 },
  { id: 'combo-master', icon: '🧾', name: 'Combo master', desc: 'Place a combo slip with 3+ legs', xp: 50 },
  { id: 'market-maker', icon: '💧', name: 'Market maker', desc: 'Provide liquidity to a market', xp: 50 },
  { id: 'prophet', icon: '🔮', name: 'Prophet', desc: 'Win a market settlement', xp: 75 },
  { id: 'scholar', icon: '🔔', name: 'On the pulse', desc: 'Have 3 alerts set at once', xp: 25 },
  { id: 'social', icon: '🎁', name: 'Rainmaker', desc: 'Refer a friend who deposits', xp: 100 },
  { id: 'scout', icon: '💡', name: 'Scout', desc: 'Propose a community market', xp: 40 },
  { id: 'streak-7', icon: '🔥', name: 'Week streak', desc: 'Sign in 7 days in a row', xp: 60 },
  { id: 'diversified', icon: '🌐', name: 'Diversified', desc: 'Hold positions in 3+ categories', xp: 50 },
]

export const achievementById = (id: string) => ACHIEVEMENTS.find(a => a.id === id)

export interface QuestDef {
  id: string
  icon: string
  name: string
  xp: number
}

/** Daily quests are informational: they show today's XP-earning actions. */
export const DAILY_QUESTS: QuestDef[] = [
  { id: 'q-trade', icon: '📈', name: 'Place a trade', xp: XP.trade },
  { id: 'q-alert', icon: '🔔', name: 'Set a price alert', xp: XP.alertSet },
  { id: 'q-deposit', icon: '💰', name: 'Top up your balance', xp: XP.deposit },
]

export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10)
