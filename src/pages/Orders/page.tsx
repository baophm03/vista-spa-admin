import { useState } from 'react'
import { Input, Modal, Select, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckOutlined, StopOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import { formatCurrency, formatDateTime, useBrandCurrency } from '@/themeRuntime'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { getProductOrdersAdmin, getGetProductOrdersAdminQueryKey, putProductOrdersIdAdmin } from '@/api/endpoints/product-orders'
import OrderDetailModal from './components/OrderDetailModal'
import {
  NEXT_ACTIONS,
  STATUS_META,
  type ProductOrderRow,
  type ProductOrderStatus,
} from './components/constants'

export default function Orders() {
  const { currency } = useBrandCurrency()
  const { isAdmin } = useCustomerProfileAccess()
  const formatMoney = (value?: number | string | null) => formatCurrency(value, currency)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductOrderStatus | undefined>()
  const [detail, setDetail] = useState<ProductOrderRow | null>(null)

  const ordersQuery = useQuery({
    queryKey: getGetProductOrdersAdminQueryKey({
      page,
      limit,
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    queryFn: async () =>
      await getProductOrdersAdmin({
        page,
        limit,
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
  })
  const rows = (pickData<ProductOrderRow[]>(ordersQuery.data) ?? []) as ProductOrderRow[]
  const total = pickMeta(ordersQuery.data)?.total ?? rows.length

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setSearch(nextKeyword.trim())
    setPage(1)
  }

  const changeStatus = async (row: ProductOrderRow, status: ProductOrderStatus) => {
    if (!isAdmin) return
    try {
      await putProductOrdersIdAdmin(row.id, { status })
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

  return (
    <>
      <PageTitle
        subtitle="Theo dõi và xử lý đơn hàng từ cửa hàng"
        left={
          <>
            <Input.Search
              allowClear
              placeholder="Tìm mã đơn, tên, SĐT"
              className="w-[260px]! max-w-[min(260px,46vw)] min-w-[140px]"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); if (!e.target.value) applySearch('') }}
              onSearch={(v) => applySearch(v)}
            />
            <Select
              allowClear
              placeholder="Trạng thái"
              style={{ width: 170 }}
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value as ProductOrderStatus | undefined); setPage(1) }}
              options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
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
        columns={columns}
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
