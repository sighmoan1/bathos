import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import matter from 'gray-matter'

const articles = fs.readdirSync('content').filter(name => name.endsWith('.md')).map(name => {
  const { content } = matter(fs.readFileSync(`content/${name}`, 'utf8'))
  return { slug: name.slice(0, -3), content }
})

test('published agent exports contain every complete source article', async ({ request }) => {
  const catalogResponse = await request.get('/agent-posts.json')
  expect(catalogResponse.status()).toBe(200)
  expect(catalogResponse.headers()['content-type']).toContain('application/json')
  const catalog = await catalogResponse.json()
  expect(catalog.articles).toHaveLength(articles.length)
  const indexResponse = await request.get('/llms.txt')
  expect(indexResponse.status()).toBe(200)
  const index = await indexResponse.text()
  for (const article of articles) {
    const record = catalog.articles.find((entry: {slug: string}) => entry.slug === article.slug)
    expect(record.content).toBe(article.content)
    expect(record.markdownUrl).toBe(`https://bathos.org/posts/${encodeURIComponent(article.slug)}/index.md`)
    expect(index).toContain(record.markdownUrl)
    const response = await request.get(new URL(record.markdownUrl).pathname)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/markdown')
    const markdown = await response.text()
    expect(matter(markdown).content.trim()).toBe(`# ${record.title.replace(/[\r\n]+/g, ' ')}\n\n${article.content.trim()}`)
    expect(matter(markdown).data.url).toBe(record.canonicalUrl)
  }
  expect((await request.get('/posts/does-not-exist/index.md')).status()).toBe(404)
})
