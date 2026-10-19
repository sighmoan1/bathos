import { test, expect } from '@playwright/test'
import { current, currentTitle } from './feed-helpers'

test('vertical trackpad events remain native through small deltas, momentum and quick reversal', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mac trackpad regression')
  await page.goto('/')
  await expect(currentTitle(page)).toBeVisible()
  const observations = await page.locator('.feed-scroller').evaluate(element => {
    const cancelled: boolean[] = []
    const send = (dx: number, dy: number, mode = 0, ctrlKey = false) => {
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: dx, deltaY: dy, deltaMode: mode, ctrlKey })
      element.dispatchEvent(event)
      cancelled.push(event.defaultPrevented)
    }
    // No 160ms gap: reversals and small movements must still reach the browser.
    for (const dy of [1, 2, 8, 40, 12, 3, -1, -8, -40, 2]) send(0, dy)
    send(8, 2) // A noisy sideways sample within a vertical gesture.
    send(1, 4, 1) // Line-mode wheel.
    send(0, 1, 2) // Page-mode wheel.
    send(0, 2, 0, true) // Browser pinch/zoom.
    return cancelled
  })
  expect(observations.every(cancelled => !cancelled)).toBe(true)
  const box = await current(page).locator('.feed-card').boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  const first = await currentTitle(page).innerText()
  await page.mouse.wheel(0, 180)
  await expect.poll(() => page.locator('.feed-scroller').evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await expect(currentTitle(page)).not.toHaveText(first)
  await page.mouse.wheel(0, -180)
  await expect(currentTitle(page)).toHaveText(first)
  await expect.poll(() => page.locator('.feed-scroller').evaluate(element => Math.round(element.scrollTop))).toBe(0)
  await expect.poll(() => page.locator('.feed-scroller').evaluate(element => getComputedStyle(element).scrollSnapType)).toBe('y mandatory')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('swipe-reader-saved') ?? '[]'))).toEqual([])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('swipe-reader-dismissed') ?? '[]'))).toEqual([])
})

test('a vertical scroll is allowed immediately after a sideways trackpad action', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mac trackpad regression')
  await page.goto('/')
  await expect(currentTitle(page)).toBeVisible()
  const result = await page.locator('.feed-scroller').evaluate(element => {
    const sideways = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: -80 })
    element.dispatchEvent(sideways)
    const vertical = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 20 })
    element.dispatchEvent(vertical)
    return { sideways: sideways.defaultPrevented, vertical: vertical.defaultPrevented }
  })
  expect(result).toEqual({ sideways: true, vertical: false })
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('swipe-reader-saved') ?? '[]').length)).toBe(1)
})

test('keyboard navigation takes over a settling trackpad gesture', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mac trackpad regression')
  await page.goto('/')
  await expect(currentTitle(page)).toBeVisible()
  const box = await current(page).locator('.feed-card').boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.wheel(0, 80)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect.poll(() => page.locator('.feed-scroller').evaluate(element => Math.round(element.scrollTop / element.clientHeight * 1000))).toBe(2000)
})
