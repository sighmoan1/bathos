import {test,expect} from '@playwright/test';
test('Webmention guide explains published replies and receiver availability', async ({page})=>{
 await page.goto('/webmentions/');
 await expect(page.getByRole('heading',{name:'Reply from your own corner of the web.'})).toBeVisible();
 await expect(page.getByRole('link',{name:'implementation guide'})).toHaveAttribute('href','/webmentions-agent.md');
 const source = page.getByLabel('Your published reply URL');
 if(await source.count() === 0) {
  await expect(page.getByRole('status')).toContainText('submission is currently unavailable');
  await expect(page.locator('form')).toHaveCount(0);
 } else {
  await expect(source).toBeVisible();
  await page.goto('/webmentions/?target=https%3A%2F%2Fbathos.org%2Fposts%2Fexample%2F');
  await expect(page.getByLabel('Bathos article URL')).toHaveValue('https://bathos.org/posts/example/');
  await page.goto('/webmentions/?target=https%3A%2F%2Fevil.example%2Fposts%2Fexample%2F');
  await expect(page.getByLabel('Bathos article URL')).toHaveValue('');
  await source.fill('https://example.org/reply/');
  await page.getByLabel('Bathos article URL').fill('https://bathos.org/posts/example/');
  await page.route('**/api/webmention', async route=>{
   expect(route.request().method()).toBe('POST');
   expect(new URLSearchParams(route.request().postData() ?? '').get('source')).toBe('https://example.org/reply/');
   await route.fulfill({status:202,body:'{}'});
  });
  await page.getByRole('button',{name:'Submit published reply'}).click();
  await expect(page.getByRole('status')).toContainText('Received for verification');
  await page.unroute('**/api/webmention');
  await page.route('**/api/webmention', route=>route.fulfill({status:429,body:'{}'}));
  await page.getByRole('button',{name:'Submit published reply'}).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('Please wait');
  await page.unroute('**/api/webmention');
  await page.route('**/api/webmention', route=>route.abort());
  await page.getByRole('button',{name:'Submit published reply'}).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('could not confirm receipt');
 }
});

test('configured form submits a real form-encoded POST without JavaScript', async ({browser})=>{
 const context = await browser.newContext({javaScriptEnabled:false});
 const page = await context.newPage();
 await page.goto(`${process.env.READER_BASE_URL ?? 'http://127.0.0.1:3021'}/webmentions/`);
 if(await page.getByLabel('Your published reply URL').count() === 0) {
  await expect(page.getByRole('status')).toContainText('submission is currently unavailable');
  await expect(page.locator('form')).toHaveCount(0);
  await context.close();
  return;
 }
 await expect(page.locator('noscript p')).toBeVisible();
 await expect(page.locator('noscript p')).toContainText('Acceptance does not confirm verification or display');
 await page.getByLabel('Your published reply URL').fill('https://example.org/native-reply/');
 await page.getByLabel('Bathos article URL').fill('https://bathos.org/posts/example/');
 await page.route('**/api/webmention', async route=>{
  expect(route.request().method()).toBe('POST');
  expect(route.request().headers()['content-type']).toContain('application/x-www-form-urlencoded');
  const fields = new URLSearchParams(route.request().postData() ?? '');
  expect(fields.get('source')).toBe('https://example.org/native-reply/');
  expect(fields.get('target')).toBe('https://bathos.org/posts/example/');
  await route.fulfill({status:202,contentType:'text/plain',body:'Received for verification; display is not guaranteed.'});
 });
 await page.getByRole('button',{name:'Submit published reply'}).click();
 await expect(page.locator('body')).toContainText('Received for verification; display is not guaranteed.');
 await context.close();
});
