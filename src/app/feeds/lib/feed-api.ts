/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Bare-fetch helpers for the feed demo — no SDK, no Beam client, just
 * plain HTTP so the file doubles as a reading exercise. Everything the
 * demo sends to SemiLayer is on this page.
 *
 * Auth is a publishable key. Safe to ship in the browser: read-only,
 * scoped to whatever the lens's `rules.feed.<name>` permits.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://api.semilayer.com'
/**
 * The lens the feed demo calls. Defaults to `food_products` to match the
 * existing `/` search+query demo. Override via env when running against a
 * different lens (e.g. the `recipes` lens from example-stack).
 */
export const FEED_LENS = process.env.NEXT_PUBLIC_FEEDS_LENS ?? 'food_products'
export const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? ''

/**
 * Metadata shape is intentionally open: we only name fields the card
 * *might* render. The feed demo is metadata-shape-agnostic so the same
 * code path works against `food_products`, `recipes`, or any future lens.
 */
export type FeedItemMeta = {
  id: number | string
  // Human title — checked in card render in priority order.
  title?: string
  name?: string
  // Subtitle / category line.
  brand?: string
  category?: string
  cuisine?: string
  // Descriptive blurb.
  description?: string
  // Free-form tags / countries (both rendered as chips if present).
  tags?: string[]
  countries?: string[]
  // Numeric display.
  price_cents?: number
  prep_time_minutes?: number
  // Boolean-y flags shown as chips.
  vegetarian?: boolean
  [key: string]: unknown
}

export interface FeedItem {
  id: string
  sourceRowId: string
  content: string | null
  metadata: FeedItemMeta
  score: number
  rank: number
}

export interface FeedPage {
  items: FeedItem[]
  cursor: string | null
  evolved: boolean
  meta: {
    lens: string
    name: string
    pageSize: number
    count: number
    durationMs: number
  }
}

export interface FeedRequestBody {
  context?: Record<string, unknown>
  cursor?: string
  pageSize?: number
}

/** POST /v1/feed/:lens/:name — one page. */
export async function fetchFeedPage(
  feedName: string,
  body: FeedRequestBody,
): Promise<FeedPage> {
  const res = await fetch(`${API_BASE}/v1/feed/${FEED_LENS}/${feedName}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`feed ${feedName} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<FeedPage>
}

/** POST /v1/query/:lens — single-row lookup for the detail page. */
export async function fetchRecord(id: number | string): Promise<FeedItemMeta | null> {
  const res = await fetch(`${API_BASE}/v1/query/${FEED_LENS}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ where: { id }, limit: 1 }),
  })
  if (!res.ok) throw new Error(`query failed: ${res.status}`)
  const body = (await res.json()) as { rows: FeedItemMeta[] }
  return body.rows[0] ?? null
}

// ── Rendering helpers (shared between list + detail pages) ────

export function displayTitle(m: FeedItemMeta): string {
  return (
    (typeof m.title === 'string' && m.title) ||
    (typeof m.name === 'string' && m.name) ||
    `#${String(m.id)}`
  )
}

export function displaySubtitle(m: FeedItemMeta): string | null {
  return (
    (typeof m.brand === 'string' && m.brand) ||
    (typeof m.category === 'string' && m.category) ||
    (typeof m.cuisine === 'string' && m.cuisine) ||
    null
  )
}

export function displayChips(m: FeedItemMeta): string[] {
  const chips: string[] = []
  if (m.vegetarian) chips.push('veg')
  if (Array.isArray(m.tags)) chips.push(...m.tags.slice(0, 3).map((t) => String(t)))
  if (Array.isArray(m.countries)) chips.push(...m.countries.slice(0, 2).map((c) => String(c)))
  return chips
}
