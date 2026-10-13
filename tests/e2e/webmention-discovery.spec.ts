import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test.use({ javaScriptEnabled: false })

for (const view of ['posts', 'read']) {
test(`exported ${view} article guides humans and agents to reply without JavaScript`, async ({ page }) => {
  const slug = fs.readdirSync('content').find(name => name.endsWith('.md'))!.slice(0, -3)
  const path = `/posts/${encodeURIComponent(slug)}/`
  await page.goto(`/${view}/${encodeURIComponent(slug)}/`)
  await expect(page.locator('article h1')).toBeVisible()
  const guidance = page.getByRole('complementary', { name: 'Reply from your own website' })
  await guidance.scrollIntoViewIfNeeded()
  await expect(guidance).toBeVisible()
  await expect(guidance.getByRole('link', { name: 'Webmention reply guide', exact: true }))
    .toHaveAttribute('href', `/webmentions?target=${encodeURIComponent(`https://bathos.org${path}`)}`)
  await expect(guidance.getByRole('link', { name: 'Webmention implementation instructions', exact: true }))
    .toHaveAttribute('href', '/webmentions-agent.md')
  // Publishing instructions does not announce an unconfigured receiver.
  await expect(page.locator('link[rel~=webmention], a[rel~=webmention]')).toHaveCount(0)
})
}
