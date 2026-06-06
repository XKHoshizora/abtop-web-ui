import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { McpServerView } from '../types'
import { useT } from '../prefs'

export function McpPanel({ items }: { items: McpServerView[] }) {
  const t = useT()
  const columns: ColumnsType<McpServerView> = [
    {
      title: t('tbl.pid'),
      dataIndex: 'pid',
      width: 90,
      render: (pid: number) => <span className="mono" style={{ color: 'var(--text-2)' }}>{pid}</span>,
    },
    {
      title: t('mcp.parent'),
      dataIndex: 'parent_cli',
      width: 110,
      render: (cli: string) => (
        <Tag bordered={false} style={{ marginInlineEnd: 0 }}>
          {cli}
        </Tag>
      ),
    },
    {
      title: t('mcp.profile'),
      dataIndex: 'profile',
      ellipsis: true,
      render: (p: string | null) => <span className="mono">{p ?? 'default'}</span>,
    },
    {
      title: t('mcp.active'),
      key: 'rollouts',
      width: 110,
      render: (_, r) => (
        <span className="mono">
          <span style={{ color: '#34d399' }}>{r.active_count}</span>
          <span style={{ color: 'var(--text-4)' }}> / {r.rollout_count}</span>
        </span>
      ),
    },
  ]

  return <Table rowKey="pid" columns={columns} dataSource={items} pagination={false} size="small" />
}
