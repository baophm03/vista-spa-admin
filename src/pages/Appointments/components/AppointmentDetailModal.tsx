import { Can } from '@casl/react'
import { Button, Modal, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { STATUS_META, type AppointmentRow } from './constants'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'

export interface AppointmentDetailModalProps {
  appointment: AppointmentRow | null
  canStart: boolean
  isPast: boolean
  canStartToday: boolean
  onClose: () => void
  onEdit: (row: AppointmentRow) => void
  onApprove: (row: AppointmentRow) => void
  onReject: (row: AppointmentRow) => void
  onNoShow: (row: AppointmentRow) => void
  onCancelAppointment: (row: AppointmentRow) => void
  onStart: (row: AppointmentRow) => void
}

export default function AppointmentDetailModal({
  appointment,
  canStart,
  isPast,
  canStartToday,
  onClose,
  onEdit,
  onApprove,
  onReject,
  onNoShow,
  onCancelAppointment,
  onStart,
}: AppointmentDetailModalProps) {
  const selectedAppointment = appointment
  return (
    <Modal
      title="Chi tiết lịch hẹn"
      width="min(900px, calc(100vw - 24px))"
      open={!!selectedAppointment}
      onCancel={onClose}
      footer={selectedAppointment ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Đóng</Button>
          {['pending', 'approved'].includes(selectedAppointment.status ?? '') && (
            <Can I="UPDATE" a="APPOINTMENT">
              <Button onClick={() => { const row = selectedAppointment; onClose(); onEdit(row) }}>Đổi lịch</Button>
            </Can>
          )}
          {selectedAppointment.status === 'pending' && (
            <Can I="APPROVE" a="APPOINTMENT">
              <Button onClick={() => { const row = selectedAppointment; onClose(); onApprove(row) }}>Duyệt</Button>
              <Button danger onClick={() => { const row = selectedAppointment; onClose(); onReject(row) }}>Từ chối</Button>
            </Can>
          )}
          {selectedAppointment.status === 'approved' && isPast && (
            <Can I="APPROVE" a="APPOINTMENT">
              <Button onClick={() => { const row = selectedAppointment; onClose(); onNoShow(row) }}>Không đến</Button>
            </Can>
          )}
          {['pending', 'approved'].includes(selectedAppointment.status ?? '') && (
            <Can I="APPROVE" a="APPOINTMENT">
              <Button danger onClick={() => { const row = selectedAppointment; onClose(); onCancelAppointment(row) }}>Hủy lịch</Button>
            </Can>
          )}
          {selectedAppointment.status === 'approved' && canStart && (
            <Can I="START" a="APPOINTMENT">
              <Button
                type="primary"
                disabled={!canStartToday}
                title={!canStartToday ? 'Chỉ bắt đầu được trong ngày hẹn, sau giờ hẹn' : undefined}
                onClick={() => { const row = selectedAppointment; onClose(); onStart(row) }}
              >
                Bắt đầu
              </Button>
            </Can>
          )}
        </div>
      ) : null}
    >
      {selectedAppointment && (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text><strong>Khách hàng:</strong> {selectedAppointment.customer_profile?.full_name || '—'} ({selectedAppointment.customer_profile?.phone || 'không có số điện thoại'})</Typography.Text>
          <Typography.Text><strong>Thời gian:</strong> {dayjs(selectedAppointment.appt_date).format('DD/MM/YYYY')} {selectedAppointment.start_time?.slice(0, 5)}</Typography.Text>
          <Typography.Text><strong>Trạng thái:</strong> <Tag color={STATUS_META[selectedAppointment.status as AppointmentStatus]?.color}>{STATUS_META[selectedAppointment.status as AppointmentStatus]?.label || selectedAppointment.status}</Tag></Typography.Text>
          {selectedAppointment.note && <Typography.Text><strong>Ghi chú:</strong> {selectedAppointment.note}</Typography.Text>}
          {selectedAppointment.reject_reason && <Typography.Text><strong>Lý do từ chối:</strong> {selectedAppointment.reject_reason}</Typography.Text>}
        </Space>
      )}
    </Modal>
  )
}
