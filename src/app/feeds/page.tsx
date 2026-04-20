'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchFeedPage,
  displayTitle,
  displaySubtitle,
  displayChips,
  type FeedItem,
  type FeedPage,
} from './lib/feed-api'
import { useLikes } from './lib/liked-storage'

/* ─────────────────────────────────────────────────────────────
 * SemiLayer · Feed demo (/feeds)
 * ─────────────────────────────────────────────────────────────
 * Three named feeds on one lens:
 *
 *   POST /v1/feed/<LENS>/discover    ← similarity (+ recency / engagement)
 *   POST /v1/feed/<LENS>/latest      ← chronological
 *   (POST /v1/feed/<LENS>/relatedTo → /feeds/[id] detail page)
 *
 * Likes live in localStorage only. `context.liked_names` drives the
 * similarity scorer in `discover`; the frontend never hits our API or
 * our database to persist a like. If the feed's engagement scorer
 * points at a sibling lens with server-seeded data, that axis evolves
 * for every visitor — they're complementary, not overlapping.
 * ───────────────────────────────────────────────────────────── */

type FeedName = 'discover' | 'latest'

export default function FeedsHome() {
  const [active, setActive] = useState<FeedName>('discover')
  const likes = useLikes()

  // Discover evolves with the user's client-side likes. Pass them both
  // as names (for text-embedding similarity) and ids (so a feed config
  // that wanted to boost-by-id could do so).
  const context = useMemo(
    () => ({ liked_names: likes.likedTitles, liked_ids: likes.likedIds }),
    [likes.likedTitles, likes.likedIds],
  )

  return (
    <main className="feed-page">
      <Header likedCount={likes.liked.length} onClear={likes.clear} />

      <div className="feed-tabs">
        <TabButton label="Discover" active={active === 'discover'} onClick={() => setActive('discover')} />
        <TabButton label="Latest" active={active === 'latest'} onClick={() => setActive('latest')} />
      </div>

      <FeedList
        key={active}
        feedName={active}
        context={active === 'discover' ? context : undefined}
        likes={likes}
      />

      <Explainer feedName={active} likedCount={likes.liked.length} />

      <style jsx>{`
        .feed-page {
          max-width: 920px;
          margin: 0 auto;
          padding: 32px 20px 96px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1a1a1a;
        }
        .feed-tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid #e5e5e5;
          margin-bottom: 16px;
        }
      `}</style>
    </main>
  )
}

/* ─── Header ─────────────────────────────────────────────── */

function Header({ likedCount, onClear }: { likedCount: number; onClear: () => void }) {
  return (
    <header className="header">
      <div>
        <h1>SemiLayer Feeds</h1>
        <p className="sub">
          Three feeds, one lens. Like something to watch the <strong>Discover</strong> tab
          re-rank around your taste. Click any card for &ldquo;More like this.&rdquo; All your
          likes live in this browser — nothing is sent to a server.
        </p>
      </div>
      <div className="likes-chip">
        <span>{likedCount} liked</span>
        {likedCount > 0 && (
          <button type="button" className="link" onClick={onClear}>
            clear
          </button>
        )}
      </div>
      <style jsx>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          gap: 16px;
        }
        h1 {
          margin: 0 0 6px;
          font-size: 28px;
          background: linear-gradient(90deg, #8b5cf6, #3b82f6, #10b981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .sub {
          margin: 0;
          font-size: 14px;
          color: #666;
          max-width: 620px;
          line-height: 1.45;
        }
        .likes-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border: 1px solid #e5e5e5;
          border-radius: 999px;
          font-size: 13px;
          color: #4a4a4a;
          background: #fafafa;
          white-space: nowrap;
        }
        .link {
          background: none;
          border: 0;
          color: #8b5cf6;
          font-size: 12px;
          cursor: pointer;
          padding: 0;
        }
        .link:hover {
          text-decoration: underline;
        }
      `}</style>
    </header>
  )
}

/* ─── Tab button ─────────────────────────────────────────── */

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={active ? 'tab active' : 'tab'} onClick={onClick}>
      {label}
      <style jsx>{`
        .tab {
          padding: 8px 18px;
          background: none;
          border: 0;
          font-size: 14px;
          color: #666;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .tab.active {
          color: #1a1a1a;
          border-bottom-color: #8b5cf6;
          font-weight: 600;
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

  // Refetch first page when the feed tab changes OR when likes change
  // (Discover ranks against `context.liked_names`, so a new like literally
  // evolves the feed on the next call). Latest ignores context so it only
  // reloads on tab switch.
  const contextKey = useMemo(() => JSON.stringify(context ?? null), [context])
  useEffect(() => {
    void load(null, true)
  }, [load, contextKey])

  return (
    <section>
      <div className="feed-list">
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
        .feed-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 16px;
        }
        @media (max-width: 720px) {
          .feed-list {
            grid-template-columns: 1fr;
          }
        }
        .load-more-wrap {
          display: flex;
          justify-content: center;
          margin-top: 20px;
        }
        .load-more {
          padding: 10px 20px;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        }
        .load-more:hover {
          border-color: #8b5cf6;
          color: #8b5cf6;
        }
        .hint {
          text-align: center;
          color: #999;
          font-size: 13px;
          margin: 18px 0;
        }
        .error {
          background: #fee;
          color: #c33;
          padding: 10px 14px;
          border-radius: 8px;
          margin-top: 12px;
          font-size: 13px;
        }
        .meta {
          color: #999;
          font-size: 11px;
          text-align: center;
          margin-top: 20px;
          font-family: ui-monospace, SFMono-Regular, monospace;
        }
      `}</style>
    </section>
  )
}

/* ─── Item card (metadata-shape-agnostic) ────────────────── */

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

  return (
    <article className="card">
      <div className="rank-chip">#{item.rank}</div>
      <Link href={`/feeds/${encodeURIComponent(String(m.id))}`} className="title">
        {title}
      </Link>
      {subtitle && <div className="subtitle">{subtitle}</div>}
      {chips.length > 0 && (
        <div className="meta-row">
          {chips.map((c, i) => (
            <span key={i} className="tag">
              {c}
            </span>
          ))}
        </div>
      )}
      {desc && <p className="desc">{desc}</p>}
      <div className="actions">
        <button
          type="button"
          className={isLiked ? 'like-btn liked' : 'like-btn'}
          onClick={onToggleLike}
          aria-label={isLiked ? 'Unlike' : 'Like'}
        >
          {isLiked ? '♥ liked' : '♡ like'}
        </button>
        <span className="score">score {item.score.toFixed(3)}</span>
      </div>

      <style jsx>{`
        .card {
          position: relative;
          padding: 14px 16px 12px;
          border: 1px solid #eee;
          border-radius: 10px;
          background: #fff;
          transition: border-color 120ms;
        }
        .card:hover {
          border-color: #d4d4d4;
        }
        .rank-chip {
          position: absolute;
          top: 10px;
          right: 12px;
          font-size: 11px;
          color: #999;
          font-family: ui-monospace, monospace;
        }
        .title {
          display: inline-block;
          font-weight: 600;
          font-size: 15px;
          color: #1a1a1a;
          text-decoration: none;
          line-height: 1.25;
          margin-right: 40px;
        }
        .title:hover {
          color: #8b5cf6;
        }
        .subtitle {
          font-size: 12px;
          color: #888;
          margin-top: 2px;
          text-transform: capitalize;
        }
        .meta-row {
          display: flex;
          gap: 6px;
          margin: 8px 0;
          flex-wrap: wrap;
        }
        .tag {
          font-size: 11px;
          text-transform: capitalize;
          padding: 2px 8px;
          background: #f3e8ff;
          color: #6d28d9;
          border-radius: 999px;
        }
        .desc {
          font-size: 13px;
          color: #666;
          line-height: 1.4;
          margin: 4px 0 10px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .like-btn {
          background: none;
          border: 1px solid #e5e5e5;
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 999px;
          cursor: pointer;
          color: #666;
          transition: all 120ms;
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
          font-size: 11px;
          color: #ccc;
          font-family: ui-monospace, monospace;
        }
      `}</style>
    </article>
  )
}

/* ─── Explainer strip ───────────────────────────────────── */

function Explainer({ feedName, likedCount }: { feedName: FeedName; likedCount: number }) {
  return (
    <section className="explainer">
      <h3>What&apos;s happening?</h3>
      {feedName === 'discover' ? (
        <p>
          Discover ranks candidates by similarity × recency (plus engagement if your feed
          config points at a sibling lens). The similarity vector is built from your{' '}
          {likedCount > 0 ? (
            <>
              <strong>{likedCount}</strong> liked titles (sent as <code>context.liked_names</code>)
            </>
          ) : (
            <>an empty context — like a few items and watch the order shift</>
          )}
          . Every like stays in <code>localStorage</code> — no writes to our server.
        </p>
      ) : (
        <p>
          Latest is chronological: <code>ORDER BY updated_at DESC</code> over the most recent
          candidates, ranked purely by recency. No personalization — same for every visitor.
        </p>
      )}
      <style jsx>{`
        .explainer {
          margin-top: 32px;
          padding: 14px 18px;
          background: #fafafa;
          border-radius: 10px;
          border: 1px solid #f0f0f0;
        }
        h3 {
          margin: 0 0 6px;
          font-size: 14px;
          color: #333;
        }
        p {
          margin: 0;
          font-size: 13px;
          color: #555;
          line-height: 1.55;
        }
        code {
          font-family: ui-monospace, monospace;
          font-size: 12px;
          background: #eee;
          padding: 1px 5px;
          border-radius: 3px;
          color: #1a1a1a;
        }
      `}</style>
    </section>
  )
}
