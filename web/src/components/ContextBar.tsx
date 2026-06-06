import { motion } from 'framer-motion'
import { pctColor } from '../lib/format'

export function ContextBar({ pct }: { pct: number }) {
  const p = Math.min(100, Math.max(0, pct || 0))
  const c = pctColor(p)
  return (
    <div className="bar-track">
      <motion.div
        className="bar-fill"
        initial={{ width: 0 }}
        animate={{ width: `${p}%` }}
        transition={{ type: 'spring', stiffness: 110, damping: 20 }}
        style={{ background: `linear-gradient(90deg, ${c}80, ${c})`, boxShadow: `0 0 10px ${c}66` }}
      />
    </div>
  )
}
