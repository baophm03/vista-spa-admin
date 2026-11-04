import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Col,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import ServiceImageField from '@/components/ServiceImageField'
import CustomFieldFormItems, { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import { errorMessage, pickData } from '@/api/helpers'
import {
  deleteServiceId,
  getGetServiceQueryKey,
  getService,
  getServiceCategories,
  postService,
  putServiceId,
} from '@/api/endpoints/services'
import type { Service } from '@/api/models/service'
import type { ServiceCreate } from '@/api/models/serviceCreate'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import type { ServiceCategory } from '@/api/models/serviceCategory'
import ServiceCategories from './ServiceCategories'
import { formatCurrency, useBrandCurrency } from '@/themeRuntime'
import links from '@/configs/links'

/** BE list include kèm `service_category`. */
type ServiceRow = Service & { service_category?: { id?: string; name?: string } }
type ServiceCategoryRow = ServiceCategory & { parent?: { id?: string; name?: string } }

/** BE trả thêm resolved_options cho field có lookup_list_id. */
const DEFAULT_COLUMNS = ['service', 'category', 'price', 'duration', 'points', 'status']
const COLUMN_OPTIONS = [
  { value: 'service', label: 'Dịch vụ' },
  { value: 'category', label: 'Danh mục' },
  { value: 'price', label: 'Giá' },
  { value: 'duration', label: 'Thời lượng' },
  { value: 'points', label: 'Điểm đổi' },
  { value: 'status', label: 'Trạng thái' },
]

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
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'SERVICE')
  const canDelete = ability.can('DELETE', 'SERVICE')
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<ServiceCategoryRow[]>([])
  const customFields = useCustomFieldDefinitions('SERVICE')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceRow | null>(null)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<{ q?: string; category_id?: string; is_active?: boolean }>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS)
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()
  // Mobile (dưới breakpoint md): chuyển vùng nội dung bằng Select thay vì Tabs
  const isMobile = !Grid.useBreakpoint().md
  const [activeTab, setActiveTab] = useState<'services' | 'categories'>('services')
  // Mobile: search thu về nút icon, bấm mới mở ô tìm kiếm
  const [searchOpen, setSearchOpen] = useState(false)

  const listQuery = useQuery({
    queryKey: getGetServiceQueryKey({ ...filters, page, limit }),
    queryFn: async () => pickData<{ services?: ServiceRow[]; total?: number }>(await getService({ ...filters, page, limit })),
  })
  const rows = listQuery.data?.services ?? []
  useEffect(() => setTotal(listQuery.data?.total ?? 0), [listQuery.data])

  const loadCategories = async () => {
    try {
      setCategories((pickData<ServiceCategoryRow[]>(await getServiceCategories()) ?? []) as ServiceCategoryRow[])
    } catch (err) {
      message.error(errorMessage(err))
    }
  }
  useEffect(() => {
    void loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setFilters((current) => ({ ...current, q: searchText.trim() || undefined }))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchText])

  const createMutation = useMutation({ mutationFn: async (dto: ServiceCreate) => postService(dto) })
  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<ServiceCreate> }) => putServiceId(id, dto as ServiceCreate),
  })
  const hideMutation = useMutation({ mutationFn: async (id: string) => deleteServiceId(id) })

  const reload = () => {
    void listQuery.refetch()
    void loadCategories()
  }

  const openEditor = async (row?: ServiceRow) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(
      row
        ? {
            ...row,
            price: row.price == null ? null : Number(row.price),
            price_max: row.price_max == null ? null : Number(row.price_max),
            gallery_file_ids: row.gallery_file_ids ?? [],
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
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const hideService = async (row: ServiceRow) => {
    try {
      await hideMutation.mutateAsync(row.id)
      message.success('Đã ẩn dịch vụ; lịch và gói cũ vẫn được giữ')
      await listQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const restoreService = async (row: ServiceRow) => {
    try {
      await updateMutation.mutateAsync({ id: row.id, dto: { is_active: true } })
      message.success('Đã bật lại dịch vụ')
      await listQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const columns = useMemo<TableColumnsType<ServiceRow>>(() => {
    const dataColumns: Record<string, NonNullable<TableColumnsType<ServiceRow>[number]>> = {
      service: {
        key: 'service',
        title: 'Dịch vụ',
        dataIndex: 'title',
        render: (value: string, row) => (
          <Space align="start">
            {row.image_file_id ? <img src={(links.imageEndpoint + (row.image_file_id || ""))} alt="" width={44} height={44} style={{ objectFit: 'cover', borderRadius: 6 }} /> : null}
            <div>
              <div style={{ fontWeight: 500 }}>{value}</div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.description}
              </Typography.Text>
            </div>
          </Space>
        ),
      },
      category: { key: 'category', title: 'Danh mục', render: (_value, row) => row.service_category?.name || '—' },
      price: {
        key: 'price',
        title: 'Giá niêm yết',
        render: (_value, row) =>
          row.price_max != null && Number(row.price_max) !== Number(row.price) ? `${formatPrice(row.price, currency)} – ${formatPrice(row.price_max, currency)}` : formatPrice(row.price, currency),
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
        title: 'Hành động', align: 'center' as const,
        width: 90,
        fixed: 'right',
        render: (_value, row) => (
          <RowActionsMenu
            items={[
              ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
              ...(canUpdate && row.is_active === false ? [{ key: 'restore', icon: <EyeOutlined />, label: 'Bật lại' }] : []),
              ...(canDelete && row.is_active !== false ? [{ key: 'hide', icon: <EyeInvisibleOutlined />, danger: true, label: 'Ẩn' }] : []),
            ]}
            onSelect={(key) => {
              if (key === 'edit') void openEditor(row)
              else if (key === 'restore') void restoreService(row)
              else if (key === 'hide') {
                Modal.confirm({
                  title: 'Ẩn dịch vụ này?',
                  content: 'Lịch và gói cũ vẫn sẽ tham chiếu dịch vụ.',
                  okText: 'Ẩn',
                  okButtonProps: { danger: true },
                  cancelText: 'Hủy',
                  onOk: () => hideService(row),
                })
              }
            }}
          />
        ),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleColumns, canUpdate, canDelete])

  const activeFilterCount = Object.values(filters).filter((value) => value !== undefined && value !== '').length
  const applyFilters = (values: Record<string, unknown>) => {
    if (!draftVisibleColumns.length) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    setFilters({
      q: searchText.trim() || undefined,
      category_id: typeof values.category_id === 'string' && values.category_id ? values.category_id : undefined,
      is_active: values.is_active === 'true' ? true : values.is_active === 'false' ? false : undefined,
    })
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }
  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({
      category_id: filters.category_id,
      is_active: filters.is_active === undefined ? undefined : String(filters.is_active),
    })
    setDraftVisibleColumns(visibleColumns)
  }
  const clearFilters = () => {
    filterForm.resetFields()
    setSearchText('')
    setFilters({})
    setDraftVisibleColumns(DEFAULT_COLUMNS)
    setVisibleColumns(DEFAULT_COLUMNS)
    setPage(1)
  }

  const servicesContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <Typography.Title level={5} style={{ margin: 0, color: 'var(--brand-secondary-ink)' }}>
            Dịch vụ
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Danh mục dịch vụ và nhóm dịch vụ
          </Typography.Text>
        </div>
        <Space wrap>
          {/* Mobile: gọn toolbar — search thu về nút icon, bấm mới mở; filter icon + Tải lại; Thêm dịch vụ chỉ trên desktop */}
          {isMobile && !searchOpen && (
            <Button icon={<SearchOutlined />} aria-label="Tìm kiếm" title="Tìm kiếm" onClick={() => setSearchOpen(true)} />
          )}
          {!isMobile && <Input
            allowClear
            prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
            placeholder="Tìm tên hoặc mô tả dịch vụ"
            style={{ width: 260 }}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onPressEnter={() => {
              setFilters((current) => ({ ...current, q: searchText.trim() || undefined }))
              setPage(1)
            }}
          />}
          <ListFilterPopover
            iconOnly={!isMobile}
            open={filterOpen}
            onOpenChange={openFilters}
            activeFilterCount={activeFilterCount}
            form={filterForm}
            onApply={applyFilters}
            onClear={clearFilters}
            columnOptions={COLUMN_OPTIONS}
            draftVisibleColumns={draftVisibleColumns}
            onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as string[])}
            filterItems={(
              <>
                <Form.Item name="category_id" label="Danh mục" style={{ marginBottom: 10 }}>
                  <Select allowClear placeholder="Tất cả danh mục" options={categoryOptions(categories)} />
                </Form.Item>
                <Form.Item name="is_active" label="Trạng thái" style={{ marginBottom: 0 }}>
                  <Select
                    allowClear
                    placeholder="Tất cả"
                    options={[
                      { value: 'true', label: 'Đang hiển thị' },
                      { value: 'false', label: 'Đã ẩn' },
                    ]}
                  />
                </Form.Item>
              </>
            )}
          />
          <Button icon={<ReloadOutlined />} onClick={reload}>
            Tải lại
          </Button>
          {!isMobile && <Can I="CREATE" a="SERVICE">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => void openEditor()}>
              Thêm dịch vụ
            </Button>
          </Can>}
        </Space>
      </div>
      {isMobile && searchOpen && (
        <Input
          allowClear
          autoFocus
          prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
          placeholder="Tìm tên hoặc mô tả dịch vụ"
          style={{ width: '100%', marginBottom: 12 }}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          onPressEnter={() => {
            setFilters((current) => ({ ...current, q: searchText.trim() || undefined }))
            setPage(1)
          }}
          onBlur={() => { if (!searchText) setSearchOpen(false) }}
        />
      )}
      <Table<ServiceRow>
        className="desktop-only"
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 1000 }}
        pagination={false}
      />
      <MobileCards
        rows={rows}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading}
        emptyText="Chưa có dịch vụ nào"
        renderCard={(row) => (
          <>
            <div className="mobile-card-head">
              <div className="mobile-card-title">{row.title || 'Dịch vụ'}</div>
              {row.is_active === false ? <Tag>Đã ẩn</Tag> : <Tag color="green">Đang dùng</Tag>}
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Thời lượng" value={row.duration_minutes ? `${row.duration_minutes} phút` : '—'} />
              <MobileCardRow label="Giá" value={row.price_max != null && Number(row.price_max) !== Number(row.price) ? `${formatPrice(row.price, currency)} – ${formatPrice(row.price_max, currency)}` : formatPrice(row.price, currency)} />
            </div>
          </>
        )}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="dịch vụ" />
    </>
  )

  return (
    <>
      {isMobile && (
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          value={activeTab}
          onChange={(value) => setActiveTab(value as 'services' | 'categories')}
          options={[
            { value: 'services', label: 'Danh sách dịch vụ' },
            { value: 'categories', label: 'Danh mục dịch vụ' },
          ]}
        />
      )}
      {!isMobile ? (
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'services' | 'categories')}
          items={[
            { key: 'services', label: 'Danh sách dịch vụ', children: servicesContent },
            { key: 'categories', label: 'Danh mục dịch vụ', children: <ServiceCategories /> },
          ]}
        />
      ) : (
        activeTab === 'services' ? servicesContent : <ServiceCategories />
      )}

      <Modal
        title={editing ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnHidden
        width={720}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="Tên dịch vụ" rules={[{ required: true, message: 'Nhập tên dịch vụ' }]}>
            <Input maxLength={255} placeholder="VD: Chăm sóc da cơ bản" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="category_id" label="Danh mục">
                <Select allowClear placeholder="Chọn danh mục" options={categoryOptions(categories, null, 0, undefined, editing?.category_id ?? undefined)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="duration_minutes" label="Thời lượng (phút)" rules={[{ type: 'number', min: 1, message: 'Thời lượng phải lớn hơn 0' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="Để trống dùng mặc định 60 phút" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="required_points" label="Điểm đổi dịch vụ" rules={[{ type: 'number', min: 0, message: 'Điểm đổi không được âm' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="price" label="Giá niêm yết" rules={[{ type: 'number', min: 0, message: 'Giá không được âm' }]}>
                <InputNumber min={0} step={1000} suffix={currencySymbol} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="price_max" label="Giá tối đa" rules={[{ type: 'number', min: 0, message: 'Giá không được âm' }]}>
                <InputNumber min={0} step={1000} suffix={currencySymbol} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="price_unit" label="Đơn vị giá">
                <Select allowClear options={[{ value: 'SESSION', label: 'Theo buổi' }, { value: 'PER_LESION', label: 'Theo nốt' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} maxLength={5000} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start" wrap>
            <Form.Item name="image_file_id" label="Ảnh bìa">
              <ServiceImageField />
            </Form.Item>
            <Form.Item name="gallery_file_ids" label="Bộ ảnh">
              <ServiceImageField multiple />
            </Form.Item>
          </Space>
          <CustomFieldFormItems definitions={customFields} />
        </Form>
      </Modal>
    </>
  )
}