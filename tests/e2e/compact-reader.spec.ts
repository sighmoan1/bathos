import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('every article keeps its reading action visible in compact desktop windows', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const slugs = fs.readdirSync('content').filter(name => name.endsWith('.md')).map(name => name.slice(0, -3)).sort()
  for (const viewport of [{ width: 390, height: 844 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport)
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
      await expect(page.getByRole('button', { name: 'Read Article', exact: true }), `${slug} at ${viewport.width}x${viewport.height}`).toBeInViewport({ ratio: 1 })
    }
  }
})
