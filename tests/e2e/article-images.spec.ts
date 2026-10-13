import { test, expect } from '@playwright/test'

for (const route of ['read', 'posts']) {
  test(`cross-chat screenshot loads with accessible text in the ${route} reader`, async ({ page }) => {
    await page.goto(`/${route}/multi-agent-agentic-way/`)
    const image = page.getByRole('img', { name: 'ChatGPT task handoff labelled Sent by ChatGPT from another task, assigning Webmention issues and branches, defining API contracts and sequencing merges.', exact: true })
    await expect(image).toBeVisible()
    await expect(image).toHaveAttribute('src', '/images/posts/multi-agent-agentic-way/cross-chat-coordination.png')
    expect(await image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth === 1510 && element.naturalHeight === 1524)).toBe(true)
    const caption = page.getByText('A real cross-chat coordination message sent by ChatGPT on 13 October 2026, after I authorised coordination between the two tasks.', { exact: true })
    await expect(caption).toBeVisible()
    expect(await image.evaluate(element => element.parentElement?.previousElementSibling?.textContent)).toBe('What it actually sent')
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 812 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      expect(await image.evaluate(element => element.getBoundingClientRect().width <= element.parentElement!.getBoundingClientRect().width)).toBe(true)
    }
  })
}
