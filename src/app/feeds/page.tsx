'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [reloadOnLike, setReloadOnLike] = useState(true)
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
        <div className="tabs-controls">
          {active === 'discover' && (
            <ReloadOnLikeToggle value={reloadOnLike} onChange={setReloadOnLike} />
          )}
          {likes.liked.length > 0 && (
            <button type="button" className="clear-btn" onClick={likes.clear}>
              clear {likes.liked.length} {likes.liked.length === 1 ? 'like' : 'likes'}
            </button>
          )}
        </div>
      </div>

      <FeedList
        key={active}
        feedName={active}
        context={active === 'discover' ? context : undefined}
        likes={likes}
        reloadOnContextChange={active === 'discover' && reloadOnLike}
      />

      <Explainer feedName={active} likedCount={likes.liked.length} reloadOnLike={reloadOnLike} />

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
        .tabs-controls {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 0.9rem;
        }
        .clear-btn {
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

/* ─── Reload-on-like toggle ──────────────────────────────── */

function ReloadOnLikeToggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="reload-toggle" title="Controls whether Discover refetches when you like something">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="ink">
        <strong>Reload on like</strong>
        <em className="hint">
          {value
            ? 'Discover refetches with your new likes so the feed evolves right away.'
            : 'Likes are saved silently — the current page stays put. Refetch manually when you want.'}
        </em>
      </span>
      <style jsx>{`
        .reload-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.35rem 0.7rem 0.35rem 0.5rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--panel);
          cursor: pointer;
          font-size: 0.78rem;
          user-select: none;
          max-width: 340px;
        }
        .reload-toggle:hover {
          border-color: rgba(139, 92, 246, 0.55);
        }
        input[type='checkbox'] {
          accent-color: var(--purple);
          width: 14px;
          height: 14px;
        }
        .ink {
          display: inline-flex;
          flex-direction: column;
          gap: 1px;
          color: var(--text-dim);
          line-height: 1.2;
        }
        strong {
          color: var(--text);
          font-weight: 600;
          font-size: 0.78rem;
        }
        .hint {
          font-style: normal;
          font-size: 0.66rem;
          color: var(--text-fade);
          letter-spacing: 0;
        }
      `}</style>
    </label>
  )
}

/* ─── Feed list (infinite scroll + shimmer-on-refetch) ──── */

function FeedList({
  feedName,
  context,
  likes,
  reloadOnContextChange,
}: {
  feedName: FeedName
  context: Record<string, unknown> | undefined
  likes: ReturnType<typeof useLikes>
  reloadOnContextChange: boolean
}) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefetching, setIsRefetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<FeedPage['meta'] | null>(null)
  // Round-trip includes the network hop; meta.durationMs is server-only.
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null)

  // The context ref always reflects the latest value. The `load()` function
  // closes over it lazily so we can refetch with "whatever context looks
  // like right now" without re-binding on every render.
  const contextRef = useRef(context)
  contextRef.current = context

  const load = useCallback(
    async (nextCursor: string | null, isRefetch: boolean) => {
      if (isRefetch && items.length > 0) setIsRefetching(true)
      else setIsLoading(true)
      setError(null)
      const t0 = performance.now()
      try {
        const page = await fetchFeedPage(feedName, {
          context: contextRef.current,
          cursor: nextCursor ?? undefined,
        })
        setMeta(page.meta)
        setRoundTripMs(Math.round(performance.now() - t0))
        setItems((prev) => (isRefetch ? page.items : [...prev, ...page.items]))
        setCursor(page.cursor)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setIsLoading(false)
        setIsRefetching(false)
      }
    },
    [feedName, items.length],
  )

  // Initial load: always happens on mount (or tab change — parent remounts
  // FeedList via `key`). Captures the current context through the ref.
  const didMountRef = useRef(false)
  useEffect(() => {
    didMountRef.current = false
    void load(null, true)
    didMountRef.current = true
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [feedName])

  // Context-driven refetches — only when the parent opts in. Keyed on a
  // stable JSON so changing-by-reference doesn't trigger false refetches.
  const contextKey = useMemo(() => JSON.stringify(context ?? null), [context])
  const lastContextRef = useRef(contextKey)
  useEffect(() => {
    if (!didMountRef.current) {
      lastContextRef.current = contextKey
      return
    }
    if (lastContextRef.current === contextKey) return
    lastContextRef.current = contextKey
    if (reloadOnContextChange) {
      void load(null, true)
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [contextKey, reloadOnContextChange])

  return (
    <section>
      {/* Status pills (round-trip + server + count) */}
      <div className="status-row">
        {isLoading && <span className="spinner" />}
        {roundTripMs != null && (
          <span className="status-pill timing">
            Round-trip <strong>{formatMs(roundTripMs)}</strong>
          </span>
        )}
        {meta && (
          <span className="status-pill timing">
            Server <strong>{formatMs(meta.durationMs)}</strong>
          </span>
        )}
        {meta && (
          <span className="status-pill count">
            <strong>{items.length}</strong> item{items.length === 1 ? '' : 's'}
          </span>
        )}
        {error && <span className="status-pill error">{error}</span>}
      </div>

      {/* Masonry + shimmer overlay (visible during a refetch over an
          existing result set; hidden on the very first load where we
          want to show a clean skeleton instead). */}
      <div className="shimmer-wrap">
        <div className="feed-masonry">
          {items.map((item) => (
            <ItemCard
              key={`${feedName}-${item.sourceRowId}`}
              item={item}
              pageSize={items.length}
              isLiked={likes.isLiked(item.metadata.id)}
              onToggleLike={() => likes.toggle(item.metadata)}
            />
          ))}
        </div>
        {isRefetching && <div className="shimmer-banner">Re-ranking with your new likes…</div>}
        <div className={isRefetching ? 'shimmer-overlay visible' : 'shimmer-overlay'} />
      </div>

      {cursor && !isLoading && !isRefetching && (
        <div className="load-more-wrap">
          <button type="button" className="load-more" onClick={() => void load(cursor, false)}>
            Load more
          </button>
        </div>
      )}

      {isLoading && items.length === 0 && <p className="hint">Loading…</p>}
      {!cursor && items.length > 0 && !isLoading && !isRefetching && (
        <p className="hint">End of feed.</p>
      )}

      {meta && (
        <p className="meta">
          {meta.name} · feed#{meta.pageSize}
        </p>
      )}

      <style jsx>{`
        .status-row {
          margin: 0 0 0.9rem;
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

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/* ─── Item card (rainbow gradient + click affordance) ─────── */

function ItemCard({
  item,
  pageSize,
  isLiked,
  onToggleLike,
}: {
  item: FeedItem
  pageSize: number
  isLiked: boolean
  onToggleLike: () => void
}) {
  const m = item.metadata
  const title = displayTitle(m)
  const subtitle = displaySubtitle(m)
  const chips = displayChips(m)
  const desc = typeof m.description === 'string' ? m.description : null
  const gradient = cardGradient(String(m.id), item.rank, pageSize)
  const tone = contentTone(item.rank, pageSize)

  return (
    <Link
      href={`/feeds/detail?id=${encodeURIComponent(String(m.id))}`}
      className="feed-card"
      style={{ backgroundImage: gradient }}
    >
      <div className="feed-card-inner">
        <div className="feed-card-top">
          <span>#{item.rank}</span>
          <span title="feed score (higher = better fit)">{item.score.toFixed(4)}</span>
        </div>
        <div className="feed-card-title" style={{ color: tone.title }}>
          {title}
        </div>
        {subtitle && (
          <div className="feed-card-subtitle" style={{ color: tone.subtitle }}>
            {subtitle}
          </div>
        )}
        {chips.length > 0 && (
          <div className="feed-card-chips">
            {chips.slice(0, 4).map((c, i) => (
              <span key={i} className="feed-card-chip">
                {c}
              </span>
            ))}
          </div>
        )}
        {desc && (
          <p className="feed-card-desc" style={{ color: tone.subtitle }}>
            {desc}
          </p>
        )}
        <div className="feed-card-actions">
          <button
            type="button"
            className={isLiked ? 'feed-like-btn liked' : 'feed-like-btn'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleLike()
            }}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            {isLiked ? '♥ liked' : '♡ like'}
          </button>
          <span className="feed-chase">View similar →</span>
        </div>
      </div>
    </Link>
  )
}

/* ─── Explainer strip ───────────────────────────────────── */

function Explainer({
  feedName,
  likedCount,
  reloadOnLike,
}: {
  feedName: FeedName
  likedCount: number
  reloadOnLike: boolean
}) {
  void reloadOnLike // available for future inline explanation branching
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
