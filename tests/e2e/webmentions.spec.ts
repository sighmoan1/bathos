import { test, expect } from '@playwright/test'

const enabled = process.env.NEXT_PUBLIC_BATHOS_WEBMENTIONS === 'true'
const target = 'https://bathos.org/posts/Gassing/'
const sectionName = 'Responses from other websites'

test('unconfigured production feature renders no response section or API request', async ({ page }) => {
  test.skip(enabled, 'This case verifies the default disabled build')
  const calls: string[] = []
  page.on('request', request => { if (request.url().includes('/api/webmention/')) calls.push(request.url()) })
  await page.goto('/posts/Gassing/')
  await expect(page.locator('article h1')).toBeVisible()
  await expect(page.getByRole('region', { name: sectionName })).toHaveCount(0)
  expect(calls).toEqual([])
})

test('approved response display escapes remote text and excludes pending/invalid records', async ({ page }) => {
  test.skip(!enabled, 'Run an explicit NEXT_PUBLIC_BATHOS_WEBMENTIONS=true QA build')
  await page.route('**/api/webmention/responses?*', route => {
    expect(new URL(route.request().url()).searchParams.get('target')).toBe(target)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ responses: [
      {source:'https://reply.example/approved',target,name:'<img src=x onerror="window.badReply=true">',author:'A & B'},
      {source:'https://reply.example/pending',target,name:'Pending should stay hidden',status:'pending'},
      {source:'javascript:alert(1)',target,name:'Unsafe URL'},
      {source:'https://reply.example/other',target:'https://bathos.org/posts/other/',name:'Wrong target'},
    ] }) })
  })
  await page.goto('/posts/Gassing/')
  const section=page.getByRole('region',{name:sectionName})
  const reply=section.getByRole('link',{name:'<img src=x onerror="window.badReply=true">'})
  await expect(reply).toBeVisible()
  await expect(reply).toHaveAttribute('href','https://reply.example/approved')
  await expect(reply).toHaveAttribute('rel','ugc nofollow noopener noreferrer')
  await expect(section.getByRole('link')).toHaveCount(1)
  await expect(section.locator('img, script')).toHaveCount(0)
  expect(await page.evaluate(()=>(window as unknown as {badReply?:boolean}).badReply)).toBeUndefined()
  await expect(section).not.toContainText('Pending should stay hidden')
})

test('pending-only receiver results show empty state and service errors show unavailable state',async ({page})=>{
  test.skip(!enabled,'Run an explicit NEXT_PUBLIC_BATHOS_WEBMENTIONS=true QA build')
  let unavailable=false
  await page.route('**/api/webmention/responses?*',route=>route.fulfill(unavailable?{status:503,contentType:'application/json',body:'{"error":"unavailable"}'}:{status:200,contentType:'application/json',body:'{"responses":[]}'}))
  await page.goto('/posts/Gassing/')
  const section=page.getByRole('region',{name:sectionName})
  await expect(section).toContainText('No approved responses yet.')
  await expect(section.getByRole('link')).toHaveCount(0)
  unavailable=true
  await page.reload()
  await expect(section.getByRole('status')).toHaveText('Responses are temporarily unavailable.')
  await expect(section.getByRole('link')).toHaveCount(0)
  await expect(section).not.toContainText('No approved responses yet.')
})

test('receiver quota payload above64KiB renders all records and browser cap rejects oversized payload',async ({page})=>{
  test.skip(!enabled,'Run an explicit NEXT_PUBLIC_BATHOS_WEBMENTIONS=true QA build')
  const responses=Array.from({length:100},(_,index)=>({source:`https://reply.example/${'x'.repeat(900)}/${index}`,target,name:`Reply ${index} ${'n'.repeat(185)}`,author:'a'.repeat(100),published:'2026-10-13T10:00:00.000Z'}))
  const valid=JSON.stringify({responses})
  expect(Buffer.byteLength(valid)).toBeGreaterThan(65536)
  expect(Buffer.byteLength(valid)).toBeLessThan(1024*1024)
  let oversized=false
  await page.route('**/api/webmention/responses?*',route=>route.fulfill({status:200,contentType:'application/json',body:oversized?JSON.stringify({responses:[{source:'https://reply.example/huge',target,name:'x'.repeat(1024*1024)}]}):valid}))
  await page.goto('/posts/Gassing/')
  const section=page.getByRole('region',{name:sectionName})
  await expect(section.getByRole('link')).toHaveCount(100)
  await expect(section).not.toContainText('Responses are temporarily unavailable.')
  oversized=true
  await page.reload()
  await expect(section.getByRole('status')).toHaveText('Responses are temporarily unavailable.')
  await expect(section.getByRole('link')).toHaveCount(0)
})
