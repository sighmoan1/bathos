import {test,expect} from '@playwright/test'
import fs from 'node:fs'

test('RSS contains every published post with valid XML, dates and stable canonical links',async({page})=>{
 await page.goto('/')
 const discovery=page.locator('link[rel=alternate][type="application/rss+xml"]')
 await expect(discovery).toHaveAttribute('href','https://bathos.org/rss.xml')
 const response=await page.request.get('/rss.xml')
 expect(response.ok()).toBe(true)
 const xml=await response.text()
 const parsed=await page.evaluate(xml=>{
  const doc=new DOMParser().parseFromString(xml,'application/xml')
  return {errors:doc.querySelectorAll('parsererror').length,items:[...doc.querySelectorAll('item')].map(item=>({title:item.querySelector('title')?.textContent,link:item.querySelector('link')?.textContent,guid:item.querySelector('guid')?.textContent,date:item.querySelector('pubDate')?.textContent}))}
 },xml)
 expect(parsed.errors).toBe(0)
 const slugs=fs.readdirSync('content').filter(name=>name.endsWith('.md')).map(name=>name.slice(0,-3))
 expect(parsed.items).toHaveLength(slugs.length)
 for(const slug of slugs){const url=`https://bathos.org/posts/${encodeURIComponent(slug)}/`;expect(parsed.items.some(item=>item.link===url&&item.guid===url)).toBe(true)}
 for(const item of parsed.items) if(item.date) expect(Number.isFinite(Date.parse(item.date))).toBe(true)
 const dates=parsed.items.filter(i=>i.date).map(i=>Date.parse(i.date!))
 expect(dates).toEqual([...dates].sort((a,b)=>b-a))
})

test('subscription navigation and RSS address work at narrow phone sizes',async({page})=>{
 for(const width of [320,390]){
  await page.setViewportSize({width,height:812})
  await page.goto('/')
  // Narrow screens keep site links in the header menu.
  await page.getByRole('button',{name:'More options'}).click()
  await page.getByRole('link',{name:'Subscribe to Bathos',exact:true}).click()
  await expect(page).toHaveURL(/\/subscribe\/$/)
  await expect(page.getByRole('heading',{name:'By RSS',exact:true})).toBeVisible()
  await expect(page.getByRole('textbox',{name:'RSS feed URL'})).toHaveValue('https://bathos.org/rss.xml')
  await expect(page.getByRole('link',{name:'Open RSS feed'})).toHaveAttribute('href','/rss.xml')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width)
  await expect(page.getByRole('link',{name:/Blogtrottr/})).toHaveCount(0)
  await page.getByRole('link',{name:'Back to Bathos'}).click()
  await expect(page.getByRole('button',{name:'More options'})).toBeVisible()
 }
})
