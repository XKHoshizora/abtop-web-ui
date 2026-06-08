import { useEffect, useState } from 'react'
import type { Snapshot } from '../types'
import { fetchSnapshot } from '../api'

const POLL_INTERVAL = 2000

export interface SnapshotState {
  snap: Snapshot | null
  connected: boolean
  /** Set true when the server rejects us (401) — caller should re-login. */
  unauthorized: boolean
}

/**
 * Subscribe to the live snapshot stream.
 *
 * SSE (`/api/stream`) is primary; on error it falls back to polling
 * `/api/snapshot`, which also surfaces 401s (EventSource can't read status
 * codes). When SSE recovers, polling is stopped again.
 */
export function useSnapshot(active: boolean): SnapshotState {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    if (!active) return

    let stopped = false
    let pollTimer: number | null = null
    let es: EventSource | null = null

    const stopPolling = () => {
      if (pollTimer != null) {
        window.clearInterval(pollTimer)
        pollTimer = null
      }
    }

    const startPolling = () => {
      if (pollTimer != null) return
      const tick = async () => {
        const r = await fetchSnapshot()
        if (stopped) return
        if (r === 'unauthorized') {
          setUnauthorized(true)
          setConnected(false)
        } else if (r && Array.isArray(r.sessions)) {
          setSnap(r)
          setConnected(true)
        } else {
          setConnected(false)
        }
      }
      void tick()
      pollTimer = window.setInterval(tick, POLL_INTERVAL)
    }

    if ('EventSource' in window) {
      es = new EventSource('/api/stream')
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          // Ignore frames that aren't a real snapshot (e.g. a placeholder "{}"
          // emitted before the server's first tick) — accepting one would blank
          // the dashboard.
          if (!data || !Array.isArray(data.sessions)) return
          stopPolling()
          setSnap(data as Snapshot)
          setConnected(true)
          setUnauthorized(false)
        } catch {
          /* ignore malformed frame */
        }
      }
      es.onerror = () => {
        setConnected(false)
        startPolling()
      }
    } else {
      startPolling()
    }

    return () => {
      stopped = true
      es?.close()
      stopPolling()
    }
  }, [active])

  return { snap, connected, unauthorized }
}
