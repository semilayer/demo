'use client'

import { useCallback, useEffect, useState } from 'react'

/* ─────────────────────────────────────────────────────────────
 * SemiLayer · Live Demo
 * ─────────────────────────────────────────────────────────────
 * Two calls. One key. No SDK.
 *
 *   POST  /v1/search/:lens    ← ask in natural language
 *   POST  /v1/query/:lens     ← ask in structured form
 *
 * Auth:   Authorization: Bearer pk_...
 *
 * The publishable key is safe to ship in the browser — it is
 * read-only and every lens decides what the world is allowed
 * to see. That is the whole integration.
 * ───────────────────────────────────────────────────────────── */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://api.semilayer.com'
const ORG = process.env.NEXT_PUBLIC_ORG ?? 'demo'
const PROJECT = process.env.NEXT_PUBLIC_PROJECT ?? 'public'
const ENV = process.env.NEXT_PUBLIC_ENV ?? 'demo-env'
const LENS = process.env.NEXT_PUBLIC_LENS ?? 'products'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? ''

const SEARCH_URL = `${API_BASE}/v1/search/${LENS}`
const QUERY_URL = `${API_BASE}/v1/query/${LENS}`

const PAGE_SIZE = 10

/* ── Shape of a row in the products fixture ─────────────────── */
interface ProductRow {
  id: number
  sku: string
  title: string
  description: string
  category: string
  inventory: number
  price_cents: number
  tags: string[]
  created_at: string
  updated_at: string
}

interface QueryResponse {
  rows: ProductRow[]
  meta: { lens: string; total: number; count: number; durationMs: number }
}

/* SearchResult shape from the SemiLayer vector store */
interface SearchHit {
  id: string
  sourceRowId: string
  content: string | null
  metadata: ProductRow
  score: number
}

interface SearchResponse {
  results: SearchHit[]
  meta: { lens: string; query: string; mode: string; count: number; durationMs: number }
}

/* ─────────────────────────────────────────────────────────── */

export default function DemoPage() {
  const [tab, setTab] = useState<'search' | 'query'>('search')

  return (
    <main className="shell">
      <Header />
      <Hero />

      <div className="tabs" role="tablist">
        <button
          className={tab === 'search' ? 'tab active' : 'tab'}
          onClick={() => setTab('search')}
        >
          Semantic search
        </button>
        <button
          className={tab === 'query' ? 'tab active' : 'tab'}
          onClick={() => setTab('query')}
        >
          Typed query
        </button>
      </div>

      {tab === 'search' ? <SearchPanel /> : <QueryPanel />}

      <HowItWorks tab={tab} />
      <BottomNote />
    </main>
  )
}

/* ── Header ─────────────────────────────────────────────────── */

function Header() {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">SL</div>
        <div>
          <div className="brand-name">SemiLayer · Live Demo</div>
          <div className="brand-tag">ask anything. no backend.</div>
        </div>
      </div>
      <nav className="nav">
        <a href="https://semilayer.com">semilayer.com</a>
        <a href="https://semilayer.dev">Docs</a>
        <a href="https://github.com/semilayer/demo">View source</a>
        <a href="https://github.com/semilayer/example-stack">Example stack</a>
        <a href="https://github.com/semilayer/example-frontend">Example frontend</a>
      </nav>
    </header>
  )
}

function Hero() {
  return (
    <section className="hero-block">
      <h1 className="hero-title">
        500 products. <span className="grad">Understood</span>, not just{' '}
        <span className="grad">stored</span>.
      </h1>
      <p className="hero-sub">
        This page is a single file. Every result you see is a plain{' '}
        <code>fetch()</code> to SemiLayer &mdash; no server of our own, no glue
        code, no SDK in the way. A <code>products</code> lens was declared once;
        the layer took care of the rest.
      </p>
      <div className="hero-callouts">
        <span className="callout"><span className="dot" />Meaning, not keywords</span>
        <span className="callout"><span className="dot" />Structured when you need it</span>
        <span className="callout"><span className="dot" />One key, nothing else</span>
      </div>
    </section>
  )
}

/* ── Search panel ───────────────────────────────────────────── */

function SearchPanel() {
  const [q, setQ] = useState('headphones')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)

  const run = useCallback(async () => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    const t0 = performance.now()
    try {
      const res = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ query: q, limit: 20 }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`)
      }
      const json = (await res.json()) as SearchResponse
      setData(json)
      setElapsed(Math.round(performance.now() - t0))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'request failed')
      setData(null)
      setElapsed(null)
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => { run() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  return (
    <>
      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        <input
          className="search-input"
          placeholder="Try: 'wireless headphones', 'cozy yoga gear', 'something to cook with'…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <button className="search-btn" type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div className="status-row">
        {loading && <span className="spinner" />}
        {elapsed != null && (
          <span className="status-pill timing">
            Round-trip <strong>{elapsed} ms</strong>
          </span>
        )}
        {data && (
          <span className="status-pill timing">
            Server <strong>{data.meta.durationMs} ms</strong>
          </span>
        )}
        {data && (
          <span className="status-pill count">
            Showing <strong>{data.results.length}</strong> hit{data.results.length === 1 ? '' : 's'}
          </span>
        )}
        {error && <span className="status-pill error">{error}</span>}
      </div>

      <div className="results">
        {!loading && data?.results.length === 0 && (
          <div className="empty">No matches. Try a different phrase.</div>
        )}
        {data?.results.map((hit) => {
          const md = hit.metadata
          return (
            <article key={hit.id} className="result-card">
              <div className="score-chip">{hit.score.toFixed(2)}</div>
              <div className="result-body">
                <h3 className="result-title">{md?.title ?? hit.sourceRowId}</h3>
                {md && (
                  <div className="result-meta">
                    {md.sku && <span>{md.sku}</span>}
                    {md.category && <span>{md.category}</span>}
                    {typeof md.price_cents === 'number' && (
                      <span>${(md.price_cents / 100).toFixed(2)}</span>
                    )}
                    {typeof md.inventory === 'number' && <span>{md.inventory} in stock</span>}
                  </div>
                )}
                {(md?.description || hit.content) && (
                  <p className="result-desc">{md?.description ?? hit.content}</p>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

/* ── Query panel ────────────────────────────────────────────── */

function QueryPanel() {
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<QueryResponse | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)

  const run = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    const t0 = performance.now()
    try {
      const res = await fetch(QUERY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          limit: PAGE_SIZE,
          offset: p * PAGE_SIZE,
          orderBy: { field: 'id', dir: 'asc' },
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`)
      }
      const json = (await res.json()) as QueryResponse
      setData(json)
      setElapsed(Math.round(performance.now() - t0))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'request failed')
      setData(null)
      setElapsed(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { run(page) }, [page, run])

  const total = data?.meta.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <>
      <div className="status-row">
        {loading && <span className="spinner" />}
        {elapsed != null && (
          <span className="status-pill timing">
            Round-trip <strong>{elapsed} ms</strong>
          </span>
        )}
        {data && (
          <span className="status-pill timing">
            Server <strong>{data.meta.durationMs} ms</strong>
          </span>
        )}
        {data && (
          <span className="status-pill count">
            Total <strong>{data.meta.total.toLocaleString()}</strong> rows
          </span>
        )}
        {error && <span className="status-pill error">{error}</span>}
      </div>

      <div className="table-wrap">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>SKU</th>
                <th>Title</th>
                <th>Category</th>
                <th>Tags</th>
                <th style={{ textAlign: 'right' }}>Inventory</th>
                <th style={{ textAlign: 'right' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.id}</td>
                  <td className="mono">{row.sku}</td>
                  <td className="title">{row.title}</td>
                  <td>{row.category}</td>
                  <td>
                    <div className="tags">
                      {row.tags.slice(0, 4).map((t) => (
                        <span className="tag" key={t}>{t}</span>
                      ))}
                      {row.tags.length > 4 && (
                        <span className="tag">+{row.tags.length - 4}</span>
                      )}
                    </div>
                  </td>
                  <td className="num">{row.inventory}</td>
                  <td className="num price">${(row.price_cents / 100).toFixed(2)}</td>
                </tr>
              ))}
              {!loading && data?.rows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">No rows.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>
            {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
          </span>
          <div className="pager-btns">
            <button
              className="pager-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              ← Prev
            </button>
            <span className="status-pill">
              Page <strong>{page + 1}</strong> of {totalPages}
            </span>
            <button
              className="pager-btn"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page + 1 >= totalPages || loading}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ── How it works ──────────────────────────────────────────── */

const SEARCH_SNIPPET = `POST ${API_BASE}/v1/search/${LENS}
Authorization: Bearer pk_...
Content-Type: application/json

{
  "query": "headphones",
  "limit": 20
}`

const QUERY_SNIPPET = `POST ${API_BASE}/v1/query/${LENS}
Authorization: Bearer pk_...
Content-Type: application/json

{
  "limit": 10,
  "offset": 0,
  "orderBy": { "field": "id", "dir": "asc" }
}`

const CONFIG_SNIPPET = `// one lens. that's the whole config.
products: {
  facets: {
    search: { mode: 'semantic' },
    query:  true,
  },
  rules: {
    search: 'public',
    query:  'public',
  },
}`

function HowItWorks({ tab }: { tab: 'search' | 'query' }) {
  return (
    <section className="howto">
      <div className="howto-card">
        <h3>The entire integration</h3>
        <p>
          Two endpoints. One publishable key. That is everything this page
          knows &mdash; copy the call into curl, any fetch, any HTTP client.
          The key carries the scope for you.
        </p>
        <pre className="code-block">{tab === 'search' ? SEARCH_SNIPPET : QUERY_SNIPPET}</pre>
      </div>
      <div className="howto-card">
        <h3>What the layer is doing</h3>
        <p>
          Somewhere behind this page a <code>products</code> lens was declared.
          SemiLayer took care of understanding it, indexing it, and keeping it
          fresh. You get one endpoint to ask in words, another to ask in shape.
          The data never moves and the layer never asks you how it works.
        </p>
        <pre className="code-block">{CONFIG_SNIPPET}</pre>
      </div>
    </section>
  )
}

function BottomNote() {
  return (
    <footer className="bottom-note">
      <div>
        Source on <a href="https://github.com/semilayer/demo">github.com/semilayer/demo</a>
        {' · '}
        Read the docs at <a href="https://semilayer.dev">semilayer.dev</a>
      </div>
      <div>
        Want to wire your own database? <a href="https://semilayer.com">semilayer.com</a>
      </div>
    </footer>
  )
}
