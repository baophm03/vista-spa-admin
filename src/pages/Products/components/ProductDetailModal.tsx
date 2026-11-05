import { Button, Descriptions, Image, Modal, Space, Typography } from 'antd'
import links from '@/configs/links'
import { resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import { formatPrice, type ProductRow } from './constants'

interface ProductDetailModalProps {
  viewing: ProductRow | null
  onClose: () => void
  currency: string
}

/** Ảnh hiển thị = imageEndpoint + path; ưu tiên object file BE trả kèm. */
function imageSrc(
  map: Map<string, string>,
  file?: { path?: string | null } | null,
  fileId?: string | null,
): string | null {
  if (file?.path) return `${links.imageEndpoint}/${file.path.replace(/^\/+/, '')}`
  return resolveFileSrc(map, fileId)
}

export default function ProductDetailModal({ viewing, onClose, currency }: ProductDetailModalProps) {
  const urlMap = useFileUrlMap()

  const coverSrc = imageSrc(urlMap, viewing?.cover_file, viewing?.cover_file_id)
  const galleryFiles = viewing?.product_galleries ?? []
  const hasImages = Boolean(coverSrc) || galleryFiles.length > 0

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
          {hasImages ? (
            <Image.PreviewGroup>
              <Space wrap>
                {coverSrc && (
                  <Image
                    src={coverSrc}
                    width={96}
                    height={96}
                    style={{ objectFit: 'cover', borderRadius: 8 }}
                    fallback=""
                  />
                )}

                {galleryFiles.map((gallery) => (
                  <Image
                    key={gallery.file?.id ?? gallery.file_id}
                    src={imageSrc(urlMap, gallery.file, gallery.file?.id ?? gallery.file_id) ?? undefined}
                    width={96}
                    height={96}
                    style={{ objectFit: 'cover', borderRadius: 8 }}
                    fallback=""
                  />
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
              {viewing.buy_url ? (
                <a href={viewing.buy_url} target="_blank" rel="noreferrer">
                  {viewing.buy_url}
                </a>
              ) : (
                '—'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Mô tả">{viewing.description || '—'}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">{viewing.is_active === false ? 'Đã ẩn' : 'Đang bán'}</Descriptions.Item>
          </Descriptions>
        </Space>
      )}
    </Modal>
  )
}
