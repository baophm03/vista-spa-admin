import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Form, Select, Space, Table, Tag, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { ReloadOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { GetAccessLogsParams } from '@/api/models/getAccessLogsParams'
import type { GetAccessLogsAction } from '@/api/models/getAccessLogsAction'
import type { Branch } from '@/api/models/branch'
import { useGetAccessLogs } from '@/api/endpoints/admin'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetUsers } from '@/api/endpoints/users'
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useBrandDateTime } from '@/themeRuntime'

interface AccessLogRow {
  id: string
  user_id: string
  branch_id?: string | null
  user_name?: string | null
  customer_profile_id?: string | null
  customer_name?: string | null
  customer_code?: string | null
  action: string
  ip?: string | null
  created_at?: string
}

interface UserOption {
  id: string
  zalo_name?: string
  phone_number?: string
}

interface CustomerOption {
  id: string
  full_name: string
  customer_code?: string
  phone?: string
}

interface ListResult<T> {
  rows?: T[]
}

const ACTION_META: Record<GetAccessLogsAction, { label: string; color: string }> = {
  VIEW_PROFILE: { label: 'Xem hồ sơ / QR / sức khỏe', color: 'blue' },
  VIEW_SESSION: { label: 'Xem buổi điều trị', color: 'cyan' },
  VIEW_PHOTO: { label: 'Xem ảnh điều trị', color: 'purple' },
  DELETE_PHOTO: { label: 'Xóa ảnh điều trị', color: 'red' },
  EXPORT: { label: 'Xuất CSV', color: 'gold' },
}

function listRows<T>(value: unknown): T[] {
  const payload = pickData<T[] | ListResult<T>>(value)
  return Array.isArray(payload) ? payload : payload?.rows ?? []
}

export default function AccessLogs() {
  const { formatDateTime } = useBrandDateTime()
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [userId, setUserId] = useState<string>()
  const [branchId, setBranchId] = useState<string>()
  const [customerProfileId, setCustomerProfileId] = useState<string>()
  const [action, setAction] = useState<GetAccessLogsAction>()
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterForm] = Form.useForm()
  const [staffSearch, setStaffSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState({ staff: '', customer: '' })

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch({ staff: staffSearch.trim(), customer: customerSearch.trim() })
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [staffSearch, customerSearch])

  const params = useMemo<GetAccessLogsParams>(() => ({
    page,
    limit,
    ...(branchId ? { branch_id: branchId } : {}),
    ...(userId ? { user_id: userId } : {}),
    ...(customerProfileId ? { customer_profile_id: customerProfileId } : {}),
    ...(action ? { action } : {}),
    ...(range?.[0] ? { from: range[0].toISOString() } : {}),
    ...(range?.[1] ? { to: range[1].toISOString() } : {}),
  }), [page, limit, branchId, userId, customerProfileId, action, range])

  const logsQuery = useGetAccessLogs(params)
  const branchesQuery = useGetBranches({ status: 'all' })
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 50, has_role: true, ...(debouncedSearch.staff ? { q: debouncedSearch.staff } : {}) })
  const customersQuery = useGetCustomerProfiles({
    page: 1,
    limit: 50,
    ...(debouncedSearch.customer ? { q: debouncedSearch.customer } : {}),
  })

  const logs = listRows<AccessLogRow>(logsQuery.data)
  const total = pickMeta(logsQuery.data)?.total ?? logs.length
  const users = listRows<UserOption>(usersQuery.data)
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const customers = listRows<CustomerOption>(customersQuery.data)

  const activeFilterCount = [branchId, userId, customerProfileId, action, range?.some(Boolean) ? 'date' : undefined]
    .filter(Boolean).length

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) {
      setStaffSearch('')
      setCustomerSearch('')
      return
    }
    filterForm.setFieldsValue({ branch_id: branchId, user_id: userId, customer_profile_id: customerProfileId, action, range })
  }

  const applyFilters = (values: Record<string, unknown>) => {
    setBranchId(typeof values.branch_id === 'string' && values.branch_id ? values.branch_id : undefined)
    setUserId(typeof values.user_id === 'string' && values.user_id ? values.user_id : undefined)
    setCustomerProfileId(typeof values.customer_profile_id === 'string' && values.customer_profile_id ? values.customer_profile_id : undefined)
    setAction(values.action as GetAccessLogsAction | undefined)
    setRange((values.range as [Dayjs | null, Dayjs | null] | null | undefined) ?? null)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setBranchId(undefined)
    setUserId(undefined)
    setCustomerProfileId(undefined)
    setAction(undefined)
    setRange(null)
    setStaffSearch('')
    setCustomerSearch('')
    setPage(1)
  }

  return (
    <>
      <PageTitle subtitle="Nhật ký truy cập hệ thống quản trị" extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void logsQuery.refetch()}>Tải lại</Button>
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={openFilters}
              activeFilterCount={activeFilterCount}
              form={filterForm}
              onApply={applyFilters}
              onClear={clearFilters}
              filterItems={(
                <>
                  <Form.Item name="branch_id" label="Cơ sở" style={{ marginBottom: 10 }}>
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      loading={branchesQuery.isLoading}
                      placeholder="Tất cả cơ sở"
                      options={branches.map((branch) => ({
                        value: branch.id,
                        label: `${branch.code} · ${branch.name}${branch.is_active === false ? ' (Ngừng hoạt động)' : ''}`,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="user_id" label="Nhân viên thực hiện" style={{ marginBottom: 10 }}>
                    <Select
                      allowClear
                      showSearch
                      filterOption={false}
                      loading={usersQuery.isLoading}
                      placeholder="Tất cả nhân viên"
                      options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.phone_number || user.id }))}
                      onSearch={setStaffSearch}
                    />
                  </Form.Item>
                  <Form.Item name="customer_profile_id" label="Khách hàng" style={{ marginBottom: 10 }}>
                    <Select
                      allowClear
                      showSearch
                      filterOption={false}
                      loading={customersQuery.isLoading}
                      placeholder="Tất cả khách hàng"
                      options={customers.map((customer) => ({
                        value: customer.id,
                        label: `${customer.customer_code ? `${customer.customer_code} · ` : ''}${customer.full_name}${customer.phone ? ` · ${customer.phone}` : ''}`,
                      }))}
                      onSearch={setCustomerSearch}
                    />
                  </Form.Item>
                  <Form.Item name="action" label="Hành động" style={{ marginBottom: 10 }}>
                    <Select<GetAccessLogsAction>
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder="Tất cả hành động"
                      options={(Object.keys(ACTION_META) as GetAccessLogsAction[]).map((value) => ({ value, label: ACTION_META[value].label }))}
                    />
                  </Form.Item>
                  <Form.Item name="range" label="Thời gian" style={{ marginBottom: 0 }}>
                    <DatePicker.RangePicker
                      allowEmpty={[true, true]}
                      showTime={{ defaultValue: [dayjs('2000-01-01T00:00:00'), dayjs('2000-01-01T23:59:59')], format: 'HH:mm' }}
                      format="DD/MM/YYYY HH:mm"
                      placeholder={['Từ ngày/giờ', 'Đến ngày/giờ']}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </>
              )}
            />
          </Space>
        )}
      >
        Nhật ký truy cập
      </PageTitle>

      {logsQuery.isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Không tải được nhật ký truy cập"
          description={errorMessage(logsQuery.error)}
          action={<Button size="small" onClick={() => void logsQuery.refetch()}>Thử lại</Button>}
        />
      )}

      {(branchesQuery.isError || usersQuery.isError || customersQuery.isError) && (
        <Typography.Text type="secondary" className="mb-3 block">
          Không tải được danh sách lựa chọn; có thể lọc bằng các mục đã tải hoặc tiếp tục xem nhật ký.
        </Typography.Text>
      )}

      <Table<AccessLogRow>
        rowKey="id"
        loading={logsQuery.isLoading}
        dataSource={logs}
        scroll={{ x: 900 }}
        locale={{ emptyText: <TableEmpty description="Chưa có nhật ký truy cập" /> }}
        pagination={false}
        columns={[
          { title: 'Thời gian', dataIndex: 'created_at', width: 180, render: (value?: string) => value ? formatDateTime(value) : '—' },
          { title: 'Nhân viên', dataIndex: 'user_name', width: 210, render: (value: string | null | undefined, row) => value || row.user_id },
          {
            title: 'Khách hàng',
            dataIndex: 'customer_name',
            width: 260,
            render: (value: string | null | undefined, row) => value ? (
              <Space direction="vertical" size={0}>
                <span>{value}</span>
                {row.customer_code && <Typography.Text type="secondary" code>{row.customer_code}</Typography.Text>}
              </Space>
            ) : row.action === 'EXPORT' ? 'Xuất danh sách khách' : '—',
          },
          {
            title: 'Hành động', align: 'center' as const,
            dataIndex: 'action',
            width: 230,
            render: (value: string) => {
              const meta = ACTION_META[value as GetAccessLogsAction]
              return <Tag color={meta?.color}>{meta?.label ?? value}</Tag>
            },
          },
          { title: 'Địa chỉ IP', dataIndex: 'ip', width: 160, render: (value?: string | null) => value || '—' },
        ]}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="lượt truy cập" />
    </>
  )
}
