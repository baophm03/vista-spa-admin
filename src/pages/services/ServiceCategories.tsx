import { useMemo, useState } from 'react'
import { Button, Form, Input, Modal, Popconfirm, Space, Table, Tag, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ServiceCategoryModal from './components/ServiceCategoryModal'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
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

export default function ServiceCategories() {
  const queryClient = useQueryClient()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'SERVICE')
  const canDelete = ability.can('DELETE', 'SERVICE')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ServiceCategoryRow | null>(null)
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()

  const categoriesQuery = useQuery({
    queryKey: getGetServiceCategoriesQueryKey(),
    queryFn: async () => (pickData<ServiceCategoryRow[]>(await getServiceCategories()) ?? []) as ServiceCategoryRow[],
  })
  const rows = categoriesQuery.data ?? []
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi-VN')
    if (!keyword) return rows
    return rows.filter((row) => [row.name, row.parent?.name].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(keyword))
  }, [rows, search])

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
      await updateMutation.mutateAsync({ id: row.id, dto: { is_active: false } })
      message.success('Đã ẩn danh mục; danh mục vẫn còn trong danh sách quản trị')
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const remove = async (row: ServiceCategoryRow) => {
    try {
      await deleteMutation.mutateAsync(row.id)
      message.success('Đã xóa danh mục')
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
        title: 'Hành động',
        key: 'actions',
        align: 'center' as const,
        width: 90,
        render: (_value, row) => (
          <RowActionsMenu
            items={[
              ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
              ...(canUpdate
                ? [row.is_active === false
                  ? { key: 'restore', icon: <EyeOutlined />, label: 'Bật lại' }
                  : { key: 'hide', icon: <EyeInvisibleOutlined />, label: 'Ẩn' }]
                : []),
              ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
            ]}
            onSelect={(key) => {
              if (key === 'edit') openEditor(row)
              else if (key === 'restore') void restore(row)
              else if (key === 'hide') Modal.confirm({
                title: 'Ẩn danh mục này?',
                content: 'Danh mục bị ẩn khỏi app nhưng vẫn còn trong danh sách quản trị.',
                okText: 'Ẩn',
                onOk: () => void hide(row),
              })
              else if (key === 'delete') Modal.confirm({
                title: 'Xóa danh mục này?',
                content: 'Chỉ xóa được khi không còn dịch vụ hoặc danh mục con tham chiếu.',
                okButtonProps: { danger: true },
                okText: 'Xóa',
                onOk: () => void remove(row),
              })
            }}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
          placeholder="Tìm tên danh mục"
          style={{ width: 260 }}
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1) }}
        />
        <Space>
          <Can I="CREATE" a="SERVICE">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
              Thêm danh mục
            </Button>
          </Can>
        </Space>
      </div>
      <Table<ServiceCategoryRow> className="desktop-only" rowKey="id" loading={categoriesQuery.isLoading} dataSource={paginateRows(filteredRows, page, 10)} columns={columns} pagination={false} />
      <MobileCards
        rows={paginateRows(filteredRows, page, 10)}
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
                <Can I="UPDATE" a="SERVICE">
                  <Popconfirm
                    title="Ẩn danh mục này?"
                    description="Danh mục bị ẩn khỏi app nhưng vẫn còn trong danh sách quản trị."
                    onConfirm={() => void hide(row)}
                  >
                    <Button size="small">Ẩn</Button>
                  </Popconfirm>
                </Can>
              )}
              <Can I="DELETE" a="SERVICE">
                <Popconfirm
                  title="Xóa danh mục này?"
                  description="Chỉ xóa được khi không còn dịch vụ hoặc danh mục con tham chiếu."
                  okButtonProps={{ danger: true }}
                  okText="Xóa"
                  onConfirm={() => void remove(row)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} aria-label="Xóa danh mục" />
                </Popconfirm>
              </Can>
            </div>
          </>
        )}
      />
      <ListPagination page={page} limit={10} total={filteredRows.length} onChange={setPage} noun="danh mục dịch vụ" />
      <ServiceCategoryModal
        open={open}
        editing={editing}
        form={form}
        rows={rows}
        saving={saving}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
      />
    </>
  )
}
