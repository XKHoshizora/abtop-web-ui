// TypeScript shapes mirroring the Rust `Snapshot` DTO (src/snapshot.rs in the
// abtop fork). Keep field names in sync with that struct.

export type SessionStatus =
  | 'Thinking'
  | 'Executing'
  | 'Waiting'
  | 'RateLimited'
  | 'Done'
  | 'Unknown'

export interface ChildProcess {
  pid: number
  command: string
  mem_kb: number
  port: number | null
}

export interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

export interface ToolCall {
  name: string
  arg: string
  duration_ms: number
}

export interface SubAgent {
  name: string
  status: string
  tokens: number
}

export interface SessionView {
  agent_cli: string
  pid: number
  session_id: string
  project_name: string
  cwd: string
  config_root: string
  status: SessionStatus
  model: string
  effort: string
  version: string
  context_percent: number
  context_window: number
  total_tokens: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_create_tokens: number
  turn_count: number
  mem_mb: number
  git_branch: string
  git_added: number
  git_modified: number
  started_at_ms: number
  elapsed_secs: number
  summary: string
  current_task: string | null
  children: ChildProcess[]
  // richer detail-view fields
  compaction_count: number
  token_history: number[]
  subagents: SubAgent[]
  tool_calls: ToolCall[]
  chat_messages: ChatMsg[]
}

export interface RateLimitInfo {
  source: string
  five_hour_pct: number | null
  five_hour_resets_at: number | null
  seven_day_pct: number | null
  seven_day_resets_at: number | null
  updated_at: number | null
}

export interface OrphanPort {
  port: number
  pid: number
  command: string
  project_name: string
}

export interface McpServerView {
  pid: number
  parent_cli: string
  profile: string | null
  mem_kb: number
  active_count: number
  rollout_count: number
  last_activity_ms: number | null
}

export interface HostMetrics {
  cpu_pct: number
  mem_pct: number
  load1: number
}

export interface AgentAggregate {
  mem_mb: number
  avg_ctx_pct: number
  active_count: number
}

export interface Snapshot {
  generated_at_ms: number
  host: HostMetrics | null
  aggregate: AgentAggregate
  token_rate: number
  interval_ms: number
  sessions: SessionView[]
  rate_limits: RateLimitInfo[]
  orphan_ports: OrphanPort[]
  mcp_servers: McpServerView[]
}
