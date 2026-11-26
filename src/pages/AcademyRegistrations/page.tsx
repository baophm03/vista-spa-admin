import ResponsiveTable from '@/components/base/ResponsiveTable'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge, Button, Form, Input, Popover, Select, Space, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, FilterOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import ListPagination from '@/components/base/ListPagination'
import StatCards from '@/components/base/StatCards'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { AcademyCourse } from '@/api/models/academyCourse'
import { useGetAcademyCourseVouchersAdmin } from '@/api/endpoints/academy-course-vouchers'
import type { VoucherCategoryRow } from '@/pages/Vouchers/components/constants'
import { getGetAcademyRegistrationsAdminQueryKey, postAcademyRegistrationsAdmin, usePutAcademyRegistrationsIdStatusAdmin } from '@/api/endpoints/academy'
import { useGetAcademyCoursesAdmin } from '@/api/endpoints/academy'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import { apiClient } from '@/api/mutator/custom-instance'
import { useBrandCurrency } from '@/themeRuntime'
import { Can } from '@casl/react'
import RegistrationCreateModal from './components/RegistrationCreateModal'
import RegistrationUpdateModal from './components/RegistrationUpdateModal'
import { NEXT_STATUS, PAYMENT_STATUS_META, STATUS_META } from './components/constants'
import type { RegistrationRow } from './components/constants'
import './academy-registrations.css'

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
  const [limit] = useState(10)
  const [updateTarget, setUpdateTarget] = useState<RegistrationRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<UpdateFormValues>()
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm] = Form.useForm()

  const applySearch = (value: string) => {
    setSearchInput(value)
    setFilter((f) => ({ ...f, q: value.trim() || undefined }))
    setPage(1)
  }

  const coursesQuery = useGetAcademyCoursesAdmin({ page: 1, limit: 200 } as never)
  const courseVouchersQuery = useGetAcademyCourseVouchersAdmin()
  const registrationsQuery = useGetRegistrationsSafe(filter, page, limit)
  const summaryQuery = useGetRegistrationsSafe({}, 1, 1)
  const pendingQuery = useGetRegistrationsSafe({ status: 'PENDING' }, 1, 1)
  const attendedQuery = useGetRegistrationsSafe({ status: 'ATTENDED' }, 1, 1)
  const usersQuery = useGetUsersAdmin({ currentPage: 1, pageSize: 200, has_role: true })
  const courses = (pickData<AcademyCourse[]>(coursesQuery.data) ?? []) as AcademyCourse[]
  const courseVouchersPayload = pickData<any>(courseVouchersQuery.data)
  const courseVouchers = (Array.isArray(courseVouchersPayload) ? courseVouchersPayload : courseVouchersPayload?.rows ?? []) as VoucherCategoryRow[]
  const registrations = (pickData<RegistrationRow[]>(registrationsQuery.data) ?? []) as RegistrationRow[]
  const total = (registrationsQuery.data as unknown as { meta?: { total?: number } } | null)?.meta?.total ?? registrations.length
  const staffs = (pickData<{ rows?: Array<{ id: string; zalo_name?: string }> } | undefined>(usersQuery.data)?.rows ?? []) as Array<{ id: string; zalo_name?: string }>
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  const statusMutation = usePutAcademyRegistrationsIdStatusAdmin()

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetAcademyRegistrationsAdminQueryKey() })
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

  // AC-08 — nhân viên ghi nhận thông tin đăng ký học hộ khách
  const openCreate = () => {
    createForm.resetFields()
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    try {
      const values = await createForm.validateFields()
      setCreating(true)
      await postAcademyRegistrationsAdmin({
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
        className="academy-registrations-page-title"
        summary={(
          <div className="academy-registration-stats">
            <StatCards items={[
              { key: 'total', label: 'Tổng đăng ký', value: registrationCount(summaryQuery.data), icon: <TeamOutlined /> },
              { key: 'pending', label: 'Mới đăng ký', value: registrationCount(pendingQuery.data), icon: <ClockCircleOutlined />, tone: 'tertiary' },
              { key: 'attended', label: 'Đã nhập học', value: registrationCount(attendedQuery.data), icon: <CheckCircleOutlined />, tone: 'secondary' },
            ]} />
          </div>
        )}
        left={
          <>
            <Input.Search
              allowClear
              placeholder="Tìm tên / SĐT / email"
              className="academy-registration-search"
              value={searchInput}
              onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) applySearch('') }}
              onSearch={applySearch}
            />
            <Popover
              trigger="click"
              placement="bottomRight"
              content={(
                <div className="academy-registration-filter-popover">
                  <Select
                    allowClear
                    placeholder="Khóa học"
                    className="mobile-filter-select"
                    options={courses.map((c) => ({ value: c.id, label: c.name }))}
                    value={filter.course_id}
                    onChange={(v) => { setFilter((f) => ({ ...f, course_id: v })); setPage(1) }}
                  />
                  <Select
                    allowClear
                    placeholder="Trạng thái"
                    className="mobile-filter-select"
                    options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
                    value={filter.status}
                    onChange={(v) => { setFilter((f) => ({ ...f, status: v })); setPage(1) }}
                  />
                </div>
              )}
            >
              <Button
                className="academy-registration-mobile-filter-button"
                icon={<Badge dot={!!(filter.course_id || filter.status)}><FilterOutlined /></Badge>}
                aria-label="Lọc khóa học và trạng thái"
                title="Lọc khóa học và trạng thái"
              />
            </Popover>
            <div className="academy-registration-desktop-filters">
              <Select
                allowClear
                placeholder="Khóa học"
                className="w-[220px]"
                options={courses.map((c) => ({ value: c.id, label: c.name }))}
                value={filter.course_id}
                onChange={(v) => { setFilter((f) => ({ ...f, course_id: v })); setPage(1) }}
              />
              <Select
                allowClear
                placeholder="Trạng thái"
                className="w-[160px]"
                options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
                value={filter.status}
                onChange={(v) => { setFilter((f) => ({ ...f, status: v })); setPage(1) }}
              />
            </div>
          </>
        }
        right={
          <Can I="CREATE" a="ACADEMY_REGISTRATION">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="academy-registration-create-button"
              aria-label="Thêm đăng ký"
              title="Thêm đăng ký"
              onClick={openCreate}
            ><span className="academy-registration-create-label">Thêm đăng ký</span></Button>
          </Can>
        }
      >
        Sổ theo dõi học viên
      </PageTitle>
      {registrationsQuery.isError && <Alert type="error" showIcon message="Không tải được danh sách đăng ký" description={errorMessage(registrationsQuery.error)} style={{ marginBottom: 12 }} />}

      <div className="academy-registration-list">
        <ResponsiveTable
          rowKey="id"
          loading={registrationsQuery.isLoading}
          columns={columns}
          dataSource={registrations}
          scroll={{ x: 1100 }}
          pagination={false}
          mobileTitleKey="full_name"
          onMobileCardClick={openUpdate}
          onRow={(row) => ({
            onClick: () => openUpdate(row),
            style: { cursor: 'pointer' },
          })}
        />
      </div>
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="đăng ký" />

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

/** Wrapper: BE hỗ trợ q + page/limit nhưng spec chưa khai báo (client sinh ra chỉ có
 * branch_id/course_id/status/phone) — giữ raw call với URL /admin mới. */
function useGetRegistrationsSafe(filter: { status?: string; course_id?: string; q?: string }, page: number, limit: number) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (filter.status) params.set('status', filter.status)
  if (filter.course_id) params.set('course_id', filter.course_id)
  if (filter.q) params.set('q', filter.q)
  return useQuery({
    queryKey: [...getGetAcademyRegistrationsAdminQueryKey(), params.toString()],
    queryFn: async ({ signal }) => (await apiClient.get(`/academy/registrations/admin?${params.toString()}`, { signal })).data,
  })
}

function registrationCount(data: unknown) {
  return pickMeta(data)?.total?.toLocaleString('vi-VN') ?? '—'
}
