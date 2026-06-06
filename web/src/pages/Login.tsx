import { useState } from 'react'
import { App as AntApp, Button, Form, Input, Segmented, Tooltip } from 'antd'
import { BulbOutlined, LockOutlined, UserOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { login } from '../api'
import { useT, usePrefs, type Lang } from '../prefs'

interface Values {
  username: string
  password: string
}

export default function Login({ onAuthed }: { onAuthed: () => void }) {
  const { message } = AntApp.useApp()
  const t = useT()
  const { lang, setLang, mode, setMode } = usePrefs()
  const [loading, setLoading] = useState(false)

  const onFinish = async (v: Values) => {
    setLoading(true)
    const ok = await login(v.username.trim(), v.password)
    setLoading(false)
    if (ok) {
      message.success(t('login.ok'))
      onAuthed()
    } else {
      message.error(t('login.fail'))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}
    >
      {/* language + theme controls, available before sign-in */}
      <div style={{ position: 'fixed', top: 18, right: 20, display: 'flex', alignItems: 'center', gap: 8, zIndex: 5 }}>
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
      </div>

      <motion.div
        className="login-card"
        initial={{ y: 26, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 130, damping: 17 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <span className="brand-mark display">◉</span>
          <div>
            <div className="display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
              ab<span style={{ color: 'var(--accent)' }}>top</span>
            </div>
            <div style={{ color: 'var(--text-2)', fontSize: 12, letterSpacing: 1 }}>{t('login.subtitle')}</div>
          </div>
        </div>

        <div style={{ margin: '18px 0 22px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {t('login.desc')}
        </div>

        <Form layout="vertical" requiredMark={false} onFinish={onFinish} size="large" autoComplete="off">
          <Form.Item name="username" rules={[{ required: true, message: t('login.needUser') }]} style={{ marginBottom: 16 }}>
            <Input prefix={<UserOutlined style={{ color: 'var(--text-3)' }} />} placeholder={t('login.username')} autoFocus />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: t('login.needPass') }]} style={{ marginBottom: 22 }}>
            <Input.Password prefix={<LockOutlined style={{ color: 'var(--text-3)' }} />} placeholder={t('login.password')} />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            style={{
              height: 44,
              fontWeight: 600,
              letterSpacing: 1,
              boxShadow: '0 8px 26px -10px color-mix(in srgb, var(--accent) 70%, transparent)',
            }}
          >
            {t('login.submit')}
          </Button>
        </Form>

        <div style={{ marginTop: 18, fontSize: 11, color: 'var(--text-4)', textAlign: 'center', letterSpacing: 0.4 }}>
          {t('login.footer')}
        </div>
      </motion.div>
    </motion.div>
  )
}
