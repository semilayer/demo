'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  API_KEY,
  QUERY_URL,
  SIMILAR_URL,
  formatSeconds,
  prettyTag,
  tagColor,
  type FoodRow,
  type QueryResponse,
  type SimilarResponse,
} from '../_lib/api'
import { cardGradient, contentTone } from '../feeds/lib/card-gradient'

/* ─────────────────────────────────────────────────────────────
 * Similar panel
 * ─────────────────────────────────────────────────────────────
 * POST /v1/similar/:lens     body: { id, limit }
 *
 * `similar` is a first-class facet: the lens declares which fields
 * should drive similarity via `facets.similar.fields`, and the service
 * uses the seed record's stored embedding to find nearest neighbors
 * in vector space. Zero embedding API call on the seed — just one
 * partition-scoped ANN read.
 *
 * UX loop: a random seed is fetched via /v1/query on load; click any
 * result to re-seed with that record and chain through the embedding
 * neighborhood. "Another random" rolls a fresh seed offset.
 * ───────────────────────────────────────────────────────────── */

const SEED_POOL = 500
const DEFAULT_LIMIT = 12

export function SimilarPanel() {
  const [seed, setSeed] = useState<FoodRow | null>(null)
  const [results, setResults] = useState<SimilarResponse['results']>([])
  const [meta, setMeta] = useState<SimilarResponse['meta'] | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Pick a random row from the first N rows of the lens. */
  const pickRandomSeed = useCallback(async (): Promise<FoodRow | null> => {
    const offset = Math.floor(Math.random() * SEED_POOL)
    const res = await fetch(QUERY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ limit: 1, offset, orderBy: { field: 'id', dir: 'asc' } }),
    })
    if (!res.ok) throw new Error(`query failed: ${res.status}`)
    const json = (await res.json()) as QueryResponse
    return json.rows[0] ?? null
  }, [])

  const fetchSimilar = useCallback(async (forSeed: FoodRow) => {
    setLoading(true)
    setError(null)
    const t0 = performance.now()
    try {
      const res = await fetch(SIMILAR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ id: String(forSeed.id), limit: DEFAULT_LIMIT }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`similar failed: ${res.status} ${text.slice(0, 240)}`)
      }
      const json = (await res.json()) as SimilarResponse
      setResults(json.results)
      setMeta(json.meta)
      setElapsed(Math.round(performance.now() - t0))
    } catch (err) {
      setError((err as Error).message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const runRandom = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextSeed = await pickRandomSeed()
      if (!nextSeed) throw new Error('no rows available to seed')
      setSeed(nextSeed)
      await fetchSimilar(nextSeed)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }, [pickRandomSeed, fetchSimilar])

  useEffect(() => {
    void runRandom() /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  const reSeedFromResult = useCallback(
    (row: FoodRow) => {
      setSeed(row)
      void fetchSimilar(row)
    },
    [fetchSimilar],
  )

  return (
    <section>
      <div className="similar-controls">
        <button
          type="button"
          className="similar-reroll"
          onClick={() => void runRandom()}
          disabled={loading}
        >
          {loading && !seed ? 'Picking seed…' : '🎲 Another random seed'}
        </button>
        <div className="status-row">
          {loading && seed && <span className="spinner" />}
          {elapsed != null && (
            <span className="status-pill timing">
              Round-trip <strong>{formatSeconds(elapsed)}</strong>
            </span>
          )}
          {meta && (
            <span className="status-pill timing">
              Server <strong>{formatSeconds(meta.durationMs)}</strong>
            </span>
          )}
          {meta && (
            <span className="status-pill count">
              <strong>{results.length}</strong> neighbor{results.length === 1 ? '' : 's'}
            </span>
          )}
          {error && <span className="status-pill error">{error}</span>}
        </div>
      </div>

      {seed && <SeedCard row={seed} />}

      {results.length > 0 && (
        <>
          <h3 className="similar-heading">Nearest neighbors</h3>
          <div className="feed-masonry">
            {results.map((hit, i) => (
              <SimilarCard
                key={hit.sourceRowId}
                hit={hit}
                rank={i + 1}
                pageSize={results.length}
                onReseed={() => reSeedFromResult(hit.metadata)}
              />
            ))}
          </div>
        </>
      )}

      <style jsx>{`
        .similar-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }
        .similar-reroll {
          padding: 0.55rem 1.1rem;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 999px;
          font-size: 0.85rem;
          cursor: pointer;
          color: var(--text);
          transition: all 150ms;
        }
        .similar-reroll:hover:not(:disabled) {
          border-color: rgba(139, 92, 246, 0.6);
          background: var(--panel-2);
          color: #fff;
        }
        .similar-reroll:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .similar-heading {
          margin: 1.4rem 0 0.6rem;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-dim);
        }
      `}</style>
    </section>
  )
}

/* ─── Seed card (the record everything is compared against) ─── */

function SeedCard({ row }: { row: FoodRow }) {
  const gradient = cardGradient(String(row.id), 1, 1)
  return (
    <article className="seed" style={{ backgroundImage: gradient }}>
      <div className="seed-inner">
        <div className="seed-tag">SEED</div>
        <h2 className="seed-title">{row.name}</h2>
        <div className="seed-meta">
          {row.brand && <span>{row.brand}</span>}
          {row.category && <span>{row.category}</span>}
          {row.quantity && <span>{row.quantity}</span>}
          {typeof row.price_cents === 'number' && (
            <span>${(row.price_cents / 100).toFixed(2)}</span>
          )}
        </div>
        {row.description && <p className="seed-desc">{row.description}</p>}
        {row.tags && row.tags.length > 0 && (
          <div className="seed-tags">
            {row.tags.slice(0, 6).map((t) => (
              <span key={t} className={`tag tag-${tagColor(t)}`}>
                {prettyTag(t)}
              </span>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .seed {
          border-radius: 16px;
          padding: 2px;
          box-shadow: 0 10px 34px rgba(139, 92, 246, 0.28);
          margin-bottom: 0.4rem;
        }
        .seed-inner {
          padding: 1.3rem 1.6rem 1.4rem;
          border-radius: 14px;
          background: rgba(15, 16, 36, 0.78);
          -webkit-backdrop-filter: blur(14px);
          backdrop-filter: blur(14px);
          color: var(--text);
        }
        .seed-tag {
          font-family: var(--mono);
          font-size: 0.65rem;
          letter-spacing: 0.14em;
          color: rgba(255, 255, 255, 0.72);
          text-transform: uppercase;
          margin-bottom: 0.3rem;
        }
        .seed-title {
          margin: 0 0 0.4rem;
          font-size: 1.5rem;
          letter-spacing: -0.01em;
          color: #fff5f0;
        }
        .seed-meta {
          display: flex;
          gap: 0.6rem;
          font-size: 0.82rem;
          color: var(--text-dim);
          flex-wrap: wrap;
          margin-bottom: 0.6rem;
          text-transform: capitalize;
        }
        .seed-desc {
          font-size: 0.88rem;
          color: var(--text-dim);
          line-height: 1.55;
          margin: 0 0 0.6rem;
        }
        .seed-tags {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
      `}</style>
    </article>
  )
}

/* ─── Similar result card ─────────────────────────────────── */

function SimilarCard({
  hit,
  rank,
  pageSize,
  onReseed,
}: {
  hit: { sourceRowId: string; content: string | null; metadata: FoodRow; score: number }
  rank: number
  pageSize: number
  onReseed: () => void
}) {
  const m = hit.metadata
  const gradient = cardGradient(String(m.id), rank, pageSize)
  const tone = contentTone(rank, pageSize)

  return (
    <button type="button" className="feed-card" style={{ backgroundImage: gradient }} onClick={onReseed}>
      <div className="feed-card-inner">
        <div className="feed-card-top">
          <span>#{rank}</span>
          <span title="cosine similarity to the seed">{hit.score.toFixed(4)}</span>
        </div>
        <div className="feed-card-title" style={{ color: tone.title }}>
          {m.name}
        </div>
        {(m.brand || m.category) && (
          <div className="feed-card-subtitle" style={{ color: tone.subtitle }}>
            {m.brand ?? m.category}
          </div>
        )}
        {m.tags && m.tags.length > 0 && (
          <div className="feed-card-chips">
            {m.tags.slice(0, 3).map((t) => (
              <span key={t} className="feed-card-chip">
                {prettyTag(t)}
              </span>
            ))}
          </div>
        )}
        {m.description && (
          <p className="feed-card-desc" style={{ color: tone.subtitle }}>
            {m.description}
          </p>
        )}
        <div className="feed-card-actions">
          <span className="feed-chase">Use as seed →</span>
        </div>
      </div>

      <style jsx>{`
        button.feed-card {
          width: 100%;
          text-align: left;
          border: 0;
          cursor: pointer;
          font: inherit;
          color: inherit;
        }
      `}</style>
    </button>
  )
}
