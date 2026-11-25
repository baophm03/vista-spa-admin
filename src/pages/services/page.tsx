import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Col, Dropdown, Empty, Form, Input, Modal, Row, Select, Skeleton, message } from 'antd'
import { AppstoreOutlined, DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, FolderOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ServiceListState from './components/ServiceListState'
import ServiceCategoryCard from './components/ServiceCategoryCard'
import ServiceCategoryModal from './components/ServiceCategoryModal'
import { UNCATEGORIZED_ID, type ServiceCategoryRow } from './components/serviceTypes'
import useServiceCategories from './useServiceCategories'
import { errorMessage, pickData } from '@/api/helpers'
import { deleteServiceCategoriesIdAdmin, getServiceAdmin, postServiceCategoriesAdmin, putServiceCategoriesIdAdmin } from '@/api/endpoints/services'
import type { ServiceCategoryCreate } from '@/api/models/serviceCategoryCreate'
import { useBrandCurrency } from '@/themeRuntime'
import { fileSrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import './services.css'

type StatusFilter = 'all' | 'active' | 'hidden'

/** Trang Dịch vụ: lưới thẻ danh mục (1 cấp) — mỗi thẻ tóm tắt dịch vụ bên trong; bấm thẻ vào trang chi tiết. */
export default function Services() {
  const navigate = useNavigate()
  const { currency } = useBrandCurrency()
  const urlMap = useFileUrlMap()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'SERVICE')
  const canDelete = ability.can('DELETE', 'SERVICE')
  const canCreate = ability.can('CREATE', 'SERVICE')
  const { query, categories, uncategorized, refresh } = useServiceCategories()
  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [editing, setEditing] = useState<ServiceCategoryRow | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  // Thống kê đầu trang — đếm server-side trên toàn bộ dịch vụ
  const statsQuery = useQuery({
    queryKey: ['service-stats'],
    queryFn: async () => {
      const [all, active] = await Promise.all([
        pickData<{ total?: number }>(await getServiceAdmin({ page: 1, limit: 1 })),
        pickData<{ total?: number }>(await getServiceAdmin({ page: 1, limit: 1, is_active: true })),
      ])
      return { total: Number(all?.total ?? 0), active: Number(active?.total ?? 0) }
    },
  })
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng dịch vụ', value: statsQuery.data?.total.toLocaleString('vi-VN') ?? '—', icon: <AppstoreOutlined />, tone: 'primary' },
    { key: 'active', label: 'Đang hiển thị', value: statsQuery.data?.active.toLocaleString('vi-VN') ?? '—', icon: <EyeOutlined />, tone: 'secondary' },
    { key: 'hidden', label: 'Đã ẩn', value: statsQuery.data ? Math.max(statsQuery.data.total - statsQuery.data.active, 0).toLocaleString('vi-VN') : '—', icon: <EyeInvisibleOutlined />, tone: 'neutral' },
    { key: 'categories', label: 'Danh mục', value: query.isLoading ? '—' : categories.length.toLocaleString('vi-VN'), icon: <FolderOutlined />, tone: 'tertiary' },
  ]

  const visibleCategories = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase('vi')
    return categories
      .filter((category) => (status === 'all' ? true : status === 'active' ? category.is_active !== false : category.is_active === false))
      .filter((category) => !keyword || category.name.toLocaleLowerCase('vi').includes(keyword))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'vi'))
  }, [categories, searchText, status])
  // Thẻ "Không có danh mục": luôn cuối, chỉ khi có dịch vụ chưa gắn danh mục và không đang lọc
  const showUncategorized = (uncategorized?.service_count ?? 0) > 0 && !searchText.trim() && status === 'all'

  const openEditor = (row?: ServiceCategoryRow) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(row ?? { sort_order: categories.length, is_active: true, image_file_id: null })
    setOpen(true)
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const dto: ServiceCategoryCreate = { ...values }
      if (editing) await putServiceCategoriesIdAdmin(editing.id, dto)
      else await postServiceCategoriesAdmin(dto)
      setOpen(false)
      message.success(editing ? 'Đã cập nhật danh mục' : 'Đã tạo danh mục')
      refresh()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (action: () => Promise<unknown>, successText: string) => {
    try {
      await action()
      message.success(successText)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  // Nút 3 chấm gọn trên thẻ (thay cho nút "Thao tác" chiếm diện tích)
  const renderActions = (row: ServiceCategoryRow) => (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
          ...(canUpdate
            ? [row.is_active === false
              ? { key: 'restore', icon: <EyeOutlined />, label: 'Bật lại' }
              : { key: 'hide', icon: <EyeInvisibleOutlined />, label: 'Ẩn' }]
            : []),
          ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation()
          if (key === 'edit') openEditor(row)
          else if (key === 'restore') void runAction(() => putServiceCategoriesIdAdmin(row.id, { is_active: true } as ServiceCategoryCreate), 'Đã bật lại danh mục')
          else if (key === 'hide') Modal.confirm({
            title: 'Ẩn danh mục này?',
            content: 'Chỉ ẩn được khi không còn dịch vụ đang hiển thị trong danh mục.',
            okText: 'Ẩn',
            cancelText: 'Hủy',
            onOk: () => runAction(() => putServiceCategoriesIdAdmin(row.id, { is_active: false } as ServiceCategoryCreate), 'Đã ẩn danh mục'),
          })
          else if (key === 'delete') Modal.confirm({
            title: 'Xóa danh mục này?',
            content: 'Chỉ xóa được khi không còn dịch vụ trong danh mục.',
            okButtonProps: { danger: true },
            okText: 'Xóa',
            cancelText: 'Hủy',
            onOk: () => runAction(() => deleteServiceCategoriesIdAdmin(row.id), 'Đã xóa danh mục'),
          })
        },
      }}
    >
      <Button type="text" size="small" icon={<MoreOutlined />} aria-label="Thao tác danh mục" />
    </Dropdown>
  )

  const openCategory = (id: string) => navigate(`/services/categories/${id}`)
  const hasFilter = !!searchText.trim() || status !== 'all'

  return (
    <div className="services-page">
      <PageTitle subtitle="Danh mục dịch vụ — bấm vào danh mục để xem và quản lý dịch vụ bên trong">
        Dịch vụ
      </PageTitle>
      <StatCards items={statItems} />

      <div className="service-list-toolbar">
        <div className="service-category-filters">
          <Input.Search
            allowClear
            aria-label="Tìm danh mục"
            placeholder="Tìm danh mục"
            className="service-list-search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onSearch={setSearchText}
          />
          <Select<StatusFilter>
            value={status}
            onChange={setStatus}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'active', label: 'Đang dùng' },
              { value: 'hidden', label: 'Đã ẩn' },
            ]}
          />
        </div>
        <Can I="CREATE" a="SERVICE">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
            Thêm danh mục
          </Button>
        </Can>
      </div>

      {query.isError ? (
        <ServiceListState message="Không tải được danh mục dịch vụ" onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <Row gutter={[16, 16]}>
          {[0, 1, 2].map((key) => (
            <Col key={key} xs={24} md={12} xl={8} xxl={6}><div className="service-category-card"><Skeleton active /></div></Col>
          ))}
        </Row>
      ) : visibleCategories.length === 0 && !showUncategorized ? (
        <Empty description={hasFilter ? 'Không có danh mục phù hợp' : 'Chưa có danh mục dịch vụ'} />
      ) : (
        <Row gutter={[16, 16]}>
          {visibleCategories.map((category) => (
            <Col key={category.id} xs={24} md={12} xl={8} xxl={6}>
              <ServiceCategoryCard
                name={category.name}
                imageSrc={fileSrc(category.image_file) ?? resolveFileSrc(urlMap, category.image_file_id)}
                isActive={category.is_active !== false}
                summary={category.summary}
                currency={currency}
                actions={(canUpdate || canDelete) ? renderActions(category) : undefined}
                onOpen={() => openCategory(category.id)}
                onAddService={canCreate ? () => navigate(`/services/categories/${category.id}?add=1`) : undefined}
              />
            </Col>
          ))}
          {showUncategorized && (
            <Col xs={24} md={12} xl={8} xxl={6}>
              <ServiceCategoryCard
                name="Không có danh mục"
                uncategorized
                summary={uncategorized}
                currency={currency}
                onOpen={() => openCategory(UNCATEGORIZED_ID)}
              />
            </Col>
          )}
        </Row>
      )}

      <ServiceCategoryModal
        open={open}
        editing={editing}
        form={form}
        saving={saving}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
      />
    </div>
  )
}
