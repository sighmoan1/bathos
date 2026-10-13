import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const slugs = fs.readdirSync('content').filter(name => name.endsWith('.md')).map(name => name.slice(0, -3))

test('every exported permalink renders content, metadata and survives reload despite preferences', async ({ page }) => {
  await page.addInitScript((slugs) => {
    localStorage.setItem('swipe-reader-dismissed', JSON.stringify(slugs))
    localStorage.setItem('swipe-reader-tags', JSON.stringify(['no-matching-tag']))
  }, slugs)
  for (const slug of slugs) {
    await page.goto(`/posts/${encodeURIComponent(slug)}/`)
    const heading = page.locator('article h1')
    await expect(heading).toBeVisible()
    const title = await heading.textContent()
    await expect(page).toHaveTitle(`${title} | Bathos`)
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://bathos.org/posts/${encodeURIComponent(slug)}/`)
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title!)
    await page.reload()
    await expect(heading).toHaveText(title!)
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    expect(new URL(page.url()).pathname).toBe('/')
    await expect(page.locator('article')).toHaveCount(0)
  }
  expect((await page.request.get('/posts/does-not-exist/')).status()).toBe(404)
})

test('feed, saved and hidden posts open permalinks with browser history', async ({ page }) => {
  await page.goto('/')
  const title = await page.getByRole('heading', { level: 2 }).first().textContent()
  const href = await page.getByRole('heading', { level: 2 }).first().locator('a').getAttribute('href')
  await page.getByRole('button', { name: 'Read Article', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(href! + '$'))
  await page.goBack()
  await expect(page.locator('article')).toHaveCount(0)
  await page.goForward()
  await expect(page.locator('article h1')).toHaveText(title!)
  await page.getByRole('button', { name: 'Save for later', exact: true }).click()
  await expect(page).toHaveURL(/:\d+\/$/)
  await page.getByRole('button', { name: 'Open saved articles' }).click()
  await page.getByRole('heading', { name: title!, exact: true, level: 3 }).click()
  await expect(page).toHaveURL(new RegExp(href! + '$'))
  await page.getByRole('button', { name: 'Never show again' }).click()
  await page.getByRole('button', { name: 'Open articles hidden on this device' }).click()
  await page.getByRole('heading', { name: title!, exact: true, level: 3 }).click()
  await expect(page).toHaveURL(new RegExp(href! + '$'))
})

test('share copies the specific permalink without moving the card; failures expose a selectable link', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (url: string) => { (window as any).copiedURL = url } }, configurable: true })
  })
  await page.goto('/')
  const heading = page.getByRole('heading', { level: 2 }).first()
  const title = await heading.textContent()
  const href = await heading.locator('a').getAttribute('href')
  await page.getByRole('button', { name: 'Share this article' }).click()
  await expect(page.getByRole('status')).toContainText('Link copied')
  expect(await page.evaluate(() => (window as any).copiedURL)).toBe(new URL(href!, page.url()).href)
  await expect(heading).toHaveText(title!)
  await page.getByRole('button', { name: 'Read Article', exact: true }).click()
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied') } }, configurable: true }))
  await page.getByRole('button', { name: 'Share this article' }).last().click()
  await expect(page.getByRole('textbox', { name: 'Article link' })).toHaveValue(new URL(href!, page.url()).href)
})

test('native share receives title and permalink and cancellation stays quiet', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
      (window as any).shared = data
      if ((window as any).cancelShare) throw new DOMException('cancelled', 'AbortError')
    } })
  })
  await page.goto(`/posts/${encodeURIComponent(slugs[0])}/`)
  await page.getByRole('button', { name: 'Share this article' }).last().click()
  expect(await page.evaluate(() => (window as any).shared)).toEqual({ title: await page.locator('article h1').textContent(), url: page.url() })
  await page.evaluate(() => { (window as any).cancelShare = true })
  await page.getByRole('button', { name: 'Share this article' }).last().click()
  await expect(page.getByRole('status').last()).toBeEmpty()
  await expect(page.locator('article h1')).toBeVisible()
})
