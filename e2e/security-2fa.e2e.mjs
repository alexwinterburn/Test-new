import { chromium } from 'playwright-core'
import { mkdirSync } from 'fs'

const DIR = new URL('./shots-security/', import.meta.url).pathname
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

// ---- Alex (2FA off): enable 2FA via modal ----
await go('/#/wallet', 900)
check('security card', await page.locator('text=🔐 Security').isVisible())
check('2FA off badge', (await page.locator('.badge', { hasText: '2FA off' }).count()) === 1)
await page.locator('button', { hasText: 'Enable two-factor authentication' }).click()
await page.waitForTimeout(300)
check('totp secret shown', (await page.locator('code', { hasText: 'FRST-2K9L' }).count()) === 1)
await shot('01-enable-2fa-modal', false)
await page.locator('.modal input').fill('482915')
await page.locator('.modal button', { hasText: 'Verify & enable 2FA' }).click()
await page.waitForTimeout(400)
check('2FA now on', (await page.locator('.badge', { hasText: '2FA on' }).count()) === 1)

// ---- Dana (tier 2, 2FA on, saved address): full withdrawal flow ----
await page.locator('.nav-right button:has(.avatar)').click()
await page.locator('button', { hasText: 'Sign out' }).click()
await page.locator('.nav-right button', { hasText: 'Sign in' }).click()
await page.locator('.modal input[type=email]').fill('dana@example.com')
await page.locator('.modal button', { hasText: 'Sign in' }).first().click()
await page.waitForTimeout(400)
await go('/#/wallet', 600)
check('dana 2FA on (seeded)', (await page.locator('.badge', { hasText: '2FA on' }).count()) === 1)
check('address book seeded', (await page.locator('text=Ledger cold wallet').count()) >= 1)
await page.locator('.tabs button', { hasText: 'Withdraw' }).click()
await page.waitForTimeout(300)
check('saved address dropdown', (await page.locator('select option', { hasText: 'Ledger cold wallet' }).count()) === 1)
check('2FA field on withdraw', await page.locator('text=Authenticator code (2FA)').isVisible())

// select saved address, try without code → blocked
await page.locator('select.select').last().selectOption({ index: 1 })
await page.locator('.trade-panel input.input[type=number]').fill('2000')
await page.locator('button', { hasText: 'Withdraw $' }).click()
await page.waitForTimeout(300)
check('blocked without 2FA code', (await page.locator('.trade-panel').textContent()).includes('6-digit'))
await shot('02-withdraw-2fa', false)
// with code → pending review (over auto-approve threshold)
await page.locator('input[placeholder="6-digit code"]').fill('918273')
await page.locator('button', { hasText: 'Withdraw $' }).click()
await page.waitForTimeout(400)
check('withdrawal submitted for review', (await page.locator('.toast', { hasText: 'submitted for review' }).count()) === 1)

// new address: warning + save to book, small amount (auto-approve) with code
await page.locator('input[placeholder="0x…"]').fill('0xNEWaddr123456789')
await page.waitForTimeout(200)
check('new-address warning', await page.locator('text=New address — double-check it').isVisible())
await page.locator('label:has-text("Save to address book") input[type=checkbox]').check()
await page.locator('input[placeholder="label"]').fill('Hot wallet')
await page.locator('.trade-panel input.input[type=number]').fill('200')
await page.locator('input[placeholder="6-digit code"]').fill('555444')
await page.locator('button', { hasText: 'Withdraw $' }).click()
await page.waitForTimeout(400)
check('instant withdrawal sent', (await page.locator('.toast', { hasText: 'sent' }).count()) >= 1)
check('address saved to book', (await page.locator('text=Hot wallet').count()) >= 1)
await shot('03-wallet-security', true)

// ---- Admin: 2FA badge + withdrawal in queue ----
await go('/#/admin', 400)
await page.locator('button', { hasText: 'Enter as demo admin' }).click()
await page.waitForTimeout(400)
await go('/#/admin/users', 500)
check('admin sees 2FA badges', (await page.locator('td .badge', { hasText: '2FA' }).count()) >= 2)
await shot('04-admin-users-2fa')
await go('/#/admin/finance', 500)
check('withdrawal awaiting review', (await page.locator('text=Withdrawal approval queue').count()) === 1 && (await page.locator('button', { hasText: 'Approve & send' }).count()) >= 1)

await browser.close()
console.log(results.join('\n'))
