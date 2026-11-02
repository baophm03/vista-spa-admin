import { useMemo, useState } from 'react'
import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, EditOutlined, EnvironmentOutlined, PauseCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { paginateRows } from '@/utils/listTable'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { BranchUpdate } from '@/api/models/branchUpdate'
import {
  getGetBranchesNextCodeQueryKey,
  getGetBranchesQueryKey,
  useDeleteBranchesId,
  useGetBranches,
  useGetBranchesNextCode,
  usePostBranches,
  usePostBranchesIdActivate,
  usePutBranchesId,
} from '@/api/endpoints/branches'
import { Can, useAbility } from '@casl/react'
import { useQueryClient } from '@tanstack/react-query'

interface BranchFormValues {
  name: string
  address?: string
  phone?: string
}

type StatusFilter = 'all' | 'active' | 'inactive'

type BranchColumnKey = 'code' | 'name' | 'address' | 'phone' | 'status'

const BRANCH_COLUMN_OPTIONS: { label: string; value: BranchColumnKey }[] = [
  { label: 'Mã cơ sở', value: 'code' },
  { label: 'Tên cơ sở', value: 'name' },
  { label: 'Địa chỉ', value: 'address' },
  { label: 'Số điện thoại', value: 'phone' },
  { label: 'Trạng thái', value: 'status' },
]

const DEFAULT_VISIBLE_COLUMNS = BRANCH_COLUMN_OPTIONS.map((column) => column.value)

/** So sánh không dấu, bỏ đ (search tiếng Việt). */
const foldForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')

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
  const queryClient = useQueryClient()
  const { isAdmin, isReceptionist, isTechnician } = useCustomerProfileAccess()
  const hideSummaryForTechnician = isTechnician && !isAdmin && !isReceptionist

  const branchesQuery = useGetBranches(statusFilter === 'all' ? undefined : { status: statusFilter })
  const nextCodeQuery = useGetBranchesNextCode({ query: { enabled: open && !editing } })
  const nextCode = pickData<{ code?: string }>(nextCodeQuery.data)?.code
  const createMutation = usePostBranches()
  const updateMutation = usePutBranchesId()
  const deactivateMutation = useDeleteBranchesId()
  const activateMutation = usePostBranchesIdActivate()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'BRANCH')
  const canDelete = ability.can('DELETE', 'BRANCH')

  const rows = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetBranchesQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetBranchesNextCodeQueryKey() })
  }

  const visibleRows = useMemo(() => {
    const term = foldForSearch(keyword.trim())
    return rows.filter((row) => {
      if (statusFilter === 'active' && !row.is_active) return false
      if (statusFilter === 'inactive' && row.is_active) return false
      return !term || foldForSearch(`${row.code} ${row.name}`).includes(term)
    })
  }, [rows, keyword, statusFilter])

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setKeyword(nextKeyword.trim())
    setPage(1)
  }

  // Thống kê đầu trang — chỉ đáng tin khi không lọc trạng thái phía server (khi đó rows là danh sách đầy đủ)
  const statItems = useMemo<StatItem[]>(() => {
    if (hideSummaryForTechnician) return []
    if (statusFilter !== 'all') return []
    const activeCount = rows.filter((row) => !!row.is_active).length
    return [
      { key: 'total', label: 'Tổng cơ sở', value: rows.length.toLocaleString('vi-VN'), icon: <EnvironmentOutlined />, tone: 'primary' },
      { key: 'active', label: 'Đang hoạt động', value: activeCount.toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
      { key: 'inactive', label: 'Đã ngừng', value: (rows.length - activeCount).toLocaleString('vi-VN'), icon: <PauseCircleOutlined />, tone: 'neutral' },
    ]
  }, [rows, statusFilter, hideSummaryForTechnician])

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
    form.setFieldsValue({ name: '', address: '', phone: '' })
    setOpen(true)
  }

  const openEdit = (branch: Branch) => {
    setEditing(branch)
    form.resetFields()
    form.setFieldsValue({
      name: branch.name,
      address: branch.address ?? '',
      phone: branch.phone ?? '',
    })
    setOpen(true)
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
    }

    try {
      if (editing) {
        const body: BranchUpdate = {
          name: payload.name,
          address: payload.address,
          phone: payload.phone,
        }
        await updateMutation.mutateAsync({ id: editing.id, data: body })
        message.success('Đã cập nhật cơ sở')
      } else {
        await createMutation.mutateAsync({ data: payload })
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

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (keyword ? 1 : 0)

  const columns = [
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
      title: 'Hành động',
      width: 90,
      fixed: 'right' as const,
      render: (_: unknown, row: Branch) => (
        <RowActionsMenu
          items={[
            ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
            ...(canDelete
              ? [row.is_active
                  ? { key: 'deactivate', icon: <PauseCircleOutlined />, danger: true, label: 'Ngừng' }
                  : { key: 'activate', icon: <CheckCircleOutlined />, label: 'Kích hoạt' }]
              : []),
          ]}
          onSelect={(key) => {
            if (key === 'edit') openEdit(row)
            else if (key === 'deactivate') confirmStatusChange(row, false)
            else if (key === 'activate') confirmStatusChange(row, true)
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
      <StatCards items={statItems} />

      <PageTitle
        subtitle="Danh sách cơ sở spa trong hệ thống"
        extra={
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
              placeholder="Tìm theo mã hoặc tên cơ sở"
              style={{ width: 260 }}
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
                <Form.Item name="status" label="Trạng thái" style={{ marginBottom: 0 }}>
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
          </Space>
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
        rowKey="id"
        loading={branchesQuery.isLoading}
        dataSource={paginateRows(visibleRows, page, 10)}
        columns={columns}
        scroll={{ x: 980 }}
        pagination={false}
        locale={{
          emptyText: <TableEmpty description={keyword.trim() || statusFilter !== 'all' ? 'Không tìm thấy cơ sở phù hợp' : 'Chưa có cơ sở nào'} />,
        }}
      />
      <ListPagination page={page} limit={10} total={visibleRows.length} onChange={setPage} noun="cơ sở" />

      <Modal
        title={editing ? 'Sửa thông tin cơ sở' : 'Thêm cơ sở'}
        open={open}
        onCancel={closeModal}
        onOk={() => void submit()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {editing ? (
            <Form.Item label="Mã cơ sở" extra="Mã do hệ thống tự sinh, không thể chỉnh sửa.">
              <Typography.Text code>{editing.code}</Typography.Text>
            </Form.Item>
          ) : (
            <Form.Item
              label="Mã cơ sở"
              extra="Hệ thống tự sinh mã theo quy tắc CS01, CS02, …; mã hiển thị là dự kiến, mã thật được gán khi lưu."
            >
              <Input disabled placeholder="Tự sinh khi lưu" value={nextCode} />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="Tên cơ sở"
            rules={[
              { required: true, whitespace: true, message: 'Nhập tên cơ sở' },
              { max: 255, message: 'Tên cơ sở tối đa 255 ký tự' },
            ]}
          >
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ" rules={[{ max: 500, message: 'Địa chỉ tối đa 500 ký tự' }]}>
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ max: 20, message: 'Số điện thoại tối đa 20 ký tự' }]}>
            <Input maxLength={20} inputMode="tel" autoComplete="tel" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
