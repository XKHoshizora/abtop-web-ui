import type { SessionStatus } from '../types'

export const fmtTokens = (n: number): string => {
  n = n || 0
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return String(Math.round(n))
}

export const fmtAge = (secs: number): string => {
  secs = Math.max(0, Math.floor(secs || 0))
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

export const fmtResetIn = (epochSecs: number | null): string => {
  if (epochSecs == null || epochSecs <= 0) return ''
  const d = epochSecs - Math.floor(Date.now() / 1000)
  if (d <= 0) return ''
  return fmtAge(d)
}

export interface StatusMeta {
  color: string
  /** Pulse the indicator for actively-working states. */
  active: boolean
  /**
   * Border-beam color for the light theme. The base status colors are
   * 400-grade pastels that vanish against the light glass card; active
   * statuses carry a saturated 600/700-grade variant instead.
   */
  beamLight?: string
}

/** Color + pulse per status; the label is translated via t(`status.<name>`). */
export const STATUS_META: Record<SessionStatus, StatusMeta> = {
  Thinking: { color: '#38bdf8', active: true, beamLight: '#0284c7' },
  Executing: { color: '#34d399', active: true, beamLight: '#059669' },
  Waiting: { color: '#94a3b8', active: false },
  RateLimited: { color: '#fb7185', active: true, beamLight: '#e11d48' },
  Done: { color: '#64748b', active: false },
  Unknown: { color: '#fbbf24', active: false },
}

/** Green → amber → red as a percentage climbs toward saturation. */
export const pctColor = (p: number): string =>
  p >= 85 ? '#fb7185' : p >= 60 ? '#fbbf24' : '#34d399'

export const fmtMemMb = (kb: number): string => `${Math.round((kb || 0) / 1024)}M`

/** Per-agent accent color, shared by the session card and detail drawer. */
const AGENT_COLOR: Record<string, string> = {
  claude: '#d39a6a',
  codex: '#7aa2f7',
  opencode: '#9ece6a',
}
export const agentColor = (cli: string): string => AGENT_COLOR[cli] ?? '#94a3b8'

export const shortId = (id: string): string => (id.length > 7 ? id.slice(0, 7) : id)

export const firstWords = (cmd: string, n = 3): string =>
  cmd.split(/\s+/).slice(0, n).join(' ')

export const sessionKey = (s: { agent_cli: string; session_id: string; pid: number }): string =>
  `${s.agent_cli}:${s.session_id}:${s.pid}`

export const fmtDuration = (ms: number): string => {
  if (!ms) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export const fmtDateTime = (epochMs: number): string =>
  epochMs ? new Date(epochMs).toLocaleString() : '—'

export const fmtWindow = (n: number): string => {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}
