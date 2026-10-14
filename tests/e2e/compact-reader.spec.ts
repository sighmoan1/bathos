import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { currentTitle, readButton } from './feed-helpers'

test('every article keeps its reading action visible in compact desktop windows', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const slugs = fs.readdirSync('content').filter(name => name.endsWith('.md')).map(name => name.slice(0, -3)).sort()
  for (const viewport of [{ width: 390, height: 844 }, { width: 667, height: 375 }, { width: 1024, height: 600 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(readButton(page)).toBeVisible()
    for (const slug of slugs) {
      await page.evaluate(({ slugs, slug }) => {
        localStorage.setItem('swipe-reader-dismissed', JSON.stringify(slugs.filter(other => other !== slug)))
        localStorage.setItem('swipe-reader-tags', '[]')
      }, { slugs, slug })
      await page.reload()
      await expect(currentTitle(page).locator('a')).toHaveAttribute('href', `/posts/${encodeURIComponent(slug)}/`)
      await expect(readButton(page), `${slug} at ${viewport.width}x${viewport.height}`).toBeInViewport({ ratio: 1 })
    }
  }
})
