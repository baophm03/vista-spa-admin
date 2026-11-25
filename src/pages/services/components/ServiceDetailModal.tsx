import { Col, Modal, Row, Tag, Typography } from 'antd'
import type { Branch } from '@/api/models'
import type { ServiceCategory } from '@/api/models/serviceCategory'
import { fileSrc, resolveFileSrc } from '@/hooks/useFileUrl'

const labelStyle = { fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8D93', fontWeight: 600 } as const

/** ServiceRow khớp với kiểu ở page (Service + include của BE) */
export interface ServiceDetailRow {
  id: string
  title?: string
  description?: string | null
  price?: number | string | null
  price_max?: number | string | null
  duration_minutes?: number | null
  required_points?: number | null
  is_active?: boolean
  image_file_id?: string | null
  image_file?: { id?: string; path?: string } | null
  service_category?: { id?: string; name?: string }
  branch_id?: string | null
  service_galleries?: Array<{ file_id?: string; sort_order?: number; file?: { id?: string; path?: string } | null }>
}

interface ServiceDetailModalProps {
  service: ServiceDetailRow | null
  onClose: () => void
  categories: ServiceCategory[]
  branches: Branch[]
  urlMap: Map<string, string>
  currency: string
  formatCurrency: (value: number | string | null | undefined, currency: string) => string
}

export default function ServiceDetailModal({ service, onClose, categories, branches, urlMap, currency, formatCurrency }: ServiceDetailModalProps) {
  if (!service) return null

  const cover = fileSrc(service.image_file) ?? resolveFileSrc(urlMap, service.image_file_id)
  const galleries = (service.service_galleries ?? [])
    .map((gallery) => fileSrc(gallery.file) ?? resolveFileSrc(urlMap, gallery.file_id))
    .filter(Boolean) as string[]
  const priceRange = service.price_max != null && Number(service.price_max) !== Number(service.price)
    ? `${formatCurrency(service.price, currency)} – ${formatCurrency(service.price_max, currency)}`
    : formatCurrency(service.price, currency)
  const categoryName = service.service_category?.name ?? categories.find((category) => category.id === service.service_category?.id)?.name ?? '—'
  const branchName = service.branch_id ? branches.find((branch) => branch.id === service.branch_id)?.name ?? '—' : 'Tất cả cơ sở'

  return (
    <Modal
      title={service.title || 'Chi tiết dịch vụ lẻ'}
      open
      onCancel={onClose}
      footer={null}
      width="min(720px, calc(100vw - 24px))"
    >
      <Row gutter={[20, 16]}>
        <Col xs={24} sm={9}>
          {cover
            ? <img src={cover} alt={service.title} style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }} />
            : <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, background: '#F1F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8D93' }}>Không có ảnh</div>}
          {galleries.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {galleries.map((src) => (
                <img key={src} src={src} alt="" width={64} height={64} style={{ objectFit: 'cover', borderRadius: 8 }} />
              ))}
            </div>
          )}
        </Col>
        <Col xs={24} sm={15}>
          <div style={{ marginBottom: 8 }}>
            {service.is_active === false ? <Tag>Đã ẩn</Tag> : <Tag color="green">Đang hiển thị</Tag>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 10, fontSize: 13 }}>
            <span style={labelStyle}>Danh mục</span>
            <span>{categoryName}</span>
            <span style={labelStyle}>Cơ sở</span>
            <span>{branchName}</span>
            <span style={labelStyle}>Giá</span>
            <span style={{ fontWeight: 600 }}>{priceRange}</span>
            <span style={labelStyle}>Thời lượng</span>
            <span>{service.duration_minutes ? `${service.duration_minutes} phút` : 'Theo cấu hình'}</span>
            <span style={labelStyle}>Điểm đổi</span>
            <span>{service.required_points ? Number(service.required_points).toLocaleString('vi-VN') : '—'}</span>
            {/* Số buổi của dịch vụ lẻ — tạm ẩn theo yêu cầu
            <span style={labelStyle}>Số buổi</span>
            <span>{service.session_count ?? 1} buổi</span>
            */}
          </div>
          {service.description && (
            <>
              <div style={{ ...labelStyle, marginTop: 16, marginBottom: 4 }}>Mô tả</div>
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{service.description}</Typography.Paragraph>
            </>
          )}
        </Col>
      </Row>
    </Modal>
  )
}
