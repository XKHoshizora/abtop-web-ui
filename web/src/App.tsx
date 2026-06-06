import { useCallback, useEffect, useState } from 'react'
import { Spin } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { fetchAuthState } from './api'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

type View = 'loading' | 'login' | 'dashboard'

export default function App() {
  const [view, setView] = useState<View>('loading')

  const resolve = useCallback(async () => {
    const s = await fetchAuthState()
    if (!s) {
      // Server unreachable — retry rather than dropping to a login screen that
      // can't succeed (e.g. in the no-password deployment).
      window.setTimeout(() => void resolve(), 1500)
      return
    }
    setView(!s.authRequired || s.authenticated ? 'dashboard' : 'login')
  }, [])

  useEffect(() => {
    void resolve()
  }, [resolve])

  return (
    <>
      <div className="app-bg" />
      <div
        className="glow-orb"
        style={{ width: 360, height: 360, top: -120, right: -70, background: 'var(--accent)' }}
      />
      <div
        className="glow-orb"
        style={{ width: 320, height: 320, bottom: -150, left: -110, background: 'var(--accent-2)', animationDelay: '-8s' }}
      />

      <AnimatePresence mode="wait">
        {view === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ height: '100vh', display: 'grid', placeItems: 'center' }}
          >
            <Spin size="large" />
          </motion.div>
        )}
        {view === 'login' && <Login key="login" onAuthed={() => setView('dashboard')} />}
        {view === 'dashboard' && <Dashboard key="dashboard" onSignedOut={() => setView('login')} />}
      </AnimatePresence>
    </>
  )
}
