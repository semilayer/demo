<p align="right">
  <img src="https://semilayer.com/icon-192.png" alt="SemiLayer" width="120" />
  <br />
  <strong>SemiLayer · Live Demo</strong>
</p>

<p align="right">
A single-page demo of SemiLayer over plain HTTP &mdash; ask in words, ask in shape, served at <a href="https://demo.semilayer.com">demo.semilayer.com</a>. No SDK. No backend of our own. Just <code>fetch()</code>.
</p>

---

## What this is

The source for **demo.semilayer.com**. One page, two calls, one key.

| Surface | Endpoint | Auth |
|---|---|---|
| **Ask in words** | `POST /v1/search/products` | `pk_` key |
| **Ask in shape** | `POST /v1/query/products` | `pk_` key |

Both calls run against the live **api.semilayer.com**, against a `products`
lens declared once and left alone. Everything you see on the page is the
literal response &mdash; open the network tab, copy the curl, you have the
whole integration.

## Why no SDK?

The point of the demo is to show there is *nothing else*. SemiLayer has a
typed client for production codebases, but the transport underneath is just
JSON over HTTPS &mdash; any language, any runtime, two POSTs.

## Run it locally

```bash
pnpm install
cp .env.example .env  # paste your pk_ key
pnpm dev
# → http://localhost:3400
```

You don't need a database, a worker, or any SemiLayer service running
locally. The demo talks to the public **api.semilayer.com** exactly the way
a real customer's app would.

## Configuration

All config is `NEXT_PUBLIC_*` env vars baked at build time. They are
checked in on purpose &mdash; **publishable keys are safe to expose**. They
are read-only, scoped to one environment, and gated by each lens's `rules`
config server-side.

| Env var | Default |
|---|---|
| `NEXT_PUBLIC_API_BASE` | `https://api.semilayer.com` |
| `NEXT_PUBLIC_LENS` | `products` |
| `NEXT_PUBLIC_API_KEY` | `pk_…` |

### About the URL shape

The demo hits `/v1/search/:lens` and `/v1/query/:lens`. That is the whole
shape. The key encodes the scope; you will not find org / project / env
segments anywhere in the path.

## Deploying

Pushes to `main` run a workflow that builds the static site and ships it to
the CDN behind `demo.semilayer.com`. The deploy identity is managed through
federated OIDC &mdash; no static credentials in the repo.

## Project layout

```
src/
  app/
    layout.tsx     ← html shell
    page.tsx       ← THE entire demo lives here
    globals.css    ← all styles
.env               ← public config (committed)
```

If you can't fit a feature into `page.tsx`, you're overcomplicating the demo.

## Links

- [semilayer.com](https://semilayer.com) &mdash; the project
- [semilayer.dev](https://semilayer.dev) &mdash; docs

## License

MIT
