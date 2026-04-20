/**
 * Rank-driven rainbow gradient.
 *
 * Why rank, not score: in the demo (and most real feeds) the numeric
 * scores on a single page cluster tightly — Latest's scores collapse
 * to one value when seed timestamps match, and Discover's cluster in a
 * narrow band too. If the gradient keys off score, every card ends up
 * in the same palette and the color carries no information.
 *
 * Keying off rank instead gives the gradient actual value: the feed's
 * own hierarchy becomes visible at a glance. #1 is hot (warm coral),
 * the last card on the page is cool (deep indigo), and every rank in
 * between walks a tasteful rainbow arc. When likes rearrange Discover,
 * the items that rose to the top literally turn hot — the re-ranking
 * story is legible without reading the `#N` chip.
 *
 * Each call to a feed endpoint re-paints its own rainbow (rank restarts
 * at 1), so paging "Load more" creates a clean visual seam between
 * page 1 and page 2.
 *
 * Record id still nudges the 2nd + 3rd gradient stops by a few degrees
 * so two cards at the same rank across sessions aren't pixel-identical;
 * the *primary* hue, the one you read, is pure rank.
 */

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Normalize rank to [0, 1] where 1 is the best (rank #1). */
export function normalizeRank(rank: number, pageSize: number): number {
  const n = Math.max(1, pageSize)
  if (n === 1) return 1
  const clamped = Math.max(1, Math.min(n, rank))
  return 1 - (clamped - 1) / (n - 1)
}

/**
 * Rank-driven three-stop gradient.
 *
 *   rank 1          →  warm coral (hue 10°)
 *   mid rank        →  pink / violet
 *   last rank       →  deep indigo (hue 235°)
 *
 * Saturation + lightness stay constant across ranks so the whole page
 * reads as a coherent palette. The rainbow arc avoids yellow/green
 * midband on purpose — white text stays readable across every card.
 */
export function cardGradient(seed: string, rank: number, pageSize: number): string {
  const t = normalizeRank(rank, pageSize)

  // 10° (warm coral) at the top → 235° (indigo) at the bottom.
  // Lerp through 130°-ish (rose/pink) for a tasteful mid-band.
  const baseHue = 10 + (235 - 10) * (1 - t)

  // Id-seeded offsets for the 2nd + 3rd gradient stops. Kept small so
  // the primary hue stays clearly rank-driven.
  const h = hashString(seed)
  const offset2 = 22 + (h % 14) // 22–35°
  const offset3 = 48 + ((h >>> 3) % 14) // 48–61°
  const hue2 = (baseHue + offset2) % 360
  const hue3 = (baseHue + offset3) % 360

  const sat = 70
  const light = 52

  return `linear-gradient(135deg, hsl(${baseHue} ${sat}% ${light}%) 0%, hsl(${hue2} ${sat}% ${light}%) 50%, hsl(${hue3} ${sat}% ${light}%) 100%)`
}

/**
 * Content tones for the dark overlay. Warmer palettes (high rank) get
 * very slightly warmer text to hold the "hot" feel; cooler palettes
 * (bottom of the page) get cooler text to complete the mood.
 */
export function contentTone(rank: number, pageSize: number): { title: string; subtitle: string } {
  const t = normalizeRank(rank, pageSize)
  if (t > 0.66) return { title: '#fff5f0', subtitle: 'rgba(255, 240, 225, 0.80)' }
  if (t > 0.33) return { title: '#faf5ff', subtitle: 'rgba(243, 232, 255, 0.80)' }
  return { title: '#e0e7ff', subtitle: 'rgba(199, 210, 254, 0.78)' }
}
