import {test,expect} from '@playwright/test';
import { current, currentTitle, openMenuItem, press, readButton } from './feed-helpers'

test('shared theme retains readable recipes and keyboard controls',async({page})=>{
 page.on('pageerror', e => console.log('Browser error:',e.message));
 await page.goto('/');
 const heading=currentTitle(page);
 await expect(heading).toBeVisible();
 const initialTitle=await heading.textContent();
 await press(page,'ArrowDown');
 await expect(currentTitle(page)).not.toHaveText(initialTitle!);
 await press(page,'ArrowUp');
 await expect(currentTitle(page)).toHaveText(initialTitle!);
 await readButton(page).click();
 await expect(page.getByRole('button',{name:/close|back/i}).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bathos-color-accent-light').trim())).toBe('#b599ed');
});

test('each post fills the screen at desktop, mobile and short landscape sizes', async ({ page }) => {
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(readButton(page)).toBeInViewport({ ratio: 1 })
    const slide = await current(page).boundingBox()
    expect(Math.round(slide!.height)).toBe(viewport.height)
    expect(Math.round(slide!.width)).toBe(viewport.width)
    const card = await current(page).locator('.feed-card').boundingBox()
    expect(card!.width).toBeGreaterThan(Math.min(viewport.width * .6, 600))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true)
    for (const name of ['Save', 'Bin', 'Share this article']) await expect(current(page).getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 })
    await page.getByRole('button', { name: 'Filter by tag' }).click()
    await expect(page.getByRole('region', { name: 'Filter by topic' })).toBeVisible()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Filter by topic' })).toHaveCount(0)
  }
})

test('reader remains installable without an offline cache', async ({ page }) => {
  await page.goto('/')
  await expect(readButton(page)).toBeVisible()
  const manifestURL = await page.locator('link[rel=manifest]').getAttribute('href')
  const manifest = await (await page.request.get(manifestURL!)).json()
  expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone' })
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true)
  await openMenuItem(page, 'Install Bathos')
  await expect(page.getByRole('region', { name: 'Install Bathos instructions' })).toContainText('Add to Home Screen')
  await page.getByRole('button', { name: 'Close installation instructions' }).click()
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(items => items.filter(item => item.scope === new URL('/', location.origin).href).length))).toBe(0)
  await page.evaluate(async () => {
    await caches.open('bathos-reader-legacy')
    await caches.open('bathos-manager-preserved')
  })
  await page.reload()
  await page.waitForFunction(async () => !(await caches.keys()).includes('bathos-reader-legacy'))
  expect(await page.evaluate(() => caches.keys())).toEqual(['bathos-manager-preserved'])
  await expect(page.getByRole('button', { name: 'Update app', exact: true })).toHaveCount(0)
  await current(page).getByRole('button', { name: 'Save', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Open saved articles' }).click()
  await expect(page.getByRole('heading', { name: 'Saved Articles' })).toBeVisible()
})

test('browser install prompt is offered once and hidden after installation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'More options' }).click()
  await expect(page.getByRole('button', { name: 'Install Bathos', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, { prompt: async () => { (window as any).__prompted = true }, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    window.dispatchEvent(event)
  })
  await page.getByRole('button', { name: 'Install Bathos', exact: true }).click()
  expect(await page.evaluate(() => (window as any).__prompted)).toBe(true)
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await page.getByRole('button', { name: 'More options' }).click()
  await expect(page.getByRole('button', { name: 'Open binned articles' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Install Bathos', exact: true })).toHaveCount(0)
})

test('manager retains its offline shell without a reader cache', async ({ page, context }) => {
  await page.goto('/')
  await page.goto('/manage/')
  await expect(page.getByRole('heading', { name: /Manage posts/i })).toBeVisible()
  await page.waitForFunction(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations()
    return registrations.some(registration => registration.scope.endsWith('/manage/') && registration.active?.state === 'activated')
  })
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/manage/sw.js'))
  const keys = await page.evaluate(() => caches.keys())
  expect(keys.some(key => key.startsWith('bathos-reader-'))).toBe(false)
  expect(keys.some(key => key.startsWith('bathos-manager-'))).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Manage posts/i })).toBeVisible()
  await context.setOffline(false)
})

test('phone UI remains readable in normal and desktop-requested viewports', async ({ browser }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 980, height: 2120 }]) {
    const context = await browser.newContext({ viewport, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/reader-phone/)
    const scale = viewport.width / 390
    for (const control of [page.getByRole('button', { name: 'Filter by tag' }), current(page).getByRole('button', { name: 'Save', exact: true }), current(page).getByRole('button', { name: 'Bin', exact: true })]) {
      const box = await control.boundingBox()
      expect(box!.width / scale).toBeGreaterThanOrEqual(43.9)
      expect(box!.height / scale).toBeGreaterThanOrEqual(43.9)
    }
    const titleSize = await currentTitle(page).evaluate(element => parseFloat(getComputedStyle(element).fontSize))
    expect(titleSize / scale).toBeGreaterThanOrEqual(29)
    await expect(current(page).locator('.feed-preview')).toBeVisible()
    // Wide-screen previous/next arrows give way to swiping on phones.
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeHidden()
    const slide = await current(page).boundingBox()
    const title = await currentTitle(page).boundingBox()
    expect((title!.y - slide!.y) / scale).toBeLessThan(160)
    await page.getByRole('button', { name: 'Filter by tag' }).click()
    const tag = await page.locator('.feed-tag-filter button').first().boundingBox()
    expect(tag!.height / scale).toBeGreaterThanOrEqual(43.9)
    await expect(readButton(page)).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await context.close()
  }
})

test('bookmark count matches available saved articles after posts are removed', async ({ page }) => {
  const missing = ['victoria-sponge', 'sticky-ginger-parkin', 'new-york-cheesecake']
  await page.addInitScript(slugs => {
    if (!localStorage.getItem('swipe-reader-saved')) localStorage.setItem('swipe-reader-saved', JSON.stringify(slugs))
  }, missing)
  await page.goto('/')
  const savedButton = page.getByRole('button', { name: 'Open saved articles' })
  await expect(savedButton).toBeVisible()
  await expect(savedButton.locator('span')).toHaveCount(0)
  await savedButton.click()
  await expect(page.getByText('No saved articles yet', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  const title = await currentTitle(page).textContent()
  const save = current(page).getByRole('button', { name: 'Save', exact: true })
  await save.click()
  await expect(save).toHaveAttribute('aria-pressed', 'true')
  await expect(savedButton.locator('span')).toHaveText('1')
  // Include a duplicate and deleted posts: the list still contains one article.
  await page.evaluate(() => {
    const slugs = JSON.parse(localStorage.getItem('swipe-reader-saved')!)
    localStorage.setItem('swipe-reader-saved', JSON.stringify([...slugs, slugs.at(-1)]))
  })
  await page.reload()
  await expect(savedButton.locator('span')).toHaveText('1')
  await savedButton.click()
  await expect(page.getByRole('button', { name: `Read ${title}`, exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: `Remove from saved: ${title}` }).click()
  await expect(page.getByText('No saved articles yet', { exact: true })).toBeVisible()
  await expect(savedButton.locator('span')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('swipe-reader-saved')!))).toEqual(missing)
})

test('binning shows an undo, and the end of the feed offers a way back', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const first = await currentTitle(page).innerText()
  await current(page).getByRole('button', { name: 'Bin', exact: true }).click()
  await expect(currentTitle(page)).not.toHaveText(first)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(currentTitle(page)).toHaveText(first)
  const total = await page.locator('.feed-slide:not(.feed-end)').count()
  for (let i = 0; i < total; i++) await press(page, 'ArrowDown')
  await expect(current(page)).toHaveAttribute('aria-label', 'End of feed')
  await expect(page.getByRole('heading', { name: /all caught up/ })).toBeVisible()
  await page.getByRole('button', { name: 'Back to the first post', exact: true }).click()
  await expect(currentTitle(page)).toHaveText(first)
})
