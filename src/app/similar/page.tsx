import { SiteHeader } from '../_components/header'
import { SimilarPanel } from '../_components/similar-panel'
import { HowItWorks } from '../_components/how-it-works'
import { BottomNote } from '../_components/bottom-note'

export default function SimilarModePage() {
  return (
    <main className="shell feeds-shell">
      <SiteHeader />
      <section className="mode-intro">
        <h1 className="hero-title">
          <span className="grad">Similar</span> — find neighbors
        </h1>
        <p className="hero-sub">
          Pick any row; SemiLayer returns its nearest neighbors in embedding space.
          One SQL round-trip, <strong>zero embedding API calls</strong> — the seed
          already has a stored vector. Click any result to re-seed with it and
          chain through the neighborhood.
        </p>
      </section>
      <SimilarPanel />
      <HowItWorks mode="similar" />
      <BottomNote />
    </main>
  )
}
