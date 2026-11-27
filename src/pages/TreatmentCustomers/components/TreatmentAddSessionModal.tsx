import { Col, DatePicker, Form, InputNumber, Modal, Row, Select, Typography } from 'antd'
import type { FormInstance } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { Slot } from './constants'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'

interface TreatmentAddSessionModalProps {
  form: FormInstance
  open: boolean
  canSchedule: boolean
  scheduledDate: Dayjs | undefined
  scheduledTime: string | undefined
  slots: Slot[]
  slotsLoading: boolean
  onLoadSlots: (date: Dayjs) => void
  staffOptions: { value: string; label: string }[]
  customFieldDefs: CustomFieldDefWithOptions[]
  /** quota_type của liệu trình đang tạo buổi — VALUE bắt buộc nhập giá tiền buổi */
  quotaType?: string | null
  remainingValue?: number
  submitting: boolean
  onCancel: () => void
  onOk: () => void
}

export default function TreatmentAddSessionModal({
  form,
  open,
  canSchedule,
  scheduledDate,
  scheduledTime,
  slots,
  slotsLoading,
  onLoadSlots,
  staffOptions,
  customFieldDefs,
  quotaType,
  remainingValue,
  submitting,
  onCancel,
  onOk,
}: TreatmentAddSessionModalProps) {
  const needsSessionValue = quotaType === 'VALUE'
  return (
    <Modal
      className="treatment-form-modal"
      title="Thông tin buổi điều trị mới"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" className="mt-3">
        {canSchedule && <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="scheduled_date" label="Ngày hẹn">
              <DatePicker
                format="DD/MM/YYYY"
                className="w-full!"
                disabledDate={(date) => date.isBefore(dayjs().startOf('day'), 'day')}
                onChange={(date) => {
                  form.setFieldsValue({ scheduled_time: undefined, staff_id: undefined })
                  if (date) void onLoadSlots(date)
                }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="scheduled_time" label="Giờ hẹn">
              <Select
                disabled={!scheduledDate || slotsLoading}
                loading={slotsLoading}
                placeholder={scheduledDate ? 'Chọn giờ còn trống' : 'Chọn ngày trước'}
                // end_time = giờ bắt đầu + thời lượng dịch vụ của gói (BE tính)
                options={slots.map((slot) => ({ value: slot.start_time.slice(0, 5), label: slot.end_time ? `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}` : slot.start_time.slice(0, 5) }))}
                onChange={() => form.setFieldsValue({ staff_id: undefined })}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="staff_id" label="KTV phụ trách">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={!scheduledTime || slotsLoading}
                placeholder={scheduledTime ? 'Chọn KTV rảnh' : 'Chọn ngày và giờ trước'}
                options={(slots
                  .find((slot) => slot.start_time.slice(0, 5) === scheduledTime)
                  ?.staff_ids.map((id) => staffOptions.find((option) => option.value === id))
                  .filter((option): option is { value: string; label: string } => !!option) ?? [])}
              />
            </Form.Item>
          </Col>
        </Row>}
        {needsSessionValue && (
          <Form.Item
            name="session_value"
            label="Giá tiền buổi (₫)"
            rules={[{ required: true, message: 'Gói bán theo giá tiền: cần nhập giá tiền cho buổi mới' }]}
            extra={remainingValue != null ? `Còn lại có thể gán: ${Number(remainingValue).toLocaleString('vi-VN')} ₫` : undefined}
          >
            <InputNumber min={1} step={100000} style={{ width: '100%' }} />
          </Form.Item>
        )}
        <CustomFieldFormItems definitions={customFieldDefs} />
        {customFieldDefs.length === 0 && <Typography.Text type="secondary">Chưa có trường tùy chỉnh cho buổi điều trị.</Typography.Text>}
      </Form>
    </Modal>
  )
}

