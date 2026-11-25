import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Select, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { PackageService } from '@/api/models/packageService'
import {
  getGetPackageServicesAdminQueryKey,
  useDeletePackageServicesIdAdmin,
  useGetPackageServicesAdmin,
  usePostPackageServicesAdmin,
  usePutPackageServicesIdAdmin,
} from '@/api/endpoints/package-services'
import PackageServiceModal, { type PackageServiceFormValues } from './components/PackageServiceModal'

/** Tab "Gói dịch vụ" trong /treatments — danh mục dịch vụ riêng của gói liệu trình (Tên / Cơ sở / Mô tả). */
export default function PackageServices({ branches, canManage }: { branches: Branch[]; canManage: boolean }) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm<PackageServiceFormValues>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PackageService | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const limit = 10

  const listQuery = useGetPackageServicesAdmin({
    page,
    limit,
    ...(search ? { q: search } : {}),
    ...(branchFilter ? { branch_id: branchFilter } : {}),
  })
  const rows = (pickData<PackageService[]>(listQuery.data) ?? []) as PackageService[]
  const total = (listQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? rows.length

  const createMutation = usePostPackageServicesAdmin()
  const updateMutation = usePutPackageServicesIdAdmin()
  const deleteMutation = useDeletePackageServicesIdAdmin()
  const reload = () => queryClient.invalidateQueries({ queryKey: getGetPackageServicesAdminQueryKey() })

  const branchLabel = (id?: string | null) => (id ? branches.find((branch) => branch.id === id)?.name ?? '—' : 'Tất cả cơ sở')

  const openEditor = (row?: PackageService) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(row
      ? { title: row.title, branch_id: row.branch_id ?? undefined, description: row.description ?? undefined }
      : { title: '' })
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const data = {
        title: values.title.trim(),
        branch_id: values.branch_id || null,
        description: values.description?.trim() || null,
      }
      if (editing) await updateMutation.mutateAsync({ id: editing.id, data })
      else await createMutation.mutateAsync({ data })
      message.success(editing ? 'Đã cập nhật gói dịch vụ' : 'Đã thêm gói dịch vụ')
      setOpen(false)
      await reload()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action()
      message.success(success)
      await reload()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const renderActions = (row: PackageService, dropdownOnly = false) => (
    <RowActionsMenu
      dropdownOnly={dropdownOnly}
      items={[
        { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
        row.is_active === false
          ? { key: 'restore', icon: <EyeOutlined />, label: 'Bật lại' }
          : { key: 'hide', icon: <EyeInvisibleOutlined />, label: 'Ẩn' },
        { key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' },
      ]}
      onSelect={(key) => {
        if (key === 'edit') openEditor(row)
        else if (key === 'hide' || key === 'restore') {
          const isActive = key === 'restore'
          void runAction(() => updateMutation.mutateAsync({ id: row.id, data: { is_active: isActive } }), isActive ? 'Đã bật lại gói dịch vụ' : 'Đã ẩn gói dịch vụ')
        } else if (key === 'delete') Modal.confirm({
          title: 'Xóa gói dịch vụ này?',
          content: 'Chỉ xóa được khi không còn gói liệu trình nào dùng gói dịch vụ này — nếu đang dùng hãy chọn "Ẩn".',
          okText: 'Xóa',
          okButtonProps: { danger: true },
          cancelText: 'Hủy',
          onOk: () => runAction(() => deleteMutation.mutateAsync({ id: row.id }), 'Đã xóa gói dịch vụ'),
        })
      }}
    />
  )

  const statusTag = (row: PackageService) => (row.is_active === false ? <Tag>Đã ẩn</Tag> : <Tag color="green">Đang sử dụng</Tag>)

  const columns: TableColumnsType<PackageService> = [
    { title: 'Tên dịch vụ', key: 'title', dataIndex: 'title', width: '28%', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Cơ sở', key: 'branch', dataIndex: 'branch_id', width: '16%', render: branchLabel },
    { title: 'Mô tả', key: 'description', dataIndex: 'description', ellipsis: true, render: (value?: string | null) => value || '—' },
    { title: 'Trạng thái', key: 'status', width: '13%', render: (_value, row) => statusTag(row) },
    ...(canManage ? [{ title: 'Thao tác', key: 'actions', align: 'center' as const, width: 88, render: (_value: unknown, row: PackageService) => renderActions(row) }] : []),
  ]

  return (
    <>
      <div className="treatment-list-toolbar">
        <div className="flex flex-wrap gap-2">
          <Input.Search
            allowClear
            aria-label="Tìm tên hoặc mô tả gói dịch vụ"
            placeholder="Tìm tên hoặc mô tả gói dịch vụ"
            className="treatment-list-search"
            value={searchInput}
            onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) { setSearch(''); setPage(1) } }}
            onSearch={(value) => { setSearch(value.trim()); setPage(1) }}
          />
          <Select
            allowClear
            placeholder="Tất cả cơ sở"
            style={{ minWidth: 160 }}
            value={branchFilter}
            onChange={(value) => { setBranchFilter(value); setPage(1) }}
            options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          />
        </div>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
            Thêm gói dịch vụ
          </Button>
        )}
      </div>
      {listQuery.isError ? (
        <Alert
          className="treatment-list-error"
          type="error"
          showIcon
          title="Không tải được danh sách gói dịch vụ"
          description={errorMessage(listQuery.error)}
          action={<Button onClick={() => void listQuery.refetch()} loading={listQuery.isFetching}>Thử lại</Button>}
        />
      ) : (
        <>
          <Table<PackageService>
            className="desktop-only"
            rowKey="id"
            loading={listQuery.isLoading}
            dataSource={rows}
            tableLayout="fixed"
            pagination={false}
            locale={{ emptyText: search ? 'Không có kết quả' : 'Chưa có gói dịch vụ' }}
            columns={columns}
          />
          <MobileCards
            rows={rows}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            emptyText={search ? 'Không có kết quả' : 'Chưa có gói dịch vụ'}
            renderCard={(row) => (
              <>
                <div className="mobile-card-head">
                  <span className="mobile-card-title">{row.title}</span>
                  {statusTag(row)}
                </div>
                <div className="mobile-card-rows">
                  <MobileCardRow label="Cơ sở" value={branchLabel(row.branch_id)} />
                  <MobileCardRow label="Mô tả" value={row.description || '—'} />
                </div>
                {canManage && <div className="mobile-card-actions">{renderActions(row, true)}</div>}
              </>
            )}
          />
          <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="gói dịch vụ" />
        </>
      )}
      <PackageServiceModal form={form} open={open} editing={!!editing} saving={saving} branches={branches} onCancel={() => setOpen(false)} onOk={submit} />
    </>
  )
}
