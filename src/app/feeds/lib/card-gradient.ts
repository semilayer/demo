/**
 * Deterministic rainbow gradient per card. The hue is seeded from the
 * record id so a given product always renders with the same palette,
 * but the whole page still looks lively. The score modulates saturation
 * + opacity, so higher-ranked items glow brighter.
 *
 * When the score is low/zero (common when no signal pushes a record
 * above baseline), we fall back to a muted default rather than a flat
 * grey — the feed should feel alive even before a user interacts.
 */

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Compute a three-stop gradient string for use in `background-image`.
 * Hue pair chosen from the seed. `intensity` in [0, 1] sets saturation.
 */
export function cardGradient(seed: string, score: number): string {
  const h = hashString(seed)
  const hue1 = h % 360
  const hue2 = (hue1 + 55 + (h % 30)) % 360
  const hue3 = (hue2 + 40) % 360

  // Score-based intensity. Feed scores are often tiny (0.04 band in the
  // demo), so we amplify aggressively and floor at 0.55 so nothing is flat.
  const raw = Math.min(1, Math.max(0, score * 12))
  const intensity = 0.55 + raw * 0.45

  const sat = Math.round(55 + intensity * 30)   // 55–85
  const light = Math.round(48 + intensity * 6)  // 48–54

  return `linear-gradient(135deg, hsl(${hue1} ${sat}% ${light}%) 0%, hsl(${hue2} ${sat}% ${light}%) 50%, hsl(${hue3} ${sat}% ${light}%) 100%)`
}

/**
 * Returns high-contrast text tones for a given score. The card inner is a
 * dark translucent panel over the gradient, so the title can stay bright
 * while the subtitle dims slightly — enough to read, not enough to
 * compete with the rainbow behind it.
 */
export function contentTone(score: number): { title: string; subtitle: string } {
  // Score in demo tends to land around 0.04; rank-1 in a full scorer run
  // can reach 1.0. We pick bright+warm for the top end, cool+softer for
  // the long tail.
  const normalized = Math.min(1, Math.max(0, score * 12))
  if (normalized > 0.7) return { title: '#fffbeb', subtitle: 'rgba(255, 245, 235, 0.78)' }
  if (normalized > 0.4) return { title: '#f8fafc', subtitle: 'rgba(241, 245, 249, 0.78)' }
  return { title: '#e2e8f0', subtitle: 'rgba(203, 213, 225, 0.75)' }
}
