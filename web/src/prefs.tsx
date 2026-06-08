import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'zh'
export type Mode = 'dark' | 'light'

const LANG_KEY = 'abtop_lang'
const THEME_KEY = 'abtop_theme'

/** Flat translation dictionary. Default language is English. */
const STR: Record<string, { en: string; zh: string }> = {
  // login
  'login.subtitle': { en: 'AI AGENT MONITOR', zh: 'AI AGENT 监控控制台' },
  'login.desc': {
    en: 'Sign in to view live sessions, token / context usage, rate limits and ports.',
    zh: '请登录以查看实时会话、Token / 上下文用量、限流与端口状态。',
  },
  'login.username': { en: 'Username', zh: '用户名' },
  'login.password': { en: 'Password', zh: '密码' },
  'login.submit': { en: 'Enter console', zh: '进入控制台' },
  'login.footer': { en: 'Local-first · read-only · any username', zh: '本地优先 · 只读监控 · 任意用户名均可' },
  'login.ok': { en: 'Authenticated', zh: '身份验证通过' },
  'login.fail': { en: 'Wrong username or password', zh: '用户名或密码错误' },
  'login.needUser': { en: 'Please enter a username', zh: '请输入用户名' },
  'login.needPass': { en: 'Please enter a password', zh: '请输入密码' },
  // header
  'hdr.console': { en: 'console', zh: '控制台' },
  'hdr.cpu': { en: 'CPU', zh: 'CPU' },
  'hdr.mem': { en: 'MEM', zh: '内存' },
  'hdr.load': { en: 'LOAD', zh: '负载' },
  'hdr.active': { en: 'ACTIVE', zh: '活跃' },
  'hdr.avgCtx': { en: 'AVG CTX', zh: '平均上下文' },
  'hdr.rate': { en: 'RATE', zh: '速率' },
  'hdr.connected': { en: 'live · {time}', zh: '已连接 · {time}' },
  'hdr.disconnected': { en: 'reconnecting…', zh: '连接中断 · 重试中' },
  'hdr.hostLinuxOnly': { en: 'Host metrics are Linux-only', zh: '主机指标仅在 Linux 上可用' },
  'hdr.logout': { en: 'Sign out', zh: '退出登录' },
  'hdr.loggedOut': { en: 'Signed out', zh: '已退出' },
  'hdr.lightMode': { en: 'Light theme', zh: '亮色主题' },
  'hdr.darkMode': { en: 'Dark theme', zh: '暗色主题' },
  // dashboard
  'dash.rateLimits': { en: 'Rate limits', zh: '账户限流' },
  'dash.sessions': { en: 'Active sessions', zh: '活跃会话' },
  'dash.noSessions': { en: 'No active sessions', zh: '暂无活跃会话' },
  'dash.noSessionsHint': {
    en: 'Sessions appear here once a Claude Code, Codex, or OpenCode agent is running on this machine.',
    zh: '在本机启动 Claude Code、Codex 或 OpenCode 后,会话会自动出现在这里。',
  },
  'dash.orphanPorts': { en: 'Orphan ports', zh: '孤儿端口' },
  'dash.mcp': { en: 'MCP servers', zh: 'MCP 服务' },
  // session card / detail
  's.context': { en: 'Context window', zh: '上下文窗口' },
  's.token': { en: 'Tokens', zh: 'Token' },
  's.mem': { en: 'Memory', zh: '内存' },
  's.turns': { en: 'Turns', zh: '轮次' },
  's.model': { en: 'Model', zh: '模型' },
  's.tokenComp': { en: 'Token composition', zh: 'Token 构成' },
  's.tokenTrend': { en: 'Token trend', zh: 'Token 走势' },
  's.input': { en: 'Input', zh: '输入' },
  's.output': { en: 'Output', zh: '输出' },
  's.cacheWrite': { en: 'Cache write', zh: '缓存写' },
  's.cacheRead': { en: 'Cache read', zh: '缓存读' },
  's.window': { en: 'Window', zh: '窗口' },
  's.compaction': { en: 'Compaction', zh: '压缩' },
  's.metadata': { en: 'Metadata', zh: '元数据' },
  's.sessionId': { en: 'Session ID', zh: '会话 ID' },
  's.version': { en: 'Version', zh: '版本' },
  's.configDir': { en: 'Config dir', zh: '配置目录' },
  's.cwd': { en: 'Working dir', zh: '工作目录' },
  's.startedAt': { en: 'Started', zh: '启动于' },
  's.uptime': { en: 'Uptime', zh: '运行时长' },
  's.children': { en: 'Child processes', zh: '子进程' },
  's.subagents': { en: 'Subagents', zh: '子代理' },
  's.tools': { en: 'Tool calls', zh: '工具调用' },
  's.chat': { en: 'Conversation', zh: '对话片段' },
  's.roleUser': { en: 'User', zh: '用户' },
  's.roleAssistant': { en: 'Assistant', zh: '助手' },
  's.ended': { en: 'Session ended', zh: '会话已结束' },
  's.noData': { en: 'Not enough data', zh: '数据不足' },
  // status
  'status.Thinking': { en: 'Thinking', zh: '思考中' },
  'status.Executing': { en: 'Executing', zh: '执行中' },
  'status.Waiting': { en: 'Waiting', zh: '等待中' },
  'status.RateLimited': { en: 'Rate limited', zh: '限流' },
  'status.Done': { en: 'Done', zh: '已完成' },
  'status.Unknown': { en: 'Unknown', zh: '未知' },
  // rate limit
  'rl.label': { en: 'rate limit', zh: '限流' },
  'rl.5h': { en: '5-hour window', zh: '5 小时窗口' },
  'rl.7d': { en: '7-day window', zh: '7 天窗口' },
  'rl.resetsIn': { en: 'resets in {t}', zh: '{t}后重置' },
  // tables
  'tbl.port': { en: 'Port', zh: '端口' },
  'tbl.pid': { en: 'PID', zh: 'PID' },
  'tbl.command': { en: 'Command', zh: '命令' },
  'tbl.project': { en: 'Project', zh: '项目' },
  'mcp.parent': { en: 'Parent', zh: '父进程' },
  'mcp.profile': { en: 'Profile', zh: 'Profile' },
  'mcp.active': { en: 'Active / Total', zh: '活跃 / 总数' },
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let s = STR[key]?.[lang] ?? key
  if (params) {
    for (const k of Object.keys(params)) s = s.replace(`{${k}}`, String(params[k]))
  }
  return s
}

export type T = (key: string, params?: Record<string, string | number>) => string

interface Prefs {
  lang: Lang
  mode: Mode
  setLang: (l: Lang) => void
  setMode: (m: Mode) => void
  t: T
}

const Ctx = createContext<Prefs | null>(null)

export function usePrefs(): Prefs {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePrefs must be used within PrefsProvider')
  return v
}

export function useT(): T {
  return usePrefs().t
}

const readLang = (): Lang => (localStorage.getItem(LANG_KEY) === 'zh' ? 'zh' : 'en')
const readMode = (): Mode => (localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark')

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)
  const [mode, setModeState] = useState<Mode>(readMode)

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l)
    setLangState(l)
  }, [])
  const setMode = useCallback((m: Mode) => {
    localStorage.setItem(THEME_KEY, m)
    document.documentElement.dataset.theme = m
    setModeState(m)
  }, [])

  const t: T = useCallback((key, params) => translate(lang, key, params), [lang])

  return <Ctx.Provider value={{ lang, mode, setLang, setMode, t }}>{children}</Ctx.Provider>
}
