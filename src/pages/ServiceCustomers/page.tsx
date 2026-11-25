import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Form, Input, Select, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckCircleOutlined, PlayCircleOutlined, PlusOutlined, ShoppingOutlined, WalletOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { Service } from '@/api/models/service'
import type { LookupItem } from '@/api/models/lookupItem'
import { getGetServiceCustomersAdminQueryKey, useGetServiceCustomersAdmin, usePostServiceCustomersAdmin } from '@/api/endpoints/service-customers'
import { getUsersCustomersAdmin } from '@/api/endpoints/customers'
import { useGetServiceAdmin } from '@/api/endpoints/services'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import { useGetLookupListsAdmin } from '@/api/endpoints/lookup-lists'
import { useBrandCurrency } from '@/themeRuntime'
import { displayName } from '@/utils/displayName'
import ServiceCustomerCreateModal from './components/ServiceCustomerCreateModal'
import ServiceCustomerDetailModal from './components/ServiceCustomerDetailModal'
import { PAYMENT_STATUS_META, STATUS_META, STATUS_OPTIONS, serviceTitle, timeLabel, type ServiceCustomerRow } from './components/constants'

type CustomerOption = { id: string; full_name?: string | null; zalo_name?: string | null; phone?: string | null }
type Filters = { q?: string; branch_id?: string; service_id?: string; status?: string; payment_status?: string; from?: string; to?: string }

/**
 * Dịch vụ khách hàng — lượt khách dùng dịch vụ lẻ (BE: bảng service_customer, API /service-customers).
 * Chọn khách hàng + cơ sở + dịch vụ lẻ; theo dõi trạng thái thực hiện, hồ sơ lần làm và thanh toán.
 */
export default function ServiceCustomers() {
  const { format: formatMoney, symbol: currencySymbol } = useBrandCurrency()
  const queryClient = useQueryClient()
  const ability = useAbility()
  const canCreate = ability.can('CREATE', 'SERVICE_CUSTOMER')
  const permissions = {
    update: ability.can('UPDATE', 'SERVICE_CUSTOMER'),
    approve: ability.can('APPROVE', 'SERVICE_CUSTOMER'),
    redeemPoints: ability.can('POINTS_ADJUST', 'MEMBERSHIP'),
    applyReward: ability.can('REDEEM_ADMIN', 'REWARD'),
    start: ability.can('START', 'SERVICE_CUSTOMER'),
    complete: ability.can('COMPLETE', 'SERVICE_CUSTOMER'),
    pay: ability.can('CREATE', 'PAYMENT'),
    readPayments: ability.can('READ', 'PAYMENT'),
  }

  const [page, setPage] = useState(1)
  const limit = 10
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<Filters>({})
  const [detailId, setDetailId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const customerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const listQuery = useGetServiceCustomersAdmin({ page, limit, ...filters } as never)
  const rows = (pickData<ServiceCustomerRow[]>(listQuery.data) ?? []) as ServiceCustomerRow[]
  const meta = (listQuery.data as unknown as { meta?: { total?: number; stats?: { total: number; in_progress: number; completed: number } } })?.meta
  const branchesQuery = useGetBranchesAdmin()
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const servicesQuery = useGetServiceAdmin({ page: 1, limit: 100 })
  const services = (pickData<{ services?: Service[] }>(servicesQuery.data)?.services ?? []) as Service[]
  const staffsQuery = useGetUsersAdmin({ currentPage: 1, pageSize: 200, has_role: true })
  const staffOptions = useMemo(
    () =>
      ((pickData<{ rows?: Array<{ id: string; zalo_name?: string; email?: string }> }>(staffsQuery.data)?.rows ?? []) as Array<{ id: string; zalo_name?: string; email?: string }>)
        .map((user) => ({ value: user.id, label: `${user.zalo_name || 'Nhân viên'} · ${user.email || user.id.slice(0, 8)}` })),
    [staffsQuery.data],
  )
  const lookupQuery = useGetLookupListsAdmin({ key: 'payment.methods', items_is_active: 'true' })
  const paymentLookup = ((pickData<Array<{ lookup_items?: LookupItem[] }>>(lookupQuery.data) ?? [])[0]) ?? null
  const paymentMethods = (paymentLookup?.lookup_items ?? []).filter((item) => item.is_active !== false)
  const paymentMethodLabels = Object.fromEntries((paymentLookup?.lookup_items ?? []).map((item) => [item.code, item.label]))

  const createMutation = usePostServiceCustomersAdmin()
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getGetServiceCustomersAdminQueryKey() })
  }, [queryClient])

  const updateFilters = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
  }

  const searchCustomers = useCallback((keyword: string) => {
    if (customerTimer.current) clearTimeout(customerTimer.current)
    customerTimer.current = setTimeout(() => {
      getUsersCustomersAdmin({ page: 1, limit: 50, ...(keyword ? { q: keyword } : {}) } as never)
        .then((response) => setCustomerOptions((pickData<CustomerOption[]>(response) ?? []) as CustomerOption[]))
        .catch(() => undefined)
    }, 300)
  }, [])

  const openCreate = () => {
    createForm.resetFields()
    createForm.setFieldsValue({ cs_date: dayjs(), branch_id: branches.length === 1 ? branches[0].id : undefined })
    searchCustomers('')
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    try {
      const values = await createForm.validateFields()
      const created = await createMutation.mutateAsync({
        data: {
          user_id: values.user_id,
          branch_id: values.branch_id,
          service_id: values.service_id,
          staff_id: values.staff_id || null,
          cs_date: (values.cs_date as Dayjs).format('YYYY-MM-DD'),
          start_time: values.start_time,
          service_amount: values.service_amount != null ? Number(values.service_amount) : undefined,
          note: values.note?.trim() || null,
        },
      })
      message.success('Đã thêm dịch vụ cho khách hàng')
      setCreateOpen(false)
      refresh()
      const createdId = pickData<ServiceCustomerRow>(created)?.id
      if (createdId) setDetailId(createdId)
    } catch (err) {
      if (!(err && typeof err === 'object' && 'errorFields' in err)) message.error(errorMessage(err))
    }
  }

  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng lượt dịch vụ', value: (meta?.stats?.total ?? 0).toLocaleString('vi-VN'), icon: <ShoppingOutlined />, tone: 'primary' },
    { key: 'in_progress', label: 'Đang thực hiện', value: (meta?.stats?.in_progress ?? 0).toLocaleString('vi-VN'), icon: <PlayCircleOutlined />, tone: 'secondary' },
    { key: 'completed', label: 'Hoàn tất', value: (meta?.stats?.completed ?? 0).toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'neutral' },
  ]

  const statusTag = (row: ServiceCustomerRow) => <Tag color={STATUS_META[row.status]?.color}>{STATUS_META[row.status]?.label ?? row.status}</Tag>
  const paymentTag = (row: ServiceCustomerRow) => (
    <Tag color={PAYMENT_STATUS_META[row.payment_status ?? '']?.color}>{PAYMENT_STATUS_META[row.payment_status ?? '']?.label ?? row.payment_status}</Tag>
  )

  const columns: TableColumnsType<ServiceCustomerRow> = [
    {
      title: 'Khách hàng',
      key: 'customer',
      width: '18%',
      render: (_value, row) => (
        <div>
          <Typography.Text strong>{displayName(row.user)}</Typography.Text>
          <div className="text-xs text-[#777]">{row.user?.phone ?? row.user?.customer_code ?? ''}</div>
        </div>
      ),
    },
    { title: 'Dịch vụ lẻ', key: 'service', render: (_value, row) => serviceTitle(row) },
    { title: 'Cơ sở', key: 'branch', width: '11%', render: (_value, row) => row.branch?.name ?? '—' },
    { title: 'Ngày giờ', key: 'time', width: '13%', render: (_value, row) => <span>{dayjs(row.cs_date).format('DD/MM/YYYY')}<br />{timeLabel(row)}</span> },
    { title: 'KTV', key: 'staff', width: '11%', render: (_value, row) => (row.staff ? displayName({ full_name: row.staff.full_name, zalo_name: row.staff.zalo_name }, row.staff.email ?? '—') : '—') },
    { title: 'Thành tiền', key: 'amount', width: '10%', render: (_value, row) => formatMoney(row.service_amount) },
    {
      title: 'Thanh toán',
      key: 'payment',
      width: '13%',
      render: (_value, row) => (
        <div>
          {paymentTag(row)}
          {Number(row.debt_amount ?? 0) > 0 && <div className="text-xs text-[#D97706]">Còn nợ {formatMoney(row.debt_amount)}</div>}
        </div>
      ),
    },
    { title: 'Trạng thái', key: 'status', width: '11%', render: (_value, row) => statusTag(row) },
  ]

  return (
    <div>
      <PageTitle subtitle="Khách hàng sử dụng dịch vụ lẻ: lịch thực hiện, hồ sơ lần làm và thanh toán.">
        Dịch vụ khách hàng
      </PageTitle>
      <StatCards items={statItems} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input.Search
            allowClear
            aria-label="Tìm khách hàng hoặc dịch vụ"
            placeholder="Tìm tên/SĐT khách, tên dịch vụ"
            style={{ width: 260 }}
            value={searchInput}
            onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) updateFilters({ q: undefined }) }}
            onSearch={(value) => updateFilters({ q: value.trim() || undefined })}
          />
          <Select allowClear placeholder="Cơ sở" style={{ minWidth: 150 }} value={filters.branch_id} onChange={(value) => updateFilters({ branch_id: value })} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="Dịch vụ lẻ" style={{ minWidth: 170 }} value={filters.service_id} onChange={(value) => updateFilters({ service_id: value })} options={services.map((service) => ({ value: service.id, label: service.title }))} />
          <Select allowClear placeholder="Trạng thái" style={{ minWidth: 140 }} value={filters.status} onChange={(value) => updateFilters({ status: value })} options={STATUS_OPTIONS} />
          <Select allowClear placeholder="Thanh toán" style={{ minWidth: 150 }} value={filters.payment_status} onChange={(value) => updateFilters({ payment_status: value })} options={Object.entries(PAYMENT_STATUS_META).map(([value, item]) => ({ value, label: item.label }))} suffixIcon={<WalletOutlined />} />
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            value={filters.from && filters.to ? [dayjs(filters.from), dayjs(filters.to)] : null}
            onChange={(range) => updateFilters({ from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD') })}
          />
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm dịch vụ cho khách
          </Button>
        )}
      </div>
      {listQuery.isError ? (
        <Alert
          type="error"
          showIcon
          title="Không tải được danh sách dịch vụ khách hàng"
          description={errorMessage(listQuery.error)}
          action={<Button onClick={() => void listQuery.refetch()} loading={listQuery.isFetching}>Thử lại</Button>}
        />
      ) : (
        <>
          <Table<ServiceCustomerRow>
            className="desktop-only [&_.ant-table-thead_th]:whitespace-nowrap!"
            rowKey="id"
            loading={listQuery.isLoading}
            dataSource={rows}
            tableLayout="fixed"
            pagination={false}
            columns={columns}
            locale={{ emptyText: filters.q ? 'Không có kết quả' : 'Chưa có dữ liệu' }}
            onRow={(row) => ({ onClick: () => setDetailId(row.id), style: { cursor: 'pointer' } })}
          />
          <MobileCards
            rows={rows}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            emptyText={filters.q ? 'Không có kết quả' : 'Chưa có dữ liệu'}
            onCardClick={(row) => setDetailId(row.id)}
            renderCard={(row) => (
              <>
                <div className="mobile-card-head">
                  <span className="mobile-card-title">{displayName(row.user)}</span>
                  {statusTag(row)}
                </div>
                <div className="mobile-card-rows">
                  <MobileCardRow label="Dịch vụ lẻ" value={serviceTitle(row)} />
                  <MobileCardRow label="Cơ sở" value={row.branch?.name ?? '—'} />
                  <MobileCardRow label="Ngày giờ" value={`${dayjs(row.cs_date).format('DD/MM/YYYY')} · ${timeLabel(row)}`} />
                  <MobileCardRow label="Thành tiền" value={formatMoney(row.service_amount)} />
                  <MobileCardRow label="Thanh toán" value={paymentTag(row)} />
                </div>
              </>
            )}
          />
          <ListPagination page={page} limit={limit} total={meta?.total ?? rows.length} onChange={setPage} noun="lượt dịch vụ" />
        </>
      )}

      <ServiceCustomerCreateModal
        form={createForm}
        open={createOpen}
        saving={createMutation.isPending}
        branches={branches}
        services={services}
        servicesLoading={servicesQuery.isLoading}
        customerOptions={customerOptions}
        onSearchCustomer={searchCustomers}
        staffOptions={staffOptions}
        currencySymbol={currencySymbol}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void submitCreate()}
      />
      <ServiceCustomerDetailModal
        rowId={detailId}
        formatMoney={formatMoney}
        currencySymbol={currencySymbol}
        paymentMethods={paymentMethods}
        paymentMethodLabels={paymentMethodLabels}
        permissions={permissions}
        onChanged={refresh}
        onClose={() => setDetailId(null)}
      />
    </div>
  )
}
