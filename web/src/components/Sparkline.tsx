import { useT } from '../prefs'

/** A tiny dependency-free SVG sparkline (filled area + line). */
export function Sparkline({
  data,
  color = '#22d3ee',
  width = 248,
  height = 44,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
}) {
  const t = useT()
  if (!data || data.length < 2) {
    return <div style={{ height, color: 'var(--text-4)', fontSize: 12 }}>{t('s.noData')}</div>
  }
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pad = 3
  const h = height - pad * 2
  const step = width / (data.length - 1)
  const y = (v: number) => pad + h - ((v - min) / range) * h
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`)
  const line = pts.join(' ')
  const area = `0,${height} ${line} ${width},${height}`
  const id = `spark-${color.replace('#', '')}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.32} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(data.length - 1) * step} cy={y(data[data.length - 1])} r={2.6} fill={color} />
    </svg>
  )
}
