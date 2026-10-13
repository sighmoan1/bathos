import {test,expect} from '@playwright/test';
test('Webmention guide explains published replies and receiver availability', async ({page})=>{
 await page.goto('/webmentions/');
 await expect(page.getByRole('heading',{name:'Reply from your own corner of the web.'})).toBeVisible();
 await expect(page.getByRole('link',{name:'implementation guide'})).toHaveAttribute('href','/webmentions-agent.md');
 const source = page.getByLabel('Your published reply URL');
 if(await source.count() === 0) {
  await expect(page.getByRole('status')).toContainText('submission is currently unavailable');
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
