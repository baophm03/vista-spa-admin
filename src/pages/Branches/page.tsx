import { useMemo, useState } from 'react'
import { Alert, Button, Form, Image, Input, Modal, Select, Table, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, PauseCircleOutlined, PictureOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { BranchUpdate } from '@/api/models/branchUpdate'
import { getGetBranchesNextCodeAdminQueryKey, getGetBranchesAdminQueryKey, useDeleteBranchesIdAdmin, useGetBranchesAdmin, useGetBranchesNextCodeAdmin, usePostBranchesAdmin, usePostBranchesIdActivateAdmin, usePostBranchesIdDeactivateAdmin, usePutBranchesIdAdmin } from '@/api/endpoints/branches'
import { usePostFilesAdmin } from '@/api/endpoints/files'
import { fileSrc, registerUploadedFile, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import { Can, useAbility } from '@casl/react'
import { useQueryClient } from '@tanstack/react-query'
import BranchModal from './components/BranchModal'
import type { BranchFormValues } from './components/constants'

type StatusFilter = 'all' | 'active' | 'inactive'

type BranchColumnKey = 'image' | 'code' | 'name' | 'address' | 'phone' | 'status'

const BRANCH_COLUMN_OPTIONS: { label: string; value: BranchColumnKey }[] = [
  { label: 'Ảnh', value: 'image' },
  { label: 'Mã cơ sở', value: 'code' },
  { label: 'Tên cơ sở', value: 'name' },
  { label: 'Địa chỉ', value: 'address' },
  { label: 'Số điện thoại', value: 'phone' },
  { label: 'Trạng thái', value: 'status' },
]

const DEFAULT_VISIBLE_COLUMNS = BRANCH_COLUMN_OPTIONS.map((column) => column.value)

export default function Branches() {
  const [searchText, setSearchText] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [visibleColumns, setVisibleColumns] = useState<BranchColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<BranchColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [form] = Form.useForm<BranchFormValues>()
  const [filterForm] = Form.useForm()
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileUrlMap = useFileUrlMap()
  const queryClient = useQueryClient()
  const { isAdmin, isReceptionist, isTechnician } = useCustomerProfileAccess()
  const hideSummaryForTechnician = isTechnician && !isAdmin && !isReceptionist

  const branchesQuery = useGetBranchesAdmin({
    page,
    limit: 10,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(keyword ? { q: keyword } : {}),
  } as never)
  const nextCodeQuery = useGetBranchesNextCodeAdmin({ query: { enabled: open && !editing } })
  const nextCode = pickData<{ code?: string }>(nextCodeQuery.data)?.code
  const createMutation = usePostBranchesAdmin()
  const updateMutation = usePutBranchesIdAdmin()
  // Ngừng hoạt động = POST /branches/{id}/deactivate (is_active=false); DELETE /branches/{id} là xóa mềm is_deleted.
  const deactivateMutation = usePostBranchesIdDeactivateAdmin()
  const deleteBranchMutation = useDeleteBranchesIdAdmin()
  const activateMutation = usePostBranchesIdActivateAdmin()
  const uploadMutation = usePostFilesAdmin()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'BRANCH')
  const canDelete = ability.can('DELETE', 'BRANCH')

  const rows = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetBranchesAdminQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetBranchesNextCodeAdminQueryKey() })
  }

  const visibleRows = rows

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setKeyword(nextKeyword.trim())
    setPage(1)
  }

  // Thống kê đến từ server nên vẫn đúng khi danh sách đang phân trang hoặc lọc.
  const statsMeta = (branchesQuery.data as unknown as { meta?: { stats?: { total: number; active: number; inactive: number } } })?.meta?.stats
  const statItems = useMemo<StatItem[]>(() => {
    if (hideSummaryForTechnician) return []
    if (!statsMeta) return []
    return [
      { key: 'total', label: 'Tổng cơ sở', value: statsMeta.total.toLocaleString('vi-VN'), icon: <EnvironmentOutlined />, tone: 'primary' },
      { key: 'active', label: 'Đang hoạt động', value: statsMeta.active.toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
      { key: 'inactive', label: 'Đã ngừng', value: statsMeta.inactive.toLocaleString('vi-VN'), icon: <PauseCircleOutlined />, tone: 'neutral' },
    ]
  }, [statsMeta, hideSummaryForTechnician])

  const applyFilters = (values: Record<string, unknown>) => {
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    setStatusFilter(values.status === 'active' || values.status === 'inactive' ? values.status : 'all')
    setVisibleColumns(draftVisibleColumns)
    setFilterOpen(false)
    setPage(1)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setSearchText('')
    setKeyword('')
    setStatusFilter('all')
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({ status: statusFilter === 'all' ? undefined : statusFilter })
    setSearchText(keyword)
    setDraftVisibleColumns(visibleColumns)
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ name: '', address: '', phone: '', image_file_id: undefined })
    setOpen(true)
  }

  const openEdit = (branch: Branch) => {
    setEditing(branch)
    form.resetFields()
    form.setFieldsValue({
      name: branch.name,
      address: branch.address ?? '',
      phone: branch.phone ?? '',
      image_file_id: (branch as Branch & { image_file?: { id?: string }; image_file_id?: string }).image_file?.id
        ?? (branch as Branch & { image_file_id?: string }).image_file_id
        ?? undefined,
    })
    setOpen(true)
  }

  /** Upload ảnh cơ sở — giống luồng ảnh bìa bài viết (POST /files → set form field). */
  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Vui lòng chọn tệp ảnh')
      return false
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('Ảnh không được vượt quá 10 MB')
      return false
    }
    setUploadingImage(true)
    try {
      const uploaded = pickData<{ id?: string; path?: string }>(await uploadMutation.mutateAsync({ data: { file } }))
      if (!uploaded?.id) throw new Error('Máy chủ không trả về file')
      registerUploadedFile(uploaded.id, uploaded.path)
      form.setFieldValue('image_file_id', uploaded.id)
      message.success('Đã tải ảnh lên')
    } catch (err) {
      message.error(`Tải ảnh lên thất bại: ${errorMessage(err)}`)
    } finally {
      setUploadingImage(false)
    }
    return false
  }

  const closeModal = () => {
    if (createMutation.isPending || updateMutation.isPending) return
    setOpen(false)
  }

  const submit = async () => {
    let values: BranchFormValues
    try {
      values = await form.validateFields()
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return
      throw err
    }

    const payload = {
      name: values.name.trim(),
      address: values.address?.trim() ?? '',
      phone: values.phone?.trim() ?? '',
      image_file_id: values.image_file_id || null,
    }

    try {
      if (editing) {
        const body: BranchUpdate = {
          name: payload.name,
          address: payload.address,
          phone: payload.phone,
        }
        await updateMutation.mutateAsync({ id: editing.id, data: { ...body, image_file_id: payload.image_file_id } as BranchUpdate })
        message.success('Đã cập nhật cơ sở')
      } else {
        await createMutation.mutateAsync({ data: payload as never })
        message.success('Đã thêm cơ sở')
      }
      setOpen(false)
      await invalidate()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  // Modal dùng confirmLoading từ mutation
  const saving = createMutation.isPending || updateMutation.isPending

  const confirmStatusChange = (branch: Branch, activate: boolean) => {
    Modal.confirm({
      title: activate ? 'Kích hoạt lại cơ sở?' : 'Ngừng hoạt động cơ sở?',
      content: activate
        ? `Cơ sở ${branch.name} (${branch.code}) sẽ xuất hiện lại trong các bộ chọn nghiệp vụ.`
        : `Cơ sở ${branch.name} (${branch.code}) sẽ không nhận nghiệp vụ mới. Hồ sơ khách và lịch sử hiện có vẫn được giữ. Lịch hẹn đang xử lý, liệu trình còn quyền lợi và tài khoản có quyền vận hành cần được giải quyết trước.`,
      okText: activate ? 'Kích hoạt lại' : 'Ngừng hoạt động',
      cancelText: 'Hủy',
      okButtonProps: activate ? undefined : { danger: true },
      onOk: async () => {
        try {
          if (activate) await activateMutation.mutateAsync({ id: branch.id })
          else await deactivateMutation.mutateAsync({ id: branch.id })
          message.success(activate ? 'Đã kích hoạt lại cơ sở' : 'Đã ngừng hoạt động cơ sở')
          await invalidate()
        } catch (err) {
          message.error(errorMessage(err))
          throw err
        }
      },
    })
  }

  // Xóa = soft delete (is_deleted) qua DELETE /branches/{id}; khác với "Ngừng hoạt động" (deactivate).
  const remove = async (branch: Branch) => {
    try {
      await deleteBranchMutation.mutateAsync({ id: branch.id })
      message.success(`Đã xóa cơ sở ${branch.name}`)
      await invalidate()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (keyword ? 1 : 0)

  const columns = [
    {
      key: 'image',
      title: 'Ảnh',
      dataIndex: 'image_file_id',
      width: 90,
      render: (_: unknown, row: Branch) => {
        const withFile = row as Branch & { image_file?: { path?: string }; image_file_id?: string }
        const src = fileSrc(withFile.image_file) ?? resolveFileSrc(fileUrlMap, withFile.image_file_id)
        return src ? (
          <Image src={src} alt={row.name} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 8 }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--brand-bg)', display: 'grid', placeItems: 'center', color: '#B9BDC2' }}>
            <PictureOutlined />
          </div>
        )
      },
    },
    {
      key: 'code',
      title: 'Mã cơ sở',
      dataIndex: 'code',
      width: 130,
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      key: 'name',
      title: 'Tên cơ sở',
      dataIndex: 'name',
      width: 210,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      key: 'address',
      title: 'Địa chỉ',
      dataIndex: 'address',
      width: 160,
      ellipsis: true,
      render: (value?: string) => value?.trim() || '—',
    },
    {
      key: 'phone',
      title: 'Số điện thoại',
      dataIndex: 'phone',
      width: 160,
      render: (value?: string) => value?.trim() || '—',
    },
    {
      key: 'status',
      title: 'Trạng thái',
      dataIndex: 'is_active',
      width: 140,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? 'Đang hoạt động' : 'Đã ngừng'}</Tag>
      ),
    },
    {
      key: 'actions',
      title: 'Thao tác', align: 'center' as const,
      width: 90,
      fixed: 'right' as const,
      render: (_: unknown, row: Branch) => (
        <RowActionsMenu
          items={[
            ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
            ...(canUpdate
              ? [row.is_active
                ? { key: 'deactivate', icon: <PauseCircleOutlined />, label: 'Ngừng' }
                : { key: 'activate', icon: <CheckCircleOutlined />, label: 'Kích hoạt' }]
              : []),
            ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
          ]}
          onSelect={(key) => {
            if (key === 'edit') openEdit(row)
            else if (key === 'deactivate') confirmStatusChange(row, false)
            else if (key === 'activate') confirmStatusChange(row, true)
            else if (key === 'delete') {
              Modal.confirm({
                title: `Xóa cơ sở ${row.name}?`,
                content: 'Xóa mềm (is_deleted=true). Chỉ thực hiện được khi cơ sở không còn lịch hẹn đang xử lý, liệu trình còn quyền lợi hay tài khoản vận hành.',
                okText: 'Xóa',
                okButtonProps: { danger: true },
                cancelText: 'Hủy',
                onOk: () => remove(row),
              })
            }
          }}
        />
      ),
    },
  ].filter((column) =>
    (column.key !== 'actions' || canUpdate || canDelete) &&
    (column.key === 'actions' || visibleColumns.includes(column.key as BranchColumnKey)),
  )

  return (
    <>

      <PageTitle
        summary={<StatCards items={statItems} />}
        subtitle="Danh sách cơ sở spa trong hệ thống"
        left={
          <>
            <Input
              allowClear
              prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
              placeholder="Tìm theo mã hoặc tên cơ sở"
              className="w-[260px]!"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value)
                if (!event.target.value) applySearch('')
              }}
              onPressEnter={() => applySearch(searchText)}
            />
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={openFilters}
              activeFilterCount={activeFilterCount}
              form={filterForm}
              onApply={applyFilters}
              onClear={clearFilters}
              columnOptions={BRANCH_COLUMN_OPTIONS}
              draftVisibleColumns={draftVisibleColumns}
              onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as BranchColumnKey[])}
              filterItems={(
                <Form.Item name="status" label="Trạng thái" className="mb-0!">
                  <Select
                    allowClear
                    placeholder="Tất cả"
                    options={[
                      { value: 'active', label: 'Đang hoạt động' },
                      { value: 'inactive', label: 'Đã ngừng' },
                    ]}
                  />
                </Form.Item>
              )}
            />
          </>
        }
        right={
          <Can I="CREATE" a="BRANCH">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm cơ sở
            </Button>
          </Can>
        }
      >
        Cơ sở
      </PageTitle>

      {branchesQuery.isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Không tải được danh sách cơ sở"
          description={errorMessage(branchesQuery.error)}
          action={<Button size="small" onClick={() => void branchesQuery.refetch()}>Thử lại</Button>}
        />
      )}

      <Table<Branch>
        className="desktop-only"
        rowKey="id"
        loading={branchesQuery.isLoading}
        dataSource={visibleRows}
        columns={columns}
        scroll={{ x: 980 }}
        pagination={false}
        locale={{
          emptyText: <TableEmpty description={keyword.trim() || statusFilter !== 'all' ? 'Không tìm thấy cơ sở phù hợp' : 'Chưa có cơ sở nào'} />,
        }}
      />
      <MobileCards
        rows={visibleRows}
        rowKey={(row) => row.id}
        loading={branchesQuery.isLoading}
        emptyText={keyword.trim() || statusFilter !== 'all' ? 'Không tìm thấy cơ sở phù hợp' : 'Chưa có cơ sở nào'}
        renderCard={(row) => (
          <>
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">{row.name}</div>
                <div className="mobile-card-sub"><Typography.Text code style={{ fontSize: 12 }}>{row.code}</Typography.Text></div>
              </div>
              <Tag color={row.is_active ? 'green' : 'default'}>{row.is_active ? 'Đang hoạt động' : 'Đã ngừng'}</Tag>
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Địa chỉ" value={row.address?.trim() || '—'} />
              <MobileCardRow label="Số điện thoại" value={row.phone?.trim() || '—'} />
            </div>
          </>
        )}
      />
      <ListPagination
        page={page}
        limit={10}
        total={(branchesQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? visibleRows.length}
        onChange={setPage}
        noun="cơ sở"
      />

      <BranchModal
        open={open}
        editing={editing}
        nextCode={nextCode}
        form={form}
        saving={saving}
        uploadingImage={uploadingImage}
        uploadImage={uploadImage}
        onCancel={closeModal}
        onSubmit={() => void submit()}
      />
    </>
  )
}
