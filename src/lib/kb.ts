// Knowledgebase content. In production this is CMS-driven (or synced from
// Zendesk Guide); the shapes below match a Zendesk article export.

export interface KbArticle {
  id: string
  category: string
  title: string
  body: string[] // paragraphs
}

export const KB_CATEGORIES = ['Getting started', 'Trading', 'Deposits & withdrawals', 'Verification (KYC)', 'Earn & fees', 'Security'] as const

export const KB: KbArticle[] = [
  {
    id: 'kb-what-is', category: 'Getting started', title: 'What is Foresight and how do prices work?',
    body: [
      'Foresight turns real-world questions into markets. Every price is a probability: a YES share trading at 63¢ means the market collectively believes there is a 63% chance the event happens.',
      'If you buy YES at 63¢ and the market resolves YES, each share pays $1.00 — a 37¢ profit per share. If it resolves NO, YES shares pay nothing. You can also sell your position at the current price any time before resolution.',
      'Prices move whenever people trade: buying YES pushes the probability up, buying NO pushes it down. That is what makes the price a live forecast.',
    ],
  },
  {
    id: 'kb-first-trade', category: 'Getting started', title: 'Placing your first trade',
    body: [
      'Pick a market from the home page, choose YES or NO, enter a dollar amount, and review the quote — it shows your average price, the number of shares, the payout if you are right, the price impact, and the fee.',
      'Press Buy. Your position appears on the market page and in your Portfolio with live profit and loss. You start with a welcome credit, so you can try this before depositing anything.',
      'Tip: the daily quests card on the home page rewards your first trade of the day with XP.',
    ],
  },
  {
    id: 'kb-combo', category: 'Trading', title: 'Combo slips: baskets across markets',
    body: [
      'The combo slip (🧾 in the navigation) lets you stack positions across several markets and place them in one click. Add legs from any market page with “Add to combo slip”.',
      'Important: combos are baskets, not all-or-nothing parlays. Each leg settles independently, so if two of your three legs win, those two still pay $1.00 per share.',
      'On multi-outcome markets, “Hedge the field” adds NO on every other outcome to your slip — a one-click way to back a single outcome efficiently.',
    ],
  },
  {
    id: 'kb-orders', category: 'Trading', title: 'Market orders, limit orders and maker rebates',
    body: [
      'A market order executes immediately at the best available price from the automated market maker. Large orders move the price — the quote shows the impact before you commit.',
      'A limit order rests on the book and fills automatically if the price reaches your limit. Because resting orders improve liquidity, fills earn you a maker rebate, credited instantly.',
      'You can cancel resting orders any time from the market page or your Portfolio.',
    ],
  },
  {
    id: 'kb-scalar', category: 'Trading', title: 'Scalar markets: LONG and SHORT on a number',
    body: [
      'Scalar markets settle on a number inside a range — for example “US CPI year-over-year for December 2026” on a 0–6% range. The price is an implied forecast rather than a probability.',
      'LONG shares pay more the higher the settled value; SHORT shares pay more the lower it lands. A settlement exactly in the middle pays both sides 50¢ per share.',
    ],
  },
  {
    id: 'kb-deposit', category: 'Deposits & withdrawals', title: 'Depositing crypto',
    body: [
      'Open Wallet → Deposit, pick your asset and network (USDC on Base is fastest and cheapest), and send funds to your personal deposit address. Only send the selected asset on the selected network.',
      'Your balance credits automatically after the network confirmations shown next to the address (about 10 seconds on Base, up to 30 minutes on Bitcoin).',
    ],
  },
  {
    id: 'kb-withdraw', category: 'Deposits & withdrawals', title: 'Withdrawing to your crypto wallet',
    body: [
      'Open Wallet → Withdraw, choose the asset and network, and enter or select a destination address. Withdrawals require Tier 1 verification, and if you have two-factor authentication enabled you will be asked for a 6-digit authenticator code.',
      'Small withdrawals are sent automatically; larger amounts are reviewed by our team, usually within a few hours. Your tier sets a daily cap — upgrade to Tier 2 for higher limits.',
      'Save addresses to your address book to avoid typos: transfers on-chain are irreversible, so always double-check new addresses.',
    ],
  },
  {
    id: 'kb-kyc', category: 'Verification (KYC)', title: 'Verification tiers and when you need them',
    body: [
      'Tier 0 (email only) lets you browse and trade up to a cap. Tier 1 (government ID + selfie) raises your limits and unlocks withdrawals. Tier 2 (proof of address + source of funds) removes position caps and raises withdrawal limits.',
      'We only ask you to verify at the moment you actually need it — when a trade would exceed your cap, or when you first withdraw. Verification usually takes minutes.',
      'If your document is rejected (blurry photo, name mismatch), you can resubmit immediately or contact support — name-order differences on passports are resolved manually all the time.',
    ],
  },
  {
    id: 'kb-lp', category: 'Earn & fees', title: 'Earning as a liquidity provider',
    body: [
      'The Earn page lets anyone provide liquidity to a market and receive a share of that market’s trading fees, pro-rata, as they accrue. Thin books pay the best — they are flagged on the page.',
      'Your principal plus accrued fees are returned automatically when the market resolves, or on demand with the Withdraw button.',
      'Trading fees are shown on every quote (1% by default). Firms quoting two-sided size can apply for the pro programme with negotiated rebates.',
    ],
  },
  {
    id: 'kb-2fa', category: 'Security', title: 'Two-factor authentication (2FA)',
    body: [
      'Enable 2FA from Wallet → Security. Scan the secret with Google Authenticator, Authy or 1Password and confirm with a 6-digit code. From then on, every withdrawal requires a fresh code.',
      'Lost your device? Contact support — after identity checks an agent can reset your 2FA so you can re-enrol. We strongly recommend keeping 2FA on at all times.',
    ],
  },
  {
    id: 'kb-alerts', category: 'Security', title: 'Price alerts and notifications',
    body: [
      'From any market page, click 🔔 Alert to be notified when the price goes above or below a level, or moves more than a set number of points in 24 hours.',
      'Alerts arrive in the in-app bell, plus email or push depending on your preferences in Wallet → Notifications. The platform also sends you automatic heads-ups: markets on your watchlist that move sharply, and positions in markets that close soon.',
    ],
  },
]
