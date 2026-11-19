import { useState } from 'react'
import { Button, Input, Typography } from 'antd'
import { DownOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons'
import { staffLabel, type ScheduleStaff } from '../types'
import { staffChipColor } from './shiftStyles'
import CheckCircle from './CheckCircle'

interface Props {
  staff: ScheduleStaff[]
  /** Danh sách id KTV đang bị ẩn khỏi calendar. */
  hidden: Set<string>
  onToggle: (staffId: string) => void
}

/** "KTV" — tìm kiếm + danh sách KTV có cuộn (khi nhiều kỹ thuật viên), mỗi KTV một màu. */
export default function StaffFilterPanel({ staff, hidden, onToggle }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const keyword = query.trim().toLowerCase()
  const filteredStaff = keyword
    ? staff.filter((person) => staffLabel(person).toLowerCase().includes(keyword))
    : staff

  return (
    <div style={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
        <Typography.Text strong style={{ fontSize: 14, color: '#1F1F1F' }}>Nhân viên</Typography.Text>
        <Button
          aria-label={collapsed ? 'Mở danh sách nhân viên' : 'Thu gọn danh sách nhân viên'}
          type="text" size="small"
          icon={collapsed ? <DownOutlined /> : <UpOutlined />}
          onClick={() => setCollapsed((current) => !current)}
        />
      </div>
      <div hidden={collapsed} style={{ marginTop: 10, display: collapsed ? 'none' : 'flex', flex: '1 1 auto', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <Input
          allowClear
          size="small"
          prefix={<SearchOutlined style={{ color: '#9AA0A6' }} />}
          placeholder="Tìm nhân viên..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ flexShrink: 0 }}
        />
        <div
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--brand-border)]"
        >
          {filteredStaff.map((person, index) => {
            const visible = !hidden.has(person.id)
            return (
              <CheckCircle key={person.id} checked={visible} onToggle={() => onToggle(person.id)}>
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    borderRadius: 4,
                    background: staffChipColor(index),
                    marginInlineEnd: 2,
                    flexShrink: 0,
                  }}
                />
                <Typography.Text style={{ fontSize: 13, color: '#2B2C2D' }} ellipsis>{staffLabel(person)}</Typography.Text>
              </CheckCircle>
            )
          })}
          {filteredStaff.length === 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Không có nhân viên nào khớp</Typography.Text>
          )}
        </div>
      </div>
    </div>
  )
}
