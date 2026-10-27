import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Avatar,
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
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { FilterOutlined, ReloadOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import ServiceImageField from '@/components/ServiceImageField'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { UserCreate } from '@/api/models/userCreate'
import type { PutUsersAdminIdBody } from '@/api/models/putUsersAdminIdBody'
import type { StaffProfileRow } from '@/api/models/staffProfileRow'
import { useDeleteUsersAdminId, usePostUsersAdmin, usePutUsersAdminId, useGetUsers } from '@/api/endpoints/users'
import { useGetRoles } from '@/api/endpoints/roles'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetService } from '@/api/endpoints/services'
import {
  useGetStaffProfiles,
  useGetStaffProfilesUserId,
  useGetStaffProfilesUserIdServices,
  usePutStaffProfilesUserId,
  usePutStaffProfilesUserIdServices,
} from '@/api/endpoints/staff-profiles'

interface StaffRow {
  id: string
  zalo_name?: string
  email?: string
  phone_number?: string
  is_admin?: boolean
  branch_id?: string | null
  is_active?: boolean
  user_roles?: { role_id?: string; role?: { role_name?: string } }[]
}

/** Nhận diện vai trò KTV (bỏ dấu, lowercase). */
function isTechnicianRole(roleName = ''): boolean {
  const normalized = roleName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  return normalized.includes('ktv') || normalized.includes('ky thuat vien') || normalized === 'technician'
}

const PAGE_SIZE = 10
type StaffColumnKey = 'staff' | 'role' | 'branch' | 'status' | 'phone' | 'email' | 'profile' | 'in_app'
const STAFF_COLUMN_OPTIONS: { label: string; value: StaffColumnKey }[] = [
  { label: 'Nhân viên', value: 'staff' },
  { label: 'Vai trò', value: 'role' },
  { label: 'Cơ sở', value: 'branch' },
  { label: 'Trạng thái', value: 'status' },
  { label: 'SĐT', value: 'phone' },
  { label: 'Email', value: 'email' },
  { label: 'Chức danh & dịch vụ phụ trách', value: 'profile' },
  { label: 'Hiện trên app', value: 'in_app' },
]
const DEFAULT_VISIBLE_COLUMNS = STAFF_COLUMN_OPTIONS.map((column) => column.value)

export default function Staffs() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<string>()
  const [roleFilter, setRoleFilter] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<string>()
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<StaffColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<StaffColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRow | null>(null)
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isAdmin = Form.useWatch('is_admin', form)
  const selectedRoleId = Form.useWatch('role_id', form)

  const usersQuery = useGetUsers({
    currentPage: page,
    pageSize,
    has_role: true,
    ...(search ? { q: search } : {}),
    ...(branchFilter ? { branch_id: branchFilter } : {}),
    ...(roleFilter ? { role_id: roleFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  })
  const rolesQuery = useGetRoles()
  const branchesQuery = useGetBranches()
  const createMutation = usePostUsersAdmin()
  const updateMutation = usePutUsersAdminId()
  const deleteMutation = useDeleteUsersAdminId()

  // KT — hồ sơ chuyên viên & dịch vụ phụ trách
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileUser, setProfileUser] = useState<StaffRow | null>(null)
  const [profileForm] = Form.useForm()
  const [servicesOpen, setServicesOpen] = useState(false)
  const [servicesUser, setServicesUser] = useState<StaffRow | null>(null)
  const [checkedServiceIds, setCheckedServiceIds] = useState<string[]>([])

  const staffProfilesQuery = useGetStaffProfiles(branchFilter ? { branch_id: branchFilter } : undefined)
  const profileRows = (pickData<StaffProfileRow[]>(staffProfilesQuery.data) ?? []) as StaffProfileRow[]
  const profileByUser = useMemo(() => new Map(profileRows.map((row) => [row.user_id, row])), [profileRows])
  const servicesQuery = useGetService({ is_active: true, limit: 200 })
  const serviceRows = (pickData<{ services?: { id: string; title?: string }[] }>(servicesQuery.data)?.services ?? []) as {
    id: string
    title?: string
  }[]
  const profileDetailQuery = useGetStaffProfilesUserId(profileUser?.id ?? 'none', {
    query: { enabled: profileOpen && !!profileUser },
  })
  const staffServicesQuery = useGetStaffProfilesUserIdServices(servicesUser?.id ?? 'none', {
    query: { enabled: servicesOpen && !!servicesUser },
  })
  const upsertProfileMutation = usePutStaffProfilesUserId()
  const assignServicesMutation = usePutStaffProfilesUserIdServices()

  useEffect(() => {
    if (!profileOpen) return
    const profile = pickData<StaffProfileRow>(profileDetailQuery.data)
    if (!profile) return
    profileForm.setFieldsValue({
      display_name: profile.display_name,
      title: profile.title ?? '',
      photo_file_id: profile.photo_file_id ?? '',
      expertise: profile.expertise ?? '',
      bio: profile.bio ?? '',
      sort_order: profile.sort_order ?? 0,
      show_in_app: profile.show_in_app !== false,
    })
  }, [profileOpen, profileDetailQuery.data, profileForm])

  useEffect(() => {
    if (!servicesOpen) return
    const data = pickData<{ service_ids?: string[] }>(staffServicesQuery.data)
    if (data) setCheckedServiceIds(data.service_ids ?? [])
  }, [servicesOpen, staffServicesQuery.data])

  // Legacy envelope: responseData = { count, rows, totalPages, currentPage }
  const usersPage = pickData<{ count?: number; rows?: StaffRow[] }>(usersQuery.data)
  const rows = (Array.isArray(usersPage) ? [] : usersPage?.rows ?? []) as StaffRow[]
  const total = Array.isArray(usersPage) ? 0 : usersPage?.count ?? rows.length

  const roleRows = (pickData<{ rows?: { id: string; role_name?: string; name?: string }[] }>(rolesQuery.data) as
    | { rows?: { id: string; role_name?: string; name?: string }[] }
    | undefined)?.rows ?? []
  const roles = roleRows.map((role) => ({ id: role.id, role_name: role.role_name ?? role.name ?? role.id }))
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]

  const loading = usersQuery.isLoading
  const selectedRoleName = roles.find((role) => role.id === selectedRoleId)?.role_name ?? ''
  const branchRequired = !isAdmin || !selectedRoleId || !roles.length || isTechnicianRole(selectedRoleName)
  const activeFilterCount = [branchFilter, roleFilter, statusFilter].filter(Boolean).length

  // Gõ tìm kiếm có debounce 400ms, quay về trang 1.
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput])

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({ branch_id: branchFilter, role_id: roleFilter, status: statusFilter })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (!draftVisibleColumns.length) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    setBranchFilter(typeof values.branch_id === 'string' ? values.branch_id : undefined)
    setRoleFilter(typeof values.role_id === 'string' ? values.role_id : undefined)
    setStatusFilter(typeof values.status === 'string' ? values.status : undefined)
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setBranchFilter(undefined)
    setRoleFilter(undefined)
    setStatusFilter(undefined)
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

  const openModal = (s?: StaffRow) => {
    setEditing(s ?? null)
    form.setFieldsValue(
      s
        ? {
            zalo_name: s.zalo_name,
            email: s.email,
            phone_number: s.phone_number,
            is_admin: s.is_admin,
            branch_id: s.branch_id ?? undefined,
            role_id: s.user_roles?.[0]?.role_id,
            password: '',
          }
        : {
            zalo_name: '',
            email: '',
            phone_number: '',
            password: '',
            role_id: undefined,
            is_admin: false,
            branch_id: branches.length === 1 ? branches[0].id : undefined,
          },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        // branch_id: gửi null tường minh để cho phép gỡ cơ sở (undefined = giữ nguyên)
        const payload: PutUsersAdminIdBody = {
          zalo_name: values.zalo_name,
          email: values.email,
          phone_number: values.phone_number,
          is_admin: values.is_admin,
          branch_id: (values.branch_id || null) as PutUsersAdminIdBody['branch_id'],
          role_id: values.role_id,
          ...(values.password ? { password: values.password } : {}),
        }
        await updateMutation.mutateAsync({ id: editing.id, data: payload })
        message.success(values.password ? 'Đã cập nhật chuyên viên và mật khẩu mới' : 'Đã cập nhật chuyên viên')
      } else {
        const payload: UserCreate = {
          email: values.email,
          phone_number: values.phone_number,
          password: values.password,
          role_id: values.role_id,
          full_name: values.zalo_name,
          is_admin: values.is_admin,
          branch_id: values.branch_id || undefined,
        }
        await createMutation.mutateAsync({ data: payload })
        message.success('Đã thêm chuyên viên')
      }
      setOpen(false)
      await usersQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  /** LIFE-01 — khóa mềm: giữ hồ sơ/lịch, thu hồi phiên; báo số lịch hẹn tương lai cần xử lý. */
  const deactivate = async (row: StaffRow) => {
    try {
      const result = await deleteMutation.mutateAsync({ id: row.id })
      const futureCount = Number(pickData<{ future_appointments?: number }>(result)?.future_appointments ?? 0)
      if (futureCount > 0) {
        message.warning(`Đã khóa tài khoản. Có ${futureCount} lịch hẹn tương lai cần phân công lại cho KTV khác.`)
      } else {
        message.success('Đã khóa tài khoản. Hồ sơ và lịch đã đặt được giữ nguyên.')
      }
      await usersQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const restore = async (row: StaffRow) => {
    try {
      await updateMutation.mutateAsync({ id: row.id, data: { is_active: true } })
      message.success('Đã khôi phục tài khoản. Lịch tuần cũ có hiệu lực trở lại.')
      await usersQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openProfile = (row: StaffRow) => {
    setProfileUser(row)
    profileForm.resetFields()
    setProfileOpen(true)
  }

  const submitProfile = async () => {
    if (!profileUser) return
    const values = await profileForm.validateFields()
    try {
      await upsertProfileMutation.mutateAsync({
        userId: profileUser.id,
        data: {
          display_name: values.display_name,
          title: values.title,
          photo_file_id: values.photo_file_id || null,
          expertise: values.expertise,
          bio: values.bio,
          sort_order: values.sort_order ?? 0,
          show_in_app: !!values.show_in_app,
        },
      })
      message.success('Đã lưu hồ sơ chuyên viên')
      setProfileOpen(false)
      await staffProfilesQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const toggleInApp = async (row: StaffRow, showInApp: boolean) => {
    try {
      await upsertProfileMutation.mutateAsync({ userId: row.id, data: { show_in_app: showInApp } })
      message.success(showInApp ? 'Đã hiện chuyên viên trên app' : 'Đã ẩn chuyên viên khỏi app')
      await staffProfilesQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openServices = (row: StaffRow) => {
    setServicesUser(row)
    setCheckedServiceIds([])
    setServicesOpen(true)
  }

  const submitServices = async () => {
    if (!servicesUser) return
    try {
      await assignServicesMutation.mutateAsync({ userId: servicesUser.id, data: { service_ids: checkedServiceIds } })
      message.success('Đã cập nhật dịch vụ phụ trách')
      setServicesOpen(false)
      await staffProfilesQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Button type="primary" onClick={() => openModal()}>
              Thêm chuyên viên
            </Button>
          </Space>
        }
      >
        Chuyên viên / KTV
      </PageTitle>
      {usersQuery.isError && (
        <div className="mb-4">
          <Typography.Text type="danger">Không tải được danh sách nhân viên: {errorMessage(usersQuery.error)}</Typography.Text>
        </div>
      )}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
          placeholder="Tìm theo tên, email, SĐT"
          style={{ width: 260 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Popover
          trigger="click"
          placement="bottomLeft"
          open={filterOpen}
          onOpenChange={openFilters}
          content={(
            <div className="flex w-[300px] flex-col" style={{ maxHeight: 'min(70vh, 580px)' }}>
              <div className="overflow-y-auto pr-1">
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Typography.Text strong>Cột hiển thị</Typography.Text>
                  <Tag style={{ marginInlineEnd: 0 }}>{draftVisibleColumns.length}/{STAFF_COLUMN_OPTIONS.length} cột</Tag>
                </Space>
                <Checkbox.Group
                  value={draftVisibleColumns}
                  onChange={(values) => setDraftVisibleColumns(values as StaffColumnKey[])}
                  style={{ display: 'grid', gap: 10 }}
                  options={STAFF_COLUMN_OPTIONS}
                />
                <Divider style={{ margin: '14px 0' }} />
                <Typography.Text strong>Điều kiện lọc</Typography.Text>
                <Form form={filterForm} layout="vertical" onFinish={applyFilters} style={{ marginTop: 10 }}>
                  <Form.Item name="branch_id" label="Cơ sở" style={{ marginBottom: 10 }}>
                    <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
                  </Form.Item>
                  <Form.Item name="role_id" label="Vai trò" style={{ marginBottom: 10 }}>
                    <Select allowClear placeholder="Tất cả vai trò" options={roles.map((role) => ({ value: role.id, label: role.role_name }))} />
                  </Form.Item>
                  <Form.Item name="status" label="Trạng thái" style={{ marginBottom: 0 }}>
                    <Select allowClear placeholder="Tất cả trạng thái" options={[
                      { value: 'active', label: 'Đang làm' },
                      { value: 'inactive', label: 'Đã nghỉ việc' },
                    ]} />
                  </Form.Item>
                </Form>
              </div>
              <div className="mt-3 flex justify-between gap-2 border-t border-[var(--brand-border-soft)] pt-3">
                <Button disabled={!activeFilterCount && visibleColumns.length === DEFAULT_VISIBLE_COLUMNS.length} onClick={clearFilters}>Xóa lọc</Button>
                <Button type="primary" onClick={() => filterForm.submit()}>Xác nhận</Button>
              </div>
            </div>
          )}
        >
          <Button icon={<FilterOutlined />}>Bộ lọc{activeFilterCount ? ` (${activeFilterCount})` : ''}</Button>
        </Popover>
        <Button icon={<ReloadOutlined />} onClick={() => void usersQuery.refetch()} />
      </Space>
      <Table<StaffRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        locale={{ emptyText: 'Chưa có nhân viên nào khớp điều kiện.' }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (t) => `Tổng ${t} nhân viên`,
          onChange: (p, ps) => { setPage(ps !== pageSize ? 1 : p); setPageSize(ps) },
        }}
        columns={[
          {
            title: 'Nhân viên',
            key: 'staff',
            dataIndex: 'zalo_name',
            render: (_: unknown, s: StaffRow) => {
              const photo = profileByUser.get(s.id)?.photo_file_id
              return (
                <Space>
                  {photo ? (
                    <img src={photo} alt="" width={36} height={36} style={{ objectFit: 'cover', borderRadius: 18 }} />
                  ) : (
                    <Avatar size={36} style={{ backgroundColor: 'var(--brand-primary)' }} icon={<UserOutlined />} />
                  )}
                  <span style={{ fontWeight: 600 }}>{s.zalo_name || s.email || '—'}</span>
                </Space>
              )
            },
          },
          {
            title: 'Vai trò',
            key: 'role',
            width: 220,
            render: (_: unknown, s: StaffRow) => (
              <Space size={4} wrap>
                <Tag color="purple">{s.user_roles?.[0]?.role?.role_name || 'Nhân viên'}</Tag>
                {s.is_admin && <Tag color="gold">Quản trị hệ thống</Tag>}
              </Space>
            ),
          },
          {
            title: 'Cơ sở',
            key: 'branch',
            dataIndex: 'branch_id',
            width: 150,
            render: (branchId: string | null | undefined, s: StaffRow) => {
              if (branchId) return branches.find((branch) => branch.id === branchId)?.name || 'Cơ sở'
              const hasTechnicianRole = s.user_roles?.some(({ role }) => isTechnicianRole(role?.role_name))
              return s.is_admin && !hasTechnicianRole ? 'Toàn hệ thống' : <Tag color="orange">Chưa gán</Tag>
            },
          },
          {
            title: 'Trạng thái',
            key: 'status',
            dataIndex: 'is_active',
            width: 120,
            render: (v: boolean | undefined) => (v === false ? <Tag>Đã nghỉ việc</Tag> : <Tag color="green">Đang làm</Tag>),
          },
          { title: 'SĐT', key: 'phone', dataIndex: 'phone_number', width: 150, render: (v: string | undefined) => v || '—' },
          { title: 'Email', key: 'email', dataIndex: 'email', render: (v: string | undefined) => v || '—' },
          {
            title: 'Chức danh & dịch vụ phụ trách',
            key: 'profile',
            width: 260,
            render: (_: unknown, s: StaffRow) => {
              const profile = profileByUser.get(s.id)
              const serviceTags = (profile?.service_ids ?? [])
                .map((serviceId) => serviceRows.find((service) => service.id === serviceId)?.title || 'Dịch vụ đã ẩn')
              return (
                <Space direction="vertical" size={4}>
                  <Typography.Text>{profile?.title || '—'}</Typography.Text>
                  <Space size={4} wrap>
                    {serviceTags.length
                      ? serviceTags.map((name, index) => <Tag key={`${s.id}-${index}`} color="blue">{name}</Tag>)
                      : <Typography.Text type="secondary">Chưa gán dịch vụ</Typography.Text>}
                  </Space>
                </Space>
              )
            },
          },
          {
            title: 'Hiện trên app',
            key: 'in_app',
            width: 120,
            render: (_: unknown, s: StaffRow) => {
              const profile = profileByUser.get(s.id)
              return (
                <Switch
                  checked={profile?.show_in_app !== false}
                  size="small"
                  loading={upsertProfileMutation.isPending}
                  onChange={(checked) => void toggleInApp(s, checked)}
                />
              )
            },
          },
          {
            title: 'Thao tác',
            key: 'actions',
            width: 280,
            render: (_: unknown, s: StaffRow) => (
              <Space size={4} wrap>
                <Button size="small" onClick={() => openModal(s)}>
                  Sửa
                </Button>
                <Button size="small" onClick={() => openProfile(s)}>
                  Hồ sơ
                </Button>
                <Button size="small" onClick={() => openServices(s)}>
                  Dịch vụ
                </Button>
                {s.is_active === false ? (
                  <Popconfirm
                    title="Khôi phục tài khoản này?"
                    description="Nhân viên sẽ đăng nhập lại được và lịch tuần cũ có hiệu lực trở lại."
                    okText="Khôi phục"
                    cancelText="Hủy"
                    onConfirm={() => restore(s)}
                  >
                    <Button size="small">Khôi phục</Button>
                  </Popconfirm>
                ) : (
                  <Popconfirm
                    title="Khóa tài khoản nhân viên này?"
                    description="Thu hồi phiên đăng nhập, không còn xuất hiện khi xếp ca/slot mới. Hồ sơ và lịch hẹn đã đặt được giữ nguyên."
                    okText="Khóa"
                    cancelText="Hủy"
                    onConfirm={() => deactivate(s)}
                  >
                    <Button size="small" danger>
                      Khóa
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ].filter((column) => column.key === 'actions' || visibleColumns.includes(column.key as StaffColumnKey))}
      />

      <Modal
        title={editing ? 'Sửa chuyên viên' : 'Thêm chuyên viên'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="zalo_name" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="VD: Trần Hoa" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, message: 'Nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]}
              >
                <Input placeholder="nhanvien@vista.vn" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="branch_id"
                label="Cơ sở"
                rules={branchRequired ? [{ required: true, message: 'Chọn cơ sở cho nhân viên/KTV' }] : []}
                extra={branchRequired ? undefined : 'Để trống nếu tài khoản quản trị cần truy cập toàn hệ thống.'}
              >
                <Select
                  style={{ width: '100%' }}
                  allowClear={!branchRequired}
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                  placeholder={branchRequired ? 'Chọn cơ sở' : 'Chọn cơ sở hoặc để trống'}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="phone_number"
                label="SĐT (đăng nhập)"
                rules={[{ required: true, message: 'Nhập SĐT' }]}
              >
                <Input placeholder="0901 111 222" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              {editing ? (
                <Form.Item
                  name="password"
                  label="Mật khẩu mới"
                  extra="Để trống nếu không đổi mật khẩu."
                >
                  <Input.Password placeholder="••••••••" autoComplete="new-password" />
                </Form.Item>
              ) : (
                <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              )}
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="role_id" label="Vai trò" rules={[{ required: true, message: 'Chọn vai trò' }]}>
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  options={roles.map((r) => ({ value: r.id, label: r.role_name }))}
                  placeholder="Chọn vai trò"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="is_admin" label="Quyền admin hệ thống">
                <Select
                  style={{ width: 130 }}
                  options={[
                    { value: true, label: 'Có' },
                    { value: false, label: 'Không' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`Hồ sơ chuyên viên — ${profileUser?.zalo_name || profileUser?.email || ''}`}
        open={profileOpen}
        onCancel={() => setProfileOpen(false)}
        onOk={() => void submitProfile()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={upsertProfileMutation.isPending}
      >
        <Form form={profileForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="display_name"
            label="Tên hiển thị trên app"
            rules={[{ required: true, whitespace: true, message: 'Nhập tên hiển thị' }]}
          >
            <Input maxLength={255} placeholder="VD: KTV Minh" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="title" label="Chức danh">
                <Input maxLength={255} placeholder="VD: Chuyên viên da liễu" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="expertise" label="Chuyên môn chính">
                <Input maxLength={500} placeholder="VD: Trị mụn, trẻ hóa" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="bio" label="Giới thiệu tóm tắt">
            <Input.TextArea rows={3} maxLength={2000} placeholder="Tiểu sử ngắn hiển thị trên Mini App" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="photo_file_id" label="Ảnh đại diện">
                <ServiceImageField />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="sort_order" label="Thứ tự sắp xếp" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="show_in_app" label="Hiển thị trên Mini App" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Dịch vụ phụ trách — ${servicesUser?.zalo_name || servicesUser?.email || ''}`}
        open={servicesOpen}
        onCancel={() => setServicesOpen(false)}
        onOk={() => void submitServices()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={assignServicesMutation.isPending}
        okButtonProps={{ disabled: staffServicesQuery.isLoading }}
      >
        {staffServicesQuery.isLoading ? (
          <Typography.Text type="secondary">Đang tải dịch vụ hiện tại…</Typography.Text>
        ) : (
          <Checkbox.Group
            value={checkedServiceIds}
            onChange={(values) => setCheckedServiceIds(values as string[])}
            style={{ display: 'grid', gap: 8, maxHeight: '50vh', overflowY: 'auto', marginTop: 8 }}
            options={serviceRows.map((service) => ({ value: service.id, label: service.title || service.id }))}
          />
        )}
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
          Lưu sẽ thay thế toàn bộ danh sách dịch vụ KTV này phụ trách. Danh sách dùng để lọc KTV khi đặt lịch.
        </Typography.Text>
      </Modal>
    </>
  )
}
