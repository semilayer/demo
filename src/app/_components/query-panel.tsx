'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  API_KEY,
  PAGE_SIZE,
  QUERY_URL,
  formatSeconds,
  prettyTag,
  tagColor,
  type QueryResponse,
} from '../_lib/api'

export function QueryPanel() {
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

  useEffect(() => {
    run(page)
  }, [page, run])

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
                <th>Code</th>
                <th>Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Tags</th>
                <th style={{ textAlign: 'right' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.id}</td>
                  <td className="mono">{row.code}</td>
                  <td className="title">{row.name}</td>
                  <td>{row.brand ?? '—'}</td>
                  <td>{row.category ?? '—'}</td>
                  <td>
                    <div className="tags">
                      {row.tags.slice(0, 4).map((t) => (
                        <span key={t} className={`tag tag-${tagColor(t)}`}>
                          {prettyTag(t)}
                        </span>
                      ))}
                      {row.tags.length > 4 && (
                        <span className="tag tag-more">+{row.tags.length - 4}</span>
                      )}
                    </div>
                  </td>
                  <td className="num price">
                    {typeof row.price_cents === 'number'
                      ? `$${(row.price_cents / 100).toFixed(2)}`
                      : '—'}
                  </td>
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
