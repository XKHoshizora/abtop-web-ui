import { Card } from 'antd'
import { motion } from 'framer-motion'
import type { RateLimitInfo } from '../types'
import { fmtResetIn, pctColor } from '../lib/format'
import { useT } from '../prefs'
import { ContextBar } from './ContextBar'

function Window({ label, pct, reset }: { label: string; pct: number | null; reset: number | null }) {
  const t = useT()
  if (pct == null) return null
  const resetTxt = fmtResetIn(reset)
  return (
    <div style={{ flex: 1, minWidth: 150 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>
        <span>{label}</span>
        <span className="mono" style={{ color: pctColor(pct) }}>
          {pct.toFixed(0)}%
          {resetTxt && <span style={{ color: 'var(--text-4)' }}> · {t('rl.resetsIn', { t: resetTxt })}</span>}
        </span>
      </div>
      <ContextBar pct={pct} />
    </div>
  )
}

export function RateLimitPanel({ items }: { items: RateLimitInfo[] }) {
  const t = useT()
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {items.map((r, i) => (
        <motion.div
          key={r.source}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card styles={{ body: { padding: 16 } }}>
            <div className="display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textTransform: 'capitalize' }}>
              {r.source} <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{t('rl.label')}</span>
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <Window label={t('rl.5h')} pct={r.five_hour_pct} reset={r.five_hour_resets_at} />
              <Window label={t('rl.7d')} pct={r.seven_day_pct} reset={r.seven_day_resets_at} />
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
