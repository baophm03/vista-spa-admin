import { useMemo, useState } from 'react'
import { Input } from 'antd'
import { CheckOutlined, SearchOutlined } from '@ant-design/icons'
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
  onBranchChange: (branchId?: string) => void
  onToggleStaff: (staffId: string) => void
  onToggleAllStaff: (visible: boolean) => void
  onToggleUnassigned: () => void
  onStatusChange: (status: string) => void
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
      className={`appt-filter-option flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border-0 px-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand-primary)] ${checked
        ? 'bg-[var(--brand-tint)] font-medium text-[var(--brand-dark)]'
        : 'bg-transparent text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      <span className="min-w-0 wrap-break-word">{label}</span>
      {checked && <CheckOutlined aria-hidden className="shrink-0 text-[12px]" />}
    </button>
  )
}

/** Các nhóm lọc lịch hẹn (Cơ sở / KTV / Trạng thái) — mỗi nhóm 1 thẻ trắng trong drawer "Bộ lọc lịch".
 *  Tiêu đề, số bộ lọc đang dùng và nút Đặt lại nằm ở header drawer (page.tsx). */
export default function AppointmentCalendarFilterPanel({
  branches,
  staff,
  branchFilter,
  hiddenStaff,
  unassignedVisible,
  statusFilter,
  onBranchChange,
  onToggleStaff,
  onToggleAllStaff,
  onToggleUnassigned,
  onStatusChange,
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
    <>
      <section className="appt-filter-card" aria-labelledby="appt-filter-branch">
        <h3 id="appt-filter-branch">Cơ sở</h3>
        {/* Ô tìm chỉ hiện khi danh sách đủ dài để cần tìm */}
        {branches.length > 5 && (
          <Input
            allowClear
            prefix={<SearchOutlined className="text-neutral-400" />}
            placeholder="Tìm cơ sở..."
            aria-label="Tìm cơ sở"
            value={branchQuery}
            onChange={(event) => setBranchQuery(event.target.value)}
          />
        )}
        <div role="group" aria-label="Lọc theo cơ sở" className="grid gap-0.5">
          <BranchOption checked={!branchFilter} label="Tất cả cơ sở" onClick={() => onBranchChange(undefined)} />
          <div className="appt-filter-scroll grid gap-0.5">
            {matchingBranches.map((branch) => (
              <BranchOption key={branch.id} checked={branchFilter === branch.id} label={branch.name} onClick={() => onBranchChange(branch.id)} />
            ))}
            {matchingBranches.length === 0 && (
              <p role="status" className="appt-filter-empty">
                {branchKeyword ? 'Không tìm thấy cơ sở phù hợp' : 'Chưa có cơ sở'}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="appt-filter-card" aria-labelledby="appt-filter-staff">
        <div className="appt-filter-card-head">
          <h3 id="appt-filter-staff">KTV phụ trách</h3>
          <span className="appt-filter-count">{visibleStaffCount}/{staff.length}</span>
        </div>
        {staff.length > 6 && (
          <Input
            allowClear
            prefix={<SearchOutlined className="text-neutral-400" />}
            placeholder="Tìm KTV..."
            aria-label="Tìm KTV trong bộ lọc"
            value={staffQuery}
            onChange={(event) => setStaffQuery(event.target.value)}
          />
        )}
        <div className="appt-filter-check appt-filter-check-all">
          <CheckCircle checked={allStaffVisible} indeterminate={someStaffVisible} onToggle={() => onToggleAllStaff(!allStaffVisible)}>
            <span className="font-medium">Tất cả KTV</span>
          </CheckCircle>
        </div>
        <div
          role="region"
          aria-label="Danh sách KTV phụ trách"
          tabIndex={0}
          className="appt-filter-scroll appt-filter-staff-list"
        >
          {filteredStaff.map((person) => {
            const index = staff.findIndex(({ id }) => id === person.id)
            return (
              <div key={person.id} className="appt-filter-check">
                <CheckCircle checked={!hiddenStaff.has(person.id)} onToggle={() => onToggleStaff(person.id)}>
                  <span aria-hidden className="appt-filter-swatch" style={{ background: staffChipColor(index) }} />
                  <span className="min-w-0 truncate">{person.label}</span>
                </CheckCircle>
              </div>
            )
          })}
          {filteredStaff.length === 0 && (
            <p className="appt-filter-empty">{staff.length ? 'Không có KTV khớp' : 'Chưa có KTV'}</p>
          )}
          <div className="appt-filter-check">
            <CheckCircle checked={unassignedVisible} onToggle={onToggleUnassigned}>
              <span aria-hidden className="appt-filter-swatch bg-neutral-400" />
              <span>Chưa phân công</span>
            </CheckCircle>
          </div>
        </div>
      </section>

      <section className="appt-filter-card" aria-labelledby="appt-filter-status">
        <h3 id="appt-filter-status">Trạng thái</h3>
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
                className={`appt-filter-option flex min-w-0 appearance-none items-center gap-2.5 rounded-lg border-0 px-3 text-left shadow-none transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand-primary)] ${selected ? 'font-medium' : 'bg-transparent text-neutral-700 hover:bg-neutral-50'}`}
                style={selected
                  ? { background: palette?.bg ?? 'var(--brand-tint)', color: palette?.text ?? 'var(--brand-dark)' }
                  : undefined}
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: palette?.accent ?? (selected ? 'var(--brand-primary)' : '#A1A1AA') }} />
                <span className="min-w-0 flex-1">{label}</span>
                {selected && <CheckOutlined aria-hidden className="shrink-0 text-[12px]" />}
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}
