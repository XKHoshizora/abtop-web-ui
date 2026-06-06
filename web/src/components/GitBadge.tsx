import type { SessionView } from '../types'

/** A session's git branch + added/modified counts. Renders nothing when there
 * is no branch. Shared by the session card and the detail drawer. */
export function GitBadge({ s }: { s: SessionView }) {
  if (!s.git_branch) return null
  return (
    <span className="mono">
      ⎇ {s.git_branch}
      {s.git_added > 0 && <span style={{ color: '#34d399' }}> +{s.git_added}</span>}
      {s.git_modified > 0 && <span style={{ color: '#fbbf24' }}> ~{s.git_modified}</span>}
    </span>
  )
}
