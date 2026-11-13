import dayjs from 'dayjs'
import { Button, Descriptions, Form, Input, Modal, Select, Tag } from 'antd'
import type { FormInstance } from 'antd'
import type { AcademyCourse } from '@/api/models/academyCourse'
import { NEXT_STATUS, PAYMENT_STATUS_META, STATUS_META, type RegistrationRow } from './constants'

export default function RegistrationUpdateModal({ target, form, staffs, courses, formatMoney, saving, onClose, onSubmit }: {
  target: RegistrationRow | null
  form: FormInstance
  staffs: Array<{ id: string; zalo_name?: string }>
  courses: AcademyCourse[]
  formatMoney: (v?: number | null) => string
  saving?: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const courseById = (id: string) => courses.find((c) => c.id === id)?.name
  const canUpdateStatus = (NEXT_STATUS[target?.status ?? 'PENDING'] ?? []).length > 0
  return (
    <Modal
      title={target && canUpdateStatus
        ? `Chi tiết & cập nhật tiến độ — ${target.full_name}`
        : `Chi tiết học viên — ${target?.full_name ?? ''}`}
      width="min(900px, calc(100vw - 24px))"
      open={!!target}
      onCancel={onClose}
      confirmLoading={saving}
      {...(target && canUpdateStatus
        ? { onOk: onSubmit, okText: 'Lưu' }
        : { footer: <Button onClick={onClose}>Đóng</Button> })}
    >
      {target && (
        <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Trạng thái hiện tại" span={2}>
            <Tag color={STATUS_META[target.status ?? '']?.color}>{STATUS_META[target.status ?? '']?.label ?? target.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Khóa học" span={2}>{target.course?.name ?? courseById(target.course_id) ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Học phí ban đầu">{formatMoney(Number(target.tuition_before_discount ?? target.course?.tuition ?? 0))}</Descriptions.Item>
          <Descriptions.Item label="Học phí cuối">{formatMoney(Number(target.final_tuition ?? 0))}</Descriptions.Item>
          <Descriptions.Item label="Ưu đãi học viên cũ">{target.discount_percent ? `${target.discount_percent}%` : '—'}</Descriptions.Item>
          <Descriptions.Item label="Voucher khóa học">{target.course_voucher_title ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Giảm từ voucher" span={2}>{Number(target.voucher_discount_amount ?? 0) > 0 ? formatMoney(Number(target.voucher_discount_amount)) : '—'}</Descriptions.Item>
          <Descriptions.Item label="Thanh toán" span={2}>
            <Tag color={PAYMENT_STATUS_META[target.payment_status ?? '']?.color}>{PAYMENT_STATUS_META[target.payment_status ?? '']?.label ?? target.payment_status ?? '—'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Người gọi">{target.user?.zalo_name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Liên hệ lúc">{target.contacted_at ? dayjs(target.contacted_at).format('DD/MM HH:mm') : '—'}</Descriptions.Item>
        </Descriptions>
      )}
      {target && canUpdateStatus ? (
        <Form form={form} layout="vertical">
          <Form.Item name="status" label="Trạng thái mới" rules={[{ required: true, message: 'Chọn trạng thái' }]}>
            <Select
              options={(NEXT_STATUS[target?.status ?? 'PENDING'] ?? []).map((s) => ({ value: s, label: STATUS_META[s]?.label ?? s }))}
              placeholder="Chọn trạng thái"
            />
          </Form.Item>
          <Form.Item name="assigned_to" label="Nhân viên phụ trách gọi">
            <Select allowClear placeholder="Chọn nhân viên" options={staffs.map((s) => ({ value: s.id, label: s.zalo_name || s.id.slice(0, 8) }))} />
          </Form.Item>
          <Form.Item name="payment_status" label="Trạng thái thanh toán học phí">
            <Select
              allowClear
              placeholder="Chọn trạng thái"
              options={Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú kết quả cuộc trao đổi">
            <Input.TextArea rows={3} placeholder="Ví dụ: khách hẹn comeback tuần sau, quan tâm khóa peel…" />
          </Form.Item>
        </Form>
      ) : null}
    </Modal>
  )
}
