import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

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
  const title = await page.locator('.reader-title').innerText()
  const opener = page.getByRole('button', { name: 'Read Article', exact: true })
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
  await expect(page.getByRole('button', { name: 'Open saved articles' })).toBeFocused()
})

test('saved selection works by keyboard and replacement dialog owns focus', async ({ page }) => {
  await page.goto('/')
  const title = await page.locator('.reader-title').innerText()
  await page.getByRole('button', { name: 'Save', exact: true }).focus()
  await page.keyboard.press('Enter')
  // The window feed handler must not replace the focused button's native action.
  await expect(page.getByRole('dialog')).toHaveCount(0)
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
  const path = await page.locator('.reader-title a').getAttribute('href')
  await page.goto(path!)
  const title = await page.locator('article h1').innerText()
  await expectModal(page, title)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open saved articles' })).toBeFocused()
  await page.getByRole('button', { name: 'Read Article', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Read Article', exact: true })).toBeFocused()
})

test('hidden panel actions are named and reduced motion retains navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const title = await page.locator('.reader-title').innerText()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'Open articles hidden on this device' }).click()
  const list = await expectModal(page, 'Hidden on this device')
  expect(await list.evaluate(element => getComputedStyle(element).transform)).toBe('none')
  await list.getByRole('button', { name: `Restore to feed: ${title}`, exact: true }).press('Enter')
  await expect(list.getByText('No hidden articles', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const before = await page.locator('.reader-title').innerText()
  await page.getByRole('button', { name: 'Next', exact: true }).press('Enter')
  await expect(page.locator('.reader-title')).not.toHaveText(before)
  expect(await page.locator('.reader-card').evaluate(element => getComputedStyle(element).transform)).toBe('none')
})

test('pointer swipes keep next, previous, save and hide behavior', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const heading = page.locator('.reader-title')
  const first = await heading.innerText()
  const swipe = async (dx: number, dy: number) => {
    const beforeSwipe = await heading.innerText()
    const box = await page.locator('.reader-card-surface').boundingBox()
    const x = box!.x + box!.width / 2
    const y = box!.y + box!.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + dx, y + dy, { steps: 12 })
    await page.mouse.up()
    await expect(heading.last()).not.toHaveText(beforeSwipe)
    await expect(page.locator(".reader-card")).toHaveCount(1)
  }
  await swipe(0, -120)
  await expect(heading).not.toHaveText(first)
  await swipe(0, 120)
  await expect(heading).toHaveText(first)
  await swipe(130, 0)
  await expect(heading).not.toHaveText(first)
  await page.getByRole('button', { name: 'Open saved articles' }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: `Read ${first}`, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const hidden = await heading.innerText()
  await swipe(-130, 0)
  await expect(heading).not.toHaveText(hidden)
  await page.getByRole('button', { name: 'Open articles hidden on this device' }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: `Read ${hidden}`, exact: true })).toBeVisible()
})


test('every article keeps its full reading action visible with phone filters expanded', async ({ browser }) => {
  const slugs = fs.readdirSync(path.join(process.cwd(), 'content')).filter(name => name.endsWith('.md')).map(name => name.slice(0, -3)).sort()
  const cases = [
    { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } },
    { viewport: { width: 980, height: 2120 }, screen: { width: 390, height: 844 } },
    { viewport: { width: 667, height: 375 }, screen: { width: 667, height: 375 } },
    { viewport: { width: 667, height: 375 }, screen: { width: 390, height: 844 } },
  ]
  for (const { viewport, screen } of cases) {
    const context = await browser.newContext({ viewport, screen, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Read Article', exact: true })).toBeVisible()
    for (const slug of slugs) {
      await page.evaluate(({ slugs, slug }) => {
        localStorage.setItem('swipe-reader-dismissed', JSON.stringify(slugs.filter(other => other !== slug)))
        localStorage.setItem('swipe-reader-tags', '[]')
      }, { slugs, slug })
      await page.reload()
      await expect(page.locator('.reader-title a')).toHaveAttribute('href', `/posts/${encodeURIComponent(slug)}/`)
      await page.getByRole('button', { name: 'Filter by tag' }).click()
      await expect(page.locator('.reader-tag-filter')).toBeVisible()
      const action = page.getByRole('button', { name: 'Read Article', exact: true })
      await expect(action, `${slug} at ${viewport.width}x${viewport.height}`).toBeInViewport({ ratio: 1 })
      const bounds = await action.boundingBox()
      const surface = await page.locator('.reader-card-surface').boundingBox()
      expect(bounds!.y, `${slug}: action top within card`).toBeGreaterThanOrEqual(surface!.y)
      expect(bounds!.y + bounds!.height, `${slug}: action bottom within card`).toBeLessThanOrEqual(surface!.y + surface!.height + 1)
    }
    await context.close()
  }
})
