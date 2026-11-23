import { useState } from 'react'
import { Button, Form, Input, Modal, Table, Tag, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ServiceCategoryModal from './components/ServiceCategoryModal'
import ServiceListState from './components/ServiceListState'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { errorMessage } from '@/api/helpers'
import { deleteServiceCategoriesIdAdmin, getGetServiceCategoriesAdminQueryKey, getServiceCategoriesAdmin, postServiceCategoriesAdmin, putServiceCategoriesIdAdmin } from '@/api/endpoints/services'
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
    queryKey: [...getGetServiceCategoriesAdminQueryKey(), { page, q: search.trim() }],
    queryFn: async () =>
      (await getServiceCategoriesAdmin({ page, limit: 10, ...(search.trim() ? { q: search.trim() } : {}) } as never)) as unknown as {
        responseData?: ServiceCategoryRow[]
        meta?: { total?: number }
      },
  })
  const rows = (categoriesQuery.data?.responseData ?? []) as ServiceCategoryRow[]
  const total = categoriesQuery.data?.meta?.total ?? rows.length
  const applySearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const createMutation = useMutation({
    mutationFn: async (dto: ServiceCategoryCreate) => postServiceCategoriesAdmin(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetServiceCategoriesAdminQueryKey() }),
  })
  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<ServiceCategoryCreate> }) => putServiceCategoriesIdAdmin(id, dto as ServiceCategoryCreate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetServiceCategoriesAdminQueryKey() }),
  })
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteServiceCategoriesIdAdmin(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetServiceCategoriesAdminQueryKey() }),
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

  const renderActions = (row: ServiceCategoryRow, dropdownOnly = false) => (
    <RowActionsMenu
      dropdownOnly={dropdownOnly}
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
  )

  const columns: TableColumnsType<ServiceCategoryRow> = [
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
      title: 'Thao tác',
      key: 'actions',
      align: 'center' as const,
      width: 90,
      render: (_value, row) => renderActions(row),
    },
  ]

  return (
    <>
      <div className="service-list-toolbar">
        <Input.Search
          allowClear
          aria-label="Tìm tên danh mục"
          placeholder="Tìm tên danh mục"
          className="service-list-search"
          value={search}
          onChange={(event) => applySearch(event.target.value)}
          onSearch={applySearch}
        />
        <Can I="CREATE" a="SERVICE">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
            Thêm danh mục
          </Button>
        </Can>
      </div>
      {categoriesQuery.isError ? (
        <ServiceListState message="Không tải được danh mục dịch vụ" onRetry={() => void categoriesQuery.refetch()} />
      ) : (
        <>
          <Table<ServiceCategoryRow> className="desktop-only" rowKey="id" loading={categoriesQuery.isLoading} dataSource={rows} columns={columns} pagination={false} locale={{ emptyText: search.trim() ? 'Không có kết quả' : 'Chưa có dữ liệu' }} />
          <MobileCards
            rows={rows}
            rowKey={(row) => row.id}
            loading={categoriesQuery.isLoading}
            emptyText={search.trim() ? 'Không có kết quả' : 'Chưa có dữ liệu'}
            emptyDescription={search.trim() ? 'Thử đổi từ khóa hoặc xóa bộ lọc' : undefined}
            renderCard={(row) => (
              <>
                <div className="mobile-card-head">
                  <div className="mobile-card-title min-w-0 flex-1">{row.name}</div>
                  <Tag color={row.is_active === false ? 'default' : 'green'}>{row.is_active === false ? 'Đã ẩn' : 'Đang dùng'}</Tag>
                  {renderActions(row, true)}
                </div>
                <div className="mobile-card-rows">
                  <MobileCardRow label="Danh mục cha" value={row.parent?.name || '—'} />
                  <MobileCardRow label="Thứ tự" value={row.sort_order ?? '—'} />
                </div>
              </>
            )}
          />
        </>
      )}
      <ListPagination page={page} limit={10} total={total} onChange={setPage} noun="danh mục dịch vụ" />
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
