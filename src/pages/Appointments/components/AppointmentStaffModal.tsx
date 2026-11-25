import { useEffect, useState } from 'react'
import { Alert, Modal, Select, message } from 'antd'
import { errorMessage, pickData } from '@/api/helpers'
import { getAppointmentsAvailableSlots, putAppointmentsIdStaffAdmin } from '@/api/endpoints/appointments'
import type { AppointmentRow } from './constants'

/** Lịch còn hiệu lực (chiếm slot KTV): chỉ cho chọn KTV rảnh đúng khung giờ của lịch. */
const ACTIVE_STATUSES = ['pending', 'approved', 'in_progress']

interface AppointmentStaffModalProps {
  appointment: AppointmentRow | null
  /** KTV của cơ sở (id, label) */
  staffOptions: { id: string; label: string }[]
  onClose: () => void
  onSaved: () => void
}

/** Gán / đổi / bỏ KTV phụ trách lịch hẹn — dùng được ở mọi trạng thái. */
export default function AppointmentStaffModal({ appointment, staffOptions, onClose, onSaved }: AppointmentStaffModalProps) {
  const [staffId, setStaffId] = useState<string | null>(null)
  const [availableIds, setAvailableIds] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const isActive = ACTIVE_STATUSES.includes(appointment?.status ?? '')

  useEffect(() => {
    if (!appointment) return
    setStaffId(appointment.staff_id ?? null)
    setAvailableIds(null)
    if (!ACTIVE_STATUSES.includes(appointment.status ?? '') || !appointment.branch_id || !appointment.appt_date || !appointment.start_time) return
    let cancelled = false
    setLoading(true)
    getAppointmentsAvailableSlots({
      branch_id: appointment.branch_id,
      date: String(appointment.appt_date).slice(0, 10),
      start_time: String(appointment.start_time).slice(0, 5),
      exclude_appointment_id: appointment.id,
    } as never)
      .then((result) => {
        if (cancelled) return
        const slots = (pickData<Array<{ staff_ids?: string[] }>>(result) ?? []) as Array<{ staff_ids?: string[] }>
        setAvailableIds(slots[0]?.staff_ids ?? [])
      })
      // Ngoài khung đặt lịch (vd lịch đã qua ngày): không lọc được ở client, BE vẫn kiểm tra khi lưu
      .catch(() => { if (!cancelled) setAvailableIds(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [appointment])

  const options = staffOptions
    .filter((staff) => !isActive || availableIds === null || availableIds.includes(staff.id) || staff.id === appointment?.staff_id)
    .map((staff) => ({ value: staff.id, label: staff.id === appointment?.staff_id ? `${staff.label} (đang gán)` : staff.label }))

  const save = async () => {
    if (!appointment) return
    setSaving(true)
    try {
      await putAppointmentsIdStaffAdmin(appointment.id, { staff_id: staffId } as never)
      message.success(staffId ? 'Đã gán KTV' : 'Đã bỏ gán KTV')
      onSaved()
      onClose()
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={appointment?.staff_id ? 'Đổi KTV phụ trách' : 'Gán KTV phụ trách'}
      open={!!appointment}
      onCancel={onClose}
      onOk={() => void save()}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={saving}
      okButtonProps={{ disabled: !appointment || staffId === (appointment.staff_id ?? null) }}
      destroyOnHidden
    >
      {isActive ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={availableIds === null && !loading
            ? 'Chọn KTV có ca và còn trống khung giờ này — hệ thống kiểm tra lại khi lưu.'
            : 'Chỉ hiện KTV có ca và còn trống đúng khung giờ của lịch.'}
        />
      ) : (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Lịch đã kết thúc — chỉ ghi nhận lại KTV phụ trách." />
      )}
      <Select
        allowClear
        showSearch
        optionFilterProp="label"
        loading={loading}
        style={{ width: '100%' }}
        placeholder="Chọn KTV (để trống = bỏ gán)"
        value={staffId ?? undefined}
        onChange={(value?: string) => setStaffId(value ?? null)}
        options={options}
        notFoundContent={loading ? 'Đang tải…' : 'Không có KTV rảnh khung giờ này'}
      />
    </Modal>
  )
}
