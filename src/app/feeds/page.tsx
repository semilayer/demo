'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SiteHeader } from '../_components/header'
import { BottomNote } from '../_components/bottom-note'
import {
  fetchFeedPage,
  displayTitle,
  displaySubtitle,
  displayChips,
  type FeedItem,
  type FeedPage,
} from './lib/feed-api'
import { useLikes } from './lib/liked-storage'
import { cardGradient, contentTone } from './lib/card-gradient'

/* ─────────────────────────────────────────────────────────────
 * SemiLayer · Feed demo (/feeds)
 * ─────────────────────────────────────────────────────────────
 * Three named feeds on one lens — Discover (similarity+recency),
 * Latest (recency), and relatedTo (recordVector, opened on
 * /feeds/detail?id=X). Likes are localStorage-only.
 * ───────────────────────────────────────────────────────────── */

type FeedName = 'discover' | 'latest'

export default function FeedsHome() {
  const [active, setActive] = useState<FeedName>('discover')
  const likes = useLikes()

  const context = useMemo(
    () => ({ liked_names: likes.likedTitles, liked_ids: likes.likedIds }),
    [likes.likedTitles, likes.likedIds],
  )

  return (
    <main className="shell feeds-shell">
      <SiteHeader />

      <FeedsHero likedCount={likes.liked.length} />

      <div className="feeds-tabs">
        <TabButton label="Discover" hint="similarity + recency" active={active === 'discover'} onClick={() => setActive('discover')} />
        <TabButton label="Latest" hint="pure recency" active={active === 'latest'} onClick={() => setActive('latest')} />
        {likes.liked.length > 0 && (
          <button type="button" className="clear-btn" onClick={likes.clear}>
            clear {likes.liked.length} {likes.liked.length === 1 ? 'like' : 'likes'}
          </button>
        )}
      </div>

      <FeedList
        key={active}
        feedName={active}
        context={active === 'discover' ? context : undefined}
        likes={likes}
      />

      <Explainer feedName={active} likedCount={likes.liked.length} />

      <BottomNote />

      <style jsx>{`
        .feeds-shell {
          max-width: 1280px;
        }
        .feeds-tabs {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          border-bottom: 1px solid var(--border);
          margin: 1.5rem 0 1rem;
          padding-bottom: 0;
          flex-wrap: wrap;
        }
        .clear-btn {
          margin-left: auto;
          font-size: 0.72rem;
          color: var(--text-fade);
          background: none;
          border: 0;
          padding: 0.5rem 0.85rem;
          cursor: pointer;
        }
        .clear-btn:hover {
          color: var(--pink);
        }
      `}</style>
    </main>
  )
}

/* ─── Hero ────────────────────────────────────────────────── */

function FeedsHero({ likedCount }: { likedCount: number }) {
  return (
    <section className="feeds-hero">
      <h1>
        Three feeds. <span className="grad">One lens.</span> No backend.
      </h1>
      <p>
        Each feed is a config block — <code>similarity</code>, <code>recency</code>,
        <code>engagement</code>, <code>diversity</code> — composed declaratively and
        served by one endpoint. Click a card to see its{' '}
        <strong>&ldquo;more like this&rdquo;</strong> relatives; like items to shift the
        <em> shape</em> of your feed.
      </p>
      {likedCount > 0 && (
        <div className="hero-badge">
          ♥ {likedCount} liked &mdash; sent on every{' '}
          <code>discover</code> call
        </div>
      )}
      <style jsx>{`
        .feeds-hero {
          padding: 1.4rem 0 0.4rem;
        }
        h1 {
          font-size: clamp(1.6rem, 3vw, 2.3rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0 0 0.4rem;
        }
        p {
          color: var(--text-dim);
          font-size: 0.95rem;
          line-height: 1.6;
          max-width: 780px;
          margin: 0;
        }
        p code {
          background: var(--panel);
          border: 1px solid var(--border);
          padding: 1px 7px;
          border-radius: 5px;
          font-size: 0.82rem;
          color: var(--text);
          margin: 0 2px;
        }
        .hero-badge {
          display: inline-flex;
          margin-top: 1rem;
          padding: 0.35rem 0.8rem;
          background: rgba(244, 114, 182, 0.12);
          border: 1px solid rgba(244, 114, 182, 0.4);
          border-radius: 999px;
          font-size: 0.8rem;
          color: #fbcfe8;
        }
        .hero-badge code {
          background: rgba(255, 255, 255, 0.08);
          border: 0;
          padding: 0 4px;
        }
      `}</style>
    </section>
  )
}

/* ─── Tab button ─────────────────────────────────────────── */

function TabButton({
  label,
  hint,
  active,
  onClick,
}: {
  label: string
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={active ? 'tab active' : 'tab'} onClick={onClick}>
      <span className="label">{label}</span>
      <span className="hint">{hint}</span>
      <style jsx>{`
        .tab {
          padding: 0.6rem 1rem 0.85rem;
          background: none;
          border: 0;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          color: var(--text-dim);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }
        .tab.active {
          color: var(--text);
          border-bottom-color: var(--purple);
        }
        .label {
          font-size: 0.95rem;
          font-weight: 600;
        }
        .hint {
          font-size: 0.7rem;
          color: var(--text-fade);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
      `}</style>
    </button>
  )
}

/* ─── Feed list (infinite scroll) ────────────────────────── */

function FeedList({
  feedName,
  context,
  likes,
}: {
  feedName: FeedName
  context: Record<string, unknown> | undefined
  likes: ReturnType<typeof useLikes>
}) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<FeedPage['meta'] | null>(null)

  const load = useCallback(
    async (nextCursor: string | null, isRefetch: boolean) => {
      setIsLoading(true)
      setError(null)
      try {
        const page = await fetchFeedPage(feedName, {
          context,
          cursor: nextCursor ?? undefined,
        })
        setMeta(page.meta)
        setItems((prev) => (isRefetch ? page.items : [...prev, ...page.items]))
        setCursor(page.cursor)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setIsLoading(false)
      }
    },
    [feedName, context],
  )

  const contextKey = useMemo(() => JSON.stringify(context ?? null), [context])
  useEffect(() => {
    void load(null, true)
  }, [load, contextKey])

  return (
    <section>
      <div className="feed-grid">
        {items.map((item) => (
          <ItemCard
            key={`${feedName}-${item.sourceRowId}`}
            item={item}
            isLiked={likes.isLiked(item.metadata.id)}
            onToggleLike={() => likes.toggle(item.metadata)}
          />
        ))}
      </div>

      {cursor && !isLoading && (
        <div className="load-more-wrap">
          <button type="button" className="load-more" onClick={() => void load(cursor, false)}>
            Load more
          </button>
        </div>
      )}

      {isLoading && <p className="hint">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!cursor && items.length > 0 && !isLoading && <p className="hint">End of feed.</p>}

      {meta && (
        <p className="meta">
          {meta.name} · {meta.count} items · {meta.durationMs}ms
        </p>
      )}

      <style jsx>{`
        .feed-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 0.9rem;
          margin-top: 1rem;
        }
        .load-more-wrap {
          display: flex;
          justify-content: center;
          margin-top: 1.5rem;
        }
        .load-more {
          padding: 0.6rem 1.3rem;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 999px;
          font-size: 0.85rem;
          cursor: pointer;
          color: var(--text);
          transition: all 150ms;
        }
        .load-more:hover {
          border-color: rgba(139, 92, 246, 0.6);
          background: var(--panel-2);
        }
        .hint {
          text-align: center;
          color: var(--text-fade);
          font-size: 0.82rem;
          margin: 1.2rem 0;
        }
        .error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          padding: 0.7rem 1rem;
          border-radius: 10px;
          margin-top: 0.8rem;
          font-size: 0.85rem;
        }
        .meta {
          color: var(--text-fade);
          font-size: 0.7rem;
          text-align: center;
          margin-top: 1.2rem;
          font-family: var(--mono);
          letter-spacing: 0.05em;
        }
      `}</style>
    </section>
  )
}

/* ─── Item card (rainbow gradient + click affordance) ─────── */

function ItemCard({
  item,
  isLiked,
  onToggleLike,
}: {
  item: FeedItem
  isLiked: boolean
  onToggleLike: () => void
}) {
  const m = item.metadata
  const title = displayTitle(m)
  const subtitle = displaySubtitle(m)
  const chips = displayChips(m)
  const desc = typeof m.description === 'string' ? m.description : null
  const gradient = cardGradient(String(m.id), item.score)
  const tone = contentTone(item.score)

  return (
    <Link
      href={`/feeds/detail?id=${encodeURIComponent(String(m.id))}`}
      className="card"
      style={{ backgroundImage: gradient }}
    >
      <div className="card-inner">
        <div className="top-row">
          <span className="rank">#{item.rank}</span>
          <span className="score" title="feed score (higher = better fit)">
            {item.score.toFixed(4)}
          </span>
        </div>
        <div className="title" style={{ color: tone.title }}>
          {title}
        </div>
        {subtitle && (
          <div className="subtitle" style={{ color: tone.subtitle }}>
            {subtitle}
          </div>
        )}
        {chips.length > 0 && (
          <div className="chips">
            {chips.slice(0, 4).map((c, i) => (
              <span key={i} className="tag">
                {c}
              </span>
            ))}
          </div>
        )}
        {desc && (
          <p className="desc" style={{ color: tone.subtitle }}>
            {desc}
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            className={isLiked ? 'like-btn liked' : 'like-btn'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleLike()
            }}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            {isLiked ? '♥ liked' : '♡ like'}
          </button>
          <span className="chase">View similar →</span>
        </div>
      </div>

      <style jsx>{`
        .card {
          display: block;
          padding: 1.5px;
          border-radius: 14px;
          text-decoration: none;
          transition: transform 160ms, box-shadow 160ms;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
        }
        .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 34px rgba(139, 92, 246, 0.28);
        }
        .card-inner {
          padding: 0.9rem 1.1rem 0.85rem;
          border-radius: 12.5px;
          background: rgba(15, 16, 36, 0.72);
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          min-height: 210px;
        }
        .top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--mono);
          font-size: 0.72rem;
        }
        .rank {
          color: rgba(255, 255, 255, 0.55);
        }
        .score {
          color: rgba(255, 255, 255, 0.55);
        }
        .title {
          font-weight: 700;
          font-size: 1rem;
          line-height: 1.3;
          letter-spacing: -0.01em;
        }
        .subtitle {
          font-size: 0.78rem;
          text-transform: capitalize;
          font-weight: 500;
        }
        .chips {
          display: flex;
          gap: 0.3rem;
          flex-wrap: wrap;
          margin-top: 0.1rem;
        }
        .tag {
          font-size: 0.7rem;
          text-transform: capitalize;
          padding: 2px 9px;
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.85);
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.14);
        }
        .desc {
          font-size: 0.78rem;
          line-height: 1.45;
          margin: 0.1rem 0 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
          padding-top: 0.6rem;
        }
        .like-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.18);
          font-size: 0.75rem;
          padding: 0.3rem 0.75rem;
          border-radius: 999px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.9);
          transition: all 150ms;
        }
        .like-btn:hover {
          border-color: #f472b6;
          color: #fbcfe8;
        }
        .like-btn.liked {
          background: rgba(244, 114, 182, 0.2);
          border-color: #f472b6;
          color: #fbcfe8;
        }
        .chase {
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.78);
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .card:hover .chase {
          color: #fff;
        }
      `}</style>
    </Link>
  )
}

/* ─── Explainer strip ───────────────────────────────────── */

function Explainer({ feedName, likedCount }: { feedName: FeedName; likedCount: number }) {
  return (
    <section className="explainer">
      <h3>What&apos;s happening?</h3>
      {feedName === 'discover' ? (
        <div className="grid">
          <div>
            <h4>Your likes don&apos;t pin to the top</h4>
            <p>
              Liking doesn&apos;t move liked items up &mdash; it shifts the{' '}
              <em>direction</em> the feed leans. Each like adds to{' '}
              <code>context.liked_names</code>; on the next page-load the server builds a
              context vector from that list and ranks candidates by{' '}
              <strong>cosine similarity to that vector</strong>. Items semantically
              close to your taste float up.{' '}
              {likedCount === 0 ? (
                <>
                  You haven&apos;t liked anything yet, so <code>context</code> is empty
                  &mdash; everything scores equally on similarity and the rank falls
                  through to pure recency (weight 0.1).
                </>
              ) : (
                <>
                  You&apos;ve liked <strong>{likedCount}</strong> item{likedCount === 1 ? '' : 's'}
                  ; the next fetch ranks against the centroid of their embeddings.
                </>
              )}
            </p>
          </div>
          <div>
            <h4>Why this page&apos;s scores look so close</h4>
            <p>
              The demo dataset has no engagement lens attached, and{' '}
              <code>similarity</code> is 0 without context. That leaves only{' '}
              <code>recency (weight 0.1)</code>, and every product in the seed shares an
              <code>updated_at</code> timestamp &mdash; so recency gives the same
              contribution to every row. Like a few items and watch the similarity axis
              wake up &mdash; the scores will fan out.
            </p>
          </div>
          <div>
            <h4>Try this</h4>
            <p>
              Hop to <strong>Latest</strong>, like a few obviously related products
              (e.g. two different olive oils). Come back to Discover. The top rows
              should now lean toward olive oils &mdash; the exact ones you liked
              might or might not be at #1, because similarity ranks{' '}
              <em>neighbors</em> in embedding space, not the originals.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid">
          <div>
            <h4>Pure chronological</h4>
            <p>
              <code>candidates.from: &apos;recent&apos;</code> pulls the 100 most-recently
              updated rows. <code>rank.recency</code> at weight 1 with{' '}
              <code>halfLife: 7d</code> orders them by freshness. No context, no
              personalization &mdash; same feed for every visitor.
            </p>
          </div>
          <div>
            <h4>Still powered by likes</h4>
            <p>
              Liking here doesn&apos;t change Latest &mdash; but those likes{' '}
              <em>do</em> follow you to <strong>Discover</strong>. Use Latest as a
              browse surface, tap likes, then jump to Discover to see them reflected.
            </p>
          </div>
        </div>
      )}
      <style jsx>{`
        .explainer {
          margin-top: 2rem;
          padding: 1.2rem 1.4rem;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        h3 {
          margin: 0 0 0.8rem;
          font-size: 0.95rem;
          color: var(--text);
          font-weight: 700;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1rem;
        }
        h4 {
          margin: 0 0 0.3rem;
          font-size: 0.85rem;
          color: var(--text);
          font-weight: 600;
        }
        p {
          margin: 0;
          color: var(--text-dim);
          font-size: 0.82rem;
          line-height: 1.6;
        }
        code {
          background: var(--bg);
          border: 1px solid var(--border);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.75rem;
          color: var(--text);
          font-family: var(--mono);
        }
      `}</style>
    </section>
  )
}
