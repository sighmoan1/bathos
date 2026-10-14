import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import matter from 'gray-matter'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import { articleMarkdownComponents, remarkPipeTables } from '../../components/article-markdown'

const articles = fs.readdirSync('content').filter(name => name.endsWith('.md')).map(name => {
  const { data, content } = matter(fs.readFileSync(`content/${name}`, 'utf8'))
  return { slug: name.slice(0, -3), title: String(data.title || name.slice(0, -3)), date: data.date ? String(data.date) : '', content }
}).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (a.slug < b.slug ? -1 : 1))

for (const javaScriptEnabled of [false, true]) {
  test.describe(javaScriptEnabled ? 'ordinary reading' : 'JavaScript-independent reading', () => {
    test.use({ javaScriptEnabled })

    test('index links every source article in deterministic order and ordinary pages render the complete body', async ({ page }) => {
      await page.goto('/articles/')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Articles')
      const links = page.locator('main h2 a')
      await expect(links).toHaveCount(articles.length)
      for (let index = 0; index < articles.length; index++) {
        const article = articles[index]
        await expect(links.nth(index)).toHaveAttribute('href', `/read/${encodeURIComponent(article.slug)}/`)
      }
      for (const article of articles) {
        await page.goto(`/read/${encodeURIComponent(article.slug)}/`)
        await expect(page.locator('article h1')).toHaveText(article.title)
        await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://bathos.org/posts/${encodeURIComponent(article.slug)}/`)
        // Compare the entire rendered Markdown, including the end of long articles,
        // with the current content source so new publishing is covered after rebuild.
        const expectedHTML = renderToStaticMarkup(React.createElement(ReactMarkdown, { children: article.content, components: articleMarkdownComponents, remarkPlugins: [remarkPipeTables as never] }))
        const [normalizedHTML, actualHTML] = await page.evaluate(([html, currentHTML]: [string, string]) => {
          const normalize = (input: string) => {
          const template = document.createElement('template')
          template.innerHTML = input.replace(/<!--[\s\S]*?-->/g, '')
          // React 19 emits image preloads beside static markup; Next hoists them
          // into the document head. Compare the complete article body itself.
          template.content.querySelectorAll('link[rel="preload"][as="image"]').forEach(link => link.remove())
          template.content.querySelectorAll('*').forEach(element => {
            const attributes = Array.from(element.attributes).map(attribute => [attribute.name, attribute.value] as const).sort(([a], [b]) => a.localeCompare(b))
            for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name)
            for (const [name, value] of attributes) element.setAttribute(name, value)
          })
          return template.innerHTML
          }
          return [normalize(html), normalize(currentHTML)]
        }, [expectedHTML, await page.locator('.article-prose').innerHTML()])
        expect(actualHTML).toBe(normalizedHTML)
        if (article.slug === 'out-of-the-rabbit-hole') {
          await expect(page.locator('.article-prose table')).toHaveCount(1)
          await expect(page.locator('.article-prose video track[kind="captions"]')).toHaveAttribute('src', '/images/posts/out-of-the-rabbit-hole/delegate-demo.en.vtt')
        }
        await expect(page.getByRole('link', { name: 'Open in swipe reader' })).toHaveAttribute('href', `/posts/${encodeURIComponent(article.slug)}/`)
        await page.getByRole('link', { name: 'Back to all articles' }).click()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Articles')
      }
      expect((await page.request.get('/read/does-not-exist/')).status()).toBe(404)
    })

    test('long articles scroll in the document and reflow at narrow and enlarged text widths', async ({ page }) => {
      await page.goto('/read/multi-agent-easy/')
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 700 })
        await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
        await page.getByRole('link', { name: 'Back to all articles' }).scrollIntoViewIfNeeded()
        await expect(page.getByRole('link', { name: 'Back to all articles' })).toBeInViewport()
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
      }
    })
  })
}

test.describe('entry points without JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('canonical swipe links offer full readable content', async ({ page }) => {
    for (const article of articles) {
      await page.goto(`/posts/${encodeURIComponent(article.slug)}/`)
      await expect(page.locator('[data-swipe-reader]')).toBeHidden()
      await page.getByRole('link', { name: 'Read this article without JavaScript' }).click()
      await expect(page.locator('article h1')).toHaveText(article.title)
      await expect(page.locator('.article-prose')).toBeVisible()
    }
  })
  test('offers a usable conventional reading path', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-swipe-reader]')).toBeHidden()
    await page.getByRole('link', { name: 'Browse all articles' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Articles')
  })
})
