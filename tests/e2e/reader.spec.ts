import {test,expect} from '@playwright/test';
test('shared theme retains readable recipes and keyboard controls',async({page})=>{
 page.on('pageerror', e => console.log('Browser error:',e.message));
 page.on('requestfailed',r=>console.log('Failed request:',r.url(),r.failure()?.errorText));
 await page.goto('/');
 const heading=page.getByRole('heading',{level:2}).first();
 await expect(heading).toBeVisible();
 const initialTitle=await heading.textContent();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(heading).not.toHaveText(initialTitle!);
 await page.getByRole('button',{name:'Previous',exact:true}).click();
 await expect(heading).toHaveText(initialTitle!);
 await page.getByRole('button',{name:'Read Article',exact:true}).click();
 await expect(page.getByRole('button',{name:/close|back/i}).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bathos-color-accent-light').trim())).toBe('#b599ed');
});

test('feed fills desktop, mobile and short landscape viewports', async ({ page }) => {
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Read Article', exact: true })).toBeVisible()
    const card = await page.locator('.reader-card-surface').boundingBox()
    expect(card!.width).toBeGreaterThan(viewport.width * .9)
    expect(card!.height).toBeGreaterThan(viewport.height * .5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true)
    await page.getByRole('button', { name: 'Filter by tag' }).click()
    await expect(page.getByRole('button', { name: 'Read Article', exact: true })).toBeInViewport()
    await page.getByRole('button', { name: 'Filter by tag' }).click()
  }
})

test('reader remains installable without an offline cache', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Read Article', exact: true })).toBeVisible()
  const manifestURL = await page.locator('link[rel=manifest]').getAttribute('href')
  const manifest = await (await page.request.get(manifestURL!)).json()
  expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone' })
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true)
  await page.getByRole('button', { name: 'Install Bathos', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Install Bathos instructions' })).toContainText('Add to Home Screen')
  await page.getByRole('button', { name: 'Close installation instructions' }).click()
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(items => items.filter(item => item.scope === new URL('/', location.origin).href).length))).toBe(0)
  expect(await page.evaluate(() => caches.keys())).toEqual([])
  await page.evaluate(async () => {
    await caches.open('bathos-reader-legacy')
    await caches.open('bathos-manager-preserved')
  })
  await page.reload()
  await page.waitForFunction(async () => !(await caches.keys()).includes('bathos-reader-legacy'))
  expect(await page.evaluate(() => caches.keys())).toEqual(['bathos-manager-preserved'])
  await expect(page.getByRole('button', { name: 'Update app', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Open saved articles' }).click()
  await expect(page.getByRole('heading', { name: 'Saved Articles' })).toBeVisible()
})

test('browser install prompt is offered once and hidden after installation', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Install Bathos', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, { prompt: async () => { (window as any).__prompted = true }, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    window.dispatchEvent(event)
  })
  await page.getByRole('button', { name: 'Install Bathos', exact: true }).click()
  expect(await page.evaluate(() => (window as any).__prompted)).toBe(true)
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
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
    const controls = await page.getByRole('button', { name: 'Filter by tag' }).boundingBox()
    expect(controls!.width / scale).toBeGreaterThanOrEqual(43.9)
    expect(controls!.height / scale).toBeGreaterThanOrEqual(43.9)
    const titleSize = await page.locator('.reader-title').evaluate(element => parseFloat(getComputedStyle(element).fontSize))
    expect(titleSize / scale).toBeGreaterThanOrEqual(31)
    await expect(page.locator('.reader-key-hint').first()).toBeHidden()
    await expect(page.locator('.reader-mobile-preview')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save this article', exact: true })).toBeHidden()
    const content = await page.locator('.reader-card-content').boundingBox()
    const title = await page.locator('.reader-title').boundingBox()
    expect((title!.y - content!.y) / scale).toBeLessThan(140)
    await page.getByRole('button', { name: 'Filter by tag' }).click()
    const tag = await page.locator('.reader-tag-filter button').first().boundingBox()
    expect(tag!.height / scale).toBeGreaterThanOrEqual(43.9)
    await expect(page.getByRole('button', { name: 'Read Article', exact: true })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await context.close()
  }
})
