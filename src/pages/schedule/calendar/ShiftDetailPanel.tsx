import { Avatar, Button, Typography } from 'antd'
import {
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  UserDeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { type Dayjs } from 'dayjs'
import type { ScheduleStaff, ShiftTemplate, StaffScheduleDate } from '../types'
import { staffLabel } from '../types'
import { formatDurationLong, formatPanelDate, shiftStyle } from './shiftStyles'
import type { ScheduleBlock } from './ScheduleTimeGrid'

export interface ShiftDetailContentProps {
  block: ScheduleBlock | null
  staffById: Map<string, ScheduleStaff>
  branches: { id?: string; name?: string }[]
  canManage: boolean
  canEditRow: (row: StaffScheduleDate) => boolean
  onEditRow: (row: StaffScheduleDate) => void
  onRemoveRow: (row: StaffScheduleDate) => void
  onDuplicate: (block: ScheduleBlock) => void
  onDeleteBlock: (block: ScheduleBlock) => void
  onClose: () => void
}

/** Nội dung popup chi tiết ca (kiểu Google Calendar) — hiển thị trong Popover bám theo khối. */
export function ShiftDetailContent({
  block, staffById, branches, canManage, canEditRow, onEditRow, onRemoveRow, onDuplicate, onDeleteBlock, onClose,
}: ShiftDetailContentProps) {
  if (!block) return null
  const style = shiftStyle(block.template, block.templateIndex)
  const template: ShiftTemplate | null = block.template
  const date: Dayjs = block.date
  const branch = branches.find((item) => item.id === block.rows[0]?.branch_id)
  const hasLeave = block.rows.some((row) => row.onLeave)
  const canTouchAny = block.rows.some((row) => canEditRow(row))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 300 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Typography.Text strong style={{ fontSize: 17, color: 'var(--brand-secondary-ink)' }}>{template?.name ?? 'Ca làm việc'}</Typography.Text>
        <Button aria-label="Đóng" type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 2 }}>
        {formatPanelDate(date)}
      </Typography.Text>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClockCircleOutlined style={{ color: style.border }} />
          <Typography.Text style={{ fontSize: 12.5 }}>
            {template ? `${template.start_time.slice(0, 5)} – ${template.end_time.slice(0, 5)} (${formatDurationLong(template.start_time, template.end_time)})` : '—'}
          </Typography.Text>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <EnvironmentOutlined style={{ color: style.border }} />
          <Typography.Text style={{ fontSize: 12.5 }}>Cơ sở: {branch?.name ?? 'Tất cả cơ sở'}</Typography.Text>
        </span>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <TeamOutlined style={{ color: style.border }} />
          <Typography.Text strong style={{ fontSize: 13 }}>{block.rows.length} KTV</Typography.Text>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {block.rows.map((row) => {
            const person = staffById.get(row.staff_id)
            const editable = canEditRow(row)
            const avatarUrl = person?.zalo_avatar ?? null
            return (
              <div
                key={row.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  border: '1px solid var(--brand-border-soft)', borderRadius: 10, padding: '6px 8px', background: '#fff',
                }}
              >
                <Avatar
                  style={avatarUrl ? undefined : { background: style.border, flexShrink: 0 }}
                  src={avatarUrl ?? undefined}
                  size={26}
                >
                  {staffLabel(person).slice(0, 1).toUpperCase()}
                </Avatar>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="flex min-w-0 items-center gap-1">
                    <Typography.Text strong ellipsis={{ tooltip: staffLabel(person) }} style={{ minWidth: 0, fontSize: 12.5 }}>{staffLabel(person)}</Typography.Text>
                    {row.onLeave && <span className="shrink-0 text-xs font-semibold" title="Nghỉ phép" aria-label="Nghỉ phép">(P)</span>}
                  </div>
                  {row.note && (
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {row.note}
                    </Typography.Text>
                  )}
                </div>
                {editable && (
                  <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <Button aria-label={`Sửa ca của ${staffLabel(person)}`} type="text" size="small" icon={<EditOutlined />} onClick={() => onEditRow(row)} />
                    <Button aria-label={`Gỡ ${staffLabel(person)} khỏi ca`} type="text" size="small" danger icon={<UserDeleteOutlined />} onClick={() => onRemoveRow(row)} />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, flexWrap: 'wrap' }}>
        {canTouchAny && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => onEditRow(block.rows.find((row) => canEditRow(row))!)}>
            Chỉnh sửa
          </Button>
        )}
        {canManage && canTouchAny && (
          <Button icon={<CopyOutlined />} onClick={() => onDuplicate(block)}>Nhân bản</Button>
        )}
        {!hasLeave && (canManage || canTouchAny) && (
          <Button danger icon={<DeleteOutlined />} onClick={() => onDeleteBlock(block)}>Xóa</Button>
        )}
      </div>
    </div>
  )
}
