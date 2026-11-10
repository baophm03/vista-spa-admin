import { Form, Modal } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { usePostAppointmentsIdStart } from '@/api/endpoints/appointments'
import type { AppointmentRow } from './constants'

export interface AppointmentStartModalProps {
  appointment: AppointmentRow | null
  form: FormInstance
  startMutation: ReturnType<typeof usePostAppointmentsIdStart>
  sessionCustomFields: CustomFieldDefWithOptions[]
  onCancel: () => void
  onSubmit: () => void
}

export default function AppointmentStartModal({
  appointment,
  form,
  startMutation,
  sessionCustomFields,
  onCancel,
  onSubmit,
}: AppointmentStartModalProps) {
  const startingAppointment = appointment
  return (
    <Modal
      title="Bắt đầu lịch hẹn"
      width="min(560px, calc(100vw - 24px))"
      open={!!startingAppointment}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={startMutation.isPending}
      okText={startMutation.isPending ? 'Đang bắt đầu…' : 'Bắt đầu'}
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <CustomFieldFormItems definitions={sessionCustomFields} />
      </Form>
    </Modal>
  )
}
