import { Can } from '@casl/react'
import { displayName } from '@/utils/displayName'
import { Button, Modal, Tag } from 'antd'
import dayjs from 'dayjs'
import { STATUS_META, appointmentTopic, type AppointmentRow } from './constants'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'
import { timeInMinutes } from '../calendar'

export interface AppointmentDetailModalProps {
  appointment: AppointmentRow | null
  canStart: boolean
  isPast: boolean
  canStartToday: boolean
  staffName?: (row: AppointmentRow) => string
  branchName?: (id?: string) => string
  onClose: () => void
  onEdit: (row: AppointmentRow) => void
  onApprove: (row: AppointmentRow) => void
  onReject: (row: AppointmentRow) => void
  onNoShow: (row: AppointmentRow) => void
  onCancelAppointment: (row: AppointmentRow) => void
  onStart: (row: AppointmentRow) => void
  onAssignStaff: (row: AppointmentRow) => void
  onComplete: (row: AppointmentRow) => void
}

function formatPhone(p?: string | null): string {
  if (!p) return ''
  const c = p.replace(/\D/g, '')
  if (c.length === 10) return `${c.slice(0, 4)} ${c.slice(4, 7)} ${c.slice(7)}`
  if (c.length === 11) return `${c.slice(0, 5)} ${c.slice(5, 8)} ${c.slice(8)}`
  return p
}

export default function AppointmentDetailModal({
  appointment,
  canStart,
  isPast,
  canStartToday,
  staffName,
  branchName,
  onClose,
  onEdit,
  onApprove,
  onReject,
  onNoShow,
  onCancelAppointment,
  onStart,
  onAssignStaff,
  onComplete,
}: AppointmentDetailModalProps) {
  if (!appointment) return null

  const row = appointment
  const statusKey = row.status as AppointmentStatus | undefined
  const statusMeta = (statusKey && STATUS_META[statusKey]) || { label: row.status || 'Chưa rõ', color: 'default' }
  const topic = appointmentTopic(row)


  const name = displayName(row.user, 'Khách vãng lai')
  const phone = row.user?.phone
  const dateFormatted = row.appt_date ? dayjs(row.appt_date).format('DD/MM/YYYY') : '—'
  const startMinute = timeInMinutes(row.start_time)
  const endMinute = timeInMinutes(row.end_time)
  const time = row.start_time?.slice(0, 5) || ''
  const timeRange = time && endMinute !== null && startMinute !== null && endMinute > startMinute
    ? `${time} – ${row.end_time?.slice(0, 5)}`
    : time

  const duration = endMinute !== null && startMinute !== null && endMinute > startMinute ? endMinute - startMinute : null

  const staff = staffName ? staffName(row) : (row.staff?.zalo_name || 'Chưa phân công')
  const staffDisplay = staff === 'Chưa phân công' ? 'Chưa gán KTV' : staff
  const branchDisplay = branchName ? branchName(row.branch_id) : '—'

  return (
    <Modal
      title="Chi tiết lịch hẹn"
      width={500}
      open={!!appointment}
      onCancel={onClose}
      destroyOnClose
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button onClick={onClose}>Đóng</Button>

          <Can I="UPDATE" a="APPOINTMENT">
            <Button onClick={() => { onClose(); onAssignStaff(row) }}>
              {row.staff_id ? 'Đổi KTV' : 'Gán KTV'}
            </Button>
          </Can>

          {['pending', 'approved'].includes(row.status ?? '') && (
            <Can I="UPDATE" a="APPOINTMENT">
              <Button onClick={() => { onClose(); onEdit(row) }}>
                Đổi lịch
              </Button>
            </Can>
          )}

          {row.status === 'in_progress' && (
            <Can I="START" a="APPOINTMENT">
              <Button type="primary" onClick={() => { onClose(); onComplete(row) }}>
                Hoàn tất
              </Button>
            </Can>
          )}

          {row.status === 'pending' && (
            <Can I="APPROVE" a="APPOINTMENT">
              <Button danger onClick={() => { onClose(); onReject(row) }}>
                Từ chối
              </Button>
              <Button type="primary" onClick={() => { onClose(); onApprove(row) }}>
                Duyệt lịch
              </Button>
            </Can>
          )}

          {row.status === 'approved' && isPast && (
            <Can I="APPROVE" a="APPOINTMENT">
              <Button onClick={() => { onClose(); onNoShow(row) }}>
                Không đến
              </Button>
            </Can>
          )}

          {['pending', 'approved'].includes(row.status ?? '') && (
            <Can I="APPROVE" a="APPOINTMENT">
              <Button danger onClick={() => { onClose(); onCancelAppointment(row) }}>
                Hủy lịch
              </Button>
            </Can>
          )}

          {row.status === 'approved' && canStart && (
            <Can I="START" a="APPOINTMENT">
              <Button
                type="primary"
                disabled={!canStartToday}
                title={!canStartToday ? 'Chỉ bắt đầu được trong ngày hẹn, sau giờ hẹn' : undefined}
                onClick={() => { onClose(); onStart(row) }}
              >
                Bắt đầu làm
              </Button>
            </Can>
          )}
        </div>
      }
    >
      <div className="pt-2">
        {/* Khách hàng & Trạng thái */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="m-0 break-words text-base font-semibold leading-snug text-slate-900">
              {name}
            </h3>
            <Tag color="blue" className="rounded font-medium m-0">
              Tư vấn
            </Tag>
          </div>
          <Tag color={statusMeta.color} className="font-medium m-0">
            {statusMeta.label}
          </Tag>
        </div>

        {/* Danh sách thông tin chi tiết */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-1 py-4 text-sm text-slate-700">
          {topic && (
            <div className="col-span-2 flex min-w-0 flex-col gap-0.5 break-words">
              <span className="text-xs text-slate-500">Chủ đề · {topic.kind}</span>
              <span className="font-semibold text-slate-900 whitespace-pre-line">{topic.label}</span>
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-0.5 break-words">
            <span className="text-xs text-slate-500">Thời gian</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {dateFormatted}{timeRange && (" · " + timeRange)}
              {duration ? <span className="font-normal text-slate-500 ml-1">({duration} phút)</span> : null}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-0.5 break-words">
            <span className="text-xs text-slate-500">KTV phụ trách</span>
            <span className={staffDisplay === 'Chưa gán KTV' ? 'text-slate-400 italic' : 'font-medium text-slate-900'}>
              {staffDisplay}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-0.5 break-words">
            <span className="text-xs text-slate-500">Số điện thoại</span>
            {phone ? (
              <a href={`tel:${phone}`} className="font-medium text-[var(--brand-primary)] hover:underline tabular-nums">
                {formatPhone(phone)}
              </a>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-0.5 break-words">
            <span className="text-xs text-slate-500">Cơ sở</span>
            <span className="text-slate-800">{branchDisplay}</span>
          </div>

          <div className="flex min-w-0 flex-col gap-0.5 break-words">
            <span className="text-xs text-slate-500">Nguồn đặt</span>
            <span className="text-slate-800">
              {row.created_via === 'APP' ? 'Zalo Mini App' : 'Nội bộ tạo'}
            </span>
          </div>

          {row.note && (
            <div className="col-span-2 flex min-w-0 flex-col gap-1 break-words border-t border-slate-100 pt-2">
              <span className="text-xs text-slate-500">Ghi chú</span>
              <span className="text-slate-800 flex-1 leading-relaxed">{row.note}</span>
            </div>
          )}

          {row.reject_reason && (
            <div className="col-span-2 flex min-w-0 flex-col gap-1 break-words border-t border-slate-100 pt-2 text-red-600">
              <span className="text-xs font-medium">Lý do từ chối</span>
              <span className="flex-1">{row.reject_reason}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
