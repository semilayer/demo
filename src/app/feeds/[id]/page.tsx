'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  fetchFeedPage,
  fetchRecord,
  displayTitle,
  displaySubtitle,
  displayChips,
  type FeedItem,
  type FeedItemMeta,
} from '../lib/feed-api'
import { useLikes } from '../lib/liked-storage'

/* ─────────────────────────────────────────────────────────────
 * SemiLayer · Feed detail + recordVector "More like this"
 * ─────────────────────────────────────────────────────────────
 * POST /v1/feed/<LENS>/relatedTo with context.seedRecordId = <clicked id>
 *
 * The `relatedTo` feed uses `similarity.against: { mode: 'recordVector' }`
 * so the seed is the clicked record's own stored embedding — zero
 * embedding API call, two SQL round-trips total. `excludeIds` keeps the
 * seed itself out of its own results so the user doesn't see what they
 * just clicked.
 *
 * Click-through is native: every card in the "More like this" panel
 * links to /feeds/<that id>, which re-seeds with a new embedding — you
 * can chain through as many related items as you want.
 * ───────────────────────────────────────────────────────────── */

export default function RelatedFeedDetail() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [seed, setSeed] = useState<FeedItemMeta | null>(null)
  const [related, setRelated] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const likes = useLikes()

  const load = useCallback(
    async (seedId: string) => {
      setLoading(true)
      setError(null)
      setSeed(null)
      setRelated([])
      try {
        // Parallel fetch: the seed record itself + the related-items feed.
        // The feed is the whole point of this page — the query is just to
        // show a nice header / details for the seed.
        const [record, feed] = await Promise.all([
          fetchRecord(seedId),
          fetchFeedPage('relatedTo', {
            context: { seedRecordId: seedId },
            pageSize: 8,
          }),
        ])
        setSeed(record)
        setRelated(feed.items)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!id) return
    void load(id)
  }, [id, load])

  return (
    <main className="detail-page">
      <Link href="/feeds" className="back-link">
        ← back to feed
      </Link>

      {loading && <p className="hint">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {seed && <SeedHeader item={seed} isLiked={likes.isLiked(seed.id)} onLike={() => likes.toggle(seed)} />}

      {related.length > 0 && (
        <section className="related">
          <h2>More like this</h2>
          <div className="related-grid">
            {related.map((it) => (
              <RelatedCard
                key={it.sourceRowId}
                item={it}
                isLiked={likes.isLiked(it.metadata.id)}
                onLike={() => likes.toggle(it.metadata)}
              />
            ))}
          </div>
        </section>
      )}

      {seed && related.length === 0 && !loading && (
        <p className="hint">No related items found.</p>
      )}

      <style jsx>{`
        .detail-page {
          max-width: 920px;
          margin: 0 auto;
          padding: 24px 20px 96px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1a1a1a;
        }
        .back-link {
          display: inline-block;
          font-size: 13px;
          color: #666;
          text-decoration: none;
          margin-bottom: 18px;
        }
        .back-link:hover {
          color: #8b5cf6;
        }
        .hint {
          color: #999;
          font-size: 14px;
          text-align: center;
          padding: 40px 0;
        }
        .error {
          background: #fee;
          color: #c33;
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
        }
        .related {
          margin-top: 28px;
        }
        .related h2 {
          font-size: 18px;
          margin: 0 0 14px;
        }
        .related-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
      `}</style>
    </main>
  )
}

/* ─── Seed header ─────────────────────────────────────────── */

function SeedHeader({
  item,
  isLiked,
  onLike,
}: {
  item: FeedItemMeta
  isLiked: boolean
  onLike: () => void
}) {
  const title = displayTitle(item)
  const subtitle = displaySubtitle(item)
  const chips = displayChips(item)
  const desc = typeof item.description === 'string' ? item.description : null

  return (
    <section className="seed">
      <header>
        <h1>{title}</h1>
        {subtitle && <p className="sub">{subtitle}</p>}
      </header>
      {chips.length > 0 && (
        <div className="chips">
          {chips.map((c, i) => (
            <span key={i} className="tag">
              {c}
            </span>
          ))}
        </div>
      )}
      {desc && <p className="desc">{desc}</p>}
      <button
        type="button"
        className={isLiked ? 'like-btn liked' : 'like-btn'}
        onClick={onLike}
      >
        {isLiked ? '♥ liked' : '♡ like this'}
      </button>

      <style jsx>{`
        .seed {
          padding: 20px 22px;
          border: 1px solid #eee;
          border-radius: 12px;
          background: linear-gradient(135deg, #faf5ff 0%, #eff6ff 50%, #f0fdf4 100%);
        }
        h1 {
          margin: 0 0 4px;
          font-size: 24px;
        }
        .sub {
          margin: 0 0 12px;
          font-size: 14px;
          color: #666;
          text-transform: capitalize;
        }
        .chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .tag {
          font-size: 11px;
          text-transform: capitalize;
          padding: 3px 10px;
          background: #fff;
          color: #6d28d9;
          border-radius: 999px;
          border: 1px solid #e9d5ff;
        }
        .desc {
          font-size: 14px;
          color: #333;
          line-height: 1.5;
          margin: 0 0 14px;
        }
        .like-btn {
          background: #fff;
          border: 1px solid #e5e5e5;
          font-size: 13px;
          padding: 6px 14px;
          border-radius: 999px;
          cursor: pointer;
          color: #666;
        }
        .like-btn:hover {
          border-color: #ec4899;
          color: #ec4899;
        }
        .like-btn.liked {
          background: #fce7f3;
          border-color: #ec4899;
          color: #be185d;
        }
      `}</style>
    </section>
  )
}

/* ─── Related card (smaller, links through to a new seed) ─ */

function RelatedCard({
  item,
  isLiked,
  onLike,
}: {
  item: FeedItem
  isLiked: boolean
  onLike: () => void
}) {
  const m = item.metadata
  const title = displayTitle(m)
  const subtitle = displaySubtitle(m)

  return (
    <article className="card">
      <Link href={`/feeds/${encodeURIComponent(String(m.id))}`} className="title">
        {title}
      </Link>
      {subtitle && <div className="subtitle">{subtitle}</div>}
      <div className="actions">
        <button
          type="button"
          className={isLiked ? 'like-btn liked' : 'like-btn'}
          onClick={onLike}
        >
          {isLiked ? '♥' : '♡'}
        </button>
        <span className="score">{item.score.toFixed(2)}</span>
      </div>
      <style jsx>{`
        .card {
          padding: 12px 14px;
          border: 1px solid #eee;
          border-radius: 10px;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .card:hover {
          border-color: #d4d4d4;
        }
        .title {
          font-weight: 600;
          font-size: 13px;
          color: #1a1a1a;
          text-decoration: none;
          line-height: 1.3;
        }
        .title:hover {
          color: #8b5cf6;
        }
        .subtitle {
          font-size: 11px;
          color: #999;
          text-transform: capitalize;
        }
        .actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 6px;
        }
        .like-btn {
          background: none;
          border: 1px solid #eee;
          font-size: 13px;
          padding: 1px 8px;
          border-radius: 999px;
          cursor: pointer;
          color: #999;
        }
        .like-btn:hover {
          border-color: #ec4899;
          color: #ec4899;
        }
        .like-btn.liked {
          background: #fce7f3;
          border-color: #ec4899;
          color: #be185d;
        }
        .score {
          font-size: 10px;
          color: #ccc;
          font-family: ui-monospace, monospace;
        }
      `}</style>
    </article>
  )
}
