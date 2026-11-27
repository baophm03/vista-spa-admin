import { Button, Tag, Typography } from 'antd'
import { AppstoreOutlined, FolderOpenOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import type { ServiceCategorySummary } from '@/api/models/serviceCategorySummary'
import { formatServicePrice } from './serviceTypes'

interface ServiceCategoryCardProps {
  name: string
  imageSrc?: string | null
  /** undefined = thẻ ảo "Không có danh mục" (không có trạng thái) */
  isActive?: boolean
  uncategorized?: boolean
  summary?: ServiceCategorySummary
  currency: string
  actions?: ReactNode
  onOpen: () => void
  onAddService?: () => void
}

/** Thẻ danh mục ở trang Dịch vụ: số dịch vụ, khoảng giá và tối đa 4 dịch vụ mới nhất — không cần mở vào xem. */
export default function ServiceCategoryCard({ name, imageSrc, isActive, uncategorized, summary, currency, actions, onOpen, onAddService }: ServiceCategoryCardProps) {
  const count = summary?.service_count ?? 0
  const hidden = summary?.hidden_count ?? 0

  return (
    <div
      className={`service-category-card${isActive === false ? ' is-hidden' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="service-category-card-head">
        <span className="service-category-card-image" aria-hidden>
          {imageSrc ? <img src={imageSrc} alt="" loading="lazy" /> : uncategorized ? <FolderOpenOutlined /> : <AppstoreOutlined />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="service-category-card-title">
            <Typography.Text strong ellipsis={{ tooltip: name }}>{name}</Typography.Text>
            <div className="service-category-card-status-row">
              {isActive !== undefined && (isActive ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã ẩn</Tag>)}
              <span className="service-category-card-meta">
                {count} dịch vụ{hidden > 0 ? ` · ${hidden} đang ẩn` : ''}
              </span>
            </div>
          </div>
        </div>
        {actions && <div onClick={(event) => event.stopPropagation()}>{actions}</div>}
      </div>

      <div className="service-category-card-body">
        {count === 0 ? (
          <div className="service-category-card-empty">
            <span>Chưa có dịch vụ</span>
            {onAddService && (
              <Button size="small" icon={<PlusOutlined />} onClick={(event) => { event.stopPropagation(); onAddService() }}>
                Thêm dịch vụ
              </Button>
            )}
          </div>
        ) : (
          <ul className="service-category-card-preview">
            {(summary?.preview ?? []).map((item) => (
              <li key={item.id} className={item.is_active ? undefined : 'is-hidden'}>
                <span className="service-category-card-preview-name">{item.title}</span>
                <span className="service-category-card-preview-price">{formatServicePrice(item.price, null, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="service-category-card-foot">
        <span>{(summary?.more_count ?? 0) > 0 ? `+${summary?.more_count} dịch vụ khác` : ''}</span>
        <span className="service-category-card-link">Xem chi tiết <RightOutlined /></span>
      </div>
    </div>
  )
}
