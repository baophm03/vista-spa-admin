import { useMemo, useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { CheckOutlined, CloseOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '../components/base/PageTitle'
import {
  useGetAppointments,
  useGetAppointmentsAvailableSlots,
  usePostAppointments,
  usePostAppointmentsIdComplete,
  usePostAppointmentsIdStart,
  usePutAppointmentsId,
  usePutAppointmentsIdApprove,
  usePutAppointmentsIdCancel,
  usePutAppointmentsIdReject,
} from '../api/endpoints/appointments'
import { useGetCustomerProfiles } from '../api/endpoints/customer-profiles'
import { useGetService } from '../api/endpoints/service'
import { useGetUsers } from '../api/endpoints/users'

type AppointmentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'in_progress' | 'completed'
interface CustomerProfile { id: string; branch_id?: string; full_name: string; phone: string }
interface Appointment {
  id: string
  customer_profile_id: string
  service_id: string
  staff_id?: string
  branch_id?: string
  appt_date: string
  start_time: string
  note?: string
  status: AppointmentStatus
  customer_profile?: CustomerProfile
  service?: { title?: string }
  staff?: { zalo_name?: string }
  created_via?: string
}

const STATUS_META: Record<AppointmentStatus, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'orange' },
  approved: { label: 'Đã duyệt', color: 'purple' },
  in_progress: { label: 'Đang thực hiện', color: 'blue' },
  completed: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'default' },
  rejected: { label: 'Từ chối', color: 'red' },
}

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'rejected', label: 'Từ chối' },
]

export default function Appointments() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [slots, setSlots] = useState<{ start_time: string; staff_ids: string[] }[]>([])
  const [form] = Form.useForm()
  const appointmentsQuery = useGetAppointments()
  const profilesQuery = useGetCustomerProfiles()
  const servicesQuery = useGetService()
  const usersQuery = useGetUsers({ currentPage: '1', pageSize: '200', IsAdmin: 'true' })
  const slotsQuery = useGetAppointmentsAvailableSlots()
  const createMutation = usePostAppointments()
  const updateMutation = usePutAppointmentsId()
  const approveMutation = usePutAppointmentsIdApprove()
  const cancelMutation = usePutAppointmentsIdCancel()
  const rejectMutation = usePutAppointmentsIdReject()
  const startMutation = usePostAppointmentsIdStart()
  const completeMutation = usePostAppointmentsIdComplete()
  const appointmentData = ((appointmentsQuery.data?.responseData ?? (appointmentsQuery.data as any)?.data ?? {}) as { rows?: Appointment[]; count?: number })
  const allRows = appointmentData.rows ?? []
  const rows = filter === 'all' ? allRows : allRows.filter((row) => row.status === filter)
  const total = appointmentData.count ?? rows.length
  const profiles = (((profilesQuery.data?.responseData ?? (profilesQuery.data as any)?.data ?? []) as CustomerProfile[]))
  const services = (((servicesQuery.data?.data?.services ?? []) as unknown as { id: string; title: string }[]))
  const staffs = ((((usersQuery.data?.responseData ?? {}) as { rows?: { id: string; zalo_name?: string; email?: string }[] }).rows ?? []))
  const loading = appointmentsQuery.isLoading
  const reload = () => appointmentsQuery.refetch()

  const openModal = (appointment?: Appointment) => {
    setEditing(appointment ?? null)
    setSlots([])
    form.setFieldsValue(
      appointment
        ? {
          customer_profile_id: appointment.customer_profile_id,
          service_id: appointment.service_id,
          staff_id: appointment.staff_id,
          appt_date: dayjs(appointment.appt_date),
          start_time: appointment.start_time?.slice(0, 5),
          note: appointment.note,
        }
        : { appt_date: dayjs().add(1, 'day') },
    )
    setOpen(true)
  }

  const loadSlots = async () => {
    const values = form.getFieldsValue()
    if (!values.customer_profile_id || !values.service_id || !values.appt_date) return
    try {
      const data = (slotsQuery.data?.responseData ?? (slotsQuery.data as any)?.data ?? []) as { start_time: string; staff_ids: string[] }[]
      setSlots(Array.isArray(data) ? data : [])
      await slotsQuery.refetch()
    } catch (err) {
      setSlots([])
      message.warning(err instanceof Error ? err.message : 'Không thể tải slot')
    }
  }

  const submit = async () => {
    const values = await form.validateFields()
    const profile = profiles.find((p) => p.id === values.customer_profile_id)
    const payload = {
      customer_profile_id: values.customer_profile_id,
      branch_id: profile?.branch_id,
      service_id: values.service_id,
      staff_id: values.staff_id || undefined,
      appt_date: dayjs(values.appt_date).format('YYYY-MM-DD'),
      start_time: values.start_time,
      note: values.note,
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload })
        message.success('Đã cập nhật lịch hẹn')
      } else {
        await createMutation.mutateAsync({ data: payload })
        message.success('Đã tạo lịch hẹn')
      }
      setOpen(false)
      await reload()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể lưu lịch hẹn')
    }
  }

  const doAction = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      message.success(msg)
      await reload()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể cập nhật lịch hẹn')
    }
  }

  const approve = (row: Appointment) => {
    if (row.staff_id) {
      doAction(() => approveMutation.mutateAsync({ id: row.id, data: { staff_id: row.staff_id } }), 'Đã duyệt')
      return
    }
    // BE bắt buộc staff_id khi duyệt — bắt chọn KTV trước
    let staffId: string | undefined
    Modal.confirm({
      title: 'Chọn KTV thực hiện',
      content: (
        <Select
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="Chọn KTV"
          options={staffs.map((s) => ({ value: s.id, label: s.zalo_name || s.email || s.id.slice(0, 8) }))}
          onChange={(v) => {
            staffId = v
          }}
        />
      ),
      onOk: () => {
        if (!staffId) {
          message.warning('Cần chọn KTV để duyệt')
          return Promise.reject(new Error('no staff'))
        }
        return doAction(() => approveMutation.mutateAsync({ id: row.id, data: { staff_id: staffId! } }), 'Đã duyệt')
      },
    })
  }

  const reject = (row: Appointment) => {
    let reason = 'Không thể sắp xếp'
    Modal.confirm({
      title: 'Từ chối lịch hẹn',
      content: (
        <Input
          placeholder="Lý do"
          onChange={(e) => {
            reason = e.target.value
          }}
        />
      ),
      onOk: () => doAction(() => rejectMutation.mutateAsync({ id: row.id, data: { reason } }), 'Đã từ chối'),
    })
  }

  const list = useMemo(() => rows, [rows])

  return (
    <>
      <PageTitle
        extra={
          <Space className="max-sm:flex! max-sm:w-full! max-sm:flex-wrap!">
            <Button icon={<ReloadOutlined />} onClick={reload} />
            <Select
              value={filter}
              onChange={(v) => {
                setFilter(v)
                setPage(1)
              }}
              options={FILTERS}
              className="max-sm:flex-1!"
              style={{ width: 140, maxWidth: '100%' }}
            />
            <Button className="max-sm:w-full" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm lịch hẹn
            </Button>
          </Space>
        }
      >
        Lịch hẹn
      </PageTitle>
      <Table<Appointment>
        rowKey="id"
        loading={loading}
        dataSource={list}
        pagination={{ current: page, pageSize: limit, total, onChange: setPage }}
        columns={[
          {
            title: 'Khách hàng',
            dataIndex: ['customer_profile', 'full_name'],
            render: (v, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v || '—'}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.customer_profile?.phone}</div>
              </div>
            ),
          },
          { title: 'Dịch vụ', dataIndex: ['service', 'title'] },
          { title: 'KTV', dataIndex: ['staff', 'zalo_name'], render: (v) => v || 'Chưa gán' },
          {
            title: 'Thời gian',
            dataIndex: 'appt_date',
            width: 160,
            render: (v, row) => `${dayjs(v).format('DD/MM/YYYY')} ${row.start_time?.slice(0, 5)}`,
          },
          { title: 'Nguồn', dataIndex: 'created_via', width: 100, render: (v) => (v === 'APP' ? <Tag>Mini App</Tag> : <Tag>Nhân viên</Tag>) },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 130,
            render: (v: AppointmentStatus) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag>,
          },
          {
            title: '',
            width: 300,
            render: (_, row) => (
              <Space>
                {row.status === 'pending' && (
                  <>
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => approve(row)}
                    >
                      Duyệt
                    </Button>
                    <Button size="small" danger icon={<CloseOutlined />} onClick={() => reject(row)}>
                      Từ chối
                    </Button>
                  </>
                )}
                {row.status === 'approved' && (
                  <>
                    <Button size="small" onClick={() => doAction(() => startMutation.mutateAsync({ id: row.id, data: {} }), 'Đã bắt đầu')}>
                      Bắt đầu
                    </Button>
                    <Popconfirm title="Hủy lịch hẹn này?" onConfirm={() => doAction(() => cancelMutation.mutateAsync({ id: row.id, data: {} }), 'Đã hủy')}>
                      <Button size="small" danger>
                        Hủy
                      </Button>
                    </Popconfirm>
                  </>
                )}
                {row.status === 'in_progress' && (
                  <Button size="small" type="primary" onClick={() => doAction(() => completeMutation.mutateAsync({ id: row.id, data: {} }), 'Đã hoàn tất')}>
                    Hoàn tất
                  </Button>
                )}
                {['pending', 'approved'].includes(row.status) && (
                  <Button size="small" onClick={() => openModal(row)}>
                    Đổi lịch
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Đổi lịch hẹn' : 'Thêm lịch hẹn'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer_profile_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={profiles.map((p) => ({
                value: p.id,
                label: `${p.full_name} — ${p.phone}`,
              }))}
              onChange={loadSlots}
            />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="service_id" label="Dịch vụ" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={services.map((s) => ({ value: s.id, label: s.title }))} onChange={loadSlots} />
            </Form.Item>
            <Form.Item name="appt_date" label="Ngày" rules={[{ required: true }]} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} onChange={loadSlots} />
            </Form.Item>
            <Form.Item name="staff_id" label="KTV" style={{ flex: 1 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Chưa gán"
                options={staffs.map((s) => ({ value: s.id, label: s.zalo_name || s.email || s.id.slice(0, 8) }))}
              />
            </Form.Item>
          </Space>
          <Form.Item name="start_time" label="Giờ (slot trống)" rules={[{ required: true, message: 'Chọn giờ' }]}>
            <Select
              placeholder={slots.length ? 'Chọn giờ' : 'Chọn khách + dịch vụ + ngày để xem slot'}
              options={slots.map((s) => ({ value: s.start_time, label: s.start_time }))}
              notFoundContent={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Không có slot trống — thử ngày khác
                </Typography.Text>
              }
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
