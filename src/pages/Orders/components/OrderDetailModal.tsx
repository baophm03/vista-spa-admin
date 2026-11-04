import { Button, Descriptions, Modal, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import type { ProductOrderItem } from '@/api/models/productOrderItem'

export default function OrderDetailModal({ detail, statusMeta, nextActions, formatDateTime, formatMoney, isAdmin, onClose, onChangeStatus }: any) {
  const status = detail?.status
  return <Modal title={`Đơn hàng ${detail?.code ?? ''}`} open={!!detail} footer={null} onCancel={onClose} width={640}>
    {detail && <><Descriptions size="small" column={2} style={{ marginTop: 12 }}>
      <Descriptions.Item label="Trạng thái"><Tag color={statusMeta[status]?.color}>{statusMeta[status]?.label}</Tag></Descriptions.Item>
      <Descriptions.Item label="Ngày đặt">{detail.created_at ? formatDateTime(detail.created_at) : '—'}</Descriptions.Item>
      <Descriptions.Item label="Khách hàng">{detail.customer_name}</Descriptions.Item><Descriptions.Item label="SĐT">{detail.phone}</Descriptions.Item>
      <Descriptions.Item label="Địa chỉ" span={2}>{detail.address || '—'}</Descriptions.Item><Descriptions.Item label="Ghi chú" span={2}>{detail.note || '—'}</Descriptions.Item>
    </Descriptions><Typography.Title level={5} style={{ marginTop: 16 }}>Sản phẩm</Typography.Title>
    <Table<ProductOrderItem> rowKey="id" size="small" pagination={false} dataSource={detail.items ?? []}
      columns={[{ title: 'Sản phẩm', render: (_, item) => item.product_name }, { title: 'SL', dataIndex: 'qty' }, { title: 'Đơn giá', render: (_, item) => formatMoney((item as ProductOrderItem & { unit_price?: number }).unit_price) }, { title: 'Thành tiền', render: (_, item) => formatMoney((item as ProductOrderItem & { total_price?: number }).total_price) }]}
      summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={3}><strong>Tổng cộng</strong></Table.Summary.Cell><Table.Summary.Cell index={1}><strong>{formatMoney(detail.total_amount)}</strong></Table.Summary.Cell></Table.Summary.Row>} />
    <Space style={{ marginTop: 16 }}>{(isAdmin ? nextActions[status] ?? [] : []).map((action: any) => <Popconfirm key={action.status} title={`${action.label} đơn ${detail.code}?`} okText={action.label} cancelText="Đóng" onConfirm={() => onChangeStatus(detail, action.status)}><Button danger={action.danger} type={action.danger ? 'default' : 'primary'}>{action.label}</Button></Popconfirm>)}</Space>
    </>}
  </Modal>
}
