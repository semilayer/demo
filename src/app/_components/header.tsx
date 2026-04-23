'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SiteHeader() {
  const pathname = usePathname() ?? '/'
  const is = (prefix: string) =>
    prefix === '/' ? pathname === '/' : pathname.startsWith(prefix)
  return (
    <header className="header">
      <Link href="/" className="brand brand-link">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="SemiLayer" width={44} height={44} className="brand-mark" />
        <div>
          <div className="brand-name">SemiLayer · Live Demo</div>
          <div className="brand-tag">ask anything. no backend.</div>
        </div>
      </Link>
      <nav className="nav">
        <Link href="/search" className={is('/search') ? 'active' : ''}>Search</Link>
        <Link href="/query" className={is('/query') ? 'active' : ''}>Query</Link>
        <Link href="/similar" className={is('/similar') ? 'active' : ''}>Similar</Link>
        <Link href="/feeds" className={is('/feeds') ? 'active' : ''}>Feeds</Link>
        <span className="nav-sep" aria-hidden>·</span>
        <a href="https://semilayer.com">semilayer.com</a>
        <a href="https://semilayer.dev">Docs</a>
        <a href="https://github.com/semilayer/demo">Source</a>
      </nav>
    </header>
  )
}
