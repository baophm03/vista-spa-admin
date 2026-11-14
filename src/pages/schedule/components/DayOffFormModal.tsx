import { Alert, DatePicker, Form, Input, Modal, Select, Space, Table, Typography } from 'antd'
import type { FormInstance } from 'antd'
import dayjs from 'dayjs'
import ServiceImageField from '@/components/ServiceImageField'
import type { ShiftTemplate, ScheduleStaff } from '../types'
import { staffLabel } from '../types'
import { useGetStaffDaysOffConflicts } from '@/api/endpoints/staff'
import { pickData } from '@/api/helpers'

interface ConflictAppointment {
  id: string
  appt_date: string
  start_time: string
  status?: string
  customer_profile?: { full_name?: string }
  service?: { title?: string }
}

export default function DayOffFormModal({ open, form, staff, scheduledTemplates, isTechnician, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  staff: ScheduleStaff[]
  scheduledTemplates: ShiftTemplate[]
  isTechnician: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  const selectedStaffId = Form.useWatch('staff_id', form)
  const selectedDate = Form.useWatch('off_date', form)
  const selectedShiftId = Form.useWatch('shift_template_id', form)

  // Lịch hẹn đích danh KTV trùng ngày/ca nghỉ dự kiến — khách thấy trước khi gửi đơn
  const conflictsQuery = useGetStaffDaysOffConflicts(
    {
      staff_id: selectedStaffId ?? '',
      off_date: selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : '',
      ...(selectedShiftId ? { shift_template_id: selectedShiftId } : {}),
    },
    { query: { enabled: !!selectedStaffId && !!selectedDate } },
  )
  const conflicts = (pickData<ConflictAppointment[] | undefined>(conflictsQuery.data) ?? [])

  return (
    <Modal
      title="Đăng ký ngày nghỉ"
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      okText={conflicts.length ? `Tiếp tục đăng ký (${conflicts.length} lịch trùng)` : 'Gửi đăng ký'}
      cancelText="Hủy"
      destroyOnHidden
      width={720}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }} onValuesChange={(changed) => {
        if (changed.staff_id !== undefined || changed.off_date !== undefined) form.setFieldValue('shift_template_id', undefined)
      }}>
        <Form.Item name="staff_id" label="KTV" rules={[{ required: true, message: 'Chọn KTV' }]}>
          <Select disabled={isTechnician} showSearch optionFilterProp="label" options={staff.map((person) => ({ value: person.id, label: staffLabel(person) }))} />
        </Form.Item>
        <Form.Item name="off_date" label="Ngày nghỉ" rules={[{ required: true, message: 'Chọn ngày nghỉ' }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="shift_template_id" label="Ca nghỉ (không chọn nghĩa là nghỉ cả ngày)">
          <Select allowClear placeholder="Cả ngày" options={scheduledTemplates.map((template) => ({ value: template.id, label: `${template.name} (${template.start_time.slice(0, 5)}–${template.end_time.slice(0, 5)})` }))} />
        </Form.Item>
        <Form.Item name="reason" label="Lý do"><Input.TextArea maxLength={1000} rows={3} /></Form.Item>
        <Form.Item name="image_file_id" label="Ảnh minh chứng (tùy chọn)">
          <ServiceImageField />
        </Form.Item>
      </Form>
      {!!selectedStaffId && !!selectedDate && (
        conflictsQuery.isLoading ? (
          <Typography.Text type="secondary">Đang kiểm tra lịch hẹn trùng…</Typography.Text>
        ) : conflicts.length ? (
          <Alert
            type="warning"
            showIcon
            message={`Có ${conflicts.length} lịch hẹn đã đặt trước trùng ca nghỉ này`}
            description={
              <Space direction="vertical" size={6} style={{ display: 'flex' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Bạn vẫn có thể gửi đơn — Admin sẽ gọi xin khách đổi sang KTV khác trước khi duyệt. Nếu khách không đồng ý đổi người, theo nghiệp vụ KTV vẫn phải đi làm (trừ bất khả kháng).
                </Typography.Text>
                <Table<ConflictAppointment>
                  rowKey="id" size="small" pagination={false} scroll={{ y: 200 }} dataSource={conflicts}
                  columns={[
                    { title: 'Giờ', dataIndex: 'start_time', render: (v: string) => v?.slice(0, 5) },
                    { title: 'Khách', dataIndex: ['customer_profile', 'full_name'], render: (v) => v || '—' },
                    { title: 'Dịch vụ', dataIndex: ['service', 'title'], render: (v) => v || '—' },
                    { title: 'Trạng thái', dataIndex: 'status', render: (v) => v === 'approved' ? 'Đã duyệt' : 'Chờ duyệt' },
                  ]}
                />
              </Space>
            }
          />
        ) : (
          <Alert type="success" showIcon message="Không có lịch hẹn nào trùng ca nghỉ này" />
        )
      )}
    </Modal>
  )
}
