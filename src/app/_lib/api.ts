/**
 * Shared constants + shapes for the demo's /search + /query + /feeds
 * pages. All of them call SemiLayer with a publishable key over plain
 * fetch() — no SDK.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://api.semilayer.com'
export const LENS = process.env.NEXT_PUBLIC_LENS ?? 'food_products'
export const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? ''

export const SEARCH_URL = `${API_BASE}/v1/search/${LENS}`
export const QUERY_URL = `${API_BASE}/v1/query/${LENS}`
export const SIMILAR_URL = `${API_BASE}/v1/similar/${LENS}`
export const ANALYZE_URL = `${API_BASE}/v1/analyze/${LENS}`

export const PAGE_SIZE = 10

/* ── formatting ──────────────────────────────────────────── */

export function formatSeconds(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.ceil(ms / 100)) / 10}s`
  return `${Math.ceil(ms / 1000)}s`
}

export const TAG_PALETTE = ['purple', 'blue', 'green', 'gold', 'pink'] as const

export function tagColor(tag: string): (typeof TAG_PALETTE)[number] {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) | 0
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length]!
}

export function prettyTag(tag: string): string {
  return tag.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ── data shapes ─────────────────────────────────────────── */

export interface FoodRow {
  id: number
  code: string
  name: string
  brand: string | null
  category: string | null
  description: string | null
  quantity: string | null
  tags: string[]
  countries: string[]
  price_cents: number | null
  inventory: number | null
}

export interface QueryResponse {
  rows: FoodRow[]
  meta: { lens: string; total: number; count: number; durationMs: number }
}

export interface SearchHit {
  id: string
  sourceRowId: string
  content: string | null
  metadata: FoodRow
  score: number
}

export interface SearchResponse {
  results: SearchHit[]
  meta: { lens: string; query: string; mode: string; count: number; durationMs: number }
}

export interface SimilarResponse {
  results: SearchHit[]
  meta: { lens: string; sourceId: string; count: number; durationMs: number }
}

/* ── analyze shapes ──────────────────────────────────────── */

export interface AnalyzeBucket {
  dims: Record<string, unknown>
  measures: Record<string, number>
  count: number
  bucketKey: string
}

export interface AnalyzeResponse {
  kind: 'metric' | 'funnel' | 'cohort'
  buckets: AnalyzeBucket[]
  meta: {
    strategy: 'pushdown' | 'streaming' | 'hybrid'
    bridgesInvolved: string[]
    estimatedCost: { rowsScanned: number }
    durationMs: number
    cached?: boolean
    approximate?: boolean
  }
}
