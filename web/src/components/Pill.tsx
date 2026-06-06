import type { ReactNode } from 'react'

/** A compact glass stat chip used across the header. */
export function Pill({
  label,
  children,
  accent,
}: {
  label: string
  children: ReactNode
  accent?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 7,
        padding: '5px 12px',
        borderRadius: 10,
        background: 'var(--chip-bg)',
        border: '1px solid var(--line)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: 0.5 }}>{label}</span>
      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: accent ?? 'var(--text)' }}>
        {children}
      </span>
    </div>
  )
}
