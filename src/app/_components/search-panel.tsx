'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  API_KEY,
  SEARCH_URL,
  formatSeconds,
  prettyTag,
  tagColor,
  type SearchResponse,
} from '../_lib/api'

export function SearchPanel({ initialQuery = 'dark chocolate with hazelnuts' }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery)
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

  useEffect(() => {
    run() /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

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
          placeholder="Try: 'organic oat milk', 'spicy ramen noodles', 'something sweet for breakfast'…"
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
            Round-trip <strong>{formatSeconds(elapsed)}</strong>
          </span>
        )}
        {data && (
          <span className="status-pill timing">
            Server <strong>{formatSeconds(data.meta.durationMs)}</strong>
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
                <h3 className="result-title">{md?.name ?? hit.sourceRowId}</h3>
                {md && (
                  <div className="result-meta">
                    {md.brand && <span>{md.brand}</span>}
                    {md.category && <span>{md.category}</span>}
                    {md.quantity && <span>{md.quantity}</span>}
                    {typeof md.price_cents === 'number' && (
                      <span>${(md.price_cents / 100).toFixed(2)}</span>
                    )}
                  </div>
                )}
                {(md?.description || hit.content) && (
                  <p className="result-desc">{md?.description ?? hit.content}</p>
                )}
                {md?.tags && md.tags.length > 0 && (
                  <div className="tags result-tags">
                    {md.tags.slice(0, 6).map((t) => (
                      <span key={t} className={`tag tag-${tagColor(t)}`}>
                        {prettyTag(t)}
                      </span>
                    ))}
                    {md.tags.length > 6 && (
                      <span className="tag tag-more">+{md.tags.length - 6}</span>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
