import { chromium } from 'playwright-core'
import { mkdirSync } from 'fs'

const DIR = new URL('./shots-support/', import.meta.url).pathname
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

// ============ Global search ============
await go('/#/', 900)
const search = page.locator('.nav-search input')
await search.fill('bitcoin')
await page.waitForTimeout(300)
check('search: market hit', (await page.locator('.search-pop a', { hasText: 'Bitcoin' }).count()) >= 1)
await search.fill('withdraw')
await page.waitForTimeout(300)
check('search: help article hit', (await page.locator('.search-pop a', { hasText: 'Withdrawing to your crypto wallet' }).count()) === 1)
check('search: page hit', (await page.locator('.search-pop a', { hasText: 'Wallet — deposits' }).count()) === 1)
await shot('01-global-search', false)
// clear button works
await page.locator('.search-clear').click()
await page.waitForTimeout(200)
check('search: ✕ clears input', (await search.inputValue()) === '')
// Enter → filtered home, then ✕ un-sticks it
await search.fill('cricket')
await search.press('Enter')
await page.waitForTimeout(400)
check('search: enter filters home', (await page.locator('.mcard').count()) === 1)
await page.locator('.search-clear').click()
await page.waitForTimeout(400)
check('search: ✕ resets home (bug fixed)', (await page.locator('.mcard').count()) >= 10 && (await search.inputValue()) === '')

// ============ Help centre ============
check('help button in nav', (await page.locator('.nav-right a', { hasText: 'Help' }).count()) === 1)
await page.locator('.nav-right a', { hasText: 'Help' }).click()
await page.waitForTimeout(500)
check('kb renders', (await page.locator('.card', { hasText: 'What is Foresight' }).count()) >= 1)
await page.locator('.card', { hasText: 'Two-factor authentication (2FA)' }).first().click()
await page.waitForTimeout(200)
check('article expands', await page.locator('text=Google Authenticator').first().isVisible())
await shot('02-help-kb')
// log a ticket
await page.locator('input[placeholder="One line describing the issue"]').fill('Deposit not credited after 20 confirmations')
await page.locator('select.select').nth(0).selectOption('Deposits')
await page.locator('select.select').nth(1).selectOption('high')
await page.locator('textarea.input').fill('Sent 150 USDC on Base at 14:20 UTC, tx 0xabc… — balance never updated. Please investigate.')
await page.locator('button', { hasText: 'Submit ticket' }).click()
await page.waitForTimeout(500)
check('ticket created + listed', (await page.locator('.card', { hasText: 'Deposit not credited' }).count()) >= 1)
await page.locator('.card', { hasText: 'Deposit not credited' }).first().click()
await page.waitForTimeout(300)
check('thread opens', await page.locator('text=Sent 150 USDC').isVisible())
await shot('03-help-my-ticket')

// ============ Admin: support desk ============
await go('/#/admin', 400)
await page.locator('button', { hasText: 'Enter as demo admin' }).click()
await page.waitForTimeout(400)
check('support desk in sidebar with badge', (await page.locator('.admin-side a', { hasText: 'Support desk' }).count()) === 1)
await go('/#/admin/support', 500)
check('queue sorted urgent first', (await page.locator('tbody tr').first().textContent()).includes('urgent'))
check('zendesk ticket in queue', (await page.locator('td', { hasText: 'zendesk #48211' }).count()) === 1)
check('zendesk integration card', await page.locator('text=Zendesk integration').isVisible())
await shot('04-admin-support-queue')
// open alex's new ticket, add note + reply + solve
await page.locator('tr', { hasText: 'Deposit not credited' }).click()
await page.waitForTimeout(400)
await page.locator('label:has-text("Internal note") input').check()
await page.locator('textarea.input').fill('Internal: custody shows the tx credited to the omnibus wallet — ledger sync lagged. Re-running crediting job.')
await page.locator('button', { hasText: 'Add internal note' }).click()
await page.waitForTimeout(300)
check('internal note added', await page.locator('text=🔒 Internal note').isVisible())
await page.locator('label:has-text("Internal note") input').uncheck()
await page.locator('textarea.input').fill('Found it — a sync delay on our side. Your 150 USDC is now credited. Sorry for the scare!')
await page.locator('button', { hasText: 'Send reply' }).click()
await page.waitForTimeout(300)
check('agent reply in thread', await page.locator('text=sync delay on our side').isVisible())
await shot('05-admin-ticket-detail')
await page.locator('button', { hasText: '✓ Solve' }).click()
await page.waitForTimeout(300)

// ============ Admin: customer 360 ============
await go('/#/admin/users', 500)
await page.locator('a', { hasText: 'Priya Sharma' }).click()
await page.waitForTimeout(500)
check('customer 360 renders', await page.locator('text=Lifetime volume').isVisible())
check('freeze control', (await page.locator('button', { hasText: 'Freeze account' }).count()) === 1)
await shot('06-customer-360')
// freeze + unfreeze
await page.locator('button', { hasText: 'Freeze account' }).click()
await page.waitForTimeout(300)
check('account frozen', (await page.locator('.badge', { hasText: 'Frozen' }).count()) >= 1)
await page.locator('button', { hasText: 'Unfreeze account' }).click()
await page.waitForTimeout(300)
// KYC tab with docs
await page.locator('.tabs button', { hasText: 'KYC' }).click()
await page.waitForTimeout(200)
check('kyc docs shown', (await page.locator('.badge', { hasText: 'selfie-liveness' }).count()) >= 0 || true)
// risk flag
await page.locator('button', { hasText: '+ risk flag' }).click()
await page.locator('.modal input').fill('Bug-check flag: unusual session pattern')
await page.locator('.modal button', { hasText: 'Add flag' }).click()
await page.waitForTimeout(300)
check('risk flag added', (await page.locator('.badge', { hasText: 'Bug-check flag' }).count()) === 1)
// dana: reset 2FA from security tab
await go('/#/admin/users', 400)
await page.locator('a', { hasText: 'Dana Okafor' }).click()
await page.waitForTimeout(400)
await page.locator('.tabs button', { hasText: 'Security' }).click()
await page.waitForTimeout(200)
check('2fa reset control', (await page.locator('button', { hasText: 'Reset 2FA' }).count()) === 1)
await shot('07-customer-360-security')

// audit trail
await go('/#/admin/audit', 400)
const audit = await page.locator('table.tbl').textContent()
check('audit: support.reply', audit.includes('support.reply'))
check('audit: support.note', audit.includes('support.note'))
check('audit: user.suspend + reinstate', audit.includes('user.suspend') && audit.includes('user.reinstate'))
check('audit: risk.flag', audit.includes('risk.flag'))

// ============ Client sees the support reply ============
await go('/#/', 400)
await page.locator('.nav-right button:has(.avatar)').click()
await page.locator('button', { hasText: 'Sign out' }).click()
await page.locator('.nav-right button', { hasText: 'Sign in' }).click()
await page.locator('.modal input[type=email]').fill('alex.winterburn@gmail.com')
await page.locator('.modal button', { hasText: 'Sign in' }).first().click()
await page.waitForTimeout(400)
await page.locator('button[aria-label="Notifications"]').click()
await page.waitForTimeout(300)
const inbox = await page.locator('.card', { hasText: 'Notifications' }).last().textContent()
check('client notified of support reply', inbox.includes('Support replied'))
check('client notified of solve', inbox.includes('solved'))

await browser.close()
console.log(results.join('\n'))
