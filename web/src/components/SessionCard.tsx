import { BorderBeam, Card, Tag, Tooltip } from 'antd'
import { motion } from 'framer-motion'
import type { SessionView } from '../types'
import { STATUS_META, agentColor, fmtAge, fmtTokens, shortId } from '../lib/format'
import { useT } from '../prefs'
import { StatusDot } from './StatusDot'
import { ContextBar } from './ContextBar'
import { AnimatedNumber } from './AnimatedNumber'
import { GitBadge } from './GitBadge'
import { Sparkline } from './Sparkline'

/** Tiny mono label · value pair for the footer strip. */
function Foot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 9.5, color: 'var(--text-4)', letterSpacing: 0.5 }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>
        {children}
      </span>
    </span>
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
  // The one line that answers "what is this agent doing right now".
  const doing = s.current_task || s.summary || '—'
  const ports = s.children
    .map((c) => c.port)
    .filter((p): p is number => p !== null)
    .slice(0, 2)

  const card = (
      <Card
        className="session-card"
        styles={{ body: { padding: '13px 15px' } }}
        onClick={onClick}
        style={{ cursor: 'pointer' }}
      >
        {/* status + agent + age */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot color={meta.color} active={meta.active} />
          <span style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>{t(`status.${s.status}`)}</span>
          <Tag
            bordered={false}
            style={{
              marginInlineEnd: 0,
              color: agentCol,
              background: `${agentCol}1f`,
              fontSize: 10.5,
              lineHeight: '18px',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {s.agent_cli}
          </Tag>
          <div style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
            {fmtAge(s.elapsed_secs)}
          </span>
          <span className="card-chevron" style={{ color: 'var(--text-4)', fontSize: 15, lineHeight: 1 }}>›</span>
        </div>

        {/* project + git + session id */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10, minWidth: 0 }}>
          <Tooltip title={s.cwd}>
            <span
              className="display"
              style={{
                fontSize: 15.5,
                fontWeight: 600,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.project_name || '—'}
            </span>
          </Tooltip>
          <GitBadge s={s} />
          <span className="mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-4)', flex: 'none' }}>
            {shortId(s.session_id)}
          </span>
        </div>

        {/* "now" line — the at-a-glance focus */}
        <Tooltip title={doing.length > 60 ? doing : undefined}>
          <div
            className={meta.active ? 'task-line active' : 'task-line'}
            style={{ borderLeftColor: meta.color, marginTop: 9 }}
          >
            {doing}
          </div>
        </Tooltip>

        {/* token sparkline + animated counter */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 11 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Sparkline data={s.token_history} color={agentCol} width={220} height={34} fluid />
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div style={{ fontSize: 9.5, color: 'var(--text-3)', letterSpacing: 0.5 }}>{t('s.token')}</div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.15 }}>
              <AnimatedNumber value={s.total_tokens} format={fmtTokens} />
            </div>
          </div>
        </div>

        {/* context bar, inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 9.5, color: 'var(--text-3)', letterSpacing: 0.5, flex: 'none' }}>
            {t('s.context')}
          </span>
          <div style={{ flex: 1 }}>
            <ContextBar pct={s.context_percent} />
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)', width: 34, textAlign: 'right' }}>
            <AnimatedNumber value={s.context_percent} format={(n) => `${n.toFixed(0)}%`} />
          </span>
        </div>

        {/* footer strip: model · mem · turns · children/ports summary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            marginTop: 11,
            paddingTop: 9,
            borderTop: '1px solid var(--line)',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          <Tooltip title={`${s.model}${s.effort ? ' · ' + s.effort : ''}`}>
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--text-2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}
            >
              {s.model.replace(/^claude-/, '') || '—'}
            </span>
          </Tooltip>
          <Foot label={t('s.mem')}>{s.mem_mb}M</Foot>
          <Foot label={t('s.turns')}>{s.turn_count}</Foot>
          <div style={{ flex: 1 }} />
          {s.children.length > 0 && (
            <Tooltip
              title={`${t('card.procs')}: ${s.children.length}`}
              placement="topRight"
            >
              <span className="mono proc-chip">
                ⚙ {s.children.length}
                {ports.map((p) => (
                  <span key={p} style={{ color: 'var(--accent)' }}>
                    {' '}:{p}
                  </span>
                ))}
              </span>
            </Tooltip>
          )}
        </div>
      </Card>
  )

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 160, damping: 22, delay: Math.min(index * 0.04, 0.4) }}
      style={{ height: '100%' }}
    >
      {meta.active ? (
        // Animated "beam" running along the border while the agent is
        // actively working — instant visual cue for which cards are live.
        <BorderBeam color={meta.color}>{card}</BorderBeam>
      ) : (
        card
      )}
    </motion.div>
  )
}
