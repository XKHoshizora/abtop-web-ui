import type { Snapshot } from './types'

export interface AuthState {
  /** Whether the server requires a login at all (false when no password set). */
  authRequired: boolean
  /** Whether the current session cookie is valid. */
  authenticated: boolean
}

/** Returns `null` when the server is unreachable (vs. a definitive answer), so
 * the caller can retry instead of dropping to an unusable login screen. */
export async function fetchAuthState(): Promise<AuthState | null> {
  try {
    const r = await fetch('/api/me', { cache: 'no-store' })
    if (r.ok) return (await r.json()) as AuthState
  } catch {
    /* server unreachable */
  }
  return null
}

export async function login(username: string, password: string): Promise<boolean> {
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST' })
  } catch {
    /* ignore */
  }
}

export type SnapshotResult = Snapshot | 'unauthorized' | null

export async function fetchSnapshot(): Promise<SnapshotResult> {
  try {
    const r = await fetch('/api/snapshot', { cache: 'no-store' })
    if (r.status === 401) return 'unauthorized'
    if (!r.ok) return null
    return (await r.json()) as Snapshot
  } catch {
    return null
  }
}
