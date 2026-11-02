import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { AcademyRegistration } from '@/api/models/academyRegistration'
import type { AcademyCourse } from '@/api/models/academyCourse'
import {
  getGetAcademyRegistrationsQueryKey,
  useGetAcademyRegistrationsFindStudent,
  usePutAcademyRegistrationsIdStatus,
} from '@/api/endpoints/academy'
import { useGetAcademyCourses } from '@/api/endpoints/academy'
import { useGetUsers } from '@/api/endpoints/users'
import { apiClient } from '@/api/mutator/custom-instance'
import { useBrandCurrency } from '@/themeRuntime'
import { Can } from '@casl/react'

/** Trường mới theo đặc tả 5.34 AC-09 (chưa có trong client sinh tự động). */
type RegistrationRow = AcademyRegistration & {
  assigned_to?: string | null
  contacted_at?: string | null
  user?: { id: string; zalo_name?: string } | null
  course?: AcademyCourse | null
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Mới đăng ký', color: 'gold' },
  CONFIRMED: { label: 'Đã liên hệ', color: 'blue' },
  ATTENDED: { label: 'Đã nhập học', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'red' },
}

/** Máy trạng thái một chiều: chỉ cho chọn trạng thái phía TRƯỚC. */
const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'ATTENDED', 'CANCELLED'],
  CONFIRMED: ['ATTENDED', 'CANCELLED'],
  ATTENDED: [],
  CANCELLED: [],
}

interface UpdateFormValues {
  status?: string
  assigned_to?: string | null
  note?: string
}

export default function AcademyRegistrations() {
  const queryClient = useQueryClient()
  const { format: formatMoney } = useBrandCurrency()
  const [filter, setFilter] = useState<{ status?: string; course_id?: string; q?: string }>({})
  const [lookupValue, setLookupValue] = useState('')
  const [updateTarget, setUpdateTarget] = useState<RegistrationRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<UpdateFormValues>()

  const coursesQuery = useGetAcademyCourses()
  const registrationsQuery = useGetRegistrationsSafe(filter)
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const lookupPhone = /^0\d{9}$/.test(lookupValue.trim()) ? lookupValue.trim() : undefined
  const lookupEmail = lookupValue.includes('@') ? lookupValue.trim() : undefined
  const lookupQuery = useGetAcademyRegistrationsFindStudent(
    lookupPhone || lookupEmail ? { phone: lookupPhone, email: lookupEmail } : undefined,
    { query: { enabled: !!(lookupPhone || lookupEmail), retry: false } },
  )

  const courses = (pickData<AcademyCourse[]>(coursesQuery.data) ?? []) as AcademyCourse[]
  const registrations = (pickData<RegistrationRow[]>(registrationsQuery.data) ?? []) as RegistrationRow[]
  const staffs = (pickData<{ rows?: Array<{ id: string; zalo_name?: string }> } | undefined>(usersQuery.data)?.rows ?? []) as Array<{ id: string; zalo_name?: string }>
  const lookupRows = (pickData<RegistrationRow[]>(lookupQuery.data) ?? []) as RegistrationRow[]
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  const statusMutation = usePutAcademyRegistrationsIdStatus()

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetAcademyRegistrationsQueryKey() })
  }

  const openUpdate = (row: RegistrationRow) => {
    setUpdateTarget(row)
    form.resetFields()
    form.setFieldsValue({ status: NEXT_STATUS[row.status ?? 'PENDING']?.[0], assigned_to: row.assigned_to ?? null, note: row.note ?? undefined })
  }

  const submitUpdate = async () => {
    if (!updateTarget) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      await statusMutation.mutateAsync({
        id: updateTarget.id,
        data: { status: values.status!, assigned_to: values.assigned_to ?? null, note: values.note ?? null } as never,
      })
      message.success('Đã cập nhật tiến độ tư vấn')
      setUpdateTarget(null)
      await reload()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const createFromLookup = async (row: RegistrationRow) => {
    try {
      await apiClient.post('/academy/registrations', {
        course_id: row.course_id,
        full_name: row.full_name,
        phone: row.phone,
        email: row.email ?? undefined,
        note: 'Nhận diện học viên cũ qua tra cứu (AC-10)',
      })
      message.success('Đã nhận đăng ký — hệ thống tự động đối soát học viên cũ')
      await reload()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const columns = [
    { title: 'Học viên', dataIndex: 'full_name', key: 'full_name', render: (v: string, row: RegistrationRow) => (
      <Space size={6} wrap>
        <Typography.Text strong>{v}</Typography.Text>
        {!!row.is_returning_student && <Tag color="purple" title="Đã từng đăng ký/khách của spa — xét ưu đãi riêng">Học viên cũ</Tag>}
      </Space>
    ) },
    { title: 'SĐT', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: 'Khóa học', key: 'course', width: 200, render: (_: unknown, row: RegistrationRow) => row.course?.name ?? courseById.get(row.course_id)?.name ?? '—' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 130, render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag> },
    { title: 'Ưu đãi', dataIndex: 'discount_percent', key: 'discount', width: 80, align: 'right' as const, render: (v?: number) => (v ? `${v}%` : '—') },
    { title: 'Học phí cuối', dataIndex: 'final_tuition', key: 'final_tuition', width: 130, align: 'right' as const, render: (v?: number) => formatMoney(Number(v ?? 0)) },
    { title: 'Người gọi', key: 'assigned', width: 130, render: (_: unknown, row: RegistrationRow) => row.user?.zalo_name ?? '—' },
    { title: 'Liên hệ lúc', dataIndex: 'contacted_at', key: 'contacted_at', width: 140, render: (v?: string) => (v ? dayjs(v).format('DD/MM HH:mm') : '—') },
    { title: 'Ghi chú', dataIndex: 'note', key: 'note', ellipsis: true },
    { title: '', key: 'actions', width: 170,
      render: (_: unknown, row: RegistrationRow) => (
        <Can I="UPDATE" a="ACADEMY">
          {NEXT_STATUS[row.status ?? 'PENDING']?.length ? (
            <Button size="small" type="primary" onClick={() => openUpdate(row)}>Cập nhật tiến độ</Button>
          ) : <Typography.Text type="secondary" style={{ fontSize: 12 }}>Đã kết thúc</Typography.Text>}
        </Can>
      ) },
  ]

  return (
    <div>
      <PageTitle>Sổ theo dõi đăng ký học viên</PageTitle>
      {registrationsQuery.isError && <Alert type="error" showIcon message="Không tải được danh sách đăng ký" description={errorMessage(registrationsQuery.error)} style={{ marginBottom: 12 }} />}

      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Tìm tên / SĐT / email"
          style={{ width: 240 }}
          allowClear
          onSearch={(v) => setFilter((f) => ({ ...f, q: v || undefined }))}
        />
        <Select
          allowClear
          placeholder="Khóa học"
          style={{ width: 220 }}
          options={courses.map((c) => ({ value: c.id, label: c.name }))}
          value={filter.course_id}
          onChange={(v) => setFilter((f) => ({ ...f, course_id: v }))}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          style={{ width: 160 }}
          options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
          value={filter.status}
          onChange={(v) => setFilter((f) => ({ ...f, status: v }))}
        />
      </Space>

      <Table rowKey="id" loading={registrationsQuery.isLoading} columns={columns} dataSource={registrations} pagination={{ pageSize: 20, showSizeChanger: false }} />

      <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
        <Typography.Text strong>Tra cứu lịch sử học viên cũ (AC-10)</Typography.Text>
        <Space wrap>
          <Input
            placeholder="Nhập SĐT hoặc email để tra cứu"
            style={{ width: 280 }}
            value={lookupValue}
            onChange={(e) => setLookupValue(e.target.value)}
            prefix={<SearchOutlined />}
          />
        </Space>
        {(lookupPhone || lookupEmail) && (
          <Table
            rowKey="id"
            size="small"
            loading={lookupQuery.isLoading}
            columns={[
              { title: 'Khóa học', key: 'course', render: (_: unknown, row: RegistrationRow) => row.course?.name ?? '—' },
              { title: 'Họ tên', dataIndex: 'full_name' },
              { title: 'SĐT', dataIndex: 'phone' },
              { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag> },
              { title: '', key: 'act', render: (_: unknown, row: RegistrationRow) => (
                <Can I="CREATE" a="ACADEMY">
                  <Button size="small" onClick={() => void createFromLookup(row)}>Nhận đăng ký mới</Button>
                </Can>
              ) },
            ]}
            dataSource={lookupRows}
            pagination={false}
            style={{ marginTop: 8 }}
          />
        )}
      </Space>

      <Modal
        title={`Cập nhật tiến độ — ${updateTarget?.full_name ?? ''}`}
        open={!!updateTarget}
        onOk={submitUpdate}
        onCancel={() => setUpdateTarget(null)}
        confirmLoading={saving}
        okText="Lưu"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="status" label="Trạng thái mới (chỉ tiến lên phía trước)" rules={[{ required: true, message: 'Chọn trạng thái' }]}>
            <Select
              options={(NEXT_STATUS[updateTarget?.status ?? 'PENDING'] ?? []).map((s) => ({ value: s, label: STATUS_META[s]?.label ?? s }))}
              placeholder="Chọn trạng thái"
            />
          </Form.Item>
          <Form.Item name="assigned_to" label="Nhân viên phụ trách gọi">
            <Select allowClear placeholder="Chọn nhân viên" options={staffs.map((s) => ({ value: s.id, label: s.zalo_name || s.id.slice(0, 8) }))} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú kết quả cuộc trao đổi">
            <Input.TextArea rows={3} placeholder="Ví dụ: khách hẹn comeback tuần sau, quan tâm khóa peel…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

/** Wrapper: BE hỗ trợ q sau khi cập nhật — gọi qua apiClient để không phụ thuộc client sinh lại. */
function useGetRegistrationsSafe(filter: { status?: string; course_id?: string; q?: string }) {
  const [data, setData] = useState<unknown>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    let alive = true
    setIsLoading(true)
    const params = new URLSearchParams()
    if (filter.status) params.set('status', filter.status)
    if (filter.course_id) params.set('course_id', filter.course_id)
    if (filter.q) params.set('q', filter.q)
    apiClient.get(`/academy/registrations?${params.toString()}`)
      .then((res) => { if (alive) { setData(res.data); setError(null) } })
      .catch((err) => { if (alive) setError(err) })
      .finally(() => { if (alive) setIsLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.status, filter.course_id, filter.q])
  return { data, isLoading, isError: !!error, error }
}
