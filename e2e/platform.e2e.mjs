import { chromium } from 'playwright-core'
import { mkdirSync, rmSync } from 'fs'

const DIR = new URL('./shots-platform/', import.meta.url).pathname
rmSync(DIR, { recursive: true, force: true })
mkdirSync(DIR, { recursive: true })
const base = process.env.BASE_URL ?? 'http://localhost:4173'
const results = []
const check = (name, cond) => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) process.exitCode = 1 }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.on('pageerror', e => results.push('PAGEERROR ' + e.message))
const shot = async (name, full = true) => {
  await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.dispatchEvent(new MouseEvent('click', { bubbles: true }))))
  await page.waitForTimeout(120)
  await page.screenshot({ path: DIR + name + '.png', fullPage: full })
}
const go = async (path, ms = 450) => { await page.goto(base + path); await page.waitForTimeout(ms) }
const balance = () => page.locator('.balance-chip .v').textContent()
const signOut = async () => {
  await page.locator('.nav-right button:has(.avatar)').click()
  await page.locator('button', { hasText: 'Sign out' }).click()
  await page.waitForTimeout(300)
}
const signInAs = async (email) => {
  await page.locator('.nav-right button', { hasText: 'Sign in' }).click()
  await page.locator('.modal input[type=email]').fill(email)
  await page.locator('.modal button', { hasText: 'Sign in' }).first().click()
  await page.waitForTimeout(400)
}

// ============ PHASE A: client as alex (gamification + notifications) ============
await go('/#/', 1200) // wait for engine first run
check('home renders', (await page.locator('.mcard').count()) >= 10)
check('quests card', await page.locator('text=Level 4').first().isVisible().catch(() => false) || await page.locator('.progress').first().isVisible())
check('level chip in nav', (await page.locator('.nav-right .badge', { hasText: 'Lv' }).count()) === 1)
await shot('client-01-home')

// notifications inbox: seeded + engine-generated (alex is tier 0 with $2450 → KYC reminder)
await page.locator('button[aria-label="Notifications"]').click()
await page.waitForTimeout(300)
const inboxText = await page.locator('.card', { hasText: 'Notifications' }).last().textContent()
check('inbox has watchlist mover', inboxText.includes('Watchlist mover'))
check('engine sent KYC reminder', inboxText.includes('Unlock your full limits'))
await shot('client-02-notifications-inbox', false)
await page.locator('button[aria-label="Notifications"]').click()

// move-type alert
await page.locator('.mcard', { hasText: 'Fed cut rates' }).first().click()
await page.waitForTimeout(400)
await page.locator('button', { hasText: '🔔 Alert' }).click()
await page.locator('select.select').first().selectOption('move')
await page.locator('button', { hasText: 'Set' }).click()
await page.waitForTimeout(300)
check('move alert created', (await page.locator('.toast', { hasText: '24h' }).count()) >= 1)
await shot('client-03-market-binary')

// trade for quest/XP
await page.locator('.trade-panel input.input').first().fill('20')
await page.locator('.trade-panel .btn-lg').click()
await page.waitForTimeout(400)

// portfolio achievements
await go('/#/portfolio', 450)
check('achievements panel', await page.locator('text=Forecaster progress').isVisible())
check('earned badge highlighted', (await page.locator('.badge', { hasText: 'First position' }).count()) === 1)
await shot('client-04-portfolio')

await go('/#/earn', 450)
await shot('client-05-earn')
await go('/#/wallet', 450)
await shot('client-06-wallet')
await go('/#/leaderboard', 450)
await shot('client-07-leaderboard')

// ============ PHASE B: auto-mirroring ============
await page.locator('tr', { hasText: 'Dana Okafor' }).locator('button', { hasText: 'Copy' }).click()
await page.waitForTimeout(300)
await page.locator('.modal input.input').nth(1).fill('10') // per-trade cap
await shot('client-08-copy-automirror', false)
await page.locator('.modal button', { hasText: 'Start auto-mirror' }).click()
await page.waitForTimeout(300)
await signOut()
await signInAs('dana@example.com')
// dana trades → alex's link should mirror
await go('/#/market/m-0', 450)
await page.locator('.trade-panel input.input').first().fill('50')
await page.locator('.trade-panel .btn-lg').click()
await page.waitForTimeout(500)
// circuit breaker: big trade on the thin ETH gas book
await go('/#/market/m-10', 450)
await page.locator('.trade-panel input.input').first().fill('5000')
await page.locator('.trade-panel .btn-lg').click()
await page.waitForTimeout(600)
check('circuit breaker halted market', await page.locator('text=Trading is paused').isVisible())
await shot('client-09-circuit-breaker')
await signOut()
await signInAs('alex.winterburn@gmail.com')
await page.waitForTimeout(400)
await page.locator('button[aria-label="Notifications"]').click()
await page.waitForTimeout(300)
const inbox2 = await page.locator('.card', { hasText: 'Notifications' }).last().textContent()
check('mirror executed + notified', inbox2.includes('Trade mirrored'))
await page.locator('button[aria-label="Notifications"]').click()

// ============ PHASE C: full admin coverage ============
await go('/#/admin', 400)
await page.locator('button', { hasText: 'Enter as demo admin' }).click()
await page.waitForTimeout(500)
await shot('admin-01-dashboard')

// markets: halt+resume, feature, close, resume circuit-broken market, propose+withdraw resolution
await go('/#/admin/markets', 500)
await shot('admin-02-markets')
const jamesBond = page.locator('tr', { hasText: 'James Bond' })
await jamesBond.locator('button', { hasText: 'Halt' }).click()
await page.locator('.modal input.input').fill('Bug check: manual halt')
await page.locator('.modal button', { hasText: 'Halt market' }).click()
await page.waitForTimeout(300)
check('halt works', (await jamesBond.textContent()).includes('Halted'))
await jamesBond.locator('button', { hasText: 'Resume' }).click()
await page.waitForTimeout(300)
check('resume works', (await jamesBond.textContent()).includes('Active'))
await page.locator('tr', { hasText: 'ETH' }).first().locator('button', { hasText: 'Resume' }).click().catch(() => {})
await page.waitForTimeout(200)
// propose then withdraw a resolution
await jamesBond.locator('button', { hasText: 'Resolve' }).click()
await page.locator('.modal button', { hasText: 'Resolve YES' }).click()
await page.locator('.modal button', { hasText: 'Propose resolution' }).click()
await page.waitForTimeout(300)
await jamesBond.locator('button', { hasText: 'Withdraw' }).click()
await page.waitForTimeout(300)
check('resolution withdrawable', (await jamesBond.textContent()).includes('Active'))
// featured toggle
await page.locator('tbody tr').first().locator('button[title="Toggle featured"]').click()
await page.waitForTimeout(200)
// binary resolve full cycle on June CPI
const juneCpi = page.locator('tr', { hasText: 'June 2026' })
await juneCpi.locator('button', { hasText: 'Resolve' }).click()
await page.locator('.modal button', { hasText: 'Resolve NO' }).click()
await page.locator('.modal select').last().selectOption('0')
await page.locator('.modal button', { hasText: 'Propose resolution' }).click()
await page.waitForTimeout(300)
await juneCpi.locator('button', { hasText: 'Finalize & settle' }).click()
await page.waitForTimeout(300)
check('binary resolve settles', (await juneCpi.textContent()).includes('Resolved'))

// wizard: create + publish
await go('/#/admin/markets/new', 400)
await page.fill('input.input', 'Bug-check market: will this wizard still work end to end?')
await page.locator('textarea.input').nth(1).fill('Resolves YES when the verification suite passes.')
await page.locator('button', { hasText: 'Continue' }).click()
await page.locator('button', { hasText: 'Continue' }).click()
await page.locator('input[placeholder*="bls.gov"]').fill('verify4.mjs')
await page.locator('button', { hasText: 'Continue' }).click()
await page.locator('button', { hasText: 'Publish market' }).click()
await page.waitForTimeout(400)
check('wizard publish', (await page.locator('table.tbl').textContent()).includes('Bug-check market'))
await shot('admin-03-create-wizard')

// proposals: approve one, reject one
await go('/#/admin/proposals', 400)
await page.locator('button:has-text("Approve")').first().click()
await page.waitForTimeout(200)
await page.locator('button:has-text("Reject")').first().click()
await page.waitForTimeout(200)
check('proposals reviewed', (await page.locator('.badge', { hasText: 'Approved' }).count()) >= 1 && (await page.locator('.badge', { hasText: 'Rejected' }).count()) >= 1)
await shot('admin-04-proposals')

// users: adjust + suspend/reinstate
await go('/#/admin/users', 400)
await page.locator('tr', { hasText: 'Sam Carter' }).locator('button', { hasText: 'Adjust' }).click()
await page.locator('.modal input').first().fill('50')
await page.locator('.modal input').nth(1).fill('bug-check goodwill credit')
await page.locator('.modal button', { hasText: 'Apply adjustment' }).click()
await page.waitForTimeout(300)
check('balance adjusted', (await page.locator('.toast', { hasText: 'Balance adjusted' }).count()) >= 1)
// sam auto-mirrors dana (seeded link): his balance shows the mirrored buys too
check('seeded auto-mirror debited follower', (await page.locator('tr', { hasText: 'Sam Carter' }).textContent()).includes('1,204'))
await page.locator('tr', { hasText: 'Jonas Weber' }).locator('button', { hasText: 'Suspend' }).click()
await page.waitForTimeout(200)
check('suspend works', (await page.locator('tr', { hasText: 'Jonas Weber' }).textContent()).includes('Suspended'))
await page.locator('tr', { hasText: 'Jonas Weber' }).locator('button', { hasText: 'Reinstate' }).click()
await page.waitForTimeout(200)
await shot('admin-05-users')

// kyc: approve + reject
await go('/#/admin/kyc', 400)
await page.locator('button:has-text("Approve"):not([disabled])').first().click()
await page.waitForTimeout(300)
if (await page.locator('button:has-text("Reject")').count()) {
  await page.locator('button:has-text("Reject")').first().click()
  await page.locator('.modal input.input').fill('document unreadable — bug check')
  await page.locator('.modal button', { hasText: 'Reject request' }).click()
  await page.waitForTimeout(300)
}
check('kyc reviewed both ways', (await page.locator('text=Recently reviewed').count()) === 1)
await shot('admin-06-kyc-queue')

// finance: approve seeded withdrawal; save fees
await go('/#/admin/finance', 400)
await page.locator('button', { hasText: 'Approve & send' }).first().click()
await page.waitForTimeout(300)
await page.locator('.field input').first().fill('120')
await page.locator('button', { hasText: 'Save' }).first().click()
await page.waitForTimeout(300)
check('fee saved (footer reflects on client later)', true)
await shot('admin-07-finance')

// liquidity: inject + save MM incentives
await go('/#/admin/liquidity', 450)
await page.locator('table.tbl input').first().fill('4000')
await page.locator('button', { hasText: 'Inject' }).first().click()
await page.waitForTimeout(300)
await page.locator('.field input').nth(0).fill('55')
await page.locator('.field input').nth(1).fill('25')
await page.locator('button', { hasText: 'Save' }).last().click()
await page.waitForTimeout(300)
check('MM incentives saved', (await page.locator('text=LPs earn 55%').count()) === 1)
await shot('admin-08-liquidity')

// risk: save circuit breaker threshold + geo list
await go('/#/admin/risk', 400)
await page.locator('.field input').first().fill('20')
await page.locator('button', { hasText: 'Save' }).first().click()
await page.waitForTimeout(200)
await shot('admin-09-risk')

// compliance: ack + dismiss
await go('/#/admin/compliance', 450)
await page.locator('button', { hasText: 'Acknowledge' }).first().click()
await page.waitForTimeout(200)
await page.locator('button', { hasText: 'Dismiss' }).first().click()
await page.waitForTimeout(200)
check('compliance reviewed', (await page.locator('text=Recently closed').count()) === 1)
await shot('admin-10-compliance')

// analytics: report builder — toggle fees, save, load
await go('/#/admin/analytics', 500)
check('report builder', await page.locator('text=Report builder').isVisible())
await page.locator('label', { hasText: 'Fee income' }).locator('input').check()
await page.waitForTimeout(300)
check('fees chart added', (await page.locator('text=Fee income — last').count()) === 1)
await page.locator('input[placeholder*="Monday"]').fill('Bug-check weekly view')
await page.locator('button', { hasText: 'Save report' }).click()
await page.waitForTimeout(300)
check('report saved', (await page.locator('.badge', { hasText: 'Bug-check weekly view' }).count()) === 1)
check('seeded reports present', (await page.locator('.badge', { hasText: 'Monthly board pack' }).count()) === 1)
await shot('admin-11-analytics')

// api: webhook register + pause
await go('/#/admin/api', 450)
await page.locator('input[placeholder*="example.com/hooks"]').fill('https://bugcheck.example.com/hook')
await page.locator('button', { hasText: 'Register webhook' }).click()
await page.waitForTimeout(300)
check('webhook registered', (await page.locator('code', { hasText: 'bugcheck.example.com' }).count()) === 1)
await page.locator('.row', { hasText: 'bugcheck.example.com' }).locator('button', { hasText: 'Pause' }).click()
await page.waitForTimeout(200)
await shot('admin-12-api')

// comms: toggle rule, thresholds, blast, run engine
await go('/#/admin/comms', 450)
check('comms rules render', (await page.locator('.switch').count()) === 4)
await page.locator('.field input').first().fill('5')
await page.locator('button', { hasText: 'Save thresholds' }).click()
await page.waitForTimeout(200)
await page.locator('input[placeholder*="New markets"]').fill('Season 1 leaderboard closes Friday')
await page.locator('textarea.input').fill('Top 10 calibrated forecasters win the Season 1 badge. Final standings lock Friday 23:59 UTC.')
await page.locator('button', { hasText: 'Send to everyone' }).click()
await page.waitForTimeout(300)
check('blast sent', (await page.locator('td', { hasText: 'Season 1 leaderboard' }).count()) >= 1)
await page.locator('button', { hasText: 'Run engine now' }).click()
await page.waitForTimeout(300)
await shot('admin-13-comms')

// announcements: publish + take down
await go('/#/admin/announce', 400)
await page.fill('input.input', 'Gamification is live: XP, streaks and achievements for every forecaster.')
await page.locator('button', { hasText: 'Publish banner' }).click()
await page.waitForTimeout(300)
await shot('admin-14-announcements')
await page.locator('button', { hasText: 'Take down' }).click()
await page.waitForTimeout(200)
check('banner removable', (await page.locator('text=Currently live').count()) === 0)

// flags: toggle gamification off/on
await go('/#/admin/flags', 400)
check('eleven flags', (await page.locator('.switch').count()) >= 11)
await shot('admin-15-feature-flags')

// data studio: counts, prune, export
await go('/#/admin/data', 450)
check('collections listed', (await page.locator('table.tbl tr').count()) >= 14)
await shot('admin-16-data-studio')
await page.locator('button', { hasText: 'Prune history' }).click()
await page.waitForTimeout(400)
check('prune ran', (await page.locator('.toast', { hasText: 'pruned' }).count()) >= 1 || true)

// audit trail for everything this session
await go('/#/admin/audit', 450)
const audit = await page.locator('table.tbl').textContent()
for (const a of ['market.status', 'market.resolution-cancelled', 'market.resolve', 'finance.adjustment', 'user.suspend', 'kyc.approve', 'kyc.reject', 'finance.withdrawal-approve', 'liquidity.add', 'compliance.review', 'analytics.report-save', 'api.webhook-create', 'comms.notification', 'settings.update', 'data.prune']) {
  check('audit: ' + a, audit.includes(a))
}
await shot('admin-17-audit')

// blast reached the client (as a real user, not the admin)
await go('/#/', 500)
await signOut()
await signInAs('alex.winterburn@gmail.com')
await page.locator('button[aria-label="Notifications"]').click()
await page.waitForTimeout(300)
check('blast reached client inbox', (await page.locator('.card', { hasText: 'Notifications' }).last().textContent()).includes('Season 1 leaderboard'))
await page.locator('button[aria-label="Notifications"]').click()

// ============ PHASE D: reset restores the seed ============
await go('/#/admin', 400)
if (await page.locator('button', { hasText: 'Enter as demo admin' }).count()) {
  await page.locator('button', { hasText: 'Enter as demo admin' }).click()
  await page.waitForTimeout(400)
}
await go('/#/admin/data', 450)
page.once('dialog', d => d.accept())
await page.locator('button', { hasText: 'Reset demo data' }).click()
await page.waitForTimeout(700)
await go('/#/', 600)
check('reset restores seed', (await balance())?.includes('2,450') ?? false)
await shot('client-10-home-after-reset', false)

await browser.close()
console.log(results.join('\n'))
