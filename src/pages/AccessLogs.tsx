import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, DatePicker, Popover, Select, Space, Table, Tag, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
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
  const [limit, setLimit] = useState(20)
  const [userId, setUserId] = useState<string>()
  const [branchId, setBranchId] = useState<string>()
  const [customerProfileId, setCustomerProfileId] = useState<string>()
  const [action, setAction] = useState<GetAccessLogsAction>()
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [draftUserId, setDraftUserId] = useState<string>()
  const [draftBranchId, setDraftBranchId] = useState<string>()
  const [draftCustomerProfileId, setDraftCustomerProfileId] = useState<string>()
  const [draftAction, setDraftAction] = useState<GetAccessLogsAction>()
  const [draftRange, setDraftRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
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
  const draftFilterCount = [draftBranchId, draftUserId, draftCustomerProfileId, draftAction, draftRange?.some(Boolean) ? 'date' : undefined]
    .filter(Boolean).length

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) {
      setStaffSearch('')
      setCustomerSearch('')
      return
    }
    setDraftBranchId(branchId)
    setDraftUserId(userId)
    setDraftCustomerProfileId(customerProfileId)
    setDraftAction(action)
    setDraftRange(range)
  }

  const applyFilters = () => {
    setBranchId(draftBranchId)
    setUserId(draftUserId)
    setCustomerProfileId(draftCustomerProfileId)
    setAction(draftAction)
    setRange(draftRange)
    setPage(1)
    setFilterOpen(false)
  }

  const resetFilters = () => {
    setBranchId(undefined)
    setUserId(undefined)
    setCustomerProfileId(undefined)
    setAction(undefined)
    setRange(null)
    setDraftBranchId(undefined)
    setDraftUserId(undefined)
    setDraftCustomerProfileId(undefined)
    setDraftAction(undefined)
    setDraftRange(null)
    setStaffSearch('')
    setCustomerSearch('')
    setPage(1)
  }

  return (
    <>
      <PageTitle
        extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void logsQuery.refetch()}>Tải lại</Button>
            <Popover
              trigger="click"
              placement="bottomRight"
              open={filterOpen}
              onOpenChange={openFilters}
              content={(
                <div style={{ width: 320, maxHeight: 'min(70vh, 580px)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ overflowY: 'auto', paddingRight: 4 }}>
                    <Typography.Text strong>Điều kiện lọc</Typography.Text>
                    <div style={{ marginTop: 12 }}>
                      <Typography.Text type="secondary">Cơ sở</Typography.Text>
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        loading={branchesQuery.isLoading}
                        value={draftBranchId}
                        placeholder="Tất cả cơ sở"
                        style={{ width: '100%', marginTop: 6 }}
                        options={branches.map((branch) => ({
                          value: branch.id,
                          label: `${branch.code} · ${branch.name}${branch.is_active === false ? ' (Ngừng hoạt động)' : ''}`,
                        }))}
                        onChange={setDraftBranchId}
                      />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <Typography.Text type="secondary">Nhân viên thực hiện</Typography.Text>
                      <Select
                        allowClear
                        showSearch
                        filterOption={false}
                        loading={usersQuery.isLoading}
                        value={draftUserId}
                        placeholder="Tất cả nhân viên"
                        style={{ width: '100%', marginTop: 6 }}
                        options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.phone_number || user.id }))}
                        onSearch={setStaffSearch}
                        onChange={setDraftUserId}
                      />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Typography.Text type="secondary">Khách hàng</Typography.Text>
                      <Select
                        allowClear
                        showSearch
                        filterOption={false}
                        loading={customersQuery.isLoading}
                        value={draftCustomerProfileId}
                        placeholder="Tất cả khách hàng"
                        style={{ width: '100%', marginTop: 6 }}
                        options={customers.map((customer) => ({
                          value: customer.id,
                          label: `${customer.customer_code ? `${customer.customer_code} · ` : ''}${customer.full_name}${customer.phone ? ` · ${customer.phone}` : ''}`,
                        }))}
                        onSearch={setCustomerSearch}
                        onChange={setDraftCustomerProfileId}
                      />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Typography.Text type="secondary">Hành động</Typography.Text>
                      <Select<GetAccessLogsAction>
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        value={draftAction}
                        placeholder="Tất cả hành động"
                        style={{ width: '100%', marginTop: 6 }}
                        options={(Object.keys(ACTION_META) as GetAccessLogsAction[]).map((value) => ({ value, label: ACTION_META[value].label }))}
                        onChange={setDraftAction}
                      />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Typography.Text type="secondary">Thời gian</Typography.Text>
                      <DatePicker.RangePicker
                        allowEmpty={[true, true]}
                        value={draftRange}
                        showTime={{ defaultValue: [dayjs('2000-01-01T00:00:00'), dayjs('2000-01-01T23:59:59')], format: 'HH:mm' }}
                        format="DD/MM/YYYY HH:mm"
                        placeholder={["Từ ngày/giờ", "Đến ngày/giờ"]}
                        style={{ width: '100%', marginTop: 6 }}
                        onCalendarChange={(value) => setDraftRange(value as [Dayjs | null, Dayjs | null] | null)}
                        onChange={(value) => setDraftRange(value as [Dayjs | null, Dayjs | null] | null)}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 12, marginTop: 12, borderTop: '1px solid var(--brand-border-soft)' }}>
                    <Button disabled={!activeFilterCount && !draftFilterCount} onClick={resetFilters}>Xóa lọc</Button>
                    <Button type="primary" onClick={applyFilters}>Xác nhận</Button>
                  </div>
                </div>
              )}
            >
              <Badge count={activeFilterCount} size="small">
                <Button icon={<FilterOutlined />}>Bộ lọc</Button>
              </Badge>
            </Popover>
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
        locale={{ emptyText: 'Chưa có nhật ký truy cập' }}
        pagination={{ current: page, pageSize: limit, total, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
        onChange={(pagination) => {
          setPage(pagination.current ?? 1)
          setLimit(pagination.pageSize ?? 20)
        }}
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
            title: 'Hành động',
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
    </>
  )
}
