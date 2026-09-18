import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()
const net=[]
page.on('response', r => { const u=new URL(r.url()); if(/\/api\/|refresh/.test(u.pathname)) net.push(`${r.status()} ${u.pathname}`) })
page.on('console', m => { const t=m.text(); if(/refresh|Failed|SUCCESS|error/i.test(t) && m.type()!=='warning') console.log('  [console]', t.slice(0,140)) })
await page.goto('http://localhost:3000/login')
await page.fill('input[type=email]','admin@payrollpro.com')
await page.fill('input[type=password]','admin123')
await page.locator('button[type=submit]').click()
await page.waitForURL(/dashboard/,{timeout:25000})
console.log('=== login done; hard-reload /attendance/check-in ===')
net.length=0
await page.goto('http://localhost:3000/attendance/check-in',{timeout:40000})
await page.waitForTimeout(4000)
const uniq=[...new Set(net)]
console.log('--- net order:'); uniq.forEach(l=>console.log('   ',l))
const sel=page.locator('select').first()
const opts=await sel.locator('option').allInnerTexts()
console.log('--- location select options:', JSON.stringify(opts))
console.log('--- redirect? url:', page.url())
await browser.close()
