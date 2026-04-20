'use client'

import { useCallback, useEffect, useState } from 'react'
import { displayTitle, type FeedItemMeta } from './feed-api'

/**
 * Client-side "likes" — stored entirely in localStorage and passed back to
 * SemiLayer as `context.liked_names` / `context.liked_ids` on every feed
 * call. No server-side write, no API endpoint, no cross-user visibility.
 *
 * That's intentional: the feed evolves on THIS device based on what this
 * user just liked. Other users see whatever server-seeded engagement
 * signal the feed's config references — a separate mechanism.
 *
 * The cap on stored likes prevents the context payload from hitting the
 * 8 KB server-side limit. We keep the 50 most recent.
 */

const STORAGE_KEY = 'semilayer-demo:likes:v1'
const MAX_LIKES = 50

export interface LikedItem {
  id: number | string
  title: string
  likedAt: number // ms epoch
}

function readStorage(): LikedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (p): p is LikedItem =>
          !!p &&
          typeof p === 'object' &&
          ((p as LikedItem).id !== undefined) &&
          typeof (p as LikedItem).title === 'string',
      )
      .slice(0, MAX_LIKES)
  } catch {
    return []
  }
}

function writeStorage(next: LikedItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_LIKES)))
  } catch {
    // Storage full / private mode — ignore. The feed still works, just
    // without personalization persistence.
  }
}

export function useLikes(): {
  liked: LikedItem[]
  isLiked: (id: number | string) => boolean
  toggle: (m: FeedItemMeta) => void
  clear: () => void
  likedTitles: string[]
  likedIds: Array<number | string>
} {
  const [liked, setLiked] = useState<LikedItem[]>([])

  useEffect(() => {
    setLiked(readStorage())
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === STORAGE_KEY) setLiked(readStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const isLiked = useCallback(
    (id: number | string) => liked.some((l) => String(l.id) === String(id)),
    [liked],
  )

  const toggle = useCallback((m: FeedItemMeta) => {
    setLiked((cur) => {
      const exists = cur.find((l) => String(l.id) === String(m.id))
      const next = exists
        ? cur.filter((l) => String(l.id) !== String(m.id))
        : [{ id: m.id, title: displayTitle(m), likedAt: Date.now() }, ...cur]
      writeStorage(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    writeStorage([])
    setLiked([])
  }, [])

  return {
    liked,
    isLiked,
    toggle,
    clear,
    likedTitles: liked.map((l) => l.title),
    likedIds: liked.map((l) => l.id),
  }
}
