import { test, expect } from '@playwright/test';
import { pagesHeaders } from '../helpers/pages-headers.cjs';

test('Pages framing policy blocks a foreign iframe and permits direct manager navigation', async ({ page, context, baseURL }) => {
  try {
    await context.route('**/api/session', route => route.fulfill({ status: 401, json: {} }));
    // The local static server does not implement Pages _headers. Apply the actual
    // committed rules to its manager HTML so Chromium tests their enforcement.
    await context.route('**/manage/', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), ...pagesHeaders('/manage/') } });
    });
    await context.route('http://attacker.test/**', route => route.fulfill({
      contentType: 'text/html', body: `<iframe src="${baseURL}/manage/" title="Framed manager"></iframe>`
    }));
    const errors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://attacker.test/');
    await expect.poll(() => errors.join('\n')).toMatch(/frame-ancestors|X-Frame-Options/i);
    await expect(page.frameLocator('iframe').getByRole('heading')).toHaveCount(0);
    await page.goto('/manage/');
    await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
  } finally {
    // Manager service-worker precaching can outlive the visible sign-in assertion.
    // Drain fetch/fulfill handlers before fixture teardown disposes their responses.
    await context.unrouteAll({ behavior: 'wait' });
  }
});
