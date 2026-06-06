import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { PrefsProvider, usePrefs } from './prefs'
import { buildAntdTheme } from './theme'
import App from './App'
import './styles.css'

// Apply the saved theme before first paint to avoid a flash of the default.
document.documentElement.dataset.theme =
  localStorage.getItem('abtop_theme') === 'light' ? 'light' : 'dark'

function ThemedShell() {
  const { mode, lang } = usePrefs()
  useEffect(() => {
    document.documentElement.dataset.theme = mode
  }, [mode])
  return (
    <ConfigProvider theme={buildAntdTheme(mode)} locale={lang === 'zh' ? zhCN : enUS}>
      <AntApp component={false}>
        <App />
      </AntApp>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrefsProvider>
      <ThemedShell />
    </PrefsProvider>
  </React.StrictMode>,
)
