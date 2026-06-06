import { Tag } from 'antd'
import type { ChildProcess } from '../types'
import { firstWords, fmtMemMb } from '../lib/format'

/** One child-process line, shared by the session card and the detail drawer. */
export function ChildRow({ c, words = 3 }: { c: ChildProcess; words?: number }) {
  return (
    <div
      className="mono"
      style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--text-2)', padding: '2px 0' }}
    >
      <span style={{ color: 'var(--text-4)' }}>{c.pid}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {firstWords(c.command, words)}
      </span>
      <span>{fmtMemMb(c.mem_kb)}</span>
      {c.port != null && (
        <Tag bordered={false} color="warning" style={{ marginInlineEnd: 0, fontSize: 10 }}>
          :{c.port}
        </Tag>
      )}
    </div>
  )
}
