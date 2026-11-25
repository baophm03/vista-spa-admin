import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Breadcrumb, Button, Result, Skeleton, Tag, Typography } from 'antd'
import { AppstoreOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { pickData } from '@/api/helpers'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import type { Branch } from '@/api/models'
import { useBrandCurrency } from '@/themeRuntime'
import { fileSrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import ServiceTable from './components/ServiceTable'
import { UNCATEGORIZED_ID, formatServicePrice } from './components/serviceTypes'
import useServiceCategories from './useServiceCategories'
import './services.css'

/** /services/categories/:id — dịch vụ trong 1 danh mục; id = 'none' là nhóm "Không có danh mục". */
export default function CategoryDetail() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const autoOpenCreate = searchParams.get('add') === '1'
  const { currency } = useBrandCurrency()
  const urlMap = useFileUrlMap()
  const { query, categories, uncategorized, refresh } = useServiceCategories()
  const branchesQuery = useGetBranchesAdmin()
  const branches = useMemo(() => (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[], [branchesQuery.data])

  const isUncategorized = id === UNCATEGORIZED_ID
  const category = categories.find((item) => item.id === id)
  const summary = isUncategorized ? uncategorized : category?.summary
  const name = isUncategorized ? 'Không có danh mục' : category?.name
  const imageSrc = category ? fileSrc(category.image_file) ?? resolveFileSrc(urlMap, category.image_file_id) : null

  if (query.isLoading) return <div className="services-page"><Skeleton active /></div>

  if (!isUncategorized && !category) {
    return (
      <Result
        status="404"
        title="Không tìm thấy danh mục"
        subTitle="Danh mục không tồn tại hoặc đã bị xóa."
        extra={<Link to="/services"><Button type="primary">Quay lại Dịch vụ</Button></Link>}
      />
    )
  }

  const priceRange = summary?.price_min != null ? formatServicePrice(summary.price_min, summary.price_max, currency) : null

  return (
    <div className="services-page">
      <Breadcrumb
        className="service-category-breadcrumb"
        items={[{ title: <Link to="/services">Dịch vụ</Link> }, { title: name }]}
      />
      <div className="service-category-detail-head">
        <span className="service-category-card-image" aria-hidden>
          {imageSrc ? <img src={imageSrc} alt="" /> : isUncategorized ? <FolderOpenOutlined /> : <AppstoreOutlined />}
        </span>
        <div className="min-w-0">
          <div className="service-category-card-title">
            <Typography.Title level={4} style={{ margin: 0 }}>{name}</Typography.Title>
            {category && (category.is_active !== false ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã ẩn</Tag>)}
          </div>
          <div className="service-category-card-meta">
            {summary?.service_count ?? 0} dịch vụ
            {(summary?.hidden_count ?? 0) > 0 ? ` · ${summary?.hidden_count} đang ẩn` : ''}
            {priceRange ? ` · Giá ${priceRange}` : ''}
          </div>
        </div>
      </div>
      <ServiceTable key={id} categoryId={id} categories={categories} branches={branches} onChanged={refresh} autoOpenCreate={autoOpenCreate} />
    </div>
  )
}
