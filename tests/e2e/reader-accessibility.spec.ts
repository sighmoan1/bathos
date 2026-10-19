import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { current, currentTitle, openMenuItem, press, readButton } from './feed-helpers'

async function expectModal(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name, exact: true })
  await expect(dialog).toBeFocused()
  await expect(page.locator('[data-reader-background]')).toHaveAttribute('aria-hidden', 'true')
  expect(await page.locator('[data-reader-background]').evaluate(element => (element as HTMLElement).inert)).toBe(true)
  await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Back', exact: true })).toBeFocused()
  return dialog
}

test('reader announces its title, contains focus and restores the opener', async ({ page }) => {
  await page.goto('/')
  const title = await currentTitle(page).innerText()
  const opener = readButton(page)
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = await expectModal(page, title)
  await expect(dialog.getByRole('button', { name: 'Save for later', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(opener).toBeFocused()
  await expect(page.locator('[data-reader-background]')).not.toHaveAttribute('aria-hidden', 'true')
  await opener.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save for later', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // Saving moves on to the next post; focus follows to its reading action.
  await expect(currentTitle(page)).not.toHaveText(title)
  await expect(readButton(page)).toBeFocused()
})

test('saved selection works by keyboard and replacement dialog owns focus', async ({ page }) => {
  await page.goto('/')
  const title = await currentTitle(page).innerText()
  await current(page).getByRole('button', { name: 'Save', exact: true }).focus()
  await page.keyboard.press('Enter')
  // The window feed handler must not replace the focused button's native action.
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(current(page).getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const saved = page.getByRole('button', { name: 'Open saved articles', exact: true })
  await saved.click()
  const list = await expectModal(page, 'Saved Articles')
  await list.getByRole('button', { name: `Read ${title}`, exact: true }).focus()
  await page.keyboard.press('Space')
  await expectModal(page, title)
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(saved).toBeFocused()
  await saved.press('Space')
  await expectModal(page, 'Saved Articles')
  await page.keyboard.press('Escape')
  await expect(saved).toBeFocused()
})

test('direct post entry and browser back recover safe focus', async ({ page }) => {
  await page.goto('/')
  const path = await currentTitle(page).locator('a').getAttribute('href')
  await page.goto(path!)
  const title = await page.locator('article h1').innerText()
  await expectModal(page, title)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open saved articles' })).toBeFocused()
  await readButton(page).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(readButton(page)).toBeFocused()
})

test('bin panel actions are named and reduced motion retains navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const title = await currentTitle(page).innerText()
  await current(page).getByRole('button', { name: 'Bin', exact: true }).click()
  await expect(currentTitle(page)).not.toHaveText(title)
  await openMenuItem(page, 'Open binned articles')
  const list = await expectModal(page, 'Binned articles')
  expect(await list.evaluate(element => getComputedStyle(element).transform)).toBe('none')
  await list.getByRole('button', { name: `Restore to feed: ${title}`, exact: true }).press('Enter')
  await expect(list.getByText('Nothing in the bin', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // Closing the menu-owned dialog restores the fallback on the next frame.
  // Wait for that lifecycle before blurring focus for global navigation.
  await expect(page.getByRole('button', { name: 'Open saved articles', exact: true })).toBeFocused()
  await expect(page.locator('[data-reader-background]')).not.toHaveAttribute('aria-hidden', 'true')
  const before = await currentTitle(page).innerText()
  await press(page, 'ArrowDown')
  await expect(currentTitle(page)).not.toHaveText(before)
  expect(await current(page).locator('.feed-card').evaluate(element => getComputedStyle(element).transform)).toBe('none')
})

test('sideways drags bin and bookmark; scrolling moves between posts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const first = await currentTitle(page).innerText()
  // Start on the title link: swipes must work from anywhere on the card.
  const drag = async (dx: number) => {
    const box = await currentTitle(page).locator('a').boundingBox()
    const x = box!.x + Math.min(box!.width / 2, 60)
    const y = box!.y + box!.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + dx, y, { steps: 12 })
    await page.mouse.up()
  }
  // Scroll the feed itself, as a finger or wheel would.
  await page.locator('.feed-scroller').evaluate(element => element.scrollBy({ top: element.clientHeight }))
  await expect(currentTitle(page)).not.toHaveText(first)
  await page.locator('.feed-scroller').evaluate(element => element.scrollTo({ top: 0 }))
  await expect(currentTitle(page)).toHaveText(first)

  await drag(160)
  await expect(currentTitle(page)).not.toHaveText(first)
  await page.getByRole('button', { name: 'Open saved articles' }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: `Read ${first}`, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const binned = await currentTitle(page).innerText()
  await drag(-160)
  await expect(currentTitle(page)).not.toHaveText(binned)
  await expect(page.locator(`.feed-slide[aria-label$=": ${binned}"]`)).toHaveCount(0)
  await openMenuItem(page, 'Open binned articles')
  await expect(page.getByRole('dialog').getByRole('button', { name: `Read ${binned}`, exact: true })).toBeVisible()
})

test('mouse vertical drags follow the pointer and navigate one post without saving or binning', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch uses native vertical scrolling')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const first = await currentTitle(page).innerText()
  const drag = async (dy: number, dx = 0) => {
    const box = await current(page).locator('.feed-description').boundingBox()
    const x = box!.x + box!.width / 2
    const y = box!.y + box!.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + dx, y + dy, { steps: 12 })
    const transform = await current(page).locator('.feed-card').evaluate(element => getComputedStyle(element).transform)
    expect(transform).not.toBe('none')
    await page.mouse.up()
  }
  await drag(-160, 25)
  await expect(currentTitle(page)).not.toHaveText(first)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => current(page).locator('.feed-card').evaluate(element => getComputedStyle(element).transform)).toBe('none')
  await drag(160, -25)
  await expect(currentTitle(page)).toHaveText(first)
  await expect.poll(() => current(page).locator('.feed-card').evaluate(element => getComputedStyle(element).transform)).toBe('none')
  await expect.poll(() => page.locator('.feed-scroller').evaluate(element => Math.round(element.scrollTop))).toBe(0)
  await drag(160) // First-card boundary springs back.
  await expect(currentTitle(page)).toHaveText(first)
  await expect.poll(() => current(page).locator('.feed-card').evaluate(element => getComputedStyle(element).transform)).toBe('none')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('swipe-reader-saved') ?? '[]'))).toEqual([])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('swipe-reader-dismissed') ?? '[]'))).toEqual([])
})

test('every article keeps its reading action and rail visible on phones, filtered or not', async ({ browser }) => {
  const articles = fs.readdirSync(path.join(process.cwd(), 'content')).filter(name => name.endsWith('.md')).sort().map(name => ({
    slug: name.slice(0, -3),
    tags: (matter(fs.readFileSync(path.join(process.cwd(), 'content', name), 'utf8')).data.tags ?? []) as string[],
  }))
  const slugs = articles.map(article => article.slug)
  const cases = [
    { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } },
    { viewport: { width: 980, height: 2120 }, screen: { width: 390, height: 844 } },
    { viewport: { width: 667, height: 375 }, screen: { width: 667, height: 375 } },
    { viewport: { width: 667, height: 375 }, screen: { width: 390, height: 844 } },
  ]
  for (const { viewport, screen } of cases) {
    const context = await browser.newContext({ viewport, screen, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.addInitScript(() => localStorage.setItem('swipe-reader-hint-seen', '1'))
    await page.goto('/')
    await expect(readButton(page)).toBeVisible()
    for (const { slug, tags } of articles) {
      for (const filter of [[], tags.slice(0, 1)]) {
        await page.evaluate(({ slugs, slug, filter }) => {
          localStorage.setItem('swipe-reader-dismissed', JSON.stringify(slugs.filter(other => other !== slug)))
          localStorage.setItem('swipe-reader-tags', JSON.stringify(filter))
        }, { slugs, slug, filter })
        await page.reload()
        await expect(currentTitle(page).locator('a')).toHaveAttribute('href', `/posts/${encodeURIComponent(slug)}/`)
        const label = `${slug} at ${viewport.width}x${viewport.height} filter=${filter.join()}`
        await expect(readButton(page), label).toBeInViewport({ ratio: 1 })
        await expect(currentTitle(page), label).toBeInViewport()
        for (const name of ['Save', 'Bin']) await expect(current(page).getByRole('button', { name, exact: true }), label).toBeInViewport({ ratio: 1 })
        const read = await readButton(page).boundingBox()
        const rail = await current(page).locator('.feed-rail').boundingBox()
        expect(read!.x + read!.width, `${label}: rail does not cover the action`).toBeLessThanOrEqual(rail!.x + 1)
        const title = await currentTitle(page).boundingBox()
        const header = await page.locator('.feed-topbar-row').boundingBox()
        expect(title!.y, `${label}: header does not cover the title`).toBeGreaterThanOrEqual(header!.y + header!.height)
      }
    }
    await context.close()
  }
})
