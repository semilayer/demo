import { API_BASE, LENS } from '../_lib/api'

const SEARCH_SNIPPET = `POST ${API_BASE}/v1/search/${LENS}
Authorization: Bearer pk_...
Content-Type: application/json

{
  "query": "dark chocolate with hazelnuts",
  "limit": 20
}`

const QUERY_SNIPPET = `POST ${API_BASE}/v1/query/${LENS}
Authorization: Bearer pk_...
Content-Type: application/json

{
  "where": { "brand": "Meijer", "price_cents": { "$lt": 500 } },
  "orderBy": { "field": "price_cents", "dir": "asc" },
  "limit": 10
}`

const FEED_SNIPPET = `POST ${API_BASE}/v1/feed/${LENS}/discover
Authorization: Bearer pk_...
Content-Type: application/json

{
  "context": { "liked_names": ["dark chocolate", "oat milk"] },
  "pageSize": 12
}`

const SIMILAR_SNIPPET = `POST ${API_BASE}/v1/similar/${LENS}
Authorization: Bearer pk_...
Content-Type: application/json

{
  "id": "42",
  "limit": 12
}`

const CONFIG_SNIPPET = `// one lens, every surface on this page.
food_products: {
  facets: {
    search:  { fields: ['name', 'description', 'brand', 'tags'] },
    similar: { fields: ['name', 'description', 'brand', 'tags'] },
    feed: {
      discover:  { /* similarity + recency */ },
      latest:    { /* pure recency */ },
      relatedTo: { /* recordVector seed */ },
    },
  },
  rules: {
    query:   'public',
    search:  'public',
    similar: 'public',
    feed:    { discover: 'public', latest: 'public', relatedTo: 'public' },
  },
}`

export function HowItWorks({ mode }: { mode: 'search' | 'query' | 'feed' | 'similar' }) {
  const snippet =
    mode === 'search'
      ? SEARCH_SNIPPET
      : mode === 'query'
        ? QUERY_SNIPPET
        : mode === 'similar'
          ? SIMILAR_SNIPPET
          : FEED_SNIPPET
  return (
    <section className="howto">
      <div className="howto-card">
        <h3>The entire integration</h3>
        <p>
          One publishable key. That&apos;s it &mdash; copy the call into curl, any
          fetch, any HTTP client. The key carries scope.
        </p>
        <pre className="code-block">{snippet}</pre>
      </div>
      <div className="howto-card">
        <h3>What the layer is doing</h3>
        <p>
          Somewhere behind this page a <code>food_products</code> lens was
          declared. SemiLayer took care of understanding it, indexing it, and
          keeping it fresh. You get one endpoint to ask in words, another to
          ask in shape, a third to compose a live feed. The data never moves.
        </p>
        <pre className="code-block">{CONFIG_SNIPPET}</pre>
      </div>
    </section>
  )
}
