import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  TMDB_API_KEY: string
  TMDB_API_BASE_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok' }))

app.all('/3/*', async (c) => {
  const path = c.req.path.replace('/3/', '')
  const url = new URL(c.req.url)
  url.protocol = 'https'
  url.hostname = new URL(c.env.TMDB_API_BASE_URL).hostname
  url.pathname = `/3/${path}`
  url.port = ''
  url.searchParams.set('api_key', c.env.TMDB_API_KEY)

  const headers = new Headers(c.req.raw.headers)
  headers.set('Accept', 'application/json')
  headers.delete('host')
  headers.delete('authorization')
  headers.delete('cf-connecting-ip')
  headers.delete('x-forwarded-for')
  headers.delete('x-real-ip')

  const response = await fetch(url.toString(), {
    method: c.req.method,
    headers,
    body: ['GET', 'HEAD'].includes(c.req.method) ? null : c.req.raw.body,
  })

  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('set-cookie')
  responseHeaders.delete('x-powered-by')
  responseHeaders.delete('server')
  responseHeaders.set('cache-control', 'public, max-age=300, s-maxage=600')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
})

export default app
