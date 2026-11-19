import { useMemo, useState } from 'react'
import { Button, Input, Typography } from 'antd'
import { CheckOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import type { Branch } from '@/api/models/branch'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'
import { STATUS_COLORS, STATUS_META } from './constants'
import CheckCircle from '../../schedule/calendar/CheckCircle'
import { staffChipColor } from '../../schedule/calendar/shiftStyles'

interface StaffOption {
  id: string
  label: string
}

interface Props {
  branches: Branch[]
  staff: StaffOption[]
  branchFilter?: string
  hiddenStaff: Set<string>
  unassignedVisible: boolean
  statusFilter: string
  activeFilterCount: number
  onBranchChange: (branchId?: string) => void
  onToggleStaff: (staffId: string) => void
  onToggleAllStaff: (visible: boolean) => void
  onToggleUnassigned: () => void
  onStatusChange: (status: string) => void
  onReset: () => void
}

function normalizeBranchSearch(value: string) {
  return value.trim().toLocaleLowerCase('vi').normalize('NFD')
    .replace(/\p{M}/gu, '').replace(/đ/g, 'd')
}

function BranchOption({
  checked,
  label,
  onClick,
}: {
  checked: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onClick}
      className={`flex min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md border-0 px-2.5 text-left text-[13px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand-primary)] ${checked
        ? 'bg-[var(--brand-tint)] font-medium text-[var(--brand-dark)]'
        : 'bg-transparent text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      <span className="min-w-0 wrap-break-word">{label}</span>
      {checked && <CheckOutlined aria-hidden className="shrink-0 text-[11px]" />}
    </button>
  )
}

export default function AppointmentCalendarFilterPanel({
  branches,
  staff,
  branchFilter,
  hiddenStaff,
  unassignedVisible,
  statusFilter,
  activeFilterCount,
  onBranchChange,
  onToggleStaff,
  onToggleAllStaff,
  onToggleUnassigned,
  onStatusChange,
  onReset,
}: Props) {
  const [branchQuery, setBranchQuery] = useState('')
  const branchKeyword = normalizeBranchSearch(branchQuery)
  const matchingBranches = branches.filter(({ name }) => normalizeBranchSearch(name).includes(branchKeyword))
  const [staffQuery, setStaffQuery] = useState('')
  const visibleStaffCount = staff.filter(({ id }) => !hiddenStaff.has(id)).length
  const allStaffVisible = visibleStaffCount === staff.length
  const someStaffVisible = visibleStaffCount > 0 && !allStaffVisible
  const filteredStaff = useMemo(() => {
    const keyword = staffQuery.trim().toLocaleLowerCase('vi')
    return keyword ? staff.filter(({ label }) => label.toLocaleLowerCase('vi').includes(keyword)) : staff
  }, [staff, staffQuery])

  const statuses = [
    { value: 'all', label: 'Tất cả trạng thái' },
    ...Object.entries(STATUS_META).map(([value, { label }]) => ({ value, label })),
  ]

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex min-h-8 items-center gap-2">
        <FilterOutlined aria-hidden className="text-[var(--brand-primary)]" />
        <h2 className="flex-1 text-[13px] font-semibold leading-5 text-neutral-800">Bộ lọc lịch</h2>
        {activeFilterCount > 0 && (
          <span aria-label={`${activeFilterCount} bộ lọc đang dùng`} className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brand-tint)] px-1 text-[11px] font-semibold text-[var(--brand-dark)]">
            {activeFilterCount}
          </span>
        )}
        {activeFilterCount > 0 && (
          <Button type="link" size="small" className="h-6! px-0! text-[11px]!" onClick={onReset}>Đặt lại</Button>
        )}
      </div>

      <section className="grid gap-1.5 border-t border-[var(--brand-border-soft)] pt-3">
        <h3 className="text-[12px] font-semibold leading-4 text-neutral-700">Cơ sở</h3>
        <Input
          allowClear
          size="small"
          prefix={<SearchOutlined className="text-neutral-400" />}
          placeholder="Tìm cơ sở..."
          aria-label="Tìm cơ sở"
          value={branchQuery}
          onChange={(event) => setBranchQuery(event.target.value)}
        />
        <div role="group" aria-label="Lọc theo cơ sở" className="grid gap-0.5">
          <BranchOption checked={!branchFilter} label="Tất cả cơ sở" onClick={() => onBranchChange(undefined)} />
          <div className="max-h-32 space-y-0.5 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
            {matchingBranches.map((branch) => (
              <BranchOption key={branch.id} checked={branchFilter === branch.id} label={branch.name} onClick={() => onBranchChange(branch.id)} />
            ))}
            {matchingBranches.length === 0 && (
              <p role="status" className="px-2.5 py-1 text-xs text-neutral-600">
                {branchKeyword ? 'Không tìm thấy cơ sở phù hợp' : 'Chưa có cơ sở'}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-2 border-t border-[var(--brand-border-soft)] pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[12px] font-semibold leading-4 text-neutral-700">KTV phụ trách</h3>
          <span className="tabular-nums text-[11px] text-neutral-500">{visibleStaffCount}/{staff.length}</span>
        </div>
        <CheckCircle checked={allStaffVisible} indeterminate={someStaffVisible} onToggle={() => onToggleAllStaff(!allStaffVisible)}>
          <Typography.Text strong style={{ fontSize: 12, color: '#2B2C2D' }}>Tất cả KTV</Typography.Text>
        </CheckCircle>
        <Input
          allowClear
          size="small"
          prefix={<SearchOutlined style={{ color: '#8B9097' }} />}
          placeholder="Tìm KTV..."
          aria-label="Tìm KTV trong bộ lọc"
          value={staffQuery}
          onChange={(event) => setStaffQuery(event.target.value)}
          className="rounded-lg!"
        />
        <div
          role="region"
          aria-label="Danh sách KTV phụ trách"
          tabIndex={0}
          className="max-h-32 space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"
        >
          {filteredStaff.map((person) => {
            const index = staff.findIndex(({ id }) => id === person.id)
            return (
              <CheckCircle key={person.id} checked={!hiddenStaff.has(person.id)} onToggle={() => onToggleStaff(person.id)}>
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: staffChipColor(index) }} />
                <Typography.Text style={{ fontSize: 12, color: '#2B2C2D' }} ellipsis>{person.label}</Typography.Text>
              </CheckCircle>
            )
          })}
          {filteredStaff.length === 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{staff.length ? 'Không có KTV khớp' : 'Chưa có KTV'}</Typography.Text>
          )}
          <CheckCircle checked={unassignedVisible} onToggle={onToggleUnassigned}>
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-neutral-400" />
            <Typography.Text style={{ fontSize: 12, color: '#2B2C2D' }}>Chưa phân công</Typography.Text>
          </CheckCircle>
        </div>
      </section>

      <section className="grid gap-1.5 border-t border-[var(--brand-border-soft)] pt-3">
        <h3 className="text-[12px] font-semibold leading-4 text-neutral-700">Trạng thái</h3>
        <div role="group" aria-label="Lọc theo trạng thái" className="grid min-w-0 gap-0.5">
          {statuses.map(({ value, label }) => {
            const selected = statusFilter === value
            const palette = value === 'all' ? undefined : STATUS_COLORS[value as AppointmentStatus]
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => onStatusChange(value)}
                className={`flex min-h-8 min-w-0 appearance-none items-center gap-2 rounded-md border-0 px-2.5 py-1 text-left text-xs leading-4 shadow-none transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand-primary)] ${selected ? 'font-semibold' : 'bg-transparent text-neutral-700 hover:bg-neutral-100'}`}
                style={selected
                  ? { background: palette?.bg ?? 'var(--brand-tint)', color: palette?.text ?? 'var(--brand-dark)' }
                  : undefined}
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: palette?.accent ?? (selected ? 'var(--brand-primary)' : '#A1A1AA') }} />
                <span className="min-w-0 flex-1">{label}</span>
                {selected && <CheckOutlined aria-hidden className="shrink-0 text-[11px]" />}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
