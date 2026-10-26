import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Form, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { errorMessage, pickData } from '@/api/helpers'
import type { StaffSchedule as StaffScheduleRow, ShiftTemplate as ShiftTemplateRow } from './types'
import {
  deleteStaffSchedulesId,
  getGetShiftTemplatesQueryKey,
  postStaffSchedules,
  putStaffSchedulesId,
  useGetShiftTemplates,
  useGetStaffSchedules,
} from '@/api/endpoints/staff'
import type { SchedulePageData, ScheduleStaff } from './types'
import { staffLabel } from './types'

const WEEKDAYS = [
  { value: 1, label: 'T2' }, { value: 2, label: 'T3' }, { value: 3, label: 'T4' },
  { value: 4, label: 'T5' }, { value: 5, label: 'T6' }, { value: 6, label: 'T7' }, { value: 7, label: 'CN' },
]

interface Props extends SchedulePageData { loadingShared: boolean }
interface ConflictAppointment { id: string; appt_date: string; start_time: string; customer_profile?: { full_name?: string }; service?: { title?: string } }
type StaffScheduleWithStaff = StaffScheduleRow & { staff?: { id: string; zalo_name?: string; email?: string; phone_number?: string } | null; shift_template?: ShiftTemplateRow | null }

export default function WeeklyScheduleTab({ branches, staff, access, loadingShared }: Props) {
  const queryClient = useQueryClient()
  const [branchFilter, setBranchFilter] = useState<string>()
  const [staffFilter, setStaffFilter] = useState<string>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffScheduleWithStaff | null>(null)
  const [form] = Form.useForm()
  const selectedBranch = Form.useWatch('branch_id', form)
  const canManage = access.isAdmin
  const staffForBranchFilter = useMemo(
    () => staff.filter((person) => !!person.branch_id && (!branchFilter || person.branch_id === branchFilter)),
    [staff, branchFilter],
  )
  const staffForSelectedBranch = useMemo(
    () => staff.filter((person) => !!selectedBranch && person.branch_id === selectedBranch),
    [staff, selectedBranch],
  )

  const scheduleParams: Record<string, unknown> = {}
  if (canManage && branchFilter) scheduleParams.branch_id = branchFilter
  if (staffFilter) scheduleParams.staff_id = staffFilter
  const schedulesQuery = useGetStaffSchedules(scheduleParams as never)
  const templatesQuery = useGetShiftTemplates(branchFilter ? { branch_id: branchFilter } : {})

  const rows = (pickData<StaffScheduleWithStaff[] | undefined>(schedulesQuery.data) ?? []) as StaffScheduleWithStaff[]
  const templates = (pickData<ShiftTemplateRow[] | undefined>(templatesQuery.data) ?? []) as ShiftTemplateRow[]
  const error = [schedulesQuery.isError ? errorMessage(schedulesQuery.error) : '', templatesQuery.isError ? `Danh mục ca: ${errorMessage(templatesQuery.error)}` : '']
    .filter(Boolean)
    .join(' · ')

  const visibleStaff = useMemo(() => {
    const filtered = staff.filter((person) => !canManage || !branchFilter || person.branch_id === branchFilter)
    const all = new Map(filtered.map((person) => [person.id, person]))
    for (const row of rows) {
      if (!all.has(row.staff_id) && row.staff) all.set(row.staff_id, { ...row.staff, branch_id: row.branch_id })
    }
    return [...all.values()].filter((person) => !staffFilter || person.id === staffFilter)
  }, [staff, rows, canManage, branchFilter, staffFilter])

  const openForm = (row?: StaffScheduleWithStaff) => {
    setEditing(row ?? null)
    const rowStaff = row ? staff.find((person) => person.id === row.staff_id) : undefined
    const branchId = row?.branch_id || branchFilter || rowStaff?.branch_id || staff.find((person) => person.id === staffFilter)?.branch_id || branches[0]?.id
    const staffId = row
      ? (rowStaff?.branch_id === branchId ? row.staff_id : undefined)
      : (staff.find((person) => person.id === staffFilter)?.branch_id === branchId ? staffFilter : undefined)
    form.setFieldsValue(row ? {
      staff_id: staffId, branch_id: branchId, weekday: row.weekday, shift_template_id: row.shift_template_id,
    } : {
      staff_id: staffId,
      branch_id: branchId,
      weekday: undefined,
      shift_template_id: undefined,
    })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const selectedStaff = staff.find((person) => person.id === values.staff_id)
    if (!selectedStaff?.branch_id || selectedStaff.branch_id !== values.branch_id) {
      message.error('KTV chưa được gán vào cơ sở đã chọn. Hãy kiểm tra lại nhân sự trước khi xếp ca.')
      return
    }
    try {
      if (editing) await putStaffSchedulesId(editing.id, values as never)
      else await postStaffSchedules(values as never)
      message.success(editing ? 'Đã cập nhật lịch làm' : 'Đã thêm lịch làm')
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['staffSchedules'] })
    } catch (err) { message.error(errorMessage(err)) }
  }

  const remove = async (id: string, confirmed = false) => {
    try {
      await deleteStaffSchedulesId(
        id,
        confirmed ? { confirm_future_appointments: 'true' } : {},
        confirmed ? { confirm_future_appointments: 'true' } : undefined,
      )
      message.success('Đã xóa lịch lặp. Các lịch hẹn đã đặt được giữ nguyên.')
      void queryClient.invalidateQueries({ queryKey: ['staffSchedules'] })
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { code?: string; details?: Record<string, unknown> } } })?.response?.data
      if (!confirmed && response?.code === 'FUTURE_APPOINTMENTS_EXIST') {
        const affected = (response.details?.affected_appointments ?? []) as ConflictAppointment[]
        Modal.confirm({
          title: `Có ${affected.length} lịch hẹn bị ảnh hưởng`,
          width: 680,
          content: <div>
            <p>Xóa lịch lặp chỉ ngừng xếp ca cho các tuần sau. Các lịch hẹn bên dưới vẫn được giữ nguyên để Admin xử lý riêng.</p>
            <Table<ConflictAppointment>
              rowKey="id" size="small" pagination={false} scroll={{ y: 240 }} dataSource={affected}
              columns={[
                { title: 'Ngày', dataIndex: 'appt_date', render: (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString('vi-VN') },
                { title: 'Giờ', dataIndex: 'start_time', render: (v: string) => v?.slice(0, 5) },
                { title: 'Khách', dataIndex: ['customer_profile', 'full_name'], render: (v) => v || '—' },
                { title: 'Dịch vụ', dataIndex: ['service', 'title'], render: (v) => v || '—' },
              ]}
            />
          </div>,
          okText: 'Xác nhận xóa lịch lặp', cancelText: 'Quay lại',
          onOk: () => remove(id, true),
        })
      } else message.error(errorMessage(err))
    }
  }

  const columns = [
    { title: 'KTV', dataIndex: 'id', key: 'staff', width: 160, render: (id: string) => <strong>{staffLabel(visibleStaff.find((person) => person.id === id))}</strong> },
    ...WEEKDAYS.map((day) => ({
      title: day.label,
      key: `weekday-${day.value}`,
      render: (_: unknown, person: ScheduleStaff) => {
        const shifts = rows.filter((row) => row.staff_id === person.id && row.weekday === day.value && row.is_active !== false)
        return <Space direction="vertical" size={4} style={{ display: 'flex' }}>
          {shifts.map((row) => {
            const template = templates.find((item) => item.id === row.shift_template_id) ?? row.shift_template
            return <Space key={row.id} size={2} style={{ display: 'flex' }}>
              <Tag color="purple" style={{ margin: 0, whiteSpace: 'normal', textAlign: 'left', cursor: canManage ? 'pointer' : undefined }} onClick={() => canManage && openForm(row)}>
                {template?.name ?? 'Ca'} {template ? `${template.start_time.slice(0, 5)}–${template.end_time.slice(0, 5)}` : ''}
              </Tag>
              {canManage && <Popconfirm title="Xóa lịch lặp này?" okText="Kiểm tra và xóa" cancelText="Hủy" onConfirm={() => remove(row.id)}>
                <Button aria-label="Xóa lịch lặp" type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>}
            </Space>
          })}
          {!shifts.length && <span style={{ color: '#aaa' }}>—</span>}
        </Space>
      },
    })),
  ]

  return <div>
    {canManage && <Space wrap style={{ marginBottom: 16 }}>
      <Select allowClear placeholder="Tất cả cơ sở" style={{ width: 190 }} value={branchFilter} onChange={(value) => {
        setBranchFilter(value)
        const selectedStaff = staff.find((person) => person.id === staffFilter)
        if (value && selectedStaff?.branch_id !== value) setStaffFilter(undefined)
      }} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
      <Select allowClear showSearch optionFilterProp="label" placeholder="Tất cả KTV" style={{ width: 220 }} value={staffFilter} onChange={setStaffFilter} options={staffForBranchFilter.map((person) => ({ value: person.id, label: staffLabel(person) }))} />
      <Button type="primary" onClick={() => openForm()}>Xếp ca</Button>
    </Space>}
    {!!error && <Alert type="error" showIcon message="Không tải được lịch tuần" description={error} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => {
      void schedulesQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: getGetShiftTemplatesQueryKey() })
    }}>Thử lại</Button>} style={{ marginBottom: 16 }} />}
    <Table<ScheduleStaff>
      rowKey="id" size="middle" pagination={false} tableLayout="fixed"
      loading={loadingShared || schedulesQuery.isLoading || templatesQuery.isLoading} dataSource={visibleStaff} columns={columns}
      locale={{ emptyText: <Empty description={staff.length ? 'Không có KTV trong bộ lọc này' : 'Chưa có danh sách KTV'} /> }}
    />

    <Modal title={editing ? 'Sửa lịch tuần' : 'Xếp ca làm việc'} open={open} onCancel={() => setOpen(false)} onOk={() => void submit()} okText="Lưu" cancelText="Hủy" destroyOnHidden>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }} onValuesChange={(changed) => {
        if (changed.branch_id !== undefined) {
          const currentStaff = staff.find((person) => person.id === form.getFieldValue('staff_id'))
          if (currentStaff?.branch_id !== changed.branch_id) form.setFieldsValue({ staff_id: undefined, shift_template_id: undefined })
        }
        if (changed.staff_id !== undefined) form.setFieldValue('shift_template_id', undefined)
      }}>
        <Form.Item
          name="staff_id"
          label="KTV"
          rules={[{ required: true, message: 'Chọn KTV' }, {
            validator: async (_, staffId: string | undefined) => {
              if (!staffId) return
              const person = staff.find((candidate) => candidate.id === staffId)
              if (!selectedBranch || !person?.branch_id || person.branch_id !== selectedBranch) {
                throw new Error('KTV phải được gán vào đúng cơ sở đã chọn')
              }
            },
          }]}
        >
          <Select
            disabled={!selectedBranch}
            showSearch
            optionFilterProp="label"
            notFoundContent="Không có KTV đã được gán vào cơ sở này"
            options={staffForSelectedBranch.map((person) => ({ value: person.id, label: staffLabel(person) }))}
          />
        </Form.Item>
        <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
          <Select options={(branchFilter ? branches.filter((branch) => branch.id === branchFilter) : branches).map((branch) => ({ value: branch.id, label: branch.name }))} />
        </Form.Item>
        <Form.Item name="weekday" label="Thứ trong tuần" rules={[{ required: true, message: 'Chọn thứ' }]}>
          <Select options={WEEKDAYS} />
        </Form.Item>
        <Form.Item name="shift_template_id" label="Ca" rules={[{ required: true, message: 'Chọn ca' }]}>
          <Select options={templates.filter((template) => template.is_active !== false && (!template.branch_id || template.branch_id === selectedBranch)).map((template) => ({ value: template.id, label: `${template.name} (${template.start_time.slice(0, 5)}–${template.end_time.slice(0, 5)})` }))} />
        </Form.Item>
      </Form>
    </Modal>
  </div>
}
