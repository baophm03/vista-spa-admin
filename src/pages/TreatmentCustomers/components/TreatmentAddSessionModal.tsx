import { Col, DatePicker, Form, Modal, Row, Select, Typography } from 'antd'
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
  submitting,
  onCancel,
  onOk,
}: TreatmentAddSessionModalProps) {
  return (
      <Modal
        title="Thông tin buổi điều trị mới"
        open={open}
        onCancel={onCancel}
        onOk={onOk}
        confirmLoading={submitting}
        okText="Tạo buổi"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          {canSchedule && <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="scheduled_date" label="Ngày hẹn">
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
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
                  options={slots.map((slot) => ({ value: slot.start_time.slice(0, 5), label: slot.start_time.slice(0, 5) }))}
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
          <CustomFieldFormItems definitions={customFieldDefs} />
          {customFieldDefs.length === 0 && <Typography.Text type="secondary">Chưa có trường tùy chỉnh cho buổi điều trị.</Typography.Text>}
        </Form>
      </Modal>
  )
}

