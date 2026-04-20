'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  API_KEY,
  SEARCH_URL,
  formatSeconds,
  prettyTag,
  tagColor,
  type FoodRow,
  type SearchResponse,
} from '../_lib/api'
import { cardGradient, contentTone } from '../feeds/lib/card-gradient'

const DEFAULT_QUERY = 'dark chocolate with hazelnuts'
// Suggestions tuned to what the dataset *actually* contains right now —
// a US-grocery catalog (Meijer, H-E-B, Markets of Meijer, Roland, Via
// Roma, Mrs. Renfro's, etc.). The ingest is still rolling in more rows;
// until it finishes, "spicy ramen noodles" or "organic oat milk" won't
// necessarily land. These prompts will.
const PROMPT_SUGGESTIONS = [
  'mashed potatoes with garlic',
  'chocolate chip cookies',
  'pasta sauce with tomatoes',
  'cheddar cheese blend',
  'pumpkin muffins',
  'sparkling citrus drink',
  'everything bagel',
  'maple sausage links',
  'salsa with chipotle',
]

export function SearchPanel({ initialQuery = DEFAULT_QUERY }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)

  const runQuery = useCallback(async (query: string) => {
    if (!query.trim()) return
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
        body: JSON.stringify({ query, limit: 20 }),
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
  }, [])

  useEffect(() => {
    void runQuery(initialQuery) /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  const pickSuggestion = (s: string) => {
    setQ(s)
    void runQuery(s)
  }

  return (
    <section>
      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault()
          void runQuery(q)
        }}
      >
        <input
          className="search-input"
          placeholder="Ask in plain English — 'crunchy salty snack', 'smooth oat milk', 'breakfast-ish sweet'"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <button className="search-btn" type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div className="suggest-row">
        <span className="suggest-label">Try:</span>
        {PROMPT_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="suggest-chip"
            onClick={() => pickSuggestion(s)}
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="indexing-note">
        <span className="dot" /> Ingest is still rolling in new rows — the
        dataset today leans heavily US-grocery (Meijer, H-E-B, Markets of
        Meijer, Roland, Via Roma). Suggestions above are tuned to what&apos;s
        currently indexed; try them for a feel, then type your own.
      </p>

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
            <strong>{data.results.length}</strong> hit{data.results.length === 1 ? '' : 's'}
          </span>
        )}
        {error && <span className="status-pill error">{error}</span>}
      </div>

      {data && data.results.length === 0 && !loading && (
        <div className="empty">No matches. Try a different phrase.</div>
      )}

      {data && data.results.length > 0 && (
        <div className="feed-masonry">
          {data.results.map((hit, i) => (
            <ResultCard
              key={hit.id}
              hit={hit}
              rank={i + 1}
              pageSize={data.results.length}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        .suggest-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          align-items: center;
          margin: 0.7rem 0 0.9rem;
        }
        .suggest-label {
          font-size: 0.72rem;
          color: var(--text-fade);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-right: 0.2rem;
        }
        .suggest-chip {
          background: var(--panel);
          border: 1px solid var(--border);
          color: var(--text-dim);
          font-size: 0.78rem;
          padding: 0.28rem 0.75rem;
          border-radius: 999px;
          cursor: pointer;
          transition: all 140ms;
        }
        .suggest-chip:hover:not(:disabled) {
          border-color: rgba(139, 92, 246, 0.55);
          color: var(--text);
          background: var(--panel-2);
        }
        .suggest-chip:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .indexing-note {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          margin: 0 0 1rem;
          padding: 0.55rem 0.8rem;
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 10px;
          color: var(--text-dim);
          font-size: 0.75rem;
          line-height: 1.5;
        }
        .indexing-note .dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          margin-top: 0.35rem;
          border-radius: 999px;
          background: #f472b6;
          flex-shrink: 0;
          box-shadow: 0 0 0 0 rgba(244, 114, 182, 0.7);
          animation: pulse 1.6s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(244, 114, 182, 0.6);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(244, 114, 182, 0);
          }
        }
      `}</style>
    </section>
  )
}

/* ─── Result card — rainbow masonry, click to jump to /similar ─── */

function ResultCard({
  hit,
  rank,
  pageSize,
}: {
  hit: { id: string; sourceRowId: string; content: string | null; metadata: FoodRow; score: number }
  rank: number
  pageSize: number
}) {
  const m = hit.metadata
  const gradient = cardGradient(String(m.id), rank, pageSize)
  const tone = contentTone(rank, pageSize)
  // Click-through: anchor to /similar with the row as seed. Keeps the
  // "search → explore neighbors" loop legible without another deep-link.
  const href = `/similar?seed=${encodeURIComponent(String(m.id))}`

  return (
    <Link href={href} className="feed-card" style={{ backgroundImage: gradient }}>
      <div className="feed-card-inner">
        <div className="feed-card-top">
          <span>#{rank}</span>
          <span title="semantic match score">{hit.score.toFixed(3)}</span>
        </div>
        <div className="feed-card-title" style={{ color: tone.title }}>
          {m.name ?? hit.sourceRowId}
        </div>
        {(m.brand || m.category) && (
          <div className="feed-card-subtitle" style={{ color: tone.subtitle }}>
            {m.brand ?? m.category}
            {m.quantity ? ` · ${m.quantity}` : ''}
            {typeof m.price_cents === 'number' ? ` · $${(m.price_cents / 100).toFixed(2)}` : ''}
          </div>
        )}
        {m.tags && m.tags.length > 0 && (
          <div className="feed-card-chips">
            {m.tags.slice(0, 4).map((t) => (
              <span key={t} className="feed-card-chip">
                {prettyTag(t)}
              </span>
            ))}
          </div>
        )}
        {(m.description || hit.content) && (
          <p className="feed-card-desc" style={{ color: tone.subtitle }}>
            {m.description ?? hit.content}
          </p>
        )}
        <div className="feed-card-actions">
          <span className="feed-chase">Find similar →</span>
        </div>
      </div>
    </Link>
  )
}

// Suppress unused-import warning when the page doesn't render tag chips via
// this helper directly — kept for possible inline use + React-y side effects.
void tagColor
