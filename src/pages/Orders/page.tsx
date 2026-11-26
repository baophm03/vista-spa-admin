import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Input, Modal, Select, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckOutlined, EyeOutlined, ShoppingOutlined, StopOutlined, UserOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards from '@/components/base/MobileCards'
import StatCards from '@/components/base/StatCards'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import { formatCurrency, formatDateTime, useBrandCurrency } from '@/themeRuntime'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { getGetProductOrdersAdminQueryKey, useGetProductOrdersAdmin, putProductOrdersIdAdmin } from '@/api/endpoints/product-orders'
import OrderDetailModal from './components/OrderDetailModal'
import {
  NEXT_ACTIONS,
  STATUS_META,
  type ProductOrderRow,
  type ProductOrderStatus,
} from './components/constants'
import './orders.css'

export default function Orders() {
  const queryClient = useQueryClient()
  const { currency } = useBrandCurrency()
  const { isAdmin } = useCustomerProfileAccess()
  const formatMoney = (value?: number | string | null) => formatCurrency(value, currency)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductOrderStatus | undefined>()
  const [detail, setDetail] = useState<ProductOrderRow | null>(null)

  const ordersQuery = useGetProductOrdersAdmin({
    page,
    limit,
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  })
  const rows = (pickData<ProductOrderRow[]>(ordersQuery.data) ?? []) as ProductOrderRow[]
  const total = pickMeta(ordersQuery.data)?.total ?? rows.length
  const summaryQuery = useGetProductOrdersAdmin({ page: 1, limit: 1 })
  const pendingQuery = useGetProductOrdersAdmin({ page: 1, limit: 1, status: 'PENDING' })
  const completedQuery = useGetProductOrdersAdmin({ page: 1, limit: 1, status: 'COMPLETED' })

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
      await queryClient.invalidateQueries({ queryKey: getGetProductOrdersAdminQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const renderOrderActions = (row: ProductOrderRow, dropdownOnly = false) => {
    const nextActions = NEXT_ACTIONS[(row.status as ProductOrderStatus) ?? 'PENDING'] ?? []
    return (
      <RowActionsMenu
        dropdownOnly={dropdownOnly}
        items={isAdmin ? nextActions.map((action) => ({
          key: action.status,
          icon: action.danger ? <StopOutlined /> : <CheckOutlined />,
          label: action.label,
          danger: action.danger,
        })) : []}
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
      title: 'Thao tác', align: 'center' as const,
      width: 120,
      fixed: 'right' as const,
      render: (_v, row) => renderOrderActions(row),
    },
  ]

  return (
    <>
      <PageTitle
        className="orders-page-title"
        summary={(
          <div className="orders-stats">
            <StatCards items={[
              { key: 'total', label: 'Tổng đơn hàng', value: pickMeta(summaryQuery.data)?.total?.toLocaleString('vi-VN') ?? '—', icon: <ShoppingOutlined /> },
              { key: 'pending', label: 'Chờ xử lý', value: pickMeta(pendingQuery.data)?.total?.toLocaleString('vi-VN') ?? '—', icon: <EyeOutlined />, tone: 'tertiary' },
              { key: 'completed', label: 'Hoàn thành', value: pickMeta(completedQuery.data)?.total?.toLocaleString('vi-VN') ?? '—', icon: <CheckOutlined />, tone: 'secondary' },
            ]} />
          </div>
        )}
        subtitle="Theo dõi và xử lý đơn hàng từ cửa hàng"
        left={
          <>
            <Input.Search
              allowClear
              placeholder="Tìm mã đơn, tên, SĐT"
              className="orders-search-control"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); if (!e.target.value) applySearch('') }}
              onSearch={(v) => applySearch(v)}
            />
            <Select
              allowClear
              placeholder="Trạng thái"
              className="orders-status-control"
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
        className="desktop-only orders-table"
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
      <div className="orders-mobile-list">
        <MobileCards
          rows={rows}
          rowKey={(row) => row.id}
          loading={ordersQuery.isFetching}
          emptyText={search || statusFilter ? 'Không tìm thấy đơn hàng phù hợp' : 'Chưa có đơn hàng'}
          onCardClick={setDetail}
          renderCard={(row) => {
            const status = STATUS_META[row.status as ProductOrderStatus]
            const items = row.items ?? []
            const itemSummary = items.length
              ? items.map((item) => `${item.product_name || 'Sản phẩm'} ×${item.qty ?? 1}`).join(' · ')
              : 'Đơn hàng chưa có sản phẩm'
            return (
              <div className="order-mobile-card">
                <div className="order-mobile-card-head">
                  <div className="order-mobile-card-code">
                    <span className="order-mobile-overline">Mã đơn hàng</span>
                    <Typography.Text code>{row.code}</Typography.Text>
                  </div>
                  <Tag className="order-mobile-status" color={status?.color ?? 'default'}>
                    {status?.label ?? row.status ?? '—'}
                  </Tag>
                </div>

                <div className="order-mobile-customer">
                  <span className="order-mobile-avatar"><UserOutlined /></span>
                  <div className="order-mobile-customer-copy">
                    <span className="order-mobile-overline">Khách hàng</span>
                    <strong>{row.customer_name || 'Khách lẻ'}</strong>
                    {row.phone && <span className="order-mobile-phone">{row.phone}</span>}
                  </div>
                </div>

                <div className="order-mobile-products">
                  <div className="order-mobile-products-heading">
                    <ShoppingOutlined />
                    <span>Sản phẩm</span>
                    <span className="order-mobile-item-count">{items.length}</span>
                  </div>
                  <div className="order-mobile-item-summary">{itemSummary}</div>
                </div>

                <div className="order-mobile-meta">
                  <div className="order-mobile-total">
                    <span className="order-mobile-overline">Tổng tiền</span>
                    <strong>{formatMoney(row.total_amount)}</strong>
                  </div>
                  <div className="order-mobile-date">
                    <span className="order-mobile-overline">Ngày đặt</span>
                    <span>{row.created_at ? formatDateTime(row.created_at) : '—'}</span>
                  </div>
                </div>

                <div className="order-mobile-card-footer">
                  <span><EyeOutlined /> Xem chi tiết</span>
                  {renderOrderActions(row, true)}
                </div>
              </div>
            )
          }}
        />
      </div>
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
