import { App as AntApp, Button, Segmented, Tooltip } from 'antd'
import { BulbOutlined, LogoutOutlined } from '@ant-design/icons'
import type { Snapshot } from '../types'
import { logout } from '../api'
import { useT, usePrefs, type Lang } from '../prefs'
import { AnimatedNumber } from './AnimatedNumber'
import { Pill } from './Pill'
import { fmtTokens } from '../lib/format'

export function HostHeader({
  snap,
  connected,
  onSignedOut,
}: {
  snap: Snapshot | null
  connected: boolean
  onSignedOut: () => void
}) {
  const { message } = AntApp.useApp()
  const t = useT()
  const { lang, setLang, mode, setMode } = usePrefs()
  const host = snap?.host ?? null
  const agg = snap?.aggregate
  const updated = snap ? new Date(snap.generated_at_ms).toLocaleTimeString() : '—'
  const perSec = ((snap?.token_rate ?? 0) * 1000) / Math.max(1, snap?.interval_ms ?? 2000)

  const signOut = async () => {
    await logout()
    message.info(t('hdr.loggedOut'))
    onSignedOut()
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        padding: '12px 22px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--header-bg)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span className="display" style={{ color: 'var(--accent)', fontSize: 20, textShadow: '0 0 14px var(--accent)' }}>
          ◉
        </span>
        <span className="display" style={{ fontSize: 19, fontWeight: 700 }}>
          ab<span style={{ color: 'var(--accent)' }}>top</span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-4)', letterSpacing: 1, marginTop: 3 }}>{t('hdr.console')}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 6 }}>
        <Pill label={t('hdr.cpu')} accent="var(--accent)">
          {host ? <AnimatedNumber value={host.cpu_pct} format={(n) => `${n.toFixed(0)}%`} /> : 'n/a'}
        </Pill>
        <Pill label={t('hdr.mem')}>
          {host ? <AnimatedNumber value={host.mem_pct} format={(n) => `${n.toFixed(0)}%`} /> : 'n/a'}
        </Pill>
        <Pill label={t('hdr.load')}>{host ? host.load1.toFixed(2) : 'n/a'}</Pill>
        <Pill label={t('hdr.active')} accent="var(--accent-2)">
          {agg?.active_count ?? 0} / {snap?.sessions.length ?? 0}
        </Pill>
        <Pill label={t('hdr.avgCtx')}>
          <AnimatedNumber value={agg?.avg_ctx_pct ?? 0} format={(n) => `${n.toFixed(0)}%`} />
        </Pill>
        <Pill label={t('hdr.rate')}>
          <AnimatedNumber value={perSec} format={(n) => `${fmtTokens(n)}/s`} />
        </Pill>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={connected ? 'conn on' : 'conn off'} />
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          {connected ? t('hdr.connected', { time: updated }) : t('hdr.disconnected')}
        </span>
      </div>

      <Segmented
        size="small"
        value={lang}
        onChange={(v) => setLang(v as Lang)}
        options={[
          { label: 'EN', value: 'en' },
          { label: '中', value: 'zh' },
        ]}
      />

      <Tooltip title={mode === 'dark' ? t('hdr.lightMode') : t('hdr.darkMode')}>
        <Button
          type="text"
          icon={<BulbOutlined />}
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          style={{ color: 'var(--text-2)' }}
        />
      </Tooltip>

      <Tooltip title={t('hdr.logout')}>
        <Button type="text" icon={<LogoutOutlined />} onClick={signOut} style={{ color: 'var(--text-2)' }} />
      </Tooltip>
    </header>
  )
}
