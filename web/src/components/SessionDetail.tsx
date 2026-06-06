import type { ReactNode } from 'react'
import { Descriptions, Drawer, Empty, Tag, Tooltip, Typography } from 'antd'
import type { SessionView } from '../types'
import {
  STATUS_META,
  agentColor,
  fmtAge,
  fmtDateTime,
  fmtDuration,
  fmtTokens,
  fmtWindow,
  pctColor,
  shortId,
} from '../lib/format'
import { useT, type T } from '../prefs'
import { StatusDot } from './StatusDot'
import { ContextBar } from './ContextBar'
import { Sparkline } from './Sparkline'
import { ChildRow } from './ChildRow'
import { GitBadge } from './GitBadge'

function Section({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 3, height: 13, background: 'var(--accent)', borderRadius: 2, boxShadow: '0 0 7px var(--accent)' }} />
        <span className="display" style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--heading)' }}>
          {title}
        </span>
        <div style={{ flex: 1 }} />
        {extra}
      </div>
      {children}
    </div>
  )
}

const TOKEN_PARTS = [
  { key: 'input_tokens', labelKey: 's.input', color: '#38bdf8' },
  { key: 'output_tokens', labelKey: 's.output', color: '#34d399' },
  { key: 'cache_create_tokens', labelKey: 's.cacheWrite', color: '#a78bfa' },
  { key: 'cache_read_tokens', labelKey: 's.cacheRead', color: '#64748b' },
] as const

function TokenBar({ s, t }: { s: SessionView; t: T }) {
  const total = TOKEN_PARTS.reduce((a, p) => a + (s[p.key] || 0), 0) || 1
  return (
    <>
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--track)' }}>
        {TOKEN_PARTS.map((p) =>
          s[p.key] > 0 ? <div key={p.key} style={{ width: `${(s[p.key] / total) * 100}%`, background: p.color }} /> : null,
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 12 }}>
        {TOKEN_PARTS.map((p) => (
          <span key={p.key} style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
            {t(p.labelKey)}{' '}
            <span className="mono" style={{ color: 'var(--text)' }}>{fmtTokens(s[p.key])}</span>
          </span>
        ))}
      </div>
    </>
  )
}

function Content({ s }: { s: SessionView }) {
  const t = useT()
  return (
    <>
      {s.current_task && (
        <div style={{ marginBottom: 20, fontSize: 13, color: 'var(--accent)' }}>└─ {s.current_task}</div>
      )}

      <Section title={t('s.tokenComp')} extra={<span className="mono" style={{ fontSize: 13, color: 'var(--accent)' }}>{fmtTokens(s.total_tokens)}</span>}>
        <TokenBar s={s} t={t} />
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{t('s.tokenTrend')}</div>
          <Sparkline data={s.token_history} />
        </div>
      </Section>

      <Section
        title={t('s.context')}
        extra={<span className="mono" style={{ fontSize: 13, color: pctColor(s.context_percent) }}>{s.context_percent.toFixed(0)}%</span>}
      >
        <ContextBar pct={s.context_percent} />
        <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 12, color: 'var(--text-2)' }}>
          <span>{t('s.window')} <span className="mono" style={{ color: 'var(--text)' }}>{fmtWindow(s.context_window)}</span></span>
          <span>{t('s.turns')} <span className="mono" style={{ color: 'var(--text)' }}>{s.turn_count}</span></span>
          <span>{t('s.compaction')} <span className="mono" style={{ color: s.compaction_count ? '#fbbf24' : 'var(--text)' }}>{s.compaction_count}</span></span>
        </div>
      </Section>

      <Section title={t('s.metadata')}>
        <Descriptions column={1} size="small" colon={false} styles={{ label: { color: 'var(--text-3)', width: 86 } }}>
          <Descriptions.Item label={t('tbl.pid')}><span className="mono">{s.pid}</span></Descriptions.Item>
          <Descriptions.Item label={t('s.sessionId')}>
            <Typography.Text className="mono" copyable style={{ color: 'var(--bright)', fontSize: 12 }}>{s.session_id}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('s.model')}><span className="mono">{s.model || '—'}{s.effort ? ` · ${s.effort}` : ''}</span></Descriptions.Item>
          <Descriptions.Item label={t('s.version')}><span className="mono">{s.version || '—'}</span></Descriptions.Item>
          <Descriptions.Item label={t('s.configDir')}><span className="mono">{s.config_root || '—'}</span></Descriptions.Item>
          <Descriptions.Item label={t('s.cwd')}><span className="mono" style={{ wordBreak: 'break-all' }}>{s.cwd}</span></Descriptions.Item>
          <Descriptions.Item label={t('s.startedAt')}>{fmtDateTime(s.started_at_ms)}</Descriptions.Item>
          <Descriptions.Item label={t('s.uptime')}><span className="mono">{fmtAge(s.elapsed_secs)}</span></Descriptions.Item>
          <Descriptions.Item label={t('s.mem')}><span className="mono">{s.mem_mb}M</span></Descriptions.Item>
          <Descriptions.Item label="Git">{s.git_branch ? <GitBadge s={s} /> : '—'}</Descriptions.Item>
        </Descriptions>
      </Section>

      {s.children.length > 0 && (
        <Section title={t('s.children')} extra={<span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{s.children.length}</span>}>
          {s.children.map((c) => (
            <ChildRow key={c.pid} c={c} words={5} />
          ))}
        </Section>
      )}

      {s.subagents.length > 0 && (
        <Section title={t('s.subagents')} extra={<span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{s.subagents.length}</span>}>
          {s.subagents.map((a, i) => (
            <div key={`${a.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '4px 0' }}>
              <Tag bordered={false} color="cyan" style={{ marginInlineEnd: 0 }}>{a.name}</Tag>
              <span style={{ color: 'var(--text-2)' }}>{a.status}</span>
              <div style={{ flex: 1 }} />
              <span className="mono" style={{ color: 'var(--accent)' }}>{fmtTokens(a.tokens)}</span>
            </div>
          ))}
        </Section>
      )}

      {s.tool_calls.length > 0 && (
        <Section title={t('s.tools')} extra={<span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{s.tool_calls.length}</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {s.tool_calls.slice().reverse().map((tc, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '3px 0' }}>
                <Tag bordered={false} style={{ marginInlineEnd: 0, minWidth: 56, textAlign: 'center' }}>{tc.name}</Tag>
                <span className="mono" style={{ flex: 1, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tc.arg || '—'}</span>
                {tc.duration_ms > 0 && <span className="mono" style={{ color: 'var(--text-4)' }}>{fmtDuration(tc.duration_ms)}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {s.chat_messages.length > 0 && (
        <Section title={t('s.chat')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.chat_messages.map((m, i) => {
              const isUser = m.role === 'user'
              return (
                <div
                  key={i}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    padding: '8px 12px',
                    borderRadius: 12,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    background: isUser ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--chip-bg)',
                    border: `1px solid ${isUser ? 'color-mix(in srgb, var(--accent) 24%, transparent)' : 'var(--line)'}`,
                    color: 'var(--bright)',
                  }}
                >
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3, letterSpacing: 0.5 }}>
                    {isUser ? t('s.roleUser') : t('s.roleAssistant')}
                  </div>
                  {m.text}
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </>
  )
}

export function SessionDetail({ session, onClose }: { session: SessionView | null; onClose: () => void }) {
  const t = useT()
  const meta = session ? STATUS_META[session.status] ?? STATUS_META.Unknown : null

  return (
    <Drawer
      open={session != null}
      onClose={onClose}
      width="min(560px, 94vw)"
      styles={{ body: { padding: '8px 22px 28px' }, header: { borderBottom: '1px solid var(--line)' } }}
      title={
        session && meta ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusDot color={meta.color} active={meta.active} />
            <span className="display" style={{ fontSize: 16, fontWeight: 600 }}>{session.project_name || '—'}</span>
            <Tag
              bordered={false}
              style={{
                marginInlineEnd: 0,
                textTransform: 'uppercase',
                fontSize: 11,
                color: agentColor(session.agent_cli),
                background: `${agentColor(session.agent_cli)}1f`,
              }}
            >
              {session.agent_cli}
            </Tag>
            <Tooltip title={session.session_id}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{shortId(session.session_id)}</span>
            </Tooltip>
          </div>
        ) : null
      }
    >
      {session ? <Content s={session} /> : <Empty description={t('s.ended')} />}
    </Drawer>
  )
}
