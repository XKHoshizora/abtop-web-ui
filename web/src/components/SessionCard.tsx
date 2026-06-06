import type { ReactNode } from 'react'
import { Card, Tag, Tooltip } from 'antd'
import { motion } from 'framer-motion'
import type { SessionView } from '../types'
import { STATUS_META, agentColor, fmtAge, fmtTokens, shortId } from '../lib/format'
import { useT } from '../prefs'
import { StatusDot } from './StatusDot'
import { ContextBar } from './ContextBar'
import { AnimatedNumber } from './AnimatedNumber'
import { ChildRow } from './ChildRow'
import { GitBadge } from './GitBadge'

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10.5, color: 'var(--text-3)', letterSpacing: 0.4 }}>{label}</span>
      <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
        {children}
      </span>
    </div>
  )
}

export function SessionCard({
  s,
  index = 0,
  onClick,
}: {
  s: SessionView
  index?: number
  onClick?: () => void
}) {
  const t = useT()
  const meta = STATUS_META[s.status] ?? STATUS_META.Unknown
  const agentCol = agentColor(s.agent_cli)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 160, damping: 22, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Card className="session-card" styles={{ body: { padding: 16 } }} onClick={onClick} style={{ cursor: 'pointer' }}>
        {/* header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot color={meta.color} active={meta.active} />
          <span style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>{t(`status.${s.status}`)}</span>
          <Tag
            bordered={false}
            style={{
              marginInlineEnd: 0,
              color: agentCol,
              background: `${agentCol}1f`,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {s.agent_cli}
          </Tag>
          <div style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {fmtAge(s.elapsed_secs)}
          </span>
          <span className="card-chevron" style={{ color: 'var(--text-4)', fontSize: 15, lineHeight: 1 }}>›</span>
        </div>

        {/* project + summary */}
        <div style={{ marginTop: 12 }}>
          <div className="display" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>
            {s.project_name || '—'}
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 7 }}>
              {shortId(s.session_id)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--bright)', marginTop: 5, minHeight: 18 }}>
            {s.summary || '—'}
          </div>
          {s.current_task && (
            <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 5 }}>└─ {s.current_task}</div>
          )}
        </div>

        {/* context bar */}
        <div style={{ marginTop: 14, marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--text-2)',
              marginBottom: 6,
            }}
          >
            <span>{t('s.context')}</span>
            <span className="mono">
              <AnimatedNumber value={s.context_percent} format={(n) => `${n.toFixed(0)}%`} />
            </span>
          </div>
          <ContextBar pct={s.context_percent} />
        </div>

        {/* stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            paddingTop: 12,
            borderTop: '1px solid var(--line)',
          }}
        >
          <Stat label={t('s.token')}>
            <span style={{ color: 'var(--accent)' }}>
              <AnimatedNumber value={s.total_tokens} format={fmtTokens} />
            </span>
          </Stat>
          <Stat label={t('s.mem')}>{s.mem_mb}M</Stat>
          <Stat label={t('s.turns')}>{s.turn_count}</Stat>
          <Stat label={t('s.model')}>
            <Tooltip title={`${s.model}${s.effort ? ' · ' + s.effort : ''}`}>
              <span style={{ fontSize: 11 }}>{s.model.replace(/^claude-/, '') || '—'}</span>
            </Tooltip>
          </Stat>
        </div>

        {/* git + cwd */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 12,
            fontSize: 11.5,
            color: 'var(--text-2)',
          }}
        >
          <GitBadge s={s} />
          <Tooltip title={s.cwd}>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                textAlign: 'right',
              }}
            >
              {s.cwd}
            </span>
          </Tooltip>
        </div>

        {/* children */}
        {s.children.length > 0 && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px dashed var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            {s.children.map((c) => (
              <ChildRow key={c.pid} c={c} />
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  )
}
