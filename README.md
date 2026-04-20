<p align="right">
  <img src="https://semilayer.com/icon-192.png" alt="SemiLayer" width="120" />
  <br />
  <strong>SemiLayer · Live Demo</strong>
</p>

<p align="right">
Three modes. One lens. One publishable key. No SDK, no backend of our own — just <code>fetch()</code> to <a href="https://demo.semilayer.com">demo.semilayer.com</a>.
</p>

---

## What this is

The source for **demo.semilayer.com**. A 1M-row food-product catalog exposed
through a single `food_products` lens declared once and left alone. Every
surface below is plain HTTP against the same lens:

| Mode | Route | Endpoint | What it asks |
|---|---|---|---|
| **Semantic search** | `/search` | `POST /v1/search/food_products` | Ask in plain English — "organic oat milk", "spicy ramen". |
| **Typed query** | `/query` | `POST /v1/query/food_products` | Ask in shape — filters, `orderBy`, `limit`, `offset`. |
| **Feeds** | `/feeds` | `POST /v1/feed/food_products/:name` | Composed, live-evolving streams (Discover · Latest · relatedTo). |

The landing at `/` is a mode picker — three tiles, pick your surface.
Everything is a **static export**: no SSR, no server code in this repo.

## The three feeds

`/feeds` exercises three named feeds on one lens. Each is a config block
on the `food_products` lens's `facets.feed` map:

- **`discover`** — similarity (0.7) + recency (0.1). Similarity targets
  `context.liked_names`, which the demo ships from localStorage on every
  call. Like a few items, come back, watch the top fan out.
- **`latest`** — `candidates.from: 'recent'` + recency (1.0). Chronological.
  Same for every visitor. No personalization by design.
- **`relatedTo`** — opens when you click any card → `/feeds/detail?id=<id>`.
  Uses `similarity.against: { mode: 'recordVector' }`, so the seed is the
  clicked record's own stored embedding. Zero embedding API call. Cards in
  the related panel are themselves clickable; chain through indefinitely.

### Likes are localStorage-only

Tapping ♥ stores the record in `window.localStorage` and nothing else. On
the next fetch, `context.liked_names` carries the most-recent 50 liked
titles into `POST /v1/feed/food_products/discover`. The feed never reaches
back into any customer DB to record the interaction — that's the brand
line: **SemiLayer is the intelligence layer over your data, not a social
graph store.**

### What "like" does, and what it doesn't

Liking **does not** pin an item to #1. Similarity ranks *neighbors in
embedding space*, not the originals. If you like an olive oil, the next
Discover fetch floats other olive oils up; the specific bottle you liked
might or might not be at the top.

Liking **does not** affect Latest. Latest's config has no `similarity`
scorer — it only reads `updated_at`, so context is ignored. This is
intentional: Latest exists as a chronological baseline you can compare
Discover against. Want likes to tilt Latest? Add a small-weight similarity
scorer next to its recency block and it'll start reacting — but then
it's no longer "pure Latest," it's a fourth feed.

### Why all my Latest scores look identical

If every row in your lens shares the same `updated_at`, every row gets
the same recency score — and same score = same gradient color. That's
not a bug in the demo; it's a property of the seed data. Staggered ingest
timestamps (or a real production stream) immediately produce a varied
Latest. Discover gets varied scores even on identical timestamps because
its similarity scorer produces a different per-row value.

### The card gradient

Card colors are **score-driven**: indigo at low scores, walking through
violet and pink into warm coral at the top end. Two cards with scores
`0.3752` and `0.3759` land in the same palette (as intended — "close
scores → close colors"). The record id only nudges the 2nd + 3rd hue
stops by a few degrees so the grid feels varied instead of mechanical.
Score is shown numerically in the card's top-right so you can correlate
color ↔ number.

## Why no SDK?

The point of the demo is to show there is *nothing else*. SemiLayer has
a typed Beam client for production codebases (`@semilayer/client`,
`@semilayer/react`), but the transport underneath is just JSON over
HTTPS — any language, any runtime, three POSTs.

## Run it locally

```bash
pnpm install
cp .env.example .env  # paste your pk_ key
pnpm dev
# → http://localhost:3400
```

You don't need a database, a worker, or any SemiLayer service running
locally. The demo talks to the public **api.semilayer.com** exactly the
way a real customer's app would.

## Configuration

All config is `NEXT_PUBLIC_*` env vars baked at build time. They're checked
in on purpose — **publishable keys are safe to expose**. They're read-only,
scoped to one environment, and gated by each lens's `rules` config
server-side.

| Env var | Default |
|---|---|
| `NEXT_PUBLIC_API_BASE` | `https://api.semilayer.com` |
| `NEXT_PUBLIC_LENS` | `food_products` |
| `NEXT_PUBLIC_FEEDS_LENS` | falls back to `NEXT_PUBLIC_LENS` |
| `NEXT_PUBLIC_API_KEY` | `pk_…` |

### About the URL shape

Every call hits `/v1/<facet>/<lens>[/<name>]`. That's the whole URL
vocabulary. The key encodes org/project/env; you'll never see those
segments in the path.

## Deploying

Pushes to `main` run a workflow that builds the static site
(`next build` with `output: 'export'`) and ships it to the CDN behind
**demo.semilayer.com**. The deploy identity is managed through federated
OIDC — no static credentials in the repo. Dynamic routes aren't used
anywhere: the detail page at `/feeds/detail?id=<record-id>` reads the id
from `useSearchParams()` at runtime, so the entire site is prerenderable.

## Project layout

```
src/app/
  layout.tsx               ← html shell
  page.tsx                 ← landing: hero + three mode tiles
  globals.css              ← all app-chrome + card-frame styles
  _components/             ← shared header / footer / panels
  _lib/
    api.ts                 ← API_BASE, LENS, helpers, shapes
  search/page.tsx          ← semantic search surface
  query/page.tsx           ← typed query surface
  feeds/
    page.tsx               ← Discover + Latest tabs
    detail/page.tsx        ← /feeds/detail?id=… — relatedTo feed
    lib/
      feed-api.ts          ← fetchFeedPage, display helpers
      liked-storage.ts     ← useLikes() localStorage hook
      card-gradient.ts     ← score → gradient (pure)
```

**Style discipline**: the `feed-card*` frame lives in `globals.css` so
the skeleton renders styled on first paint (dev-mode styled-jsx
hydrates after HTML and flickers otherwise). Per-card gradients are
the only inline style — everything else is a class.

## Links

- [semilayer.com](https://semilayer.com) — the project
- [semilayer.dev](https://semilayer.dev) — docs
- [semilayer.dev/feeds](https://semilayer.dev/feeds) — feed config reference

## License

MIT
