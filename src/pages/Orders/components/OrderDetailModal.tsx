import { Button, Descriptions, Modal, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import type { ProductOrderItem } from '@/api/models/productOrderItem'
import { formatDateTime } from '@/themeRuntime'
import {
  NEXT_ACTIONS,
  STATUS_META,
  type ProductOrderRow,
  type ProductOrderStatus,
} from './constants'

interface OrderDetailModalProps {
  detail: ProductOrderRow | null
  onClose: () => void
  isAdmin: boolean
  onChangeStatus: (row: ProductOrderRow, status: ProductOrderStatus) => void
  formatMoney: (value?: number | string | null) => string
}

export default function OrderDetailModal({
  detail,
  onClose,
  isAdmin,
  onChangeStatus,
  formatMoney,
}: OrderDetailModalProps) {
  const detailStatus = (detail?.status as ProductOrderStatus) ?? 'PENDING'

  const itemColumns: TableColumnsType<ProductOrderItem> = [
    { title: 'Tên', dataIndex: 'product_name' },
    { title: 'Đơn giá', dataIndex: 'price', width: 120, render: (v?: number | null) => formatMoney(v) },
    { title: 'SL', dataIndex: 'qty', width: 60 },
    { title: 'Thành tiền', dataIndex: 'subtotal', width: 130, render: (v?: number | null) => formatMoney(v) },
  ]

  return (
    <Modal
      title={`Đơn hàng ${detail?.code ?? ''}`}
      open={!!detail}
      footer={null}
      onCancel={onClose}
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
            {detail.voucher_title_snapshot && <Descriptions.Item label="Voucher" span={2}>{detail.voucher_title_snapshot}</Descriptions.Item>}
          </Descriptions>
          <Typography.Title level={5} style={{ marginTop: 16 }}>Sản phẩm</Typography.Title>
          <Table<ProductOrderItem>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={detail.items ?? []}
            columns={itemColumns}
            summary={() => {
              const subtotal = detail.subtotal_amount ?? (detail.items ?? []).reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0)
              const discount = Number(detail.discount_amount ?? 0)
              return (
                <>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3}>Tạm tính</Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>{formatMoney(subtotal)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                  {discount > 0 && (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={3}>
                        Giảm từ voucher{detail.voucher_title_snapshot ? ` · ${detail.voucher_title_snapshot}` : ''}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3}>−{formatMoney(discount)}</Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3}><strong>Khách cần trả</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={3}><strong>{formatMoney(detail.total_amount)}</strong></Table.Summary.Cell>
                  </Table.Summary.Row>
                </>
              )
            }}
          />
          <Space style={{ marginTop: 16 }}>
            {(isAdmin ? NEXT_ACTIONS[detailStatus] ?? [] : []).map((action) => (
              <Popconfirm
                key={action.status}
                title={`${action.label} đơn ${detail.code}?`}
                okText={action.label}
                cancelText="Đóng"
                onConfirm={() => void onChangeStatus(detail, action.status)}
              >
                <Button danger={action.danger} type={action.danger ? 'default' : 'primary'}>{action.label}</Button>
              </Popconfirm>
            ))}
          </Space>
        </>
      )}
    </Modal>
  )
}
