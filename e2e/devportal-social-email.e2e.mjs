import { chromium } from 'playwright-core'
import { mkdirSync, rmSync } from 'fs'

const DIR = new URL('./shots-devportal/', import.meta.url).pathname
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
const go = async (path, ms = 500) => { await page.goto(base + path); await page.waitForTimeout(ms) }

await go('/#/', 900)
check('developers link in nav', (await page.locator('.nav-links a', { hasText: 'Developers' }).count()) === 1)
check('developers link in footer', (await page.locator('.footer', { hasText: 'Developers & API' }).count()) === 1)
await shot('01-home')

await go('/#/developers', 600)
check('developers portal renders', await page.locator('text=Build on Foresight').isVisible())
check('order book endpoint documented', (await page.locator('code', { hasText: '/v1/markets/:id/book' }).count()) === 1)
check('websocket sample shown', (await page.locator('pre', { hasText: 'wss://api.foresight.demo' }).count()) === 1)
await page.locator('input[placeholder="you@company.com"]').fill('dev@example.com')
await page.locator('button', { hasText: 'Request key' }).click()
await page.waitForTimeout(300)
check('sandbox key request', (await page.locator('.toast', { hasText: 'Sandbox key' }).count()) === 1)
await shot('02-developers')

// social signup
await page.locator('.nav-right button:has(.avatar)').click()
await page.locator('button', { hasText: 'Sign out' }).click()
await page.waitForTimeout(300)
await page.locator('.nav-right button', { hasText: 'Sign up' }).click()
await page.waitForTimeout(200)
check('social buttons in auth', (await page.locator('.modal button', { hasText: 'Google' }).count()) === 1 && (await page.locator('.modal button', { hasText: 'Apple' }).count()) === 1)
await shot('03-signup-social', false)
await page.locator('.modal button', { hasText: 'Google' }).click()
await page.waitForTimeout(500)
check('google signup created session', (await page.locator('.balance-chip').count()) === 1)
check('welcome credit granted', (await page.locator('.balance-chip .v').textContent()).includes('100'))

// major page screenshots (as google user where relevant, sign back to alex for portfolio richness)
await page.locator('.nav-right button:has(.avatar)').click()
await page.locator('button', { hasText: 'Sign out' }).click()
await page.locator('.nav-right button', { hasText: 'Sign in' }).click()
await page.locator('.modal input[type=email]').fill('alex.winterburn@gmail.com')
await page.locator('.modal button', { hasText: 'Sign in' }).first().click()
await page.waitForTimeout(400)

await go('/#/market/m-0', 600)
await shot('04-market')
await go('/#/portfolio', 500)
await shot('05-portfolio')
await go('/#/wallet', 500)
await shot('06-wallet')
await go('/#/earn', 500)
await shot('07-earn')
await go('/#/leaderboard', 500)
await shot('08-leaderboard')

// admin: comms email card
await go('/#/admin', 400)
await page.locator('button', { hasText: 'Enter as demo admin' }).click()
await page.waitForTimeout(500)
await shot('09-admin-dashboard')
await go('/#/admin/comms', 500)
check('email delivery card', await page.locator('text=Email delivery (SendGrid integration)').isVisible())
check('provider connected badge', (await page.locator('.badge', { hasText: 'Connected' }).count()) === 1)
await page.locator('input[placeholder="you@example.com"]').fill('ops@foresight.demo')
await page.locator('button', { hasText: 'Send test' }).click()
await page.waitForTimeout(300)
check('test email queued', (await page.locator('.toast', { hasText: 'Test email queued' }).count()) === 1)
await shot('10-admin-comms-email')
await go('/#/admin/audit', 400)
check('audit: comms.email-test', (await page.locator('table.tbl').textContent()).includes('comms.email-test'))
await go('/#/admin/analytics', 500)
await shot('11-admin-analytics')
await go('/#/admin/markets', 500)
await shot('12-admin-markets')

await browser.close()
console.log(results.join('\n'))
