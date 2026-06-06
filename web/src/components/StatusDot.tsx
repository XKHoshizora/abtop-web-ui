export function StatusDot({
  color,
  active,
  size = 9,
}: {
  color: string
  active: boolean
  size?: number
}) {
  return (
    <span
      className={active ? 'status-dot pulse' : 'status-dot'}
      style={{ width: size, height: size, background: color, color, boxShadow: `0 0 8px ${color}` }}
    />
  )
}
