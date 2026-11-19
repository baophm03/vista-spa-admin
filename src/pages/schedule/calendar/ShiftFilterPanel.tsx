import { useState } from 'react'
import { Button, Typography } from 'antd'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
import type { ShiftTemplate } from '../types'
import { shiftStyle } from './shiftStyles'
import CheckCircle from './CheckCircle'

interface Props {
  templates: ShiftTemplate[]
  /** Danh sách id ca đang bị ẩn khỏi calendar. */
  hidden: Set<string>
  onToggle: (templateId: string) => void
  onToggleAll: (visible: boolean) => void
}

/** "Hiển thị lịch" — lọc khối ca theo từng mẫu ca, chip tròn màu khớp màu khối trên calendar. */
export default function ShiftFilterPanel({ templates, hidden, onToggle, onToggleAll }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const sorted = [...templates].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
  const checkedCount = templates.filter((t) => !hidden.has(t.id)).length
  const allChecked = templates.length > 0 && checkedCount === templates.length
  const someChecked = checkedCount > 0 && checkedCount < templates.length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Typography.Text strong style={{ fontSize: 14, color: '#1F1F1F' }}>Hiển thị lịch</Typography.Text>
        <Button
          aria-label={collapsed ? 'Mở danh sách ca' : 'Thu gọn danh sách ca'}
          type="text" size="small"
          icon={collapsed ? <DownOutlined /> : <UpOutlined />}
          onClick={() => setCollapsed((current) => !current)}
        />
      </div>
      <div hidden={collapsed} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CheckCircle checked={allChecked} indeterminate={someChecked} onToggle={() => onToggleAll(!allChecked)}>
          <Typography.Text strong style={{ fontSize: 13, color: '#2B2C2D' }}>Tất cả ca làm</Typography.Text>
        </CheckCircle>
        <div
          className="flex max-h-48 flex-col gap-2.5 overflow-y-auto overscroll-contain pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--brand-border)]"
        >
          {sorted.map((template, index) => {
            const style = shiftStyle(template, index)
            const visible = !hidden.has(template.id)
            return (
              <CheckCircle key={template.id} checked={visible} onToggle={() => onToggle(template.id)}>
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: style.border,
                    marginInlineEnd: 2,
                    flexShrink: 0,
                  }}
                />
                <Typography.Text style={{ fontSize: 13, color: '#2B2C2D' }} ellipsis>
                  {template.name} ({template.start_time.slice(0, 5)} – {template.end_time.slice(0, 5)})
                </Typography.Text>
              </CheckCircle>
            )
          })}
        </div>
        {sorted.length === 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Chưa có ca làm nào</Typography.Text>
        )}
      </div>
    </div>
  )
}
