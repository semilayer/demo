'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ANALYZE_URL,
  API_KEY,
  formatSeconds,
  prettyTag,
  type AnalyzeResponse,
  type AnalyzeBucket,
  type FoodRow,
  type QueryResponse,
} from '../_lib/api'
import { SiteHeader } from '../_components/header'
import { BottomNote } from '../_components/bottom-note'
import {
  createChart,
  type ChartInstance,
  type ChartShape,
  resolveTheme,
} from '@semilayer/charts'

/* ─────────────────────────────────────────────────────────────
 * SemiLayer · Analyze demo (/analyze)
 * ─────────────────────────────────────────────────────────────
 * Four named analyses on `food_products`. A single shared filter
 * bar (price band + in-stock toggle) feeds the body.where on every
 * call — change a chip, every chart re-runs against the merged
 * predicate. That's the moment.
 *
 * Charts come from @semilayer/charts (vanilla SVG, zero framework
 * deps). The demo stays SDK-free — same posture as Search/Query/
 * Similar/Feeds. Only difference: each tile mounts a chart instead
 * of rendering a list.
 * ───────────────────────────────────────────────────────────── */

interface AnalysisSpec {
  name: string
  title: string
  caption: string
  shape: ChartShape
  /** Map an AnalyzeBucket onto a `(label, value)` pair for the chart. */
  toRow: (b: AnalyzeBucket) => { label: string; value: number }
  /** Friendly label for the bottom drill-down panel. */
  rowsCol: string
}

const ANALYSES: AnalysisSpec[] = [
  {
    name: 'byCategory',
    title: 'Top categories',
    caption: 'How are 1M products distributed across categories?',
    shape: 'bar',
    toRow: (b) => ({
      label: prettyTag(String(b.dims.category ?? '?')),
      value: b.measures.products ?? 0,
    }),
    rowsCol: 'category',
  },
  {
    name: 'priceDistribution',
    title: 'Price distribution',
    caption: 'Numeric bucket on price_cents — break points at $5/$10/$15/$20/$30/$50/$100.',
    shape: 'bar',
    toRow: (b) => {
      const band = String(b.dims.price_band ?? '?')
      // band looks like "500..1000" — render as $5–$10
      const [lo, hi] = band.split('..').map((n) => Number(n) / 100)
      const label =
        Number.isFinite(lo) && Number.isFinite(hi) ? `$${lo}–$${hi}` : band
      return { label, value: b.measures.products ?? 0 }
    },
    rowsCol: 'price_cents',
  },
  {
    name: 'topBrands',
    title: 'Top brands',
    caption: 'Most products in the catalog ship under one of these names.',
    shape: 'donut',
    toRow: (b) => ({
      label: String(b.dims.brand ?? '?'),
      value: b.measures.products ?? 0,
    }),
    rowsCol: 'brand',
  },
  {
    name: 'inventoryByCategory',
    title: 'Stock by category',
    caption: 'Total units on hand, top 10 categories. Same filter bar feeds it.',
    shape: 'bar',
    toRow: (b) => ({
      label: prettyTag(String(b.dims.category ?? '?')),
      value: b.measures.totalStock ?? 0,
    }),
    rowsCol: 'category',
  },
]

const PRICE_BANDS: Array<{ id: string; label: string; where: Record<string, unknown> | null }> = [
  { id: 'all', label: 'All prices', where: null },
  {
    id: 'under5',
    label: 'Under $5',
    where: { price_cents: { $gt: 0, $lte: 500 } },
  },
  {
    id: '5to15',
    label: '$5 – $15',
    where: { price_cents: { $gt: 500, $lte: 1500 } },
  },
  {
    id: 'premium',
    label: 'Premium ($15+)',
    where: { price_cents: { $gt: 1500 } },
  },
]

interface DrillState {
  spec: AnalysisSpec
  bucketKey: string
  bucketLabel: string
  rows: FoodRow[]
  total: number
  loading: boolean
  error: string | null
}

export default function AnalyzePage() {
  const [bandId, setBandId] = useState<string>('all')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [drill, setDrill] = useState<DrillState | null>(null)

  // Compose the body.where every call should send. Memoised so chart effects
  // can depend on a stable serialisation rather than a fresh object each
  // render.
  const where = useMemo<Record<string, unknown> | undefined>(() => {
    const merged: Record<string, unknown> = {}
    const band = PRICE_BANDS.find((b) => b.id === bandId)
    if (band?.where) Object.assign(merged, band.where)
    if (inStockOnly) merged.inventory = { $gt: 0 }
    return Object.keys(merged).length === 0 ? undefined : merged
  }, [bandId, inStockOnly])

  // Stringified form of the where so child <ChartTile> effects re-run
  // exactly when the predicate changes.
  const whereKey = useMemo(() => JSON.stringify(where ?? null), [where])

  const closeDrill = useCallback(() => setDrill(null), [])

  return (
    <main className="shell">
      <SiteHeader />

      <section className="analyze-hero">
        <div className="hero-eyebrow">
          <span className="hero-dot" /> POST /v1/analyze
        </div>
        <h1 className="hero-title">
          One <code>food_products</code> lens. <span className="grad">Four declarative analyses.</span>{' '}
          One <code>where</code> predicate that feeds them all.
        </h1>
        <p className="hero-sub">
          Every chart below is a named analysis declared on the lens — you call them by
          name, you don&rsquo;t write SQL. Pick a price band or toggle &ldquo;in stock only&rdquo;
          and watch every tile recompose live as the predicate changes. Click any bar to
          drill down to the underlying products.
        </p>
      </section>

      <section className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Price</span>
          <div className="chip-row">
            {PRICE_BANDS.map((b) => (
              <button
                key={b.id}
                className={`chip ${bandId === b.id ? 'on' : ''}`}
                onClick={() => setBandId(b.id)}
                type="button"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-label">Stock</span>
          <button
            type="button"
            className={`chip ${inStockOnly ? 'on' : ''}`}
            onClick={() => setInStockOnly((v) => !v)}
          >
            {inStockOnly ? '✓ In stock only' : 'In stock only'}
          </button>
        </div>
        <div className="filter-where">
          <code>{`where = ${whereKey}`}</code>
        </div>
      </section>

      <section className="chart-grid">
        {ANALYSES.map((spec) => (
          <ChartTile
            key={spec.name}
            spec={spec}
            where={where}
            whereKey={whereKey}
            onDrill={(bucket) =>
              setDrill({
                spec,
                bucketKey: bucket.bucketKey,
                bucketLabel: spec.toRow(bucket).label,
                rows: [],
                total: 0,
                loading: true,
                error: null,
              })
            }
          />
        ))}
      </section>

      {drill ? <DrillPanel drill={drill} setDrill={setDrill} onClose={closeDrill} /> : null}

      <BottomNote />

      <style jsx>{`
        .analyze-hero {
          margin: 1.5rem 0 1.75rem;
        }
        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--mono);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--gold);
          padding: 0.3rem 0.65rem;
          background: rgba(255, 209, 102, 0.1);
          border: 1px solid rgba(255, 209, 102, 0.25);
          border-radius: 999px;
          margin-bottom: 0.9rem;
        }
        .hero-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--gold);
          box-shadow: 0 0 8px rgba(255, 209, 102, 0.6);
        }
        .hero-title {
          font-size: clamp(1.55rem, 3.4vw, 2.15rem);
          font-weight: 700;
          line-height: 1.18;
          letter-spacing: -0.02em;
          margin: 0 0 0.7rem;
          color: var(--text);
        }
        .hero-title code {
          font-family: var(--mono);
          font-size: 0.85em;
          padding: 0.05em 0.3em;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 0.3em;
          color: var(--text);
        }
        .grad {
          background: linear-gradient(90deg, var(--gold), #f59e0b 40%, var(--purple));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .hero-sub {
          margin: 0;
          color: var(--text-dim);
          font-size: 0.95rem;
          line-height: 1.6;
          max-width: 720px;
        }
        .filter-bar {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
          padding: 0.85rem 1rem;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 1.4rem;
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .filter-label {
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-fade);
        }
        .chip-row {
          display: flex;
          gap: 0.35rem;
        }
        .chip {
          padding: 0.4rem 0.8rem;
          font-size: 0.82rem;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 999px;
          color: var(--text-dim);
          font-weight: 500;
          transition: border-color 140ms, color 140ms, background 140ms, transform 140ms;
        }
        .chip:hover {
          color: var(--text);
          border-color: rgba(139, 92, 246, 0.55);
        }
        .chip.on {
          color: white;
          background: linear-gradient(135deg, var(--gold) 0%, #f59e0b 100%);
          border-color: rgba(255, 209, 102, 0.6);
          box-shadow: 0 4px 14px -8px rgba(255, 209, 102, 0.6);
        }
        .filter-where {
          margin-left: auto;
          font-family: var(--mono);
          font-size: 0.72rem;
          color: var(--text-fade);
          max-width: 360px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (max-width: 760px) {
          .filter-where {
            display: none;
          }
        }
        .chart-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        @media (max-width: 760px) {
          .chart-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}

/* ── ChartTile ────────────────────────────────────────────── */

interface ChartTileProps {
  spec: AnalysisSpec
  where: Record<string, unknown> | undefined
  whereKey: string
  onDrill: (bucket: AnalyzeBucket) => void
}

function ChartTile({ spec, where, whereKey, onDrill }: ChartTileProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ChartInstance | null>(null)
  const [meta, setMeta] = useState<{ strategy: string; duration: number; rows: number } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Dark-themed chart tokens — brand palette + opaque tooltip surface so
  // labels stay readable over the panel background. resolveTheme() falls
  // back to lightTheme for any field we don't override; the explicit
  // overrides below are everything the tooltip / axis / palette read.
  const theme = useMemo(
    () =>
      resolveTheme({
        background: 'transparent',
        foreground: '#e7e8f5',
        axis: '#9ea0bf',
        grid: 'rgba(255,255,255,0.06)',
        surface: '#1a1c38',
        surfaceBorder: '#2a2c4f',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif",
        palette: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f472b6', '#06b6d4', '#a78bfa', '#34d399'],
      }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host) return

    setLoading(true)
    setError(null)

    fetch(`${ANALYZE_URL}/${spec.name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(where ? { where } : {}),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
        }
        return res.json() as Promise<AnalyzeResponse>
      })
      .then((data) => {
        if (cancelled) return

        // Reshape buckets into a tidy `(dim, value)` series for the chart.
        // The synthetic AnalyzeResult shape is what @semilayer/charts'
        // `kind: 'data'` source adapter ingests; bar/donut shapes read
        // `dims.label` for the category and the first numeric measure
        // for the value. We *also* keep an index → original-bucket map
        // so the click handler can hand the un-reshaped AnalyzeBucket
        // (with the signed bucketKey) to the drill-down panel.
        const reshapedBuckets = data.buckets.map((b) => {
          const row = spec.toRow(b)
          return {
            dims: { label: row.label } as Record<string, unknown>,
            measures: { value: row.value } as Record<string, unknown>,
            count: b.count,
            bucketKey: b.bucketKey,
          }
        })
        const reshaped = {
          kind: 'metric' as const,
          buckets: reshapedBuckets,
          meta: {
            ...data.meta,
            approximate: data.meta.approximate ?? false,
            cached: data.meta.cached ?? false,
          },
        }

        if (chartRef.current) {
          chartRef.current.update(reshaped)
        } else {
          chartRef.current = createChart(host, {
            shape: spec.shape,
            theme,
            source: { kind: 'data', result: reshaped },
            encoding: { x: 'label', y: 'value' },
          })
          chartRef.current.onBucketClick((bk) => {
            // The chart's bucketKey is the same string we attached above,
            // so look the original AnalyzeBucket up directly.
            const original = data.buckets.find((b) => b.bucketKey === bk)
            if (original) onDrill(original)
          })
        }

        setMeta({
          strategy: data.meta.strategy,
          duration: data.meta.durationMs,
          rows: data.buckets.length,
        })
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'fetch failed')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [spec, theme, whereKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tear down the chart on unmount.
  useEffect(() => {
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [])

  return (
    <article className="tile">
      <header className="tile-head">
        <div>
          <h3 className="tile-title">{spec.title}</h3>
          <p className="tile-caption">{spec.caption}</p>
        </div>
        <div className="tile-meta">
          {loading ? (
            <span className="tile-pill loading">recomputing…</span>
          ) : error ? (
            <span className="tile-pill err">error</span>
          ) : meta ? (
            <>
              <span className="tile-pill">{meta.strategy}</span>
              <span className="tile-pill mono">{formatSeconds(meta.duration)}</span>
            </>
          ) : null}
        </div>
      </header>
      <div ref={hostRef} className="chart-host" />
      {error ? <div className="tile-err">{error}</div> : null}

      <style jsx>{`
        .tile {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1rem 1.1rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          min-width: 0;
          overflow: hidden;
        }
        .tile-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .tile-title {
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 0 0 0.2rem;
          color: var(--text);
        }
        .tile-caption {
          font-size: 0.8rem;
          color: var(--text-dim);
          margin: 0;
          line-height: 1.45;
          max-width: 380px;
        }
        .tile-meta {
          display: flex;
          gap: 0.3rem;
          flex-shrink: 0;
        }
        .tile-pill {
          font-family: var(--mono);
          font-size: 0.65rem;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: var(--purple);
          letter-spacing: 0.04em;
        }
        .tile-pill.loading {
          background: rgba(255, 209, 102, 0.12);
          border-color: rgba(255, 209, 102, 0.3);
          color: var(--gold);
        }
        .tile-pill.err {
          background: rgba(244, 114, 182, 0.12);
          border-color: rgba(244, 114, 182, 0.3);
          color: var(--pink);
        }
        .tile-pill.mono {
          background: rgba(59, 130, 246, 0.12);
          border-color: rgba(59, 130, 246, 0.3);
          color: var(--blue);
        }
        .chart-host {
          height: 240px;
          width: 100%;
        }
        .chart-host :global(svg) {
          width: 100%;
          height: 100%;
          display: block;
        }
        .tile-err {
          font-size: 0.78rem;
          color: var(--pink);
          font-family: var(--mono);
          padding: 0.4rem 0.6rem;
          background: rgba(244, 114, 182, 0.08);
          border-radius: 6px;
          word-break: break-word;
        }
      `}</style>
    </article>
  )
}

/* ── DrillPanel ───────────────────────────────────────────── */

interface DrillPanelProps {
  drill: DrillState
  setDrill: (next: DrillState | null) => void
  onClose: () => void
}

function DrillPanel({ drill, setDrill, onClose }: DrillPanelProps) {
  useEffect(() => {
    let cancelled = false
    setDrill({ ...drill, loading: true, error: null })
    const t0 = performance.now()
    fetch(`${ANALYZE_URL}/${drill.spec.name}/rows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ bucketKey: drill.bucketKey, limit: 10 }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
        }
        const data = (await res.json()) as QueryResponse
        if (cancelled) return
        const elapsed = Math.round(performance.now() - t0)
        setDrill({
          ...drill,
          rows: data.rows ?? [],
          total: data.meta?.total ?? data.rows?.length ?? 0,
          loading: false,
          error: null,
        })
        void elapsed
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setDrill({
          ...drill,
          rows: [],
          loading: false,
          error: err instanceof Error ? err.message : 'fetch failed',
        })
      })
    return () => {
      cancelled = true
    }
    // Refetch whenever the bucketKey changes (a new bar was clicked).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill.bucketKey])

  return (
    <section className="drill">
      <header className="drill-head">
        <div>
          <div className="drill-eyebrow">POST /v1/analyze/.../rows</div>
          <h3 className="drill-title">
            {drill.spec.title} → <span className="grad">{drill.bucketLabel}</span>
          </h3>
          <p className="drill-sub">
            Drill-down replays the predicate that produced this bucket — same RBAC, same
            mapping. {drill.total ? `${drill.total.toLocaleString()} matching rows` : null}
            {drill.loading ? ' · loading' : ''}
          </p>
        </div>
        <button className="drill-close" onClick={onClose} type="button">
          ✕
        </button>
      </header>

      {drill.error ? (
        <div className="drill-err">{drill.error}</div>
      ) : drill.rows.length > 0 ? (
        <ul className="drill-list">
          {drill.rows.map((r) => (
            <li key={r.id} className="drill-row">
              <div className="drill-row-name">{r.name}</div>
              <div className="drill-row-meta">
                <span>{r.brand ?? '—'}</span>
                <span>·</span>
                <span>{r.category ?? '—'}</span>
                <span>·</span>
                <span className="mono">
                  ${(r.price_cents ?? 0) / 100}
                </span>
                <span>·</span>
                <span className="mono">stock {r.inventory ?? 0}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : drill.loading ? null : (
        <div className="drill-empty">No rows.</div>
      )}

      <style jsx>{`
        .drill {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.1rem 1.25rem 1.25rem;
          margin-bottom: 1.5rem;
        }
        .drill-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 0.85rem;
        }
        .drill-eyebrow {
          font-family: var(--mono);
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-fade);
          margin-bottom: 0.3rem;
        }
        .drill-title {
          font-size: 1.05rem;
          font-weight: 700;
          margin: 0;
          color: var(--text);
        }
        .grad {
          background: linear-gradient(90deg, var(--gold), var(--purple));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .drill-sub {
          margin: 0.3rem 0 0;
          font-size: 0.82rem;
          color: var(--text-dim);
        }
        .drill-close {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-dim);
          width: 30px;
          height: 30px;
          border-radius: 999px;
          font-size: 1rem;
          line-height: 1;
        }
        .drill-close:hover {
          color: var(--text);
          border-color: var(--purple);
        }
        .drill-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .drill-row {
          padding: 0.55rem 0.7rem;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 8px;
        }
        .drill-row-name {
          font-size: 0.88rem;
          color: var(--text);
          font-weight: 500;
          margin-bottom: 0.2rem;
        }
        .drill-row-meta {
          display: flex;
          gap: 0.45rem;
          font-size: 0.78rem;
          color: var(--text-dim);
          flex-wrap: wrap;
          align-items: center;
        }
        .mono {
          font-family: var(--mono);
        }
        .drill-empty {
          font-size: 0.85rem;
          color: var(--text-fade);
          text-align: center;
          padding: 1rem 0;
        }
        .drill-err {
          font-size: 0.82rem;
          color: var(--pink);
          font-family: var(--mono);
          padding: 0.5rem 0.7rem;
          background: rgba(244, 114, 182, 0.08);
          border-radius: 6px;
        }
      `}</style>
    </section>
  )
}
