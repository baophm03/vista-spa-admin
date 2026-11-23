import dayjs from 'dayjs'
import { Button, Descriptions, Form, Grid, Input, Modal, Select, Tag, Typography } from 'antd'
import type { FormInstance } from 'antd'
import type { AcademyCourse } from '@/api/models/academyCourse'
import { NEXT_STATUS, PAYMENT_STATUS_META, STATUS_META, type RegistrationRow } from './constants'
import './registration-update-modal.css'

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
  const isMobile = !Grid.useBreakpoint().md
  const courseById = (id: string) => courses.find((c) => c.id === id)?.name
  const canUpdateStatus = (NEXT_STATUS[target?.status ?? 'PENDING'] ?? []).length > 0
  const fullRow = isMobile ? 1 : 2
  const discountAmount = Number(target?.voucher_discount_amount ?? 0)
  const paymentStatus = target?.payment_status ?? ''
  const summaryItems = target ? [
    { key: 'course', label: 'Khóa học', span: fullRow, children: target.course?.name ?? courseById(target.course_id) ?? '—' },
    { key: 'final', label: 'Học phí cuối', children: formatMoney(Number(target.final_tuition ?? 0)) },
    { key: 'payment', label: 'Thanh toán', children: <Tag color={PAYMENT_STATUS_META[paymentStatus]?.color}>{PAYMENT_STATUS_META[paymentStatus]?.label ?? (paymentStatus || '—')}</Tag> },
  ] : []
  const detailItems = target ? [
    { key: 'original', label: 'Học phí gốc', children: formatMoney(Number(target.tuition_before_discount ?? target.course?.tuition ?? 0)) },
    { key: 'discount', label: 'Ưu đãi cũ', children: target.discount_percent ? `${target.discount_percent}%` : '—' },
    { key: 'voucher', label: 'Voucher', children: target.course_voucher_title ?? '—' },
    { key: 'voucherDiscount', label: 'Giảm voucher', children: discountAmount > 0 ? formatMoney(discountAmount) : '—' },
    { key: 'staff', label: 'Người gọi', children: target.user?.zalo_name ?? '—' },
    { key: 'contacted', label: 'Liên hệ lúc', children: target.contacted_at ? dayjs(target.contacted_at).format('DD/MM HH:mm') : '—' },
  ] : []
  const collapseDetails = isMobile && canUpdateStatus
  return (
    <Modal
      title={target && canUpdateStatus ? 'Cập nhật đăng ký' : 'Chi tiết đăng ký'}
      className="academy-registration-update-modal"
      width="min(900px, calc(100vw - 24px))"
      open={!!target}
      onCancel={onClose}
      confirmLoading={saving}
      {...(target && canUpdateStatus
        ? { onOk: onSubmit, okText: 'Lưu', cancelText: 'Hủy' }
        : { footer: <Button onClick={onClose}>Đóng</Button> })}
    >
      {target && (
        <>
          <div className="academy-registration-summary-head">
            <Typography.Text strong>{target.full_name}</Typography.Text>
            <Tag color={STATUS_META[target.status ?? '']?.color}>{STATUS_META[target.status ?? '']?.label ?? target.status}</Tag>
          </div>
          <div className="academy-registration-summary">
            <Descriptions
              className="academy-registration-summary-details"
              size="small"
              column={fullRow}
              bordered={!isMobile}
              items={collapseDetails ? summaryItems : [...summaryItems, ...detailItems]}
            />
            {collapseDetails && (
              <details key={target.id} className="academy-registration-extra-details">
                <summary>Ưu đãi và lịch sử liên hệ</summary>
                <Descriptions className="academy-registration-summary-details" size="small" column={1} items={detailItems} />
              </details>
            )}
          </div>
        </>
      )}
      {target && canUpdateStatus ? (
        <Form form={form} layout="vertical" labelCol={{ span: 24 }} wrapperCol={{ span: 24 }} className="academy-registration-update-form">
          <Form.Item name="status" label="Trạng thái mới" rules={[{ required: true, message: 'Chọn trạng thái' }]}>
            <Select
              className="w-full"
              options={(NEXT_STATUS[target?.status ?? 'PENDING'] ?? []).map((s) => ({ value: s, label: STATUS_META[s]?.label ?? s }))}
              placeholder="Chọn trạng thái"
            />
          </Form.Item>
          <Form.Item name="assigned_to" label="Nhân viên phụ trách">
            <Select className="w-full" allowClear placeholder="Chọn nhân viên" options={staffs.map((s) => ({ value: s.id, label: s.zalo_name || s.id.slice(0, 8) }))} />
          </Form.Item>
          <Form.Item name="payment_status" label="Thanh toán">
            <Select
              className="w-full"
              allowClear
              placeholder="Chọn trạng thái"
              options={Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú kết quả">
            <Input.TextArea className="w-full" rows={isMobile ? 2 : 3} placeholder="Nhập ghi chú cuộc trao đổi" />
          </Form.Item>
        </Form>
      ) : null}
    </Modal>
  )
}
