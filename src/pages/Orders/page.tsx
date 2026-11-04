import { useEffect, useState } from 'react'
import { Form, Input, Modal, Select, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckOutlined, SearchOutlined, StopOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import { formatCurrency, formatDateTime, useBrandCurrency } from '@/themeRuntime'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { getProductOrders, getGetProductOrdersQueryKey, putProductOrdersId } from '@/api/endpoints/products'
import OrderDetailModal from './components/OrderDetailModal'
import {
  NEXT_ACTIONS,
  STATUS_META,
  type ProductOrderRow,
  type ProductOrderStatus,
} from './components/constants'

type OrderColumnKey = 'code' | 'customer' | 'items' | 'total_amount' | 'status' | 'created_at'

const ORDER_COLUMN_OPTIONS: { label: string; value: OrderColumnKey }[] = [
  { label: 'Mã đơn', value: 'code' },
  { label: 'Khách hàng', value: 'customer' },
  { label: 'Sản phẩm', value: 'items' },
  { label: 'Tổng tiền', value: 'total_amount' },
  { label: 'Trạng thái', value: 'status' },
  { label: 'Ngày đặt', value: 'created_at' },
]

const DEFAULT_VISIBLE_COLUMNS = ORDER_COLUMN_OPTIONS.map((column) => column.value)

export default function Orders() {
  const { currency } = useBrandCurrency()
  const { isAdmin } = useCustomerProfileAccess()
  const formatMoney = (value?: number | string | null) => formatCurrency(value, currency)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductOrderStatus | undefined>()
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<OrderColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<OrderColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [detail, setDetail] = useState<ProductOrderRow | null>(null)
  const [filterForm] = Form.useForm()

  const ordersQuery = useQuery({
    queryKey: getGetProductOrdersQueryKey({
      page,
      limit,
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    queryFn: async () =>
      await getProductOrders({
        page,
        limit,
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
  })
  const rows = (pickData<ProductOrderRow[]>(ordersQuery.data) ?? []) as ProductOrderRow[]
  const total = pickMeta(ordersQuery.data)?.total ?? rows.length

  // Debounce 300ms cho ô tìm kiếm
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchText), 300)
    return () => window.clearTimeout(timer)
  }, [searchText])

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setSearch(nextKeyword.trim())
    setPage(1)
  }

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({ status: statusFilter })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    setStatusFilter((values.status as ProductOrderStatus) || undefined)
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setStatusFilter(undefined)
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

  const changeStatus = async (row: ProductOrderRow, status: ProductOrderStatus) => {
    if (!isAdmin) return
    try {
      await putProductOrdersId(row.id, { status })
      message.success(`Đã chuyển đơn ${row.code} sang "${STATUS_META[status].label}"`)
      if (detail?.id === row.id) setDetail({ ...detail, status })
      await ordersQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const columns: TableColumnsType<ProductOrderRow> = [
    { key: 'code', title: 'Mã đơn', dataIndex: 'code', width: 160, render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    {
      key: 'customer',
      title: 'Khách hàng',
      width: 180,
      render: (_v, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.customer_name}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.phone}</Typography.Text>
        </div>
      ),
    },
    {
      key: 'items',
      title: 'Sản phẩm',
      width: 260,
      render: (_v, row) => {
        const items = row.items ?? []
        if (!items.length) return '—'
        const names = items.map((i) => `${i.product_name} ×${i.qty ?? 1}`).join(', ')
        return <Typography.Text ellipsis={{ tooltip: names }}>{names}</Typography.Text>
      },
    },
    { key: 'total_amount', title: 'Tổng tiền', dataIndex: 'total_amount', width: 130, render: (v?: number | null) => formatMoney(v) },
    {
      key: 'status',
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (v?: string | null) => <Tag color={STATUS_META[v as ProductOrderStatus]?.color}>{STATUS_META[v as ProductOrderStatus]?.label ?? v}</Tag>,
    },
    { key: 'created_at', title: 'Ngày đặt', dataIndex: 'created_at', width: 170, render: (v?: string | null) => (v ? formatDateTime(v) : '—') },
    {
      key: 'actions',
      title: 'Hành động', align: 'center' as const,
      width: 120,
      fixed: 'right' as const,
      render: (_v, row) => {
        const nextActions = NEXT_ACTIONS[(row.status as ProductOrderStatus) ?? 'PENDING'] ?? []
        return (
          <RowActionsMenu
            items={[
              ...(isAdmin
                ? nextActions.map((action) => ({
                  key: action.status,
                  icon: action.danger ? <StopOutlined /> : <CheckOutlined />,
                  label: action.label,
                  danger: action.danger,
                }))
                : []),
            ]}
            onSelect={(key) => {
              if (!isAdmin) return
              const action = nextActions.find((item) => item.status === key)
              if (!action) return
              if (action.danger) {
                Modal.confirm({
                  title: `${action.label} đơn ${row.code}?`,
                  okText: action.label,
                  okButtonProps: { danger: true },
                  cancelText: 'Hủy',
                  onOk: () => changeStatus(row, action.status),
                })
              } else {
                void changeStatus(row, action.status)
              }
            }}
          />
        )
      },
    },
  ]

  const activeFilterCount = (statusFilter ? 1 : 0) + (search ? 1 : 0)

  return (
    <>
      <PageTitle
        subtitle="Theo dõi và xử lý đơn hàng từ cửa hàng"
        left={
          <>
            <Input
              allowClear
              prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
              placeholder="Tìm mã đơn, tên, SĐT"
              className="w-[260px]!"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value)
                setPage(1)
                if (!event.target.value) setSearch('')
              }}
              onPressEnter={() => applySearch(searchText)}
            />
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={openFilters}
              activeFilterCount={activeFilterCount}
              form={filterForm}
              onApply={applyFilters}
              onClear={clearFilters}
              columnOptions={ORDER_COLUMN_OPTIONS}
              draftVisibleColumns={draftVisibleColumns}
              onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as OrderColumnKey[])}
              filterItems={(
                <Form.Item name="status" label="Trạng thái" className="mb-0!">
                  <Select allowClear placeholder="Tất cả" options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))} />
                </Form.Item>
              )}
            />
          </>
        }
      >
        Đơn hàng
      </PageTitle>

      <Table<ProductOrderRow>
        rowKey="id"
        loading={ordersQuery.isFetching}
        dataSource={rows}
        scroll={{ x: 1000 }}
        pagination={false}
        onRow={(row) => ({
          onClick: () => setDetail(row),
          style: { cursor: 'pointer' },
        })}
        columns={columns.filter((column) =>
          column.key === 'actions' || visibleColumns.includes(column.key as OrderColumnKey),
        )}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="đơn hàng" />

      <OrderDetailModal
        detail={detail}
        onClose={() => setDetail(null)}
        isAdmin={isAdmin}
        onChangeStatus={changeStatus}
        formatMoney={formatMoney}
      />
    </>
  )
}
