import { useEffect, useState } from 'react'
import { Button, Descriptions, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import { formatCurrency, formatDateTime, useBrandCurrency } from '@/themeRuntime'
import { getProductOrders, getGetProductOrdersQueryKey, putProductOrdersId } from '@/api/endpoints/products'
import type { ProductOrder } from '@/api/models/productOrder'
import type { ProductOrderItem } from '@/api/models/productOrderItem'

type ProductOrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

/** BE include kèm `items` khi list. */
type ProductOrderRow = ProductOrder & { items?: ProductOrderItem[] }

const STATUS_META: Record<ProductOrderStatus, { label: string; color: string }> = {
  PENDING: { label: 'Chờ xử lý', color: 'orange' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'blue' },
  COMPLETED: { label: 'Hoàn thành', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
}

const NEXT_ACTIONS: Record<ProductOrderStatus, { status: ProductOrderStatus; label: string; danger?: boolean }[]> = {
  PENDING: [
    { status: 'CONFIRMED', label: 'Xác nhận' },
    { status: 'CANCELLED', label: 'Hủy đơn', danger: true },
  ],
  CONFIRMED: [
    { status: 'COMPLETED', label: 'Hoàn thành' },
    { status: 'CANCELLED', label: 'Hủy đơn', danger: true },
  ],
  COMPLETED: [],
  CANCELLED: [],
}

export default function Orders() {
  const { currency } = useBrandCurrency()
  const formatMoney = (value?: number | string | null) => formatCurrency(value, currency)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductOrderStatus | undefined>()
  const [detail, setDetail] = useState<ProductOrderRow | null>(null)

  const ordersQuery = useQuery({
    queryKey: getGetProductOrdersQueryKey({
      page,
      limit: pageSize,
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    queryFn: async () =>
      await getProductOrders({
        page,
        limit: pageSize,
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

  const changeStatus = async (row: ProductOrderRow, status: ProductOrderStatus) => {
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
    { title: 'Mã đơn', dataIndex: 'code', width: 160, render: (v: string) => <strong>{v}</strong> },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_v, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.customer_name}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.phone}</Typography.Text>
        </div>
      ),
    },
    {
      title: 'Sản phẩm',
      key: 'items',
      render: (_v, row) => {
        const items = row.items ?? []
        if (!items.length) return '—'
        const names = items.map((i) => `${i.product_name} ×${i.qty ?? 1}`).join(', ')
        return <Typography.Text style={{ fontSize: 13 }} ellipsis={{ tooltip: names }}>{names}</Typography.Text>
      },
    },
    { title: 'Tổng tiền', dataIndex: 'total_amount', width: 130, render: (v?: number | null) => formatMoney(v) },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (v?: string | null) => <Tag color={STATUS_META[v as ProductOrderStatus]?.color}>{STATUS_META[v as ProductOrderStatus]?.label ?? v}</Tag>,
    },
    { title: 'Ngày đặt', dataIndex: 'created_at', width: 170, render: (v?: string | null) => (v ? formatDateTime(v) : '—') },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 220,
      render: (_v, row) => (
        <Space>
          <Button size="small" onClick={() => setDetail(row)}>Chi tiết</Button>
          {(NEXT_ACTIONS[(row.status as ProductOrderStatus) ?? 'PENDING'] ?? []).map((action) => (
            <Popconfirm
              key={action.status}
              title={`${action.label} đơn ${row.code}?`}
              okText={action.label}
              cancelText="Đóng"
              onConfirm={() => void changeStatus(row, action.status)}
            >
              <Button size="small" danger={action.danger} type={action.danger ? 'default' : 'primary'}>{action.label}</Button>
            </Popconfirm>
          ))}
        </Space>
      ),
    },
  ]

  const itemColumns: TableColumnsType<ProductOrderItem> = [
    { title: 'Tên', dataIndex: 'product_name' },
    { title: 'Đơn giá', dataIndex: 'price', width: 120, render: (v?: number | null) => formatMoney(v) },
    { title: 'SL', dataIndex: 'qty', width: 60 },
    { title: 'Thành tiền', dataIndex: 'subtotal', width: 130, render: (v?: number | null) => formatMoney(v) },
  ]

  const detailStatus = (detail?.status as ProductOrderStatus) ?? 'PENDING'

  return (
    <>
      <PageTitle>Đơn hàng</PageTitle>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Space wrap>
          <Input
            allowClear
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(1) }}
            prefix={<SearchOutlined />}
            placeholder="Tìm mã đơn, tên, SĐT"
            style={{ width: 260 }}
          />
          <Select
            allowClear
            value={statusFilter}
            placeholder="Trạng thái"
            style={{ width: 160 }}
            onChange={(v) => { setStatusFilter(v as ProductOrderStatus | undefined); setPage(1) }}
            options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => void ordersQuery.refetch()}>Tải lại</Button>
      </Space>

      <Table<ProductOrderRow>
        rowKey="id"
        loading={ordersQuery.isFetching}
        dataSource={rows}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (count) => `${count} đơn`,
        }}
        onChange={(pagination) => {
          if (pagination.current) setPage(pagination.current)
          if (pagination.pageSize && pagination.pageSize !== pageSize) {
            setPageSize(pagination.pageSize)
            setPage(1)
          }
        }}
      />

      <Modal
        title={`Đơn hàng ${detail?.code ?? ''}`}
        open={!!detail}
        footer={null}
        onCancel={() => setDetail(null)}
        width={640}
      >
        {detail && (
          <>
            <Descriptions size="small" column={2} style={{ marginTop: 12 }}>
              <Descriptions.Item label="Trạng thái">
                <Tag color={STATUS_META[detailStatus]?.color}>{STATUS_META[detailStatus]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày đặt">{detail.created_at ? formatDateTime(detail.created_at) : '—'}</Descriptions.Item>
              <Descriptions.Item label="Khách hàng">{detail.customer_name}</Descriptions.Item>
              <Descriptions.Item label="SĐT">{detail.phone}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ" span={2}>{detail.address || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ghi chú" span={2}>{detail.note || '—'}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} style={{ marginTop: 16 }}>Sản phẩm</Typography.Title>
            <Table<ProductOrderItem>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detail.items ?? []}
              columns={itemColumns}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}><strong>Tổng cộng</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}><strong>{formatMoney(detail.total_amount)}</strong></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
            <Space style={{ marginTop: 16 }}>
              {(NEXT_ACTIONS[detailStatus] ?? []).map((action) => (
                <Popconfirm
                  key={action.status}
                  title={`${action.label} đơn ${detail.code}?`}
                  okText={action.label}
                  cancelText="Đóng"
                  onConfirm={() => void changeStatus(detail, action.status)}
                >
                  <Button danger={action.danger} type={action.danger ? 'default' : 'primary'}>{action.label}</Button>
                </Popconfirm>
              ))}
            </Space>
          </>
        )}
      </Modal>
    </>
  )
}
