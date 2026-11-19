import { useState } from 'react'
import { Button, Input, Select, Typography } from 'antd'
import { CalendarOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons'
import { type Dayjs } from 'dayjs'
import type { Branch } from '@/api/models/branch'
import type { ScheduleStaff, ShiftTemplate } from '../types'
import { staffLabel } from '../types'
import { hasShiftStarted, isPastScheduleDate } from '../registrationTime'

export interface QuickCreatePayload {
  staffId: string
  branchId?: string
  templateIds: string[]
  note?: string
}

interface Props {
  date: Dayjs
  staff: ScheduleStaff[]
  branches: Branch[]
  branchFilter?: string
  templates: ShiftTemplate[]
  /** KTV tự đăng ký: khóa KTV theo hồ sơ, cơ sở theo chi nhánh của mình. */
  isTechSelf: boolean
  currentUserId?: string
  canManage: boolean
  onSubmit: (payload: QuickCreatePayload) => Promise<void>
  onMoreOptions: (preset: { staffId?: string; templateId?: string }) => void
  onClose: () => void
}

const WEEKDAY_FULL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

/** Popup tạo nhanh kiểu Google Calendar: KTV + ca + ghi chú, bấm Lưu là xong.
 *  "Thêm chi tiết" mở form đầy đủ với giá trị đã chọn. */
export default function QuickCreatePopover({
  date, staff, branches, branchFilter, templates, isTechSelf, currentUserId,
  canManage, onSubmit, onMoreOptions, onClose,
}: Props) {
  const [saving, setSaving] = useState(false)
  const ownStaff = staff.find((person) => person.id === currentUserId)
  const [branchId, setBranchId] = useState<string | undefined>(() => branchFilter ?? ownStaff?.branch_id ?? branches[0]?.id)
  const [staffId, setStaffId] = useState<string | undefined>(() => isTechSelf ? currentUserId : undefined)
  const [templateIds, setTemplateIds] = useState<string[]>([])
  const [note, setNote] = useState('')
  const dateKey = date.format('YYYY-MM-DD')
  const pastDate = isPastScheduleDate(dateKey)

  const resolvedBranch = isTechSelf ? (ownStaff?.branch_id ?? branchId) : branchId
  const staffOptions = staff.filter((person) => person.branch_id === resolvedBranch)
  const templateOptions = templates.filter(
    (template) => template.is_active !== false && (!template.branch_id || template.branch_id === resolvedBranch),
  )

  const save = async () => {
    if (!staffId) return
    if (pastDate || templateIds.length === 0 || templateOptions.some((template) => templateIds.includes(template.id) && hasShiftStarted(dateKey, template.start_time))) return
    setSaving(true)
    try {
      await onSubmit({ staffId, branchId: resolvedBranch, templateIds, note: note.trim() || undefined })
      onClose()
    } catch {
      // Lỗi đã được thông báo ở cha — giữ popup mở để sửa lại
    } finally {
      setSaving(false)
    }
  }

  const showBranchSelect = canManage && !branchFilter && branches.length > 1

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--brand-border-soft)', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px 0' }}>
        <Typography.Text strong style={{ fontSize: 16, color: 'var(--brand-secondary-ink)' }}>Tạo ca làm</Typography.Text>
        <Button aria-label="Đóng" type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, padding: '0 14px' }}>
        {WEEKDAY_FULL[date.day()]}, {date.format('DD/MM/YYYY')}
      </Typography.Text>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarOutlined style={{ color: '#5F6368' }} />
          <Typography.Text style={{ fontSize: 12.5 }}>Ngày: {date.format('DD/MM/YYYY')}</Typography.Text>
        </span>

        <div>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>KTV</Typography.Text>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn KTV"
            size="small"
            style={{ width: '100%' }}
            value={staffId}
            disabled={isTechSelf}
            notFoundContent="Không có KTV ở cơ sở này"
            onChange={(value) => { setStaffId(value); setTemplateIds([]) }}
            options={staffOptions.map((person) => ({ value: person.id, label: staffLabel(person) }))}
          />
        </div>

        {showBranchSelect && (
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Cơ sở</Typography.Text>
            <Select
              size="small"
              style={{ width: '100%' }}
              value={branchId}
              onChange={(value) => { setBranchId(value); setStaffId(undefined); setTemplateIds([]) }}
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            />
          </div>
        )}

        <div>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Ca (chọn nhiều)</Typography.Text>
          <Select
            mode="multiple"
            allowClear
            size="small"
            placeholder="Chọn ca"
            style={{ width: '100%' }}
            value={templateIds}
            disabled={!staffId || pastDate}
            onChange={(value) => setTemplateIds(value as string[])}
            options={templateOptions.map((template) => ({
              disabled: hasShiftStarted(dateKey, template.start_time),
              value: template.id,
              label: `${template.name} (${template.start_time.slice(0, 5)}–${template.end_time.slice(0, 5)})`,
            }))}
          />
        </div>

        <Input
          size="small"
          placeholder="Ghi chú (không bắt buộc)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          prefix={<EditOutlined style={{ color: '#9AA0A6', fontSize: 12 }} />}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, padding: '0 14px 12px' }}>
        <Button
          type="text"
          icon={<EditOutlined style={{ fontSize: 12 }} />}
          disabled={!staffId}
          onClick={() => onMoreOptions({ staffId, templateId: templateIds[0] })}
        >
          Thêm chi tiết
        </Button>
        <Button
          type="primary"
          loading={saving}
          disabled={pastDate || !staffId || templateIds.length === 0}
          onClick={() => void save()}
        >
          Lưu
        </Button>
      </div>
    </div>
  )
}
