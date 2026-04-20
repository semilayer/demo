'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'
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
import { cardGradient, contentTone } from '../lib/card-gradient'

/* ─────────────────────────────────────────────────────────────
 * SemiLayer · Feed detail + recordVector "More like this"
 * ─────────────────────────────────────────────────────────────
 * Lives at /feeds/detail?id=<record-id> so the page works with
 * Next.js `output: 'export'` without needing generateStaticParams.
 *
 * POST /v1/feed/<LENS>/relatedTo with context.seedRecordId = <id>
 *
 * The `relatedTo` feed uses `similarity.against: { mode: 'recordVector' }`
 * so the seed is the clicked record's own stored embedding — zero
 * embedding API call, two SQL round-trips total. `excludeIds` keeps the
 * seed itself out of its own results.
 * ───────────────────────────────────────────────────────────── */

export default function Page() {
  return (
    <Suspense fallback={<main className="shell"><p className="detail-hint">Loading…</p></main>}>
      <DetailInner />
    </Suspense>
  )
}

function DetailInner() {
  const sp = useSearchParams()
  const id = sp?.get('id') ?? ''
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
    <main className="shell detail-shell">
      <Link href="/feeds" className="back-link">
        ← back to feed
      </Link>

      {!id && <p className="detail-hint">No record id in URL (?id=&hellip;)</p>}
      {loading && <p className="detail-hint">Loading…</p>}
      {error && <p className="detail-error">{error}</p>}

      {seed && (
        <SeedHeader item={seed} isLiked={likes.isLiked(seed.id)} onLike={() => likes.toggle(seed)} />
      )}

      {related.length > 0 && (
        <section className="related">
          <div className="related-head">
            <h2>More like this</h2>
            <p>
              Ranked by <code>relatedTo</code> — <code>similarity.against: recordVector</code>{' '}
              using this item&apos;s stored embedding. Click any card to chain through to
              <em> its</em> related items.
            </p>
          </div>
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
        <p className="detail-hint">No related items found.</p>
      )}

      <style jsx>{`
        .detail-shell {
          max-width: 1080px;
        }
        .back-link {
          display: inline-block;
          font-size: 0.82rem;
          color: var(--text-dim);
          text-decoration: none;
          margin-bottom: 1rem;
        }
        .back-link:hover {
          color: var(--text);
        }
        .detail-hint {
          color: var(--text-fade);
          text-align: center;
          padding: 2rem 0;
          font-size: 0.9rem;
        }
        .detail-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          padding: 0.9rem 1rem;
          border-radius: 10px;
          font-size: 0.85rem;
        }
        .related {
          margin-top: 1.8rem;
        }
        .related-head {
          margin-bottom: 1rem;
        }
        .related h2 {
          font-size: 1.1rem;
          margin: 0 0 0.3rem;
          color: var(--text);
        }
        .related-head p {
          font-size: 0.82rem;
          color: var(--text-dim);
          margin: 0;
          line-height: 1.55;
        }
        .related-head code {
          font-size: 0.78rem;
          background: var(--panel-2);
          color: var(--text);
          padding: 1px 6px;
          border-radius: 4px;
        }
        .related-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 0.9rem;
        }
      `}</style>
    </main>
  )
}

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
  const gradient = cardGradient(String(item.id), 1)

  return (
    <section className="seed" style={{ backgroundImage: gradient }}>
      <div className="seed-inner">
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
      </div>

      <style jsx>{`
        .seed {
          border-radius: 16px;
          padding: 2px;
          box-shadow: 0 10px 40px rgba(139, 92, 246, 0.25);
          margin-bottom: 1.5rem;
        }
        .seed-inner {
          padding: 1.4rem 1.6rem;
          border-radius: 14px;
          background: rgba(15, 16, 36, 0.78);
          backdrop-filter: blur(14px);
          color: var(--text);
        }
        h1 {
          margin: 0 0 4px;
          font-size: 1.5rem;
          letter-spacing: -0.01em;
        }
        .sub {
          margin: 0 0 0.8rem;
          font-size: 0.88rem;
          color: var(--text-dim);
          text-transform: capitalize;
        }
        .chips {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
          margin-bottom: 0.8rem;
        }
        .tag {
          font-size: 0.7rem;
          text-transform: capitalize;
          padding: 3px 10px;
          background: rgba(255, 255, 255, 0.08);
          color: var(--text);
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .desc {
          font-size: 0.88rem;
          color: var(--text-dim);
          line-height: 1.55;
          margin: 0 0 1rem;
        }
        .like-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          font-size: 0.82rem;
          padding: 0.4rem 0.9rem;
          border-radius: 999px;
          cursor: pointer;
          color: var(--text);
          transition: all 150ms;
        }
        .like-btn:hover {
          border-color: #f472b6;
          color: #f9a8d4;
        }
        .like-btn.liked {
          background: rgba(244, 114, 182, 0.15);
          border-color: #f472b6;
          color: #fbcfe8;
        }
      `}</style>
    </section>
  )
}

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
  const gradient = cardGradient(String(m.id), item.score)
  const tone = contentTone(item.score)

  return (
    <Link href={`/feeds/detail?id=${encodeURIComponent(String(m.id))}`} className="card" style={{ backgroundImage: gradient }}>
      <div className="card-inner">
        <div className="title" style={{ color: tone.title }}>
          {title}
        </div>
        {subtitle && <div className="subtitle" style={{ color: tone.subtitle }}>{subtitle}</div>}
        <div className="actions">
          <button
            type="button"
            className={isLiked ? 'like-btn liked' : 'like-btn'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onLike()
            }}
          >
            {isLiked ? '♥' : '♡'}
          </button>
          <span className="chase">View similar →</span>
        </div>
      </div>
      <style jsx>{`
        .card {
          display: block;
          padding: 1.5px;
          border-radius: 12px;
          text-decoration: none;
          transition: transform 160ms, box-shadow 160ms;
        }
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(139, 92, 246, 0.25);
        }
        .card-inner {
          padding: 0.85rem 1rem 0.75rem;
          border-radius: 10.5px;
          background: rgba(15, 16, 36, 0.74);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          min-height: 96px;
        }
        .title {
          font-weight: 600;
          font-size: 0.88rem;
          line-height: 1.3;
          text-decoration: none;
        }
        .subtitle {
          font-size: 0.72rem;
          text-transform: capitalize;
        }
        .actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
          padding-top: 0.5rem;
        }
        .like-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          font-size: 0.85rem;
          padding: 1px 9px;
          border-radius: 999px;
          cursor: pointer;
          color: var(--text);
        }
        .like-btn:hover {
          border-color: #f472b6;
          color: #f9a8d4;
        }
        .like-btn.liked {
          background: rgba(244, 114, 182, 0.15);
          border-color: #f472b6;
          color: #fbcfe8;
        }
        .chase {
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.75);
          font-weight: 600;
        }
      `}</style>
    </Link>
  )
}
