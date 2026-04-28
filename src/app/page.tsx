'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SiteHeader } from './_components/header'
import { BottomNote } from './_components/bottom-note'

/* ─────────────────────────────────────────────────────────────
 * SemiLayer · Live Demo (landing)
 * ─────────────────────────────────────────────────────────────
 * Three modes, one publishable key, one lens. Pick a surface:
 *   /search — ask in words
 *   /query  — ask in shape
 *   /feeds  — subscribe to a composed, live-evolving feed
 *
 * Each tile is a route. The panels behind them are plain fetch()
 * calls — no SDK, no backend of our own. Source is on the page.
 * ───────────────────────────────────────────────────────────── */

function useCountUp(target: number, durationMs = 2400) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setValue(Math.round(easeOutCubic(t) * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}

export default function LandingPage() {
  const count = useCountUp(1_000_000, 2600)

  return (
    <main className="shell">
      <SiteHeader />

      <section className="hero-block">
        <h1 className="hero-title">
          <span className="count-up">{count.toLocaleString()}</span> food products.{' '}
          <span className="grad">Understood</span>, not just{' '}
          <span className="grad">indexed</span>.
        </h1>
        <p className="hero-sub">
          One publishable key. One <code>food_products</code> lens. Five surfaces to ask in
          words, in shape, by similarity, by ranked feed, or by aggregate &mdash; each over
          plain <code>fetch()</code>, no SDK, no backend of our own. Pick a surface below to
          see the same data through a different window.
        </p>
        <div className="hero-callouts">
          <span className="callout"><span className="dot" />Meaning, not keywords</span>
          <span className="callout"><span className="dot" />Structured when you need it</span>
          <span className="callout"><span className="dot" />Composed into live feeds</span>
        </div>
      </section>

      <section className="mode-grid">
        <ModeTile
          href="/search"
          badge="POST /v1/search"
          title="Semantic search"
          gradient="linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)"
          description="Plain-English queries over the embeddings. 'Organic oat milk', 'something sweet for breakfast' — the layer understands intent, not keywords."
          bullets={[
            'One endpoint',
            'Context-aware ranking',
            'Filter + limit + order inline',
          ]}
        />
        <ModeTile
          href="/query"
          badge="POST /v1/query"
          title="Typed query"
          gradient="linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)"
          description="Ask in shape. Filters, orderBy, limit, offset — your lens becomes a read-only API over structured rows. Useful for grids, admin, pipelines."
          bullets={[
            'All standard SQL-ish filters',
            'Typed rows, mapped fields',
            'Stable pagination',
          ]}
        />
        <ModeTile
          href="/similar"
          badge="POST /v1/similar"
          title="Similar"
          gradient="linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%)"
          description="Pass any record id, get its nearest neighbors in embedding space. No embedding API call — the seed's vector is already stored. Chain-click to explore."
          bullets={[
            "Zero embedding cost per call",
            'Click a result to re-seed',
            'Declarative: which fields drive similarity',
          ]}
        />
        <ModeTile
          href="/feeds"
          badge="POST /v1/feed"
          title="Feeds"
          gradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)"
          description="Declarative ranking &mdash; similarity, recency, engagement, diversity. Likes stay on your device; the feed re-ranks live as you interact."
          bullets={[
            'Three named feeds on one lens',
            '"More like this" via recordVector',
            'Likes in localStorage, no server write',
          ]}
        />
        <ModeTile
          href="/analyze"
          badge="POST /v1/analyze"
          title="Analyze"
          gradient="linear-gradient(135deg, #ffd166 0%, #f59e0b 100%)"
          description="Declared aggregations &mdash; group, bucket, drill down. Pick a price band or stock filter and watch four charts recompose live. Same lens, no SQL."
          bullets={[
            'Four named analyses on one lens',
            'One filter feeds every chart',
            'Click a bar to drill to the rows',
          ]}
        />
      </section>

      <section className="dataset-note">
        <h2>About the dataset</h2>
        <p>
          The <code>food_products</code> lens points at a slice of the{' '}
          <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">
            Open Food Facts
          </a>{' '}
          open dataset &mdash; brands, categories, tags, descriptions, prices,
          inventory. Enough shape to show how a real product catalog behaves through
          SemiLayer: one config block up front, then every surface above composes against
          the same underlying table. Search, filter, and feed are all the same data.
        </p>
      </section>

      <BottomNote />

      <style jsx>{`
        .mode-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1rem;
          margin: 2.5rem 0;
        }
        @media (max-width: 1280px) {
          .mode-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 900px) {
          .mode-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .mode-grid {
            grid-template-columns: 1fr;
          }
        }
        .dataset-note {
          margin: 2.5rem 0 1rem;
          padding: 1.4rem 1.6rem;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
        }
        .dataset-note h2 {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          color: var(--text);
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .dataset-note p {
          margin: 0;
          color: var(--text-dim);
          font-size: 0.88rem;
          line-height: 1.65;
        }
        .dataset-note a {
          color: var(--purple);
        }
        .dataset-note a:hover {
          color: var(--blue);
        }
      `}</style>
    </main>
  )
}

/* ─── Mode tile ──────────────────────────────────────────── */

function ModeTile({
  href,
  badge,
  title,
  gradient,
  description,
  bullets,
}: {
  href: string
  badge: string
  title: string
  gradient: string
  description: string
  bullets: string[]
}) {
  return (
    <Link href={href} className="mode-tile">
      <div className="tile-stripe" style={{ background: gradient }} />
      <div className="tile-body">
        <div className="tile-badge">{badge}</div>
        <h3 className="tile-title">{title}</h3>
        <p className="tile-desc">{description}</p>
        <ul className="tile-bullets">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
        <div className="tile-cta">
          Try it <span className="tile-cta-arrow">→</span>
        </div>
      </div>

      <style jsx>{`
        .mode-tile {
          display: flex;
          flex-direction: column;
          text-decoration: none;
          color: inherit;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 160ms, transform 160ms;
        }
        .mode-tile:hover {
          border-color: rgba(139, 92, 246, 0.55);
          transform: translateY(-2px);
        }
        .tile-stripe {
          height: 6px;
        }
        .tile-body {
          padding: 1.4rem 1.6rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }
        .tile-badge {
          font-family: var(--mono);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-fade);
          margin-bottom: 0.15rem;
        }
        .tile-title {
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 0;
          color: var(--text);
        }
        .tile-desc {
          font-size: 0.9rem;
          color: var(--text-dim);
          line-height: 1.55;
          margin: 0;
        }
        .tile-bullets {
          margin: 0.3rem 0 0.5rem;
          padding-left: 1.1rem;
          font-size: 0.82rem;
          color: var(--text-dim);
          line-height: 1.7;
        }
        .tile-cta {
          margin-top: auto;
          padding-top: 0.7rem;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--purple);
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .tile-cta-arrow {
          transition: transform 160ms;
        }
        .mode-tile:hover .tile-cta-arrow {
          transform: translateX(3px);
        }
      `}</style>
    </Link>
  )
}
