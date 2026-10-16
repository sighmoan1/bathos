import { test, expect } from '@playwright/test'

test('manager previews grouped email updates, sends explicitly, and handles empty/disabled/stale previews', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ json: { authenticated: true, user: { login: 'owner' } } }))
  await page.route('**/api/posts', route => route.fulfill({ json: { posts: [] } }))
  let enabled = true, empty = false, stale = false, sends = 0
  await page.route('**/api/subscriptions/digest', route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ preview: 'signed-preview' })
      sends++
      if (stale) return route.fulfill({ status: 409, json: { error: 'The update changed. Refresh the preview before sending.' } })
      empty = true
      return route.fulfill({ status: 202, json: { queued: 3, posts: 2 } })
    }
    return route.fulfill({ json: { enabled, recipients: 3, preview: 'signed-preview', schedule: 'Mondays at 09:00 UK time', posts: empty ? [] : [
      { title: 'First new post', summary: 'First summary', canonicalUrl: 'https://bathos.org/posts/first/' },
      { title: 'Second new post', summary: 'Second summary', canonicalUrl: 'https://bathos.org/posts/second/' },
    ] } })
  })
  for (const width of [320, 1200]) {
    enabled = true; empty = false; stale = false
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/manage/')
    const region = page.getByRole('region', { name: 'Email updates' })
    await expect(region).toBeVisible()
    await expect(region.getByRole('button', { name: 'Send update now' })).toHaveCount(0)
    await region.getByRole('button', { name: 'Preview email update' }).click()
    await expect(region.getByText('Subject: Bathos update: 2 new posts')).toBeVisible()
    await expect(region.getByRole('link', { name: 'First new post' })).toHaveAttribute('href', 'https://bathos.org/posts/first/')
    const before = sends
    await region.getByRole('button', { name: 'Send update now' }).click()
    await expect(region.getByRole('status')).toContainText('Update queued for 3 subscribers')
    expect(sends).toBe(before + 1)
    await region.getByRole('button', { name: 'Preview email update' }).click()
    await expect(region.getByRole('button', { name: 'Send update now' })).toBeDisabled()
    await expect(region.getByText('No new posts since the last update. Nothing will be sent.')).toBeVisible()
    empty = false; enabled = false
    await region.getByRole('button', { name: 'Preview email update' }).click()
    await expect(region.getByRole('button', { name: 'Send update now' })).toBeDisabled()
    await expect(region.getByText(/Email delivery is not enabled yet/)).toBeVisible()
    enabled = true; stale = true
    await region.getByRole('button', { name: 'Preview email update' }).click()
    await region.getByRole('button', { name: 'Send update now' }).click()
    await expect(region.getByRole('status')).toContainText('The update changed')
    await expect(region.getByRole('button', { name: 'Send update now' })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  }
})

test('email updates are not exposed in the signed-out manager', async ({page}) => {
  await page.route('**/api/session', route => route.fulfill({ status: 401, json: { error: 'Sign in.' } }))
  await page.goto('/manage/')
  await expect(page.getByRole('link', {name: /Sign in with GitHub/})).toBeVisible()
  await expect(page.getByRole('region', {name: 'Email updates'})).toHaveCount(0)
})
