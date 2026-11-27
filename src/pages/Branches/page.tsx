import { useMemo, useState } from 'react'
import { Alert, Button, Form, Image, Input, Modal, Select, Table, Tag, Typography, message, Skeleton } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, PauseCircleOutlined, PictureOutlined, PlusOutlined, FilterOutlined } from '@ant-design/icons'
import MobileUI from '@/components/base/MobileUI'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import BranchMobileCard from './BranchMobileCard'
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



function BranchMobileSkeleton() {
  return (
    <div className="w-full rounded-lg border border-[#E9E1EC] bg-white p-[17px]" aria-busy="true">
      <Skeleton active title={false} paragraph={{ rows: 3 }} />
    </div>
  )
}

function BranchMobileEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex h-[164px] w-full flex-col items-center justify-center gap-[9px] rounded-lg border border-[#E9E1EC] bg-white">
      <div className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-[31px] bg-[#F2E5F4]">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            d="M7.58333 10.8333H15.1667M7.58333 15.1667H18.4167M5.41667 5.41666H20.5833C21.158 5.41666 21.7091 5.64493 22.1154 6.05126C22.5217 6.45759 22.75 7.00869 22.75 7.58332V18.4167C22.75 18.9913 22.5217 19.5424 22.1154 19.9487C21.7091 20.3551 21.158 20.5833 20.5833 20.5833H5.41667C4.84203 20.5833 4.29093 20.3551 3.8846 19.9487C3.47827 19.5424 3.25 18.9913 3.25 18.4167V7.58332C3.25 7.00869 3.47827 6.45759 3.8846 6.05126C4.29093 5.64493 4.84203 5.41666 5.41667 5.41666Z"
            stroke="#702176"
            strokeWidth="1.89583"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="m-0 text-sm font-bold text-[#282335]">{filtered ? 'Không có kết quả' : 'Chưa có dữ liệu'}</p>
    </div>
  )
}

function BranchMobileError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex w-full flex-col items-end gap-2 rounded-lg border border-[#E9E1EC] bg-[#FFF1F2] p-[13px]">
      <p className="m-0 w-full text-sm font-bold text-[#A03A3F]">Không tải được danh sách cơ sở</p>
      <p className="m-0 w-full text-[13px] text-[#655E71]">Vui lòng thử lại sau.</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-11 w-fit cursor-pointer items-center justify-center gap-1.5 text-nowrap rounded-lg border border-[#E9E1EC] bg-white px-3 text-[13px] font-medium text-[#282335]"
      >
        Thử lại
      </button>
    </div>
  )
}

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
  const total = (branchesQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? visibleRows.length
  const isFiltered = keyword.trim() !== '' || statusFilter !== 'all'


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
    <MobileUI>

      <PageTitle
        summary={<StatCards items={statItems} />}
        subtitle="Danh sách cơ sở spa trong hệ thống"
        left={
          <>
            <Input.Search
              allowClear
              placeholder="Tìm theo mã hoặc tên cơ sở"
              className="w-full! max-md:col-span-full md:w-[260px]!"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value)
                if (!event.target.value) applySearch('')
              }}
              onSearch={() => applySearch(searchText)}
            />
            {/* Mobile: [Bộ lọc][+] cùng 1 hàng (docs 6.2.1); từ tablet tan vào hàng toolbar */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-md:col-span-full md:contents">
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={openFilters}
              activeFilterCount={activeFilterCount}
              trigger={<Button className="keep-label" icon={<FilterOutlined />}>Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</Button>}
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
            <Can I="CREATE" a="BRANCH">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Thêm cơ sở
              </Button>
            </Can>
            </div>
          </>
        }
      >
        Cơ sở
      </PageTitle>

      {branchesQuery.isError && (
        <Alert
          className="desktop-only mb-4! max-lg:mb-3!"
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
   <div className="mobile-only">
        {branchesQuery.isLoading ? (
          <BranchMobileSkeleton />
        ) : branchesQuery.isError ? (
          <BranchMobileError onRetry={() => void branchesQuery.refetch()} />
        ) : visibleRows.length === 0 ? (
          <BranchMobileEmpty filtered={isFiltered} />
        ) : (
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            {visibleRows.map((row) => (
              <BranchMobileCard key={row.id} row={row} visibleColumns={visibleColumns} />
            ))}
          </div>
        )}
      </div>
  {total > 0 && (
        <ListPagination page={page} limit={10} total={total} onChange={setPage} noun="cơ sở" />
      )}

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
    </MobileUI>
  )
}
