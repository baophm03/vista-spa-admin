import { Button, message, Popconfirm, Table } from 'antd'
import type { TableColumnsType } from 'antd'
import { EnvironmentOutlined, PhoneOutlined, PrinterOutlined, ShoppingOutlined, UserOutlined } from '@ant-design/icons'
import { useAbility } from '@casl/react'
import DetailModal, { DetailCard, DetailChip, DetailEmpty, DetailField, DetailInfoRow, DetailNote, type ChipTone } from '@/components/base/DetailModal'
import type { ProductOrderItem } from '@/api/models/productOrderItem'
import { useGetConfig } from '@/api/endpoints/config'
import { errorMessage, openHtmlPrint, pickData } from '@/api/helpers'
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

const STATUS_TONE: Record<ProductOrderStatus, ChipTone> = {
  PENDING: 'pending',
  CONFIRMED: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

export default function OrderDetailModal({
  detail,
  onClose,
  isAdmin,
  onChangeStatus,
  formatMoney,
}: OrderDetailModalProps) {
  // Module hóa đơn tắt thì BE trả 404 "Module đang tắt" — ẩn nút In phiếu thay vì cho bấm lỗi
  const configQuery = useGetConfig(undefined, { query: { staleTime: 5 * 60 * 1000 } })
  const invoiceEnabled = pickData<{ settings?: Record<string, unknown> }>(configQuery.data)?.settings?.['module.invoice'] === true
  const canPrint = useAbility().can('READ', 'INVOICE') && invoiceEnabled
  if (!detail) return null

  const status = (detail.status as ProductOrderStatus) ?? 'PENDING'
  const items = detail.items ?? []
  const subtotal = detail.subtotal_amount ?? items.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0)
  const discount = Number(detail.discount_amount ?? 0)
  const actions = isAdmin ? NEXT_ACTIONS[status] ?? [] : []

  const itemColumns: TableColumnsType<ProductOrderItem> = [
    { title: 'Sản phẩm', dataIndex: 'product_name', render: (v?: string | null) => v || 'Sản phẩm' },
    { title: 'Đơn giá', dataIndex: 'price', width: 120, align: 'right', render: (v?: number | null) => formatMoney(v) },
    { title: 'SL', dataIndex: 'qty', width: 56, align: 'center' },
    { title: 'Thành tiền', dataIndex: 'subtotal', width: 130, align: 'right', render: (v?: number | null) => <b>{formatMoney(v)}</b> },
  ]

  const print = () => {
    void openHtmlPrint(`/product-orders/${detail.id}/print/admin`)
      .catch((err) => message.error(errorMessage(err, 'Không mở được phiếu in. Vui lòng kiểm tra cấu hình hóa đơn.')))
  }

  return (
    <DetailModal
      open
      onClose={onClose}
      leading={<span className="dm-avatar-icon" aria-hidden><ShoppingOutlined /></span>}
      title={`Đơn hàng ${detail.code ?? ''}`.trim()}
      meta={(
        <>
          <span className="dm-code">{detail.created_at ? formatDateTime(detail.created_at) : '—'}</span>
          <DetailChip tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_META[status]?.label ?? detail.status}</DetailChip>
        </>
      )}
      footer={(canPrint || actions.length > 0) && (
        <>
          {canPrint && <Button className="dm-footer-start" icon={<PrinterOutlined />} onClick={print}>In phiếu</Button>}
          {actions.map((action) => (
            <Popconfirm
              key={action.status}
              title={`${action.label} đơn ${detail.code}?`}
              okText={action.label}
              cancelText="Đóng"
              okButtonProps={action.danger ? { danger: true } : undefined}
              onConfirm={() => void onChangeStatus(detail, action.status)}
            >
              <Button danger={action.danger} type={action.danger ? 'default' : 'primary'}>{action.label}</Button>
            </Popconfirm>
          ))}
        </>
      )}
    >
      <div className="dm-split">
        {/* Trái: thông tin đơn + khách */}
        <div className="dm-stack">
          <DetailCard title="Khách hàng">
            <div className="dm-info-list">
              <DetailInfoRow icon={<UserOutlined />} label="Họ tên" value={detail.customer_name} />
              <DetailInfoRow icon={<PhoneOutlined />} label="Điện thoại" value={detail.phone && <a href={`tel:${detail.phone}`}>{detail.phone}</a>} />
              <DetailInfoRow icon={<EnvironmentOutlined />} label="Địa chỉ nhận hàng" value={detail.address} />
            </div>
          </DetailCard>
          <DetailCard title="Thông tin đơn">
            <div className="dm-grid">
              <DetailField label="Mã đơn" value={detail.code} emptyText="—" />
              <DetailField label="Ngày đặt" value={detail.created_at ? formatDateTime(detail.created_at) : undefined} emptyText="—" />
              {detail.voucher_title_snapshot && <DetailField wide label="Voucher" value={detail.voucher_title_snapshot} />}
            </div>
            {detail.note && <DetailNote title="Ghi chú của khách">{detail.note}</DetailNote>}
          </DetailCard>
        </div>

        {/* Phải: sản phẩm + tổng tiền */}
        <DetailCard title="Sản phẩm" extra={<span className="dm-extra">{items.length} sản phẩm</span>}>
          {items.length === 0 ? (
            <DetailEmpty icon={<ShoppingOutlined />} title="Đơn hàng chưa có sản phẩm" />
          ) : (
            <>
              <Table<ProductOrderItem>
                className="max-md:hidden!"
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={items}
                columns={itemColumns}
              />
              <div className="dm-list md:hidden!">
                {items.map((item) => (
                  <div key={item.id} className="dm-list-item">
                    <div className="dm-list-main">
                      <div className="dm-value">{item.product_name || 'Sản phẩm'}</div>
                      <div className="dm-label">{item.qty} × {formatMoney(item.price)}</div>
                    </div>
                    <span className="dm-amount">{formatMoney(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="dm-summary">
            <div><span>Tạm tính</span><span>{formatMoney(subtotal)}</span></div>
            {discount > 0 && (
              <div>
                <span>Giảm từ voucher{detail.voucher_title_snapshot ? ` · ${detail.voucher_title_snapshot}` : ''}</span>
                <span>−{formatMoney(discount)}</span>
              </div>
            )}
            <div className="dm-summary-total"><span>Khách cần trả</span><span>{formatMoney(detail.total_amount)}</span></div>
          </div>
        </DetailCard>
      </div>
    </DetailModal>
  )
}
