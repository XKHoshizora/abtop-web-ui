import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { OrphanPort } from '../types'
import { firstWords } from '../lib/format'
import { useT } from '../prefs'

export function PortsPanel({ items }: { items: OrphanPort[] }) {
  const t = useT()
  const columns: ColumnsType<OrphanPort> = [
    {
      title: t('tbl.port'),
      dataIndex: 'port',
      width: 90,
      render: (port: number) => (
        <Tag bordered={false} color="warning" style={{ marginInlineEnd: 0 }}>
          :{port}
        </Tag>
      ),
    },
    {
      title: t('tbl.pid'),
      dataIndex: 'pid',
      width: 90,
      render: (pid: number) => <span className="mono" style={{ color: 'var(--text-2)' }}>{pid}</span>,
    },
    {
      title: t('tbl.command'),
      dataIndex: 'command',
      ellipsis: true,
      render: (cmd: string) => <span className="mono" style={{ color: 'var(--bright)' }}>{firstWords(cmd, 4)}</span>,
    },
    { title: t('tbl.project'), dataIndex: 'project_name', width: 140, ellipsis: true },
  ]

  return (
    <Table
      rowKey={(r) => `${r.pid}:${r.port}`}
      columns={columns}
      dataSource={items}
      pagination={false}
      size="small"
    />
  )
}
