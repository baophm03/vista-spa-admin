import { Alert, Button, DatePicker, Form, Input, Modal, Select, Space, Typography } from 'antd'
import type { FormInstance } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import ServiceImageField from '@/components/ServiceImageField'
import type { ShiftTemplate, ScheduleStaff } from '../types'
import { staffLabel } from '../types'
import { useGetStaffDaysOffConflictsAdmin } from '@/api/endpoints/staff'
import { pickData } from '@/api/helpers'
import ResponsiveTable from '@/components/base/ResponsiveTable'
import { displayName } from '@/utils/displayName'

interface ConflictAppointment {
  id: string
  appt_date: string
  start_time: string
  status?: string
  user?: { full_name?: string }
  service?: { title?: string }
}

/** Mở trang Lịch hẹn với modal Chi tiết lịch hẹn — từ đó bấm "Đổi KTV" để gán người phụ trách mới. */
function useOpenAppointmentInAppointmentsPage() {
  const navigate = useNavigate()
  return (id: string) => navigate(`/appointments?appointment_id=${id}&detail=1`)
}

export default function DayOffFormModal({ open, form, staff, scheduledTemplates, isTechnician, compact = false, submitting = false, submitError, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  staff: ScheduleStaff[]
  scheduledTemplates: ShiftTemplate[]
  isTechnician: boolean
  /** Layout mobile/tablet theo Figma: cảnh báo trùng rút gọn, lỗi gửi ngay trong form */
  compact?: boolean
  submitting?: boolean
  submitError?: string | null
  onCancel: () => void
  onSubmit: () => void
}) {
  const selectedStaffId = Form.useWatch('staff_id', form)
  const selectedDate = Form.useWatch('off_date', form)
  const selectedShiftId = Form.useWatch('shift_template_id', form)
  const openAppointment = useOpenAppointmentInAppointmentsPage()

  // Lịch hẹn đích danh KTV trùng ngày/ca nghỉ dự kiến — khách thấy trước khi gửi đơn
  const conflictsQuery = useGetStaffDaysOffConflictsAdmin(
    {
      staff_id: selectedStaffId ?? '',
      off_date: selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : '',
      ...(selectedShiftId ? { shift_template_id: selectedShiftId } : {}),
    },
    { query: { enabled: !!selectedStaffId && !!selectedDate } },
  )
  const conflicts = (pickData<ConflictAppointment[] | undefined>(conflictsQuery.data) ?? [])
  const blocked = conflicts.length > 0

  return (
    <Modal
      title="Đăng ký ngày nghỉ"
      open={open}
      onCancel={onCancel}
      onOk={() => { if (!blocked) onSubmit() }}
      okText={blocked ? 'Không thể tiếp tục đăng ký' : compact ? (submitting ? 'Đang gửi…' : 'Gửi đăng ký') : 'Gửi đăng ký'}
      okButtonProps={{ disabled: blocked }}
      cancelText="Hủy"
      confirmLoading={submitting}
      destroyOnHidden
      width={720}
      className={compact ? 'schedule-compact-modal' : undefined}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }} onValuesChange={(changed) => {
        if (changed.staff_id !== undefined || changed.off_date !== undefined) form.setFieldValue('shift_template_id', undefined)
      }}>
        <Form.Item name="staff_id" label="Nhân viên" rules={[{ required: true, message: 'Chọn nhân viên' }]}>
          <Select disabled={isTechnician} showSearch optionFilterProp="label" options={staff.map((person) => ({ value: person.id, label: staffLabel(person) }))} />
        </Form.Item>
        <Form.Item name="off_date" label="Ngày nghỉ" rules={[{ required: true, message: compact ? 'Vui lòng chọn ngày nghỉ.' : 'Chọn ngày nghỉ' }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="shift_template_id" label="Ca nghỉ (không chọn nghĩa là nghỉ cả ngày)">
          <Select allowClear placeholder="Cả ngày" options={scheduledTemplates.map((template) => ({ value: template.id, label: `${template.name} (${template.start_time.slice(0, 5)}–${template.end_time.slice(0, 5)})` }))} />
        </Form.Item>
        <Form.Item name="reason" label="Lý do"><Input.TextArea maxLength={1000} rows={3} /></Form.Item>
        <Form.Item name="image_file_id" label="Ảnh minh chứng (tùy chọn)">
          <ServiceImageField />
        </Form.Item>
      </Form>
      {compact && !!selectedStaffId && !!selectedDate && (
        conflictsQuery.isLoading ? (
          <Typography.Text type="secondary">Đang kiểm tra lịch hẹn trùng…</Typography.Text>
        ) : blocked ? (
          <Alert
            type="warning"
            showIcon
            message={`Có ${conflicts.length} lịch hẹn trùng — không cho phép tiếp tục đăng ký`}
            description={
              <Space direction="vertical" size={4} style={{ display: 'flex' }}>
                <Typography.Text style={{ fontSize: 12 }}>
                  Bấm vào lịch hẹn bên dưới để mở trang Lịch hẹn và đổi sang KTV khác thay thế, xong hãy quay lại gửi đăng ký nghỉ.
                </Typography.Text>
                {conflicts.map((row) => (
                  <Button
                    key={row.id} size="small" type="link" icon={<CalendarOutlined />}
                    style={{ padding: 0, height: 'auto', justifyContent: 'flex-start', display: 'inline-flex', textAlign: 'left' }}
                    onClick={() => openAppointment(row.id)}
                  >
                    {dayjs(row.appt_date).format('DD/MM')} · {row.start_time?.slice(0, 5)} · {displayName(row.user)} · {row.service?.title || '—'}
                  </Button>
                ))}
              </Space>
            }
          />
        ) : null
      )}
      {!compact && !!selectedStaffId && !!selectedDate && (
        conflictsQuery.isLoading ? (
          <Typography.Text type="secondary">Đang kiểm tra lịch hẹn trùng…</Typography.Text>
        ) : blocked ? (
          <Alert
            type="warning"
            showIcon
            message={`Có ${conflicts.length} lịch hẹn đã đặt trước trùng ca nghỉ này — không cho phép tiếp tục đăng ký`}
            description={
              <Space direction="vertical" size={6} style={{ display: 'flex' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Vui lòng bấm vào lịch hẹn bên dưới để mở trang Lịch hẹn và đổi sang KTV khác thay thế. Xử lý xong hết các lịch trùng rồi quay lại gửi đăng ký nghỉ.
                </Typography.Text>
                <ResponsiveTable<ConflictAppointment>
                  rowKey="id" size="small" pagination={false} scroll={{ y: 200 }} dataSource={conflicts}
                  onRow={(row) => ({ onClick: () => openAppointment(row.id), style: { cursor: 'pointer' } })}
                  columns={[
                    { title: 'Giờ', dataIndex: 'start_time', render: (v: string) => v?.slice(0, 5) },
                    { title: 'Khách', dataIndex: ['user', 'full_name'], render: (_: unknown, row: ConflictAppointment) => displayName(row.user) },
                    { title: 'Dịch vụ', dataIndex: ['service', 'title'], render: (v) => v || '—' },
                    { title: 'Trạng thái', dataIndex: 'status', render: (v) => v === 'approved' ? 'Đã duyệt' : 'Chờ duyệt' },
                    {
                      title: 'Thao tác', align: 'center' as const, width: 130,
                      render: (_: unknown, row: ConflictAppointment) => (
                        <Button size="small" type="primary" icon={<CalendarOutlined />} onClick={() => openAppointment(row.id)}>
                          Đổi KTV
                        </Button>
                      ),
                    },
                  ]}
                />
              </Space>
            }
          />
        ) : (
          <Alert type="success" showIcon message="Không có lịch hẹn nào trùng ca nghỉ này" />
        )
      )}
      {!!submitError && (
        <Alert style={{ marginTop: 12 }} type="error" showIcon role="alert" message="Không gửi được đăng ký nghỉ" description={submitError || 'Vui lòng thử lại.'} />
      )}
    </Modal>
  )
}
