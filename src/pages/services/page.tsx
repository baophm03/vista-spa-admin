import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { AppstoreOutlined, DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import ServiceModal from './components/ServiceModal'
import ServiceDetailModal from './components/ServiceDetailModal'
import ServiceListState from './components/ServiceListState'
import { errorMessage, pickData } from '@/api/helpers'
import { deleteServiceIdAdmin, getGetServiceAdminQueryKey, getServiceAdmin, getServiceCategoriesAdmin, postServiceAdmin, putServiceIdAdmin } from '@/api/endpoints/services'
import type { Service } from '@/api/models/service'
import type { ServiceCreate } from '@/api/models/serviceCreate'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import type { ServiceCategory } from '@/api/models/serviceCategory'
import ServiceCategories from './ServiceCategories'
import { formatCurrency, useBrandCurrency } from '@/themeRuntime'
import { fileSrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { Branch } from '@/api/models'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import './services.css'

/** BE list include kèm `service_category`, ảnh bìa `image_file` và bộ ảnh `service_galleries[].file`. */
type ServiceRow = Service & {
  branch_id?: string | null
  service_category?: { id?: string; name?: string }
  image_file?: { id?: string; path?: string } | null
  service_galleries?: Array<{ file_id?: string; sort_order?: number; file?: { id?: string; path?: string } | null }>
}
type ServiceCategoryRow = ServiceCategory & { parent?: { id?: string; name?: string } }

/** BE trả thêm resolved_options cho field có lookup_list_id. */
const DEFAULT_COLUMNS = ['service', 'category', 'branch','price', 'duration', 'points', 'status']

function formatPrice(value: number | string | null | undefined, currency: string) {
  if (value === null || value === undefined || value === '') return '—'
  return formatCurrency(value, currency)
}

function categoryOptions(
  categories: ServiceCategoryRow[],
  parentId: string | null = null,
  depth = 0,
  skipId?: string,
  includeInactiveId?: string,
): { value: string; label: string }[] {
  return categories
    .filter((category) => (category.parent_id ?? null) === parentId && category.id !== skipId && (category.is_active !== false || category.id === includeInactiveId))
    .flatMap((category) => [
      { value: category.id, label: `${'　'.repeat(depth)}${category.name}${category.is_active === false ? ' (đã ẩn)' : ''}` },
      ...categoryOptions(categories, category.id, depth + 1, skipId, includeInactiveId),
    ])
}

export default function Services() {
  const { currency, symbol: currencySymbol } = useBrandCurrency()
  const urlMap = useFileUrlMap()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'SERVICE')
  const canDelete = ability.can('DELETE', 'SERVICE')
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<ServiceCategoryRow[]>([])
  const customFields = useCustomFieldDefinitions('SERVICE')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceRow | null>(null)
  const [detailService, setDetailService] = useState<ServiceRow | null>(null)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<{ q?: string; category_id?: string; is_active?: boolean }>({})
  const [visibleColumns] = useState<string[]>(DEFAULT_COLUMNS)
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState<'services' | 'categories'>('services')
  const branchesQuery = useGetBranchesAdmin()
  const branches = useMemo(() => (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[], [branchesQuery.data])

  const listQuery = useQuery({
    queryKey: getGetServiceAdminQueryKey({ ...filters, page, limit }),
    queryFn: async () => pickData<{ services?: ServiceRow[]; total?: number }>(await getServiceAdmin({ ...filters, page, limit })),
  })
  const rows = listQuery.data?.services ?? []
  useEffect(() => setTotal(listQuery.data?.total ?? 0), [listQuery.data])

  // Thống kê đầu trang — đếm server-side (total) nên đúng cả khi đang tìm kiếm/phân trang
  const queryClient = useQueryClient()
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
  ]

  const loadCategories = async () => {
    try {
      setCategories((pickData<ServiceCategoryRow[]>(await getServiceCategoriesAdmin()) ?? []) as ServiceCategoryRow[])
    } catch (err) {
      message.error(errorMessage(err))
    }
  }
  useEffect(() => {
    void loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setPage(1)
    setFilters((current) => ({ ...current, q: nextKeyword.trim() || undefined }))
  }

  const createMutation = useMutation({ mutationFn: async (dto: ServiceCreate) => postServiceAdmin(dto) })
  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<ServiceCreate> }) => putServiceIdAdmin(id, dto as ServiceCreate),
  })
  const hideMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      putServiceIdAdmin(id, { is_active: isActive } as ServiceCreate),
  })
  const deleteMutation = useMutation({ mutationFn: async (id: string) => deleteServiceIdAdmin(id) })


  const openEditor = async (row?: ServiceRow) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(
      row
          ? {
            ...row,
            image_file_id: row.image_file?.id ?? row.image_file_id ?? undefined,
            price: row.price == null ? null : Number(row.price),
            price_max: row.price_max == null ? null : Number(row.price_max),
            gallery_file_ids: (row.service_galleries ?? []).map((gallery) => gallery.file?.id ?? gallery.file_id),
            custom_fields: row.custom_fields ?? {},
            duration_minutes: row.duration_minutes ?? null,
          }
        : {
            title: '',
            required_points: 0,
            price_unit: 'SESSION',
            duration_minutes: null,
            gallery_file_ids: [],
            custom_fields: {},
          },
    )
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const dto = {
        ...values,
        custom_fields: normalizeCustomFieldValues(customFields, values.custom_fields ?? {}, editing?.custom_fields ?? {}),
      }
      if (editing) await updateMutation.mutateAsync({ id: editing.id, dto })
      else await createMutation.mutateAsync(dto)
      setOpen(false)
      message.success(editing ? 'Đã cập nhật dịch vụ' : 'Đã thêm dịch vụ')
      await listQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: ["service-stats"] })
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const hideService = async (row: ServiceRow) => {
    try {
      await hideMutation.mutateAsync({ id: row.id, isActive: false })
      message.success('Đã ẩn dịch vụ; lịch và gói cũ vẫn được giữ')
      await listQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: ["service-stats"] })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const deleteService = async (row: ServiceRow) => {
    try {
      await deleteMutation.mutateAsync(row.id)
      message.success('Đã xóa dịch vụ')
      await listQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: ["service-stats"] })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const restoreService = async (row: ServiceRow) => {
    try {
      await updateMutation.mutateAsync({ id: row.id, dto: { is_active: true } })
      message.success('Đã bật lại dịch vụ')
      await listQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: ["service-stats"] })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const renderActions = (row: ServiceRow, dropdownOnly = false) => (
    <RowActionsMenu
      dropdownOnly={dropdownOnly}
      items={[
        ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
        ...(canUpdate && row.is_active === false ? [{ key: 'restore', icon: <EyeOutlined />, label: 'Bật lại' }] : []),
        ...(canUpdate && row.is_active !== false ? [{ key: 'hide', icon: <EyeInvisibleOutlined />, label: 'Ẩn' }] : []),
        ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
      ]}
      onSelect={(key) => {
        if (key === 'edit') void openEditor(row)
        else if (key === 'restore') void restoreService(row)
        else if (key === 'hide') {
          Modal.confirm({
            title: 'Ẩn dịch vụ này?',
            content: 'Dịch vụ sẽ bị ẩn khỏi app nhưng vẫn còn trong danh sách quản trị.',
            okText: 'Ẩn',
            cancelText: 'Hủy',
            onOk: () => hideService(row),
          })
        } else if (key === 'delete') {
          Modal.confirm({
            title: 'Xóa dịch vụ này?',
            content: 'Xóa mềm: chỉ thực hiện được khi dịch vụ không còn lịch sử/hóa đơn tham chiếu.',
            okText: 'Xóa',
            okButtonProps: { danger: true },
            cancelText: 'Hủy',
            onOk: () => deleteService(row),
          })
        }
      }}
    />
  )

  const branchName = (id?: string | null) =>
    id ? branches.find((branch) => branch.id === id)?.name ?? '—' : 'Tất cả cơ sở'
  const priceLabel = (row: ServiceRow) =>
    row.price_max != null && Number(row.price_max) !== Number(row.price)
      ? `${formatPrice(row.price, currency)} – ${formatPrice(row.price_max, currency)}`
      : formatPrice(row.price, currency)
  const coverSrc = (row: ServiceRow) => fileSrc(row.image_file) ?? resolveFileSrc(urlMap, row.image_file_id)

  const columns = ((): TableColumnsType<ServiceRow> => {
    const dataColumns: Record<string, NonNullable<TableColumnsType<ServiceRow>[number]>> = {
      service: {
        key: 'service',
        title: 'Dịch vụ',
        dataIndex: 'title',
        render: (value: string, row) => {
          const image = coverSrc(row)
          return (
            <Space align="start">
              {image && <img src={image} alt="" width={44} height={44} style={{ objectFit: 'cover', borderRadius: 6 }} />}
              <div>
                <div style={{ fontWeight: 500 }}>{value}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {row.description}
                </Typography.Text>
              </div>
            </Space>
          )
        },
      },
      category: { key: 'category', title: 'Danh mục', render: (_value, row) => row.service_category?.name || '—' },
      branch: { key: 'branch', title: 'Cơ sở', dataIndex: 'branch_id', width: 140, render: branchName },
      price: {
        key: 'price',
        title: 'Giá niêm yết',
        render: (_value, row) => priceLabel(row),
      },
      duration: { key: 'duration', title: 'Thời lượng', dataIndex: 'duration_minutes', render: (value?: number | null) => (value ? `${value} phút` : 'Theo cấu hình') },
      points: { key: 'points', title: 'Điểm đổi', dataIndex: 'required_points', render: (value?: number | null) => (value ? Number(value).toLocaleString('vi-VN') : '—') },
      status: {
        key: 'status',
        title: 'Trạng thái',
        dataIndex: 'is_active',
        render: (value?: boolean) => <Tag color={value === false ? 'default' : 'green'}>{value === false ? 'Đã ẩn' : 'Đang hiển thị'}</Tag>,
      },
    }
    return [
      ...visibleColumns.map((key) => dataColumns[key]).filter(Boolean),
      {
        key: 'actions',
        title: 'Thao tác', align: 'center' as const,
        width: 90,
        fixed: 'right',
        render: (_value, row) => renderActions(row),
      },
    ]
  })()

  const hasServices = !listQuery.isLoading && !listQuery.isError && rows.length > 0

  const servicesContent = (
    <>
      <div className="service-list-toolbar">
        <Input.Search
          allowClear
          aria-label="Tìm tên hoặc mô tả dịch vụ"
          placeholder="Tìm tên hoặc mô tả dịch vụ"
          className="service-list-search"
          value={searchText}
          onChange={(event) => { setSearchText(event.target.value); if (!event.target.value) applySearch('') }}
          onSearch={(v) => applySearch(v)}
        />
        <Can I="CREATE" a="SERVICE">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void openEditor()}>
            Thêm dịch vụ
          </Button>
        </Can>
      </div>
      {listQuery.isError ? (
        <ServiceListState message="Không tải được danh sách dịch vụ" onRetry={() => void listQuery.refetch()} />
      ) : (
        <>
          <Table<ServiceRow>
            className="desktop-only"
            rowKey="id"
            loading={listQuery.isLoading}
            dataSource={rows}
            columns={columns}
            scroll={{ x: 1000 }}
            pagination={false}
            locale={{ emptyText: filters.q ? 'Không có kết quả' : 'Chưa có dữ liệu' }}
            onRow={(row) => ({
              onClick: () => setDetailService(row),
              style: { cursor: 'pointer' },
            })}
          />
          <MobileCards
            rows={rows}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            emptyText={filters.q ? 'Không có kết quả' : 'Chưa có dữ liệu'}
            emptyDescription={filters.q ? 'Thử đổi từ khóa hoặc xóa bộ lọc' : undefined}
            onCardClick={setDetailService}
            renderCard={(row) => {
              const galleryImage = row.service_galleries?.[0]
              const image = coverSrc(row) ?? fileSrc(galleryImage?.file) ?? resolveFileSrc(urlMap, galleryImage?.file_id)
              return (
                <>
                  <div className="mobile-card-head">
                    <button type="button" className="mobile-card-title service-card-link" onClick={(event) => {
                      event.stopPropagation()
                      setDetailService(row)
                    }}>
                      {image
                        ? <img className="service-card-image" src={image} alt="" loading="lazy" />
                        : <AppstoreOutlined aria-hidden />}
                      <span className="min-w-0">{row.title || 'Dịch vụ'}</span>
                    </button>
                    {row.is_active === false ? <Tag>Đã ẩn</Tag> : <Tag color="green">Đang dùng</Tag>}
                    {renderActions(row, true)}
                  </div>
                  <div className="mobile-card-rows">
                    <MobileCardRow label="Danh mục" value={row.service_category?.name || '—'} />
                    <MobileCardRow label="Cơ sở" value={branchName(row.branch_id)} />
                    <MobileCardRow label="Giá niêm yết" value={priceLabel(row)} />
                    <MobileCardRow label="Thời lượng" value={row.duration_minutes ? `${row.duration_minutes} phút` : 'Theo cấu hình'} />
                    <MobileCardRow label="Điểm đổi" value={row.required_points ? Number(row.required_points).toLocaleString('vi-VN') : '—'} />
                  </div>
                </>
              )
            }}
          />
        </>
      )}
      {hasServices && <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="dịch vụ" />}
    </>
  )

  return (
    <div className="services-page">
      <PageTitle subtitle="Danh mục dịch vụ và nhóm dịch vụ">
        Dịch vụ
      </PageTitle>
      <StatCards items={statItems} />

      <Tabs
        className="services-tabs"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'services' | 'categories')}
        items={[
          { key: 'services', label: 'Danh sách dịch vụ', children: servicesContent },
          { key: 'categories', label: 'Danh mục dịch vụ', children: <ServiceCategories /> },
        ]}
      />
      <ServiceModal
        open={open}
        editing={editing}
        form={form}
        categories={categories}
        customFields={customFields}
        currencySymbol={currencySymbol}
        saving={saving}
        categoryOptions={categoryOptions}
        onCancel={() => setOpen(false)}
        onSubmit={() => void submit()}
        branches={branches}
      />
      <ServiceDetailModal
        service={detailService}
        onClose={() => setDetailService(null)}
        categories={categories}
        branches={branches}
        urlMap={urlMap}
        currency={currency}
        formatCurrency={formatCurrency}
      />
    </div>
  )
}
