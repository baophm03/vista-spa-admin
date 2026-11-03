import { useMemo, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ServiceImageField from '@/components/ServiceImageField'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import { Can } from '@casl/react'
import {
  deleteServiceCategoriesId,
  getGetServiceCategoriesQueryKey,
  getServiceCategories,
  postServiceCategories,
  putServiceCategoriesId,
} from '@/api/endpoints/services'
import type { ServiceCategory } from '@/api/models/serviceCategory'
import type { ServiceCategoryCreate } from '@/api/models/serviceCategoryCreate'

/** BE include kèm `parent` (id, name) khi list. */
type ServiceCategoryRow = ServiceCategory & { parent?: { id?: string; name?: string } }

function flattenCategories(
  categories: ServiceCategoryRow[],
  parentId: string | null = null,
  depth = 0,
  includeId?: string,
): { value: string; label: string }[] {
  return categories
    .filter((category) => (category.parent_id ?? null) === parentId && (category.is_active !== false || category.id === includeId))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'vi'))
    .flatMap((category) => [
      { value: category.id, label: `${'　'.repeat(depth)}${category.name}${category.is_active === false ? ' (đã ẩn)' : ''}` },
      ...flattenCategories(categories, category.id, depth + 1, includeId),
    ])
}

export default function ServiceCategories() {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ServiceCategoryRow | null>(null)
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [form] = Form.useForm()

  const categoriesQuery = useQuery({
    queryKey: getGetServiceCategoriesQueryKey(),
    queryFn: async () => (pickData<ServiceCategoryRow[]>(await getServiceCategories()) ?? []) as ServiceCategoryRow[],
  })
  const rows = categoriesQuery.data ?? []

  const createMutation = useMutation({
    mutationFn: async (dto: ServiceCategoryCreate) => postServiceCategories(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetServiceCategoriesQueryKey() }),
  })
  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<ServiceCategoryCreate> }) => putServiceCategoriesId(id, dto as ServiceCategoryCreate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetServiceCategoriesQueryKey() }),
  })
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteServiceCategoriesId(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetServiceCategoriesQueryKey() }),
  })

  const openEditor = (row?: ServiceCategoryRow) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(row ?? { sort_order: rows.length, is_active: true, image_file_id: null })
    setOpen(true)
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      const dto: ServiceCategoryCreate = { ...values }
      if (editing && values.parent_id === editing.parent_id) delete dto.parent_id
      else dto.parent_id = values.parent_id || undefined
      setSaving(true)
      if (editing) await updateMutation.mutateAsync({ id: editing.id, dto })
      else await createMutation.mutateAsync(dto)
      setOpen(false)
      message.success(editing ? 'Đã cập nhật danh mục' : 'Đã tạo danh mục')
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const hide = async (row: ServiceCategoryRow) => {
    try {
      await deleteMutation.mutateAsync(row.id)
      message.success('Đã ẩn danh mục')
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const restore = async (row: ServiceCategoryRow) => {
    try {
      await updateMutation.mutateAsync({ id: row.id, dto: { is_active: true } })
      message.success('Đã bật lại danh mục')
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const columns = useMemo<TableColumnsType<ServiceCategoryRow>>(
    () => [
      { title: 'Tên danh mục', dataIndex: 'name' },
      { title: 'Danh mục cha', render: (_value, row) => row.parent?.name || '—' },
      { title: 'Thứ tự', dataIndex: 'sort_order', width: 100 },
      {
        title: 'Trạng thái',
        dataIndex: 'is_active',
        width: 140,
        render: (active?: boolean) => <Tag color={active === false ? 'default' : 'green'}>{active === false ? 'Đã ẩn' : 'Đang dùng'}</Tag>,
      },
      {
        title: '',
        key: 'actions',
        width: 170,
        render: (_value, row) => (
          <Space>
            <Can I="UPDATE" a="SERVICE">
              <Button size="small" onClick={() => openEditor(row)}>
                Sửa
              </Button>
            </Can>
            {row.is_active === false ? (
              <Can I="UPDATE" a="SERVICE">
                <Button size="small" onClick={() => void restore(row)}>
                  Bật lại
                </Button>
              </Can>
            ) : (
              <Can I="DELETE" a="SERVICE">
                <Popconfirm
                  title="Ẩn danh mục này?"
                  description="Chỉ ẩn được khi không còn dịch vụ hoặc danh mục con đang hoạt động."
                  onConfirm={() => void hide(row)}
                >
                  <Button size="small" danger>
                    Ẩn
                  </Button>
                </Popconfirm>
              </Can>
            )}
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <Typography.Title level={5} style={{ margin: 0, color: 'var(--brand-secondary-ink)' }}>
            Danh mục dịch vụ
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Danh mục hỗ trợ cây cha/con; chỉ ẩn được khi không còn dịch vụ hoặc danh mục con đang hoạt động.
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); void categoriesQuery.refetch() }}>
            Tải lại
          </Button>
          <Can I="CREATE" a="SERVICE">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
              Thêm danh mục
            </Button>
          </Can>
        </Space>
      </div>
      <Table<ServiceCategoryRow> className="desktop-only" rowKey="id" loading={categoriesQuery.isLoading} dataSource={paginateRows(rows, page, 10)} columns={columns} pagination={false} />
      <MobileCards
        rows={paginateRows(rows, page, 10)}
        rowKey={(row) => row.id}
        loading={categoriesQuery.isLoading}
        emptyText="Chưa có danh mục nào"
        renderCard={(row) => (
          <>
            <div className="mobile-card-head">
              <div className="mobile-card-title">{row.name}</div>
              <Tag color={row.is_active === false ? 'default' : 'green'}>{row.is_active === false ? 'Đã ẩn' : 'Đang dùng'}</Tag>
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Danh mục cha" value={row.parent?.name || '—'} />
              <MobileCardRow label="Thứ tự" value={row.sort_order ?? '—'} />
            </div>
            <div className="mobile-card-actions">
              <Can I="UPDATE" a="SERVICE">
                <Button size="small" onClick={() => openEditor(row)}>Sửa</Button>
              </Can>
              {row.is_active === false ? (
                <Can I="UPDATE" a="SERVICE">
                  <Button size="small" onClick={() => void restore(row)}>Bật lại</Button>
                </Can>
              ) : (
                <Can I="DELETE" a="SERVICE">
                  <Popconfirm
                    title="Ẩn danh mục này?"
                    description="Chỉ ẩn được khi không còn dịch vụ hoặc danh mục con đang hoạt động."
                    onConfirm={() => void hide(row)}
                  >
                    <Button size="small" danger>Ẩn</Button>
                  </Popconfirm>
                </Can>
              )}
            </div>
          </>
        )}
      />
      <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="danh mục dịch vụ" />
      <Modal
        title={editing ? 'Sửa danh mục dịch vụ' : 'Thêm danh mục dịch vụ'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: 'Nhập tên danh mục' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="parent_id" label="Danh mục cha">
            <Select
              allowClear
              placeholder="Danh mục gốc"
              options={flattenCategories(rows, null, 0, editing?.parent_id ?? undefined).filter((option) => option.value !== editing?.id)}
            />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị" rules={[{ type: 'number', min: 0 }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="image_file_id" label="Ảnh danh mục">
            <ServiceImageField />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
