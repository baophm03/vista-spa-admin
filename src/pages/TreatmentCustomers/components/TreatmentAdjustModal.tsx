import { Alert, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import { ADJUST_TYPE_OPTIONS } from './constants'

interface TreatmentAdjustModalProps {
  form: FormInstance
  open: boolean
  adjustRow: CustomerTreatment | null
  profileName: (row: CustomerTreatment) => string
  adjustType: string | undefined
  adjustAmount: number | undefined
  adjustSessionsLoading: boolean
  adjustCompletedCount: number
  submitting: boolean
  onCancel: () => void
  onOk: () => void
}

export default function TreatmentAdjustModal({
  form,
  open,
  adjustRow,
  profileName,
  adjustType,
  adjustAmount,
  adjustSessionsLoading,
  adjustCompletedCount,
  submitting,
  onCancel,
  onOk,
}: TreatmentAdjustModalProps) {
  return (
      <Modal
        title={`Điều chỉnh gói — ${adjustRow ? profileName(adjustRow) : ''}`}
      open={open}
        onCancel={onCancel}
        onOk={onOk}
        okText="Ghi điều chỉnh"
        cancelText="Hủy"
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="type" label="Tham số cần chỉnh" rules={[{ required: true, message: 'Chọn tham số' }]}>
            <Select
              options={ADJUST_TYPE_OPTIONS.filter((option) =>
                option.value !== 'ADJUST_VALUE_TOTAL' || adjustRow?.quota_type === 'VALUE',
              )}
              placeholder="Chọn tham số"
            />
          </Form.Item>
          {adjustType === 'ADJUST_SESSIONS' && (
            <Alert
              type={adjustSessionsLoading ? 'info' : adjustCompletedCount === Number(adjustAmount) ? 'success' : 'warning'}
              showIcon
              style={{ marginBottom: 12 }}
              message={
                adjustSessionsLoading
                  ? 'Đang đối chiếu sổ liệu trình…'
                  : `Sổ liệu trình ghi nhận ${adjustCompletedCount} buổi đã hoàn thành${adjustRow?.sessions_used != null ? ` — bộ đếm hiện tại: ${adjustRow.sessions_used}` : ''}`
              }
              description={
                !adjustSessionsLoading && adjustCompletedCount !== Number(adjustAmount)
                  ? 'Giá trị mới lệch với sổ: bộ đếm sẽ không còn khớp số buổi đã hoàn thành trong sổ. Chỉ tiếp tục nếu bạn hiểu rõ sự lệch này (VD: khách làm tay trước khi dùng hệ thống).'
                  : undefined
              }
            />
          )}
          {adjustType === 'EXTEND_EXPIRY' ? (
            <Form.Item name="expires_at" label="Hạn dùng mới" rules={[{ required: true, message: 'Chọn hạn dùng mới' }]}
              extra="Gói đang Hết hạn sẽ tự mở lại thành Đang làm nếu hạn mới ở tương lai.">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          ) : (
            <Form.Item
              name="amount"
              label={adjustType === 'ADJUST_VALUE_TOTAL' ? 'Định mức tiền mới' : 'Giá trị mới'}
              rules={[{ required: true, message: 'Nhập giá trị mới' }]}
              extra={adjustType === 'ADJUST_BONUS'
                ? 'Buổi tặng cộng thêm vào số buổi mua chính.'
                : adjustType === 'ADJUST_VALUE_TOTAL'
                  ? 'Tổng giá trị khách được sử dụng; không phải số đã tiêu.'
                  : undefined}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item name="reason" label="Lý do điều chỉnh (bắt buộc)" rules={[{ required: true, whitespace: true, message: 'Nhập lý do' }]}>
            <Input.TextArea rows={2} maxLength={500} placeholder="VD: Khách báo salon ghi nhầm số buổi" />
          </Form.Item>
        </Form>
      </Modal>

  )
}

