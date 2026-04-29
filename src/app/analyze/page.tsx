'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ANALYZE_URL,
  API_KEY,
  formatSeconds,
  prettyTag,
  type AnalyzeResponse,
  type AnalyzeBucket,
  type AnalyzeRowsPage,
  type FoodRow,
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
 *
 * The drill-down panel below the charts ships search inside the
 * bucket (auto/semantic/simple), column-header sort, and a
 * streaming NDJSON/CSV export — all flowing through the same
 * /v1/analyze/.../rows + .../rows/export endpoints.
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
    caption: 'Where does the catalog cluster on price? Numeric bucket on price_cents — break points at $5/$10/$15/$20/$30/$50/$100.',
    shape: 'line',
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
    caption: 'Total units on hand. Cell area = each category’s share of total stock — top 10.',
    shape: 'treemap',
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

interface DrillSelection {
  spec: AnalysisSpec
  bucketKey: string
  bucketLabel: string
}

export default function AnalyzePage() {
  const [bandId, setBandId] = useState<string>('all')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [drill, setDrill] = useState<DrillSelection | null>(null)

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
              })
            }
          />
        ))}
      </section>

      {drill ? (
        <DrillPanel drill={drill} onClose={closeDrill} />
      ) : (
        <HintBanner />
      )}

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

/* ── HintBanner ───────────────────────────────────────────── */

/**
 * Magical "click something" nudge that lives where the drill panel will
 * eventually render. Pulsing double-chevron-up points at the chart grid
 * above so the eye knows where to go before the cursor does.
 */
function HintBanner() {
  return (
    <section className="hint">
      <div className="hint-chevrons" aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 11 12 6 7 11" />
          <polyline points="17 18 12 13 7 18" />
        </svg>
      </div>
      <div className="hint-text">
        <strong>Try clicking a chart segment above</strong>
        <span className="hint-sub">drill, search inside, sort, export</span>
      </div>

      <style jsx>{`
        .hint {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.95rem 1.1rem;
          margin-bottom: 1.5rem;
          background: linear-gradient(
            135deg,
            rgba(16, 185, 129, 0.08) 0%,
            rgba(52, 211, 153, 0.04) 100%
          );
          border: 1px solid rgba(16, 185, 129, 0.35);
          border-radius: 12px;
          color: var(--text);
        }
        .hint-chevrons {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #10b981;
          animation: chevron-pulse 1.4s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes chevron-pulse {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.55;
          }
          50% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .hint-chevrons {
            animation: none;
            opacity: 0.85;
          }
        }
        .hint-text {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          font-size: 0.92rem;
          line-height: 1.35;
        }
        .hint-text strong {
          color: var(--text);
          font-weight: 600;
          letter-spacing: -0.005em;
        }
        .hint-sub {
          color: var(--text-dim);
          font-size: 0.8rem;
        }
      `}</style>
    </section>
  )
}

/* ── DrillPanel ───────────────────────────────────────────── */

interface DrillPanelProps {
  drill: DrillSelection
  onClose: () => void
}

const PAGE_LIMIT = 25

type SortDir = 'asc' | 'desc'
type SortKey = 'name' | 'brand' | 'category' | 'price_cents' | 'inventory'
type SearchMode = 'auto' | 'semantic' | 'simple'
type ExportFormat = 'ndjson' | 'csv'

interface DrillData {
  rows: FoodRow[]
  cursor: string | null
  hasMore: boolean
  total: number
  loading: boolean
  loadingMore: boolean
  error: string | null
  /** Echoed by the server — the concrete mode the engine ran. */
  searchModeResolved: string | null
}

const EMPTY_DRILL_DATA: DrillData = {
  rows: [],
  cursor: null,
  hasMore: false,
  total: 0,
  loading: true,
  loadingMore: false,
  error: null,
  searchModeResolved: null,
}

const SEARCH_MODES: Array<{ id: SearchMode; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'semantic', label: 'Semantic' },
  { id: 'simple', label: 'Substring' },
]

const SORT_COLUMNS: Array<{ id: SortKey; label: string; align?: 'right' }> = [
  { id: 'name', label: 'Name' },
  { id: 'brand', label: 'Brand' },
  { id: 'category', label: 'Category' },
  { id: 'price_cents', label: 'Price', align: 'right' },
  { id: 'inventory', label: 'Stock', align: 'right' },
]

/**
 * Wrap every case-insensitive match of `query` inside `text` with a `<mark>`.
 * Matches every occurrence (not just the first) so users see "tomato" lit
 * up everywhere it appears in name + description.
 *
 * Returns the original string when there's no query — keeps the React tree
 * cheap on the common no-search drill view. Escapes regex metacharacters in
 * the query so user input like `(Cento)` doesn't blow up the matcher.
 */
function highlightAll(text: string | null | undefined, query: string): React.ReactNode {
  if (!text) return text ?? null
  const q = query.trim()
  if (!q) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped, 'gi')
  const parts: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(
      <mark key={`m-${i}`} className="hl">
        {m[0]}
      </mark>,
    )
    last = m.index + m[0].length
    i += 1
    // Safety against zero-width matches if escaping ever fails.
    if (m.index === re.lastIndex) re.lastIndex += 1
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? <>{parts}</> : text
}

function DrillPanel({ drill, onClose }: DrillPanelProps) {
  const [data, setData] = useState<DrillData>(EMPTY_DRILL_DATA)

  // ── Search state. `searchInput` is what the user is typing; `search` is
  // the debounced value that actually hits the API. 250ms is short enough
  // that the demo feels instant but long enough to skip the noise of every
  // keystroke roundtripping to Postgres.
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('auto')

  // ── Sort state. Default null = server-default (PK asc).
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null)

  // ── Export state. Drives the inline progress label + truncation note.
  const [exportState, setExportState] = useState<{
    running: boolean
    rowsExported: number
    truncated: boolean
    error: string | null
  }>({ running: false, rowsExported: 0, truncated: false, error: null })
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  // dataRef + listRef + sentinelRef + inFlightRef per the original pattern —
  // see the surrounding comments below for what each one guards.
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])
  const listRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const inFlightRef = useRef(false)

  // Debounce the search input → search query that actually hits the API.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 250)
    return () => clearTimeout(handle)
  }, [searchInput])

  // Stable serialised form of the body the API call assembles. Used as a
  // dependency so the reset/refetch effect runs exactly when something
  // visible to the user actually changed.
  const orderByJson = useMemo(
    () => (sort ? JSON.stringify({ field: sort.key, dir: sort.dir }) : ''),
    [sort],
  )

  const buildBody = useCallback(
    (extras: Record<string, unknown>) => {
      const body: Record<string, unknown> = {
        bucketKey: drill.bucketKey,
        ...extras,
      }
      if (search) {
        body.search = search
        body.searchMode = searchMode
      }
      if (sort) {
        body.orderBy = { field: sort.key, dir: sort.dir }
      }
      return body
    },
    [drill.bucketKey, search, searchMode, sort],
  )

  // Reset + first-page fetch on every (bucketKey | search | searchMode | sort)
  // change. Also runs on mount.
  useEffect(() => {
    let cancelled = false
    inFlightRef.current = true
    setData({ ...EMPTY_DRILL_DATA })

    fetch(`${ANALYZE_URL}/${drill.spec.name}/rows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(buildBody({ limit: PAGE_LIMIT })),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
        }
        return (await res.json()) as AnalyzeRowsPage & {
          meta?: { searchMode?: string }
        }
      })
      .then((page) => {
        if (cancelled) return
        const cursor = page.cursor ?? null
        setData({
          rows: page.rows ?? [],
          cursor,
          hasMore: !!cursor,
          total: page.total ?? page.rows?.length ?? 0,
          loading: false,
          loadingMore: false,
          error: null,
          searchModeResolved: page.meta?.searchMode ?? null,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setData({
          ...EMPTY_DRILL_DATA,
          loading: false,
          error: err instanceof Error ? err.message : 'fetch failed',
        })
      })
      .finally(() => {
        if (!cancelled) inFlightRef.current = false
      })

    return () => {
      cancelled = true
    }
  }, [drill.bucketKey, drill.spec.name, search, searchMode, orderByJson, buildBody])

  // Append the next page. The synchronous in-flight guard + cursor capture
  // happen BEFORE any state setter so React (incl. StrictMode) cannot
  // double-fire the fetch. Setters only update state, never trigger I/O.
  const fetchMore = useCallback(() => {
    if (inFlightRef.current) return
    const cur = dataRef.current
    if (!cur.hasMore || !cur.cursor || cur.loading || cur.loadingMore) return
    inFlightRef.current = true
    const cursorAtRequest = cur.cursor
    setData((prev) => ({ ...prev, loadingMore: true }))

    void (async () => {
      try {
        const res = await fetch(`${ANALYZE_URL}/${drill.spec.name}/rows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify(buildBody({ limit: PAGE_LIMIT, cursor: cursorAtRequest })),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
        }
        const page = (await res.json()) as AnalyzeRowsPage
        setData((prev) => {
          // Defense-in-depth: even if a duplicate request slipped past the
          // in-flight guard (or the bridge returned overlapping rows under
          // a write), filter ids we've already rendered.
          const seen = new Set(prev.rows.map((r) => r.id))
          const fresh = (page.rows ?? []).filter((r) => !seen.has(r.id))
          const nextCursor = page.cursor ?? null
          return {
            ...prev,
            rows: [...prev.rows, ...fresh],
            cursor: nextCursor,
            hasMore: !!nextCursor,
            loadingMore: false,
            error: null,
          }
        })
      } catch (err) {
        setData((prev) => ({
          ...prev,
          loadingMore: false,
          error: err instanceof Error ? err.message : 'fetch failed',
        }))
      } finally {
        inFlightRef.current = false
      }
    })()
  }, [drill.spec.name, buildBody])

  // Observe the sentinel — when it scrolls into view inside the list's
  // internal scroll container, trigger fetchMore. Scoping `root` to the
  // list itself means scrolling within the list (not the page) advances
  // pagination — the magical "drag the bottom" feel.
  useEffect(() => {
    if (!data.hasMore || data.loading || data.error) return
    const node = sentinelRef.current
    const root = listRef.current
    if (!node || !root) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) fetchMore()
      },
      { root, rootMargin: '120px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [data.hasMore, data.loading, data.error, fetchMore])

  const onSortClick = useCallback((key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null // third click clears sort
    })
  }, [])

  const startExport = useCallback(
    async (format: ExportFormat) => {
      setExportMenuOpen(false)
      setExportState({ running: true, rowsExported: 0, truncated: false, error: null })
      try {
        const result = await streamingDownload({
          url: `${ANALYZE_URL}/${drill.spec.name}/rows/export`,
          body: buildBody({ format }),
          format,
          filenameBase: `${drill.spec.name}.${slugify(drill.bucketLabel)}`,
          authHeader: `Bearer ${API_KEY}`,
          onProgress: (rows) =>
            setExportState((prev) => (prev.running ? { ...prev, rowsExported: rows } : prev)),
        })
        setExportState({
          running: false,
          rowsExported: result.rowsExported,
          truncated: result.truncated,
          error: null,
        })
      } catch (err) {
        setExportState({
          running: false,
          rowsExported: 0,
          truncated: false,
          error: err instanceof Error ? err.message : 'export failed',
        })
      }
    },
    [drill.bucketLabel, drill.spec.name, buildBody],
  )

  // Close the export menu on outside click.
  useEffect(() => {
    if (!exportMenuOpen) return
    const onDocClick = () => setExportMenuOpen(false)
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [exportMenuOpen])

  return (
    <section className="drill">
      <header className="drill-head">
        <div className="drill-head-text">
          <div className="drill-eyebrow">POST /v1/analyze/.../rows</div>
          <h3 className="drill-title">
            {drill.spec.title} → <span className="grad">{drill.bucketLabel}</span>
          </h3>
          <p className="drill-sub">
            Drill-down replays the predicate that produced this bucket — same RBAC, same
            mapping.
            {data.total ? ` ${data.total.toLocaleString()} matching rows` : ''}
            {data.loading ? ' · loading' : ''}
          </p>
        </div>
        <div className="drill-head-actions">
          <div className="drill-export" onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="export-btn"
              disabled={exportState.running}
              onClick={() => setExportMenuOpen((v) => !v)}
            >
              {exportState.running ? `Exporting… ${exportState.rowsExported.toLocaleString()}` : 'Export ▾'}
            </button>
            {exportMenuOpen ? (
              <div className="export-menu">
                <button type="button" onClick={() => startExport('ndjson')}>
                  NDJSON
                </button>
                <button type="button" onClick={() => startExport('csv')}>
                  CSV
                </button>
              </div>
            ) : null}
          </div>
          <button className="drill-close" onClick={onClose} type="button" aria-label="Close drill panel">
            ✕
          </button>
        </div>
      </header>

      <div className="drill-search">
        <input
          type="search"
          placeholder="Search inside this bucket…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <div className="search-modes">
          {SEARCH_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mode-pill ${searchMode === m.id ? 'on' : ''}`}
              onClick={() => setSearchMode(m.id)}
            >
              {m.label}
            </button>
          ))}
          {data.searchModeResolved && search ? (
            <span className="search-resolved">
              ran as <code>{data.searchModeResolved}</code>
            </span>
          ) : null}
        </div>
      </div>

      {exportState.error ? (
        <div className="drill-toast err">Export failed: {exportState.error}</div>
      ) : !exportState.running && exportState.rowsExported > 0 ? (
        <div className={`drill-toast ${exportState.truncated ? 'warn' : 'ok'}`}>
          Exported {exportState.rowsExported.toLocaleString()} rows
          {exportState.truncated ? ' — truncated at the tier cap.' : '.'}
        </div>
      ) : null}

      {data.error ? (
        <div className="drill-err">{data.error}</div>
      ) : (
        <>
          <div className="sort-header" role="row">
            {SORT_COLUMNS.map((col) => {
              const active = sort?.key === col.id
              const dirChar = active ? (sort?.dir === 'asc' ? '↑' : '↓') : ''
              return (
                <button
                  key={col.id}
                  type="button"
                  role="columnheader"
                  className={`sort-cell ${col.id} ${active ? 'on' : ''} ${col.align === 'right' ? 'r' : ''}`}
                  onClick={() => onSortClick(col.id)}
                >
                  {col.label} {dirChar}
                </button>
              )
            })}
          </div>
          {data.rows.length > 0 ? (
            <div ref={listRef} className="drill-grid" role="rowgroup">
              {data.rows.map((r) => (
                <div key={r.id} className="drill-row" role="row">
                  <div className="cell name">
                    <div className="cell-title">{highlightAll(r.name, search)}</div>
                    {r.description ? (
                      <div className="cell-desc">{highlightAll(r.description, search)}</div>
                    ) : null}
                  </div>
                  <div className="cell brand">{r.brand ?? '—'}</div>
                  <div className="cell category">{r.category ?? '—'}</div>
                  <div className="cell price r mono">
                    ${(r.price_cents ?? 0) / 100}
                  </div>
                  <div className="cell stock r mono">{r.inventory ?? 0}</div>
                </div>
              ))}
              {data.hasMore ? (
                <div ref={sentinelRef} className="drill-sentinel" role="row">
                  {data.loadingMore ? 'Loading more…' : ''}
                </div>
              ) : (
                <div className="drill-end" role="row">
                  — end of rows —
                </div>
              )}
            </div>
          ) : data.loading ? null : (
            <div className="drill-empty">No rows match.</div>
          )}
        </>
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
        .drill-head-text {
          min-width: 0;
        }
        .drill-head-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
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
        .drill-export {
          position: relative;
        }
        .export-btn {
          background: var(--panel-2);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          font-size: 0.78rem;
          font-family: var(--mono);
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: border-color 140ms, color 140ms;
        }
        .export-btn:hover:not(:disabled) {
          border-color: var(--purple);
          color: white;
        }
        .export-btn:disabled {
          opacity: 0.7;
          cursor: progress;
        }
        .export-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 4px);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.25rem;
          display: flex;
          flex-direction: column;
          min-width: 110px;
          box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.5);
          z-index: 5;
        }
        .export-menu button {
          background: transparent;
          border: 0;
          color: var(--text);
          font-size: 0.82rem;
          padding: 0.45rem 0.6rem;
          border-radius: 6px;
          text-align: left;
          font-family: var(--mono);
          cursor: pointer;
        }
        .export-menu button:hover {
          background: var(--panel-2);
          color: white;
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
        .drill-search {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 0.85rem;
        }
        .drill-search input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.88rem;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-family: inherit;
          transition: border-color 140ms;
        }
        .drill-search input:focus {
          outline: none;
          border-color: var(--purple);
        }
        .search-modes {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          flex-wrap: wrap;
        }
        .mode-pill {
          font-family: var(--mono);
          font-size: 0.68rem;
          padding: 0.25rem 0.6rem;
          border-radius: 999px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          color: var(--text-dim);
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: border-color 140ms, color 140ms, background 140ms;
        }
        .mode-pill:hover {
          color: var(--text);
          border-color: rgba(139, 92, 246, 0.5);
        }
        .mode-pill.on {
          background: rgba(139, 92, 246, 0.18);
          border-color: rgba(139, 92, 246, 0.55);
          color: white;
        }
        .search-resolved {
          font-family: var(--mono);
          font-size: 0.68rem;
          color: var(--text-fade);
          margin-left: 0.4rem;
        }
        .search-resolved code {
          color: var(--gold);
          background: rgba(255, 209, 102, 0.08);
          padding: 0.1em 0.35em;
          border-radius: 4px;
        }
        .drill-toast {
          padding: 0.45rem 0.65rem;
          border-radius: 6px;
          font-size: 0.78rem;
          margin-bottom: 0.6rem;
          font-family: var(--mono);
          letter-spacing: 0.02em;
        }
        .drill-toast.ok {
          color: #34d399;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .drill-toast.warn {
          color: var(--gold);
          background: rgba(255, 209, 102, 0.08);
          border: 1px solid rgba(255, 209, 102, 0.3);
        }
        .drill-toast.err {
          color: var(--pink);
          background: rgba(244, 114, 182, 0.08);
          border: 1px solid rgba(244, 114, 182, 0.3);
        }

        /* ── 4-column grid ── */
        .sort-header {
          display: grid;
          grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 1fr) 5rem 4rem;
          gap: 0.5rem;
          padding: 0.4rem 0.7rem;
          border-bottom: 1px solid var(--border);
          margin-bottom: 0.4rem;
          position: sticky;
          top: 0;
          background: var(--panel);
          z-index: 1;
        }
        .sort-cell {
          background: transparent;
          border: 0;
          color: var(--text-dim);
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 600;
          text-align: left;
          padding: 0.2rem 0;
          cursor: pointer;
          white-space: nowrap;
          transition: color 140ms;
        }
        .sort-cell.r {
          text-align: right;
        }
        .sort-cell:hover {
          color: var(--text);
        }
        .sort-cell.on {
          color: var(--gold);
        }
        .drill-grid {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          max-height: 60vh;
          overflow-y: auto;
        }
        .drill-row {
          display: grid;
          grid-template-columns: minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 1fr) 5rem 4rem;
          gap: 0.5rem;
          padding: 0.55rem 0.7rem;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 0.85rem;
          align-items: center;
        }
        .cell {
          color: var(--text-dim);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cell.name {
          color: var(--text);
          font-weight: 500;
          white-space: normal;
          min-width: 0;
        }
        .cell-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cell-desc {
          margin-top: 0.1rem;
          font-size: 0.74rem;
          font-weight: 400;
          color: var(--text-fade);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .hl {
          background: rgba(217, 178, 92, 0.22);
          color: var(--gold);
          padding: 0 1px;
          border-radius: 2px;
        }
        .cell.r {
          text-align: right;
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
        .drill-sentinel {
          padding: 0.65rem 0;
          text-align: center;
          font-size: 0.78rem;
          color: var(--text-fade);
          font-family: var(--mono);
          letter-spacing: 0.04em;
          min-height: 1rem;
        }
        .drill-end {
          padding: 0.65rem 0;
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-fade);
          letter-spacing: 0.04em;
        }

        /* ── Mobile fallback: collapse to stacked rows + Sort menu ── */
        @media (max-width: 640px) {
          .sort-header {
            display: none;
          }
          .drill-row {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.2rem;
          }
          .cell.r {
            text-align: left;
          }
        }
      `}</style>
    </section>
  )
}

/* ── Streaming download helper ─────────────────────────────────
 *
 * Inline mini-version of @semilayer/console's streaming-export.ts.
 * Demo lives outside the monorepo, so we don't share code with
 * Console — we re-derive the small bits we need: drain the stream
 * with a Reader, count rows by quote-aware newlines so progress
 * matches reality, read the trailer where the runtime exposes it,
 * fall back to "rows hit the cap" when it doesn't.
 *
 * Aborts aren't surfaced by the demo (no cancel button on this
 * surface — the Console covers that path); a fresh export request
 * still wins because the previous fetch's `setExportState` only
 * fires after `await result`, and `setExportState({running:true})`
 * resets first.
 * ───────────────────────────────────────────────────────────── */

interface StreamingDownloadOpts {
  url: string
  body: Record<string, unknown>
  format: ExportFormat
  filenameBase: string
  authHeader: string
  onProgress?: (rows: number) => void
}

async function streamingDownload(opts: StreamingDownloadOpts): Promise<{
  rowsExported: number
  truncated: boolean
}> {
  const res = await fetch(opts.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: opts.authHeader,
    },
    body: JSON.stringify(opts.body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const maxRowsHeader = res.headers.get('x-semilayer-export-max-rows')
  const maxRows = maxRowsHeader ? Number(maxRowsHeader) : null

  if (!res.body) {
    const blob = await res.blob()
    saveBlob(blob, `${opts.filenameBase}.${opts.format}`)
    return { rowsExported: 0, truncated: false }
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let rowCount = 0
  const counter = makeRowCounter(opts.format)
  const decoder = new TextDecoder('utf-8')

  while (true) {
    const { done, value } = await reader.read()
    if (value) {
      chunks.push(value)
      rowCount += counter.feed(decoder.decode(value, { stream: true }))
      opts.onProgress?.(rowCount)
    }
    if (done) {
      const tail = decoder.decode()
      if (tail.length > 0) rowCount += counter.feed(tail)
      rowCount += counter.flush()
      break
    }
  }

  let truncated = false
  type ResponseWithTrailer = Response & { trailer?: Promise<Headers> }
  const r = res as unknown as ResponseWithTrailer
  if (r.trailer) {
    try {
      const trailers = await r.trailer
      if (trailers.get('x-semilayer-export-truncated') === 'true') truncated = true
    } catch {
      // trailers are advisory
    }
  }
  if (!truncated && maxRows !== null && rowCount >= maxRows) truncated = true

  const blob = new Blob(chunks as BlobPart[], {
    type: opts.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/x-ndjson;charset=utf-8',
  })
  saveBlob(blob, `${opts.filenameBase}.${opts.format}`)
  opts.onProgress?.(rowCount)
  return { rowsExported: rowCount, truncated }
}

function saveBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

interface RowCounter {
  feed(chunk: string): number
  flush(): number
}

/**
 * Quote-aware row counter — same posture as the Console helper. CSV cells
 * with embedded `\n` are RFC-4180-quoted, so naive `split('\n')` overcounts
 * rows whenever data contains descriptions or addresses. NDJSON's escapes
 * are JSON.stringify's responsibility so the in-quote branch never trips,
 * and the same code path works for both formats.
 */
function makeRowCounter(format: ExportFormat): RowCounter {
  let inQuote = false
  let pendingChar = ''
  let csvHeaderSeen = format !== 'csv'
  let rowHasContent = false

  function consumeRowEnd(): number {
    if (!rowHasContent) return 0
    rowHasContent = false
    if (!csvHeaderSeen && format === 'csv') {
      csvHeaderSeen = true
      return 0
    }
    return 1
  }

  return {
    feed(chunk: string): number {
      if (chunk.length === 0) return 0
      let added = 0
      const text = pendingChar + chunk
      pendingChar = ''
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]!
        if (format === 'csv' && ch === '"') {
          if (inQuote) {
            if (i + 1 >= text.length) {
              pendingChar = ch
              break
            }
            if (text[i + 1] === '"') {
              i++
              rowHasContent = true
              continue
            }
            inQuote = false
          } else {
            inQuote = true
          }
          rowHasContent = true
          continue
        }
        if ((ch === '\n' || ch === '\r') && !inQuote) {
          if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++
          added += consumeRowEnd()
          continue
        }
        rowHasContent = true
      }
      return added
    },
    flush(): number {
      if (pendingChar) {
        if (pendingChar === '"' && inQuote) inQuote = false
        rowHasContent = true
        pendingChar = ''
      }
      return consumeRowEnd()
    },
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'bucket'
}
