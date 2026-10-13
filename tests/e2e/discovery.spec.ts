import {test,expect} from '@playwright/test'
import fs from 'node:fs'

test('exported discovery catalog, sitemap, robots and RSS agree on every post',async({page})=>{
 await page.goto('/')
 await expect(page.locator('link[rel=alternate][type="application/json"]')).toHaveAttribute('href','https://bathos.org/articles.json')
 await expect(page.locator('link[rel=sitemap]')).toHaveAttribute('href','https://bathos.org/sitemap.xml')
 const catalogResponse=await page.request.get('/articles.json')
 expect(catalogResponse.ok()).toBe(true)
 const catalog=await catalogResponse.json()
 expect(catalog.version).toBe(1)
 const slugs=fs.readdirSync('content').filter(name=>name.endsWith('.md')).map(name=>name.slice(0,-3)).sort()
 expect(catalog.articles.map((article:{slug:string})=>article.slug)).toEqual(slugs)
 const sitemapResponse=await page.request.get('/sitemap.xml')
 expect(sitemapResponse.ok()).toBe(true)
 const sitemap=await sitemapResponse.text()
 const rssResponse=await page.request.get('/rss.xml')
 expect(rssResponse.ok()).toBe(true)
 const rss=await rssResponse.text()
 const parsed=await page.evaluate(({sitemap,rss})=>{
  const parse=(xml:string)=>new DOMParser().parseFromString(xml,'application/xml')
  const site=parse(sitemap),feed=parse(rss)
  return {errors:site.querySelectorAll('parsererror').length+feed.querySelectorAll('parsererror').length,urls:[...site.querySelectorAll('loc')].map(el=>el.textContent),feedUrls:[...feed.querySelectorAll('item > link')].map(el=>el.textContent),modified:site.querySelectorAll('lastmod').length}
 },{sitemap,rss})
 expect(parsed.errors).toBe(0)
 expect(parsed.modified).toBe(0)
 expect(parsed.urls).toContain("https://bathos.org/articles/")
 expect(parsed.urls).toHaveLength(slugs.length+2)
 for(const article of catalog.articles){
  expect(parsed.urls.filter(url=>url===article.canonicalUrl)).toHaveLength(1)
  expect(parsed.feedUrls.filter(url=>url===article.canonicalUrl)).toHaveLength(1)
  expect(article.readingUrl).toBe(`https://bathos.org/read/${encodeURIComponent(article.slug)}/`)
  if(article.date) expect(Number.isFinite(Date.parse(article.date))).toBe(true)
  const response=await page.request.get(new URL(article.canonicalUrl).pathname)
  expect(response.ok()).toBe(true)
 }
 const robots=await page.request.get('/robots.txt')
 expect(robots.ok()).toBe(true)
 expect(await robots.text()).toContain('Sitemap: https://bathos.org/sitemap.xml')
})
