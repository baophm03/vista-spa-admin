import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import type { AcademyCourse } from '@/api/models/academyCourse'
import { getVoucherCategory, type VoucherCategoryRow } from '@/api/custom/voucherCategories'
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
import RegistrationCreateModal from './components/RegistrationCreateModal'
import RegistrationUpdateModal from './components/RegistrationUpdateModal'
import StudentLookupModal from './components/StudentLookupModal'
import { NEXT_STATUS, PAYMENT_STATUS_META, STATUS_META } from './components/constants'
import type { RegistrationRow } from './components/constants'

interface UpdateFormValues {
  status?: string
  payment_status?: string
  assigned_to?: string | null
  note?: string
}

export default function AcademyRegistrations() {
  const queryClient = useQueryClient()
  const { format: formatMoney } = useBrandCurrency()
  const [filter, setFilter] = useState<{ status?: string; course_id?: string; q?: string }>({})
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [lookupValue, setLookupValue] = useState('')
  const [updateTarget, setUpdateTarget] = useState<RegistrationRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<UpdateFormValues>()
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [lookupOpen, setLookupOpen] = useState(false)
  const [createForm] = Form.useForm()

  // Gõ tìm kiếm có debounce 400ms — giống các page danh sách khác
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setFilter((f) => ({ ...f, q: searchInput.trim() || undefined }))
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const coursesQuery = useGetAcademyCourses()
  const courseVouchersQuery = useQuery({ queryKey: ['voucher-category', 'academy-course'], queryFn: () => getVoucherCategory('academy-course') })
  const registrationsQuery = useGetRegistrationsSafe(filter)
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const lookupPhone = /^0\d{9}$/.test(lookupValue.trim()) ? lookupValue.trim() : undefined
  const lookupEmail = lookupValue.includes('@') ? lookupValue.trim() : undefined
  const lookupQuery = useGetAcademyRegistrationsFindStudent(
    lookupPhone || lookupEmail ? { phone: lookupPhone, email: lookupEmail } : undefined,
    { query: { enabled: !!(lookupPhone || lookupEmail), retry: false } },
  )

  const courses = (pickData<AcademyCourse[]>(coursesQuery.data) ?? []) as AcademyCourse[]
  const courseVouchersPayload = pickData<any>(courseVouchersQuery.data)
  const courseVouchers = (Array.isArray(courseVouchersPayload) ? courseVouchersPayload : courseVouchersPayload?.rows ?? []) as VoucherCategoryRow[]
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
    form.setFieldsValue({ status: NEXT_STATUS[row.status ?? 'PENDING']?.[0], payment_status: row.payment_status ?? 'UNPAID', assigned_to: row.assigned_to ?? null, note: row.note ?? undefined })
  }

  const submitUpdate = async () => {
    if (!updateTarget) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      await statusMutation.mutateAsync({
        id: updateTarget.id,
        data: { status: values.status!, payment_status: values.payment_status, assigned_to: values.assigned_to ?? null, note: values.note ?? null } as never,
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

  // AC-08 — nhân viên ghi nhận thông tin đăng ký học hộ khách
  const openCreate = () => {
    createForm.resetFields()
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    try {
      const values = await createForm.validateFields()
      setCreating(true)
      await apiClient.post('/academy/registrations', {
        full_name: values.full_name,
        phone: values.phone,
        email: values.email || undefined,
        course_id: values.course_id,
        academy_course_voucher_id: values.academy_course_voucher_id || undefined,
        note: values.note || undefined,
      })
      message.success('Đã thêm đăng ký — hệ thống tự động đối soát học viên cũ')
      setCreateOpen(false)
      await reload()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const columns = [
    {
      title: 'Học viên', dataIndex: 'full_name', key: 'full_name', render: (v: string, row: RegistrationRow) => (
        <div>
          <Space size={6} wrap>
            <Typography.Text strong>{v}</Typography.Text>
            {!!row.is_returning_student && <Tag color="purple" title="Đã từng đăng ký/khách của spa — xét ưu đãi riêng">Học viên cũ</Tag>}
          </Space>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{row.phone}</Typography.Text>
        </div>
      )
    },
    { title: 'Khóa học', key: 'course', width: 200, render: (_: unknown, row: RegistrationRow) => row.course?.name ?? courseById.get(row.course_id)?.name ?? '—' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 130, render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag> },
    {
      title: 'Ưu đãi', dataIndex: 'discount_percent', key: 'discount', width: 220,
      render: (_v: number, row: RegistrationRow) => {
        const details = [
          row.course_voucher_title ? `Voucher: ${row.course_voucher_title}` : null,
          Number(row.voucher_discount_amount ?? 0) > 0 ? `Giảm ${formatMoney(Number(row.voucher_discount_amount))} từ voucher` : null,
          Number(row.discount_percent ?? 0) > 0 ? `Ưu đãi học viên cũ ${row.discount_percent}%` : null,
        ].filter(Boolean)
        return details.length ? <Typography.Text>{details.join(' · ')}</Typography.Text> : '—'
      },
    },
    { title: 'Học phí cuối', dataIndex: 'final_tuition', key: 'final_tuition', width: 130, align: 'right' as const, render: (v?: number) => formatMoney(Number(v ?? 0)) },
    {
      title: 'Thanh toán', dataIndex: 'payment_status', key: 'payment_status', width: 150,
      render: (v?: string) => <Tag color={PAYMENT_STATUS_META[v ?? '']?.color}>{PAYMENT_STATUS_META[v ?? '']?.label ?? v ?? '—'}</Tag>,
    },
    { title: 'Người gọi', key: 'assigned', width: 130, render: (_: unknown, row: RegistrationRow) => row.user?.zalo_name ?? '—' },
    { title: 'Liên hệ lúc', dataIndex: 'contacted_at', key: 'contacted_at', width: 140, render: (v?: string) => (v ? dayjs(v).format('DD/MM HH:mm') : '—') },
    { title: 'Ghi chú', dataIndex: 'note', key: 'note', ellipsis: true },
  ]

  return (
    <div>
      <PageTitle
        left={
          <>
            {/* Icon viết dạng children (không qua prop icon) để chữ không bị ẩn trên mobile — giữ nguyên như desktop */}
            <Button onClick={() => setLookupOpen(true)}><SearchOutlined /> Tra cứu học viên</Button>
            <Input
              allowClear
              prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
              placeholder="Tìm tên / SĐT / email"
              className="w-[240px]!"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Select
              allowClear
              placeholder="Khóa học"
              className="w-[220px]"
              options={courses.map((c) => ({ value: c.id, label: c.name }))}
              value={filter.course_id}
              onChange={(v) => setFilter((f) => ({ ...f, course_id: v }))}
            />
            <Select
              allowClear
              placeholder="Trạng thái"
              className="w-[160px]"
              options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
              value={filter.status}
              onChange={(v) => setFilter((f) => ({ ...f, status: v }))}
            />
          </>
        }
        right={
          <Can I="CREATE" a="ACADEMY">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm đăng ký</Button>
          </Can>
        }
      >
        Sổ theo dõi học viên
      </PageTitle>
      {registrationsQuery.isError && <Alert type="error" showIcon message="Không tải được danh sách đăng ký" description={errorMessage(registrationsQuery.error)} style={{ marginBottom: 12 }} />}

      <Table
        rowKey="id"
        loading={registrationsQuery.isLoading}
        columns={columns}
        dataSource={paginateRows(registrations, page, 10)}
        scroll={{ x: 1100 }}
        pagination={false}
        onRow={(row) => ({
          onClick: () => openUpdate(row),
          style: { cursor: 'pointer' },
        })}
      />
      <ListPagination page={page} limit={10} total={registrations.length} onChange={setPage} noun="đăng ký" />

      <StudentLookupModal
        open={lookupOpen}
        lookupValue={lookupValue}
        onLookupValueChange={setLookupValue}
        hasQuery={!!(lookupPhone || lookupEmail)}
        loading={lookupQuery.isLoading}
        rows={lookupRows}
        onClose={() => setLookupOpen(false)}
        onCreateFromLookup={(row) => void createFromLookup(row)}
      />

      <RegistrationUpdateModal
        target={updateTarget}
        form={form}
        staffs={staffs}
        courses={courses}
        formatMoney={formatMoney}
        saving={saving}
        onClose={() => setUpdateTarget(null)}
        onSubmit={submitUpdate}
      />

      <RegistrationCreateModal
        open={createOpen}
        form={createForm}
        courses={courses}
        vouchers={courseVouchers}
        creating={creating}
        onCancel={() => setCreateOpen(false)}
        onSubmit={() => void submitCreate()}
      />
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
