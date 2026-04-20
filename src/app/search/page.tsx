import { SiteHeader } from '../_components/header'
import { SearchPanel } from '../_components/search-panel'
import { HowItWorks } from '../_components/how-it-works'
import { BottomNote } from '../_components/bottom-note'

export default function SearchModePage() {
  return (
    <main className="shell">
      <SiteHeader />
      <section className="mode-intro">
        <h1 className="hero-title">
          <span className="grad">Semantic</span> search
        </h1>
        <p className="hero-sub">
          Ask in plain English &mdash; &ldquo;spicy ramen&rdquo;, &ldquo;something sweet for
          breakfast&rdquo;, &ldquo;organic oat milk&rdquo;. The layer returns the products that
          <em> mean</em> what you asked, not the ones that happen to share your keywords.
        </p>
      </section>
      <SearchPanel />
      <HowItWorks mode="search" />
      <BottomNote />
    </main>
  )
}
