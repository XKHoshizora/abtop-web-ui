import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Empty } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { useSnapshot } from '../hooks/useSnapshot'
import { HostHeader } from '../components/HostHeader'
import { SessionCard } from '../components/SessionCard'
import { SessionDetail } from '../components/SessionDetail'
import { RateLimitPanel } from '../components/RateLimitPanel'
import { PortsPanel } from '../components/PortsPanel'
import { McpPanel } from '../components/McpPanel'
import { sessionKey } from '../lib/format'
import { useT } from '../prefs'

function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '26px 2px 14px' }}>
      <span style={{ width: 3, height: 15, background: 'var(--accent)', borderRadius: 2, boxShadow: '0 0 8px var(--accent)' }} />
      <h2 className="display" style={{ margin: 0, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--heading)' }}>
        {children}
      </h2>
      {count != null && (
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>
          {count}
        </span>
      )}
      <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--line), transparent)' }} />
    </div>
  )
}

export default function Dashboard({ onSignedOut }: { onSignedOut: () => void }) {
  const t = useT()
  const { snap, connected, unauthorized } = useSnapshot(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    if (unauthorized) onSignedOut()
  }, [unauthorized, onSignedOut])

  const sessions = snap?.sessions ?? []
  const rate = snap?.rate_limits ?? []
  const ports = snap?.orphan_ports ?? []
  const mcp = snap?.mcp_servers ?? []

  // Look the selected session up in the live list so the drawer updates in
  // real time; null when it has ended (the drawer then closes).
  const selected = selectedKey ? sessions.find((s) => sessionKey(s) === selectedKey) ?? null : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ minHeight: '100vh' }}
    >
      <HostHeader snap={snap} connected={connected} onSignedOut={onSignedOut} />

      <main style={{ maxWidth: 1480, margin: '0 auto', padding: '8px 22px 72px' }}>
        {rate.length > 0 && (
          <section>
            <SectionTitle>{t('dash.rateLimits')}</SectionTitle>
            <RateLimitPanel items={rate} />
          </section>
        )}

        <section>
          <SectionTitle count={sessions.length}>{t('dash.sessions')}</SectionTitle>
          {sessions.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dash.noSessions')} style={{ padding: '40px 0', color: 'var(--text-3)' }} />
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              }}
            >
              <AnimatePresence mode="popLayout">
                {sessions.map((s, i) => (
                  <SessionCard
                    key={sessionKey(s)}
                    s={s}
                    index={i}
                    onClick={() => setSelectedKey(sessionKey(s))}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {(ports.length > 0 || mcp.length > 0) && (
          <div style={{ display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
            {ports.length > 0 && (
              <section>
                <SectionTitle count={ports.length}>{t('dash.orphanPorts')}</SectionTitle>
                <PortsPanel items={ports} />
              </section>
            )}
            {mcp.length > 0 && (
              <section>
                <SectionTitle count={mcp.length}>{t('dash.mcp')}</SectionTitle>
                <McpPanel items={mcp} />
              </section>
            )}
          </div>
        )}
      </main>

      <SessionDetail session={selected} onClose={() => setSelectedKey(null)} />
    </motion.div>
  )
}
