import type { Page } from '@playwright/test'

/** The slide on screen. Other slides are inert, so their controls are unreachable. */
export const current = (page: Page) => page.locator('.feed-slide[data-current]')
export const currentTitle = (page: Page) => current(page).locator('.reader-title')
export const readButton = (page: Page) => current(page).getByRole('button', { name: 'Read Article', exact: true })

/** Keyboard navigation applies when focus is not on a control. */
export async function press(page: Page, key: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press(key)
}

export async function openMenuItem(page: Page, name: string) {
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByRole('button', { name, exact: true }).click()
}
