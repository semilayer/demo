import { SiteHeader } from '../_components/header'
import { QueryPanel } from '../_components/query-panel'
import { HowItWorks } from '../_components/how-it-works'
import { BottomNote } from '../_components/bottom-note'

export default function QueryModePage() {
  return (
    <main className="shell">
      <SiteHeader />
      <section className="mode-intro">
        <h1 className="hero-title">
          <span className="grad">Typed</span> query
        </h1>
        <p className="hero-sub">
          Ask in shape &mdash; filters, orderBy, limit. The same lens, same key,
          same latency &mdash; but now you&apos;re driving the table directly. Useful
          for browse grids, admin views, structured pipelines.
        </p>
      </section>
      <QueryPanel />
      <HowItWorks mode="query" />
      <BottomNote />
    </main>
  )
}
