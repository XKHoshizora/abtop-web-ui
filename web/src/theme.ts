import { theme as antdTheme, type ThemeConfig } from 'antd'
import type { Mode } from './prefs'

/** Scanner-cyan accent (dark). Light mode uses a deeper cyan for contrast. */
export const ACCENT = '#22d3ee'

const DARK: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: ACCENT,
    colorInfo: ACCENT,
    colorSuccess: '#34d399',
    colorWarning: '#fbbf24',
    colorError: '#fb7185',
    colorBgBase: '#070b13',
    colorBgContainer: 'rgba(15, 22, 36, 0.55)',
    colorBgElevated: 'rgba(20, 28, 44, 0.96)',
    colorBorder: 'rgba(120, 165, 210, 0.16)',
    colorBorderSecondary: 'rgba(120, 165, 210, 0.09)',
    colorText: '#dbe4f2',
    colorTextSecondary: '#93a1ba',
    colorTextTertiary: '#6b7a93',
    borderRadius: 12,
    borderRadiusLG: 16,
    fontFamily: "'Sora', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    controlHeight: 38,
    wireframe: false,
  },
  components: {
    Card: { colorBorderSecondary: 'rgba(120,165,210,0.12)' },
    Table: {
      headerBg: 'transparent',
      headerColor: '#93a1ba',
      headerSplitColor: 'transparent',
      borderColor: 'rgba(120,165,210,0.10)',
      rowHoverBg: 'rgba(34,211,238,0.06)',
      colorBgContainer: 'transparent',
      cellPaddingBlock: 10,
    },
    Input: {
      colorBgContainer: 'rgba(8,13,22,0.7)',
      activeShadow: '0 0 0 2px rgba(34,211,238,0.18)',
    },
    Button: { defaultBg: 'rgba(255,255,255,0.04)', defaultBorderColor: 'rgba(120,165,210,0.2)' },
    Tag: { defaultBg: 'rgba(255,255,255,0.05)' },
  },
}

const LIGHT: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#0891b2',
    colorInfo: '#0891b2',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#e11d48',
    colorBgBase: '#eef3f9',
    colorBgContainer: 'rgba(255, 255, 255, 0.7)',
    colorBgElevated: 'rgba(255, 255, 255, 0.97)',
    colorBorder: 'rgba(40, 70, 120, 0.16)',
    colorBorderSecondary: 'rgba(40, 70, 120, 0.10)',
    colorText: '#1e2733',
    colorTextSecondary: '#51607a',
    colorTextTertiary: '#6b7686',
    borderRadius: 12,
    borderRadiusLG: 16,
    fontFamily: "'Sora', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    controlHeight: 38,
    wireframe: false,
  },
  components: {
    Card: { colorBorderSecondary: 'rgba(40,70,120,0.12)' },
    Table: {
      headerBg: 'transparent',
      headerColor: '#51607a',
      headerSplitColor: 'transparent',
      borderColor: 'rgba(40,70,120,0.10)',
      rowHoverBg: 'rgba(8,145,178,0.06)',
      colorBgContainer: 'transparent',
      cellPaddingBlock: 10,
    },
    Input: {
      colorBgContainer: 'rgba(255,255,255,0.85)',
      activeShadow: '0 0 0 2px rgba(8,145,178,0.18)',
    },
    Button: { defaultBg: 'rgba(20,40,80,0.03)', defaultBorderColor: 'rgba(40,70,120,0.2)' },
    Tag: { defaultBg: 'rgba(20,40,80,0.05)' },
  },
}

export const buildAntdTheme = (mode: Mode): ThemeConfig => (mode === 'light' ? LIGHT : DARK)
