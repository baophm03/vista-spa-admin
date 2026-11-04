import { Button, Descriptions, Image, Modal, Space, Typography } from 'antd'
import links from '@/configs/links'
import { formatPrice, type ProductRow } from './constants'

interface ProductDetailModalProps {
  viewing: ProductRow | null
  onClose: () => void
  currency: string
}

export default function ProductDetailModal({
  viewing,
  onClose,
  currency,
}: ProductDetailModalProps) {
  return (
    <Modal
      title="Chi tiết sản phẩm"
      open={!!viewing}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={680}
    >
      {viewing && (
        <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 12 }}>
          {(viewing.cover_url || viewing.gallery?.length) ? (
            <Image.PreviewGroup>
              <Space wrap>
                {viewing.cover_url && <Image src={(links.imageEndpoint + (viewing.cover_url || ""))} width={96} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />}
                {(viewing.gallery ?? []).map((url) => (
                  <Image key={url} src={(links.imageEndpoint + (url || ""))} width={96} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />
                ))}
              </Space>
            </Image.PreviewGroup>
          ) : (
            <Typography.Text type="secondary">Sản phẩm chưa có hình ảnh.</Typography.Text>
          )}
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Tên sản phẩm">{viewing.name}</Descriptions.Item>
            <Descriptions.Item label="Mã SKU">{viewing.sku || '—'}</Descriptions.Item>
            <Descriptions.Item label="Danh mục">{viewing.category?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Giá hiển thị">{formatPrice(viewing.price, currency)}</Descriptions.Item>
            <Descriptions.Item label="Liên kết mua hàng">
              {viewing.buy_url ? <a href={viewing.buy_url} target="_blank" rel="noreferrer">{viewing.buy_url}</a> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Mô tả">{viewing.description || '—'}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">{viewing.is_active === false ? 'Đã ẩn' : 'Đang bán'}</Descriptions.Item>
          </Descriptions>
        </Space>
      )}
    </Modal>
  )
}

