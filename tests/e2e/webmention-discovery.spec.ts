import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { webmentionEndpoint } from '../../lib/webmention-submission'

test.use({ javaScriptEnabled: false })

for (const view of ['posts', 'read']) {
test(`exported ${view} article guides humans and agents to reply without JavaScript`, async ({ page }) => {
  const slug = fs.readdirSync('content').find(name => name.endsWith('.md'))!.slice(0, -3)
  const path = `/posts/${encodeURIComponent(slug)}/`
  await page.goto(`/${view}/${encodeURIComponent(slug)}/`)
  if (view === 'posts') {
    await page.getByRole('link', { name: 'Read this article without JavaScript', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/read/${encodeURIComponent(slug)}/$`))
  }
  await expect(page.locator('article h1')).toBeVisible()
  const guidance = page.getByRole('complementary', { name: 'Reply from your own website' })
  await guidance.scrollIntoViewIfNeeded()
  await expect(guidance).toBeVisible()
  await expect(guidance.getByRole('link', { name: 'Webmention reply guide', exact: true }))
    .toHaveAttribute('href', `/webmentions?target=${encodeURIComponent(`https://bathos.org${path}`)}`)
  await expect(guidance.getByRole('link', { name: 'Webmention implementation instructions', exact: true }))
    .toHaveAttribute('href', '/webmentions-agent.md')
  const receiver = webmentionEndpoint()
  const discovery = page.locator('link[rel~=webmention], a[rel~=webmention]')
  if (receiver) {
    await expect(discovery).toHaveCount(1)
    await expect(discovery).toHaveAttribute('href', receiver)
  } else {
    // Publishing instructions does not announce an unconfigured receiver.
    await expect(discovery).toHaveCount(0)
  }
})
}
