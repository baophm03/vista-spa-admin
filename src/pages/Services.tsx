import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Popover,
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
import { PlusOutlined, SearchOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import ServiceImageField from '@/components/ServiceImageField'
import { errorMessage, pickData } from '@/api/helpers'
import { Can } from '@casl/react'
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
import { getCustomFieldDefs } from '@/api/endpoints/settings'
import type { CustomFieldDef } from '@/api/models/customFieldDef'
import type { ServiceCategory } from '@/api/models/serviceCategory'
import ServiceCategories from './services/ServiceCategories'
import { formatCurrency, useBrandCurrency } from '@/themeRuntime'

/** BE list include kèm `service_category`. */
type ServiceRow = Service & { service_category?: { id?: string; name?: string } }
type ServiceCategoryRow = ServiceCategory & { parent?: { id?: string; name?: string } }

/** BE trả thêm resolved_options cho field có lookup_list_id. */
type CustomFieldDefRow = CustomFieldDef & {
  resolved_options?: { value: string; label: string; color?: string | null; is_active?: boolean }[]
}

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

function ServiceCustomFieldControl({ field }: { field: CustomFieldDefRow }) {
  const form = Form.useFormInstance()
  const value = Form.useWatch(['custom_fields', field.key], form)
  if (field.data_type === 'number') return <InputNumber style={{ width: '100%' }} />
  if (field.data_type === 'bool') return <Checkbox />
  if (field.data_type === 'select' || field.data_type === 'multiselect') {
    const selected = Array.isArray(value) ? value : [value]
    const options = field.lookup_list_id
      ? (field.resolved_options ?? []).map((option) => ({
          value: option.value,
          label: (
            <Space size={6}>
              {option.color && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: option.color, display: 'inline-block' }} />}
              {option.label}
              {option.is_active === false ? ' (đã ngừng)' : ''}
            </Space>
          ),
          disabled: option.is_active === false && !selected.includes(option.value),
        }))
      : Object.keys(field.options ?? {}).map((option) => ({ value: option, label: <span>{option}</span>, disabled: false }))
    return <Select mode={field.data_type === 'multiselect' ? 'multiple' : undefined} options={options} />
  }
  if (field.data_type === 'date') return <Input type="date" />
  return <Input />
}

function ServiceListTab() {
  const { currency, symbol: currencySymbol } = useBrandCurrency()
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<ServiceCategoryRow[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldDefRow[]>([])
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceRow | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<{ q?: string; category_id?: string; is_active?: boolean }>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [draftCategory, setDraftCategory] = useState<string | undefined>()
  const [draftActive, setDraftActive] = useState<string | undefined>()
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS)
  const [form] = Form.useForm()

  const listQuery = useQuery({
    queryKey: getGetServiceQueryKey({ ...filters, page, limit: pageSize }),
    queryFn: async () => pickData<{ services?: ServiceRow[]; total?: number }>(await getService({ ...filters, page, limit: pageSize })),
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
    void getCustomFieldDefs({ entity: 'SERVICE', is_active: true })
      .then((body) => setCustomFields((pickData<CustomFieldDefRow[]>(body) ?? []) as CustomFieldDefRow[]))
      .catch((err) => message.error(errorMessage(err)))
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
      if (editing) await updateMutation.mutateAsync({ id: editing.id, dto: values })
      else await createMutation.mutateAsync(values)
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
            {row.image_file_id ? <img src={row.image_file_id} alt="" width={44} height={44} style={{ objectFit: 'cover', borderRadius: 6 }} /> : null}
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
        title: '',
        width: 150,
        fixed: 'right',
        render: (_value, row) => (
          <Space>
            <Can I="UPDATE" a="SERVICE">
              <Button size="small" onClick={() => void openEditor(row)}>
                Sửa
              </Button>
            </Can>
            {row.is_active === false ? (
              <Can I="UPDATE" a="SERVICE">
                <Button size="small" onClick={() => void restoreService(row)}>
                  Bật lại
                </Button>
              </Can>
            ) : (
              <Can I="DELETE" a="SERVICE">
                <Popconfirm title="Ẩn dịch vụ này?" description="Lịch và gói cũ vẫn sẽ tham chiếu dịch vụ." onConfirm={() => void hideService(row)}>
                  <Button size="small" danger>
                    Ẩn
                  </Button>
                </Popconfirm>
              </Can>
            )}
          </Space>
        ),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleColumns])

  const conditionCount = Number(Boolean(filters.category_id)) + Number(filters.is_active !== undefined)
  const applyFilters = () => {
    setFilters({
      q: searchText.trim() || undefined,
      category_id: draftCategory || undefined,
      is_active: draftActive === undefined || draftActive === '' ? undefined : draftActive === 'true',
    })
    setPage(1)
    setFilterOpen(false)
  }
  const clearFilters = () => {
    setSearchText('')
    setDraftCategory(undefined)
    setDraftActive(undefined)
    setFilters({})
    setPage(1)
    setFilterOpen(false)
  }

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Space wrap>
          <Input
            allowClear
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onPressEnter={() => {
              setFilters((current) => ({ ...current, q: searchText.trim() || undefined }))
              setPage(1)
            }}
            prefix={<SearchOutlined />}
            placeholder="Tìm tên hoặc mô tả"
            style={{ width: 260 }}
          />
          <Popover
            trigger="click"
            open={filterOpen}
            onOpenChange={(next) => {
              setFilterOpen(next)
              if (next) {
                setDraftCategory(filters.category_id)
                setDraftActive(filters.is_active === undefined ? undefined : String(filters.is_active))
              }
            }}
            content={
              <div style={{ width: 320 }}>
                <Typography.Text strong>
                  Cột hiển thị ({visibleColumns.length}/{COLUMN_OPTIONS.length})
                </Typography.Text>
                <Checkbox.Group
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: 8, gap: 6 }}
                  value={visibleColumns}
                  options={COLUMN_OPTIONS}
                  onChange={(values) => {
                    if (values.length) setVisibleColumns(values as string[])
                  }}
                />
                <Divider style={{ margin: '14px 0' }} />
                <Typography.Text strong>Điều kiện lọc</Typography.Text>
                <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                  <Select allowClear value={draftCategory} placeholder="Danh mục" options={categoryOptions(categories)} onChange={setDraftCategory} style={{ width: '100%' }} />
                  <Select
                    allowClear
                    value={draftActive}
                    placeholder="Trạng thái"
                    options={[
                      { value: 'true', label: 'Đang hiển thị' },
                      { value: 'false', label: 'Đã ẩn' },
                    ]}
                    onChange={setDraftActive}
                    style={{ width: '100%' }}
                  />
                </Space>
                <Space style={{ marginTop: 14, width: '100%', justifyContent: 'space-between' }}>
                  <Button onClick={clearFilters}>Xóa lọc</Button>
                  <Button type="primary" onClick={applyFilters}>
                    Xác nhận
                  </Button>
                </Space>
              </div>
            }
          >
            <Badge count={conditionCount} size="small">
              <Button icon={<FilterOutlined />}>Bộ lọc</Button>
            </Badge>
          </Popover>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={reload}>
            Tải lại
          </Button>
          <Can I="CREATE" a="SERVICE">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => void openEditor()}>
              Thêm dịch vụ
            </Button>
          </Can>
        </Space>
      </Space>

      <Table<ServiceRow>
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 1000 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (count) => `${count} dịch vụ`,
        }}
        onChange={(pagination) => {
          if (pagination.current) setPage(pagination.current)
          if (pagination.pageSize && pagination.pageSize !== pageSize) {
            setPageSize(pagination.pageSize)
            setPage(1)
          }
        }}
      />

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
          {customFields.map((field) => (
            <Form.Item
              key={field.id}
              name={['custom_fields', field.key]}
              label={field.label}
              valuePropName={field.data_type === 'bool' ? 'checked' : 'value'}
              rules={field.required ? [{ required: true, message: `Nhập ${field.label}` }] : []}
            >
              <ServiceCustomFieldControl field={field} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </>
  )
}

export default function Services() {
  return (
    <>
      <PageTitle>Dịch vụ</PageTitle>
      <Tabs
        items={[
          { key: 'services', label: 'Danh sách dịch vụ', children: <ServiceListTab /> },
          { key: 'categories', label: 'Danh mục dịch vụ', children: <ServiceCategories /> },
        ]}
      />
    </>
  )
}
