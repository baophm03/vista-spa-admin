import { useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, EditOutlined, PauseCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { BranchUpdate } from '@/api/models/branchUpdate'
import {
  getGetBranchesQueryKey,
  useDeleteBranchesId,
  useGetBranches,
  usePostBranches,
  usePostBranchesIdActivate,
  usePutBranchesId,
} from '@/api/endpoints/branches'
import { usePermissions } from '@/utils/permissions'
import { useQueryClient } from '@tanstack/react-query'

interface BranchFormValues {
  code: string
  name: string
  address?: string
  phone?: string
}

type StatusFilter = 'all' | 'active' | 'inactive'

/** So sánh không dấu, bỏ đ (search tiếng Việt). */
const foldForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')

export default function Branches() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [form] = Form.useForm<BranchFormValues>()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const canCreate = can('branch.create')
  const canUpdate = can('branch.update')
  const canDelete = can('branch.delete')

  const branchesQuery = useGetBranches(statusFilter === 'all' ? undefined : { status: statusFilter })
  const createMutation = usePostBranches()
  const updateMutation = usePutBranchesId()
  const deactivateMutation = useDeleteBranchesId()
  const activateMutation = usePostBranchesIdActivate()

  const rows = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetBranchesQueryKey() })

  const visibleRows = useMemo(() => {
    const keyword = foldForSearch(search.trim())
    return rows.filter((row) => {
      if (statusFilter === 'active' && !row.is_active) return false
      if (statusFilter === 'inactive' && row.is_active) return false
      return !keyword || foldForSearch(`${row.code} ${row.name}`).includes(keyword)
    })
  }, [rows, search, statusFilter])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ code: '', name: '', address: '', phone: '' })
    setOpen(true)
  }

  const openEdit = (branch: Branch) => {
    setEditing(branch)
    form.resetFields()
    form.setFieldsValue({
      code: branch.code,
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
      code: values.code.trim(),
      name: values.name.trim(),
      address: values.address?.trim() ?? '',
      phone: values.phone?.trim() ?? '',
    }

    try {
      if (editing) {
        const body: BranchUpdate = {
          code: payload.code,
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

  const columns = [
    {
      title: 'Mã cơ sở',
      dataIndex: 'code',
      width: 130,
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      title: 'Tên cơ sở',
      dataIndex: 'name',
      width: 210,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Địa chỉ',
      dataIndex: 'address',
      render: (value?: string) => value?.trim() || '—',
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      width: 160,
      render: (value?: string) => value?.trim() || '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      width: 140,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? 'Đang hoạt động' : 'Đã ngừng'}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 220,
      align: 'right' as const,
      render: (_: unknown, row: Branch) => (
        <Space wrap size={6}>
          {canUpdate && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
              Sửa
            </Button>
          )}
          {canDelete && row.is_active && (
            <Button size="small" danger icon={<PauseCircleOutlined />} onClick={() => confirmStatusChange(row, false)}>
              Ngừng
            </Button>
          )}
          {canDelete && !row.is_active && (
            <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />} onClick={() => confirmStatusChange(row, true)}>
              Kích hoạt
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageTitle>Cơ sở</PageTitle>

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

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <Select<StatusFilter>
            aria-label="Lọc theo trạng thái cơ sở"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 190, maxWidth: '100%' }}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'inactive', label: 'Đã ngừng' },
            ]}
          />
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#A9ADB2' }} />}
            placeholder="Tìm theo mã hoặc tên cơ sở"
            aria-label="Tìm theo mã hoặc tên cơ sở"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 250, maxWidth: '100%' }}
          />
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm cơ sở
            </Button>
          )}
        </div>

        <Table<Branch>
          rowKey="id"
          loading={branchesQuery.isLoading}
          dataSource={visibleRows}
          columns={columns}
          scroll={{ x: 980 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total) => `Tổng ${total} cơ sở`,
          }}
          locale={{
            emptyText: search.trim() || statusFilter !== 'all' ? 'Không tìm thấy cơ sở phù hợp' : 'Chưa có cơ sở nào',
          }}
        />
      </Card>

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
          <Form.Item
            name="code"
            label="Mã cơ sở"
            rules={[
              { required: true, whitespace: true, message: 'Nhập mã cơ sở' },
              { max: 10, message: 'Mã cơ sở tối đa 10 ký tự' },
            ]}
            extra={editing ? 'Không thể đổi mã nếu cơ sở đã có khách.' : undefined}
          >
            <Input maxLength={10} autoComplete="off" />
          </Form.Item>
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
