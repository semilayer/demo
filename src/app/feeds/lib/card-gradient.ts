/**
 * Rainbow gradient driven primarily by score, with a small id-seeded
 * offset so identical-score cards don't look pixel-identical.
 *
 * Design principle: "close scores → close colors."
 *   - Two cards with scores 0.3752 and 0.3759 share the same warm palette.
 *   - A card at 0.04 is clearly cooler than one at 0.4.
 *   - The id's only role is to nudge the second + third hue stops a
 *     few degrees so the grid doesn't feel mechanical.
 *
 * Demo feed scores tend to cluster in [0.04, 0.5], so we amplify:
 *   score  →  hue
 *   0.00   →  220° (indigo)
 *   0.20   →  280° (violet)
 *   0.40   →  330° (pink)
 *   0.60+  →   20° (warm orange)
 *
 * Normalized via an easing curve so the mid-range (where most demo
 * scores land) gets a healthy spread rather than everything collapsing
 * to one hue.
 */

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Map a [0,∞) score into a [0,1] normalized position on the rainbow.
 * Exposed for tests; the gradient function consumes it to pick a hue.
 */
export function normalizeScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0
  // Amplify: demo scores cluster around 0.04..0.5. Map 0.5 → ~1, 0.04 → ~0.3.
  const raw = Math.min(1, Math.max(0, score * 2))
  // Ease-out-cubic for a pleasant spread in the busy mid-range.
  return 1 - Math.pow(1 - raw, 3)
}

/**
 * Score-driven three-stop gradient. The primary hue comes purely from
 * the score, so similar scores share a palette. The record id offsets
 * the second + third stops by a handful of degrees so the grid still
 * feels rich.
 */
export function cardGradient(seed: string, score: number): string {
  const t = normalizeScore(score)

  // Score walks the rainbow: cool → warm as quality rises.
  // Stay in a tasteful arc; avoid yellow (hard to read white on).
  // 220° (indigo) → 280° (violet) → 330° (pink) → 10° (warm coral)
  const baseHue = lerpHue(220, 380 /* = 20° going the warm way */, t) % 360

  // Id-seeded subtle stop offsets (within ±20°).
  const h = hashString(seed)
  const offset2 = 25 + (h % 18) // 25–42°
  const offset3 = 60 + ((h >>> 3) % 15) // 60–74°
  const hue1 = baseHue
  const hue2 = (baseHue + offset2) % 360
  const hue3 = (baseHue + offset3) % 360

  // Saturation + lightness also track score so rank-1 glows brighter.
  const sat = Math.round(55 + t * 25) // 55–80
  const light = Math.round(46 + t * 10) // 46–56

  return `linear-gradient(135deg, hsl(${hue1} ${sat}% ${light}%) 0%, hsl(${hue2} ${sat}% ${light}%) 50%, hsl(${hue3} ${sat}% ${light}%) 100%)`
}

/**
 * High-contrast text tones for the dark overlay that sits on top of the
 * gradient. Content is always readable — we bump brightness for warmer
 * (higher-score) cards because the cooler/dimmer cards need cooler text.
 */
export function contentTone(score: number): { title: string; subtitle: string } {
  const t = normalizeScore(score)
  if (t > 0.66) return { title: '#fff5f0', subtitle: 'rgba(255, 240, 225, 0.78)' }
  if (t > 0.33) return { title: '#faf5ff', subtitle: 'rgba(243, 232, 255, 0.78)' }
  return { title: '#e0e7ff', subtitle: 'rgba(199, 210, 254, 0.75)' }
}

/**
 * Shortest-path hue interpolation, with `to` allowed past 360° so the
 * caller can express "go the warm way" (220 → 20 → pass 360 → 380).
 */
function lerpHue(from: number, to: number, t: number): number {
  return from + (to - from) * t
}
