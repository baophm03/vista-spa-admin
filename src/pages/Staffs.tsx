import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Avatar,
  Button,
  Checkbox,
  Col,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useAbility } from '@casl/react'
import {
  AppstoreOutlined,
  EditOutlined,
  LockOutlined,
  PlusOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SearchOutlined,
  UndoOutlined,
  UserOutlined,
} from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import ServiceImageField from '@/components/ServiceImageField'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { UserCreate } from '@/api/models/userCreate'
import type { PutUsersAdminIdBody } from '@/api/models/putUsersAdminIdBody'
import type { StaffProfileRow } from '@/api/models/staffProfileRow'
import { useProfileStore } from '@/stores/profile-store'
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
  branch_id?: string | null
  is_active?: boolean
  user_roles?: { role_id?: string; role?: { role_name?: string; code?: string | null } }[]
}

/** Nhận diện vai trò KTV (bỏ dấu, lowercase). */
function isTechnicianRole(code?: string | null): boolean {
  return String(code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'ktv'
}

/** Nhận diện vai trò Admin hệ thống qua mã vai trò (roles.code = 'admin'). */
function isAdminRole(code?: string | null): boolean {
  return String(code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'admin'
}

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
  const ability = useAbility()
  const currentUser = useProfileStore((state) => state.profile)
  const isPlatformAdmin = !!currentUser?.is_admin
  const canReadStaffProfile = isPlatformAdmin || ability.can('READ', 'STAFF_PROFILE')
  const canUpdateStaffProfile = isPlatformAdmin || ability.can('UPDATE', 'STAFF_PROFILE')
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
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
  const selectedRoleId = Form.useWatch('role_id', form)

  const usersQuery = useGetUsers({
    currentPage: page,
    pageSize: limit,
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

  const staffProfilesQuery = useGetStaffProfiles(branchFilter ? { branch_id: branchFilter } : undefined, {
    query: { enabled: canReadStaffProfile },
  })
  const profileRows = (pickData<StaffProfileRow[]>(staffProfilesQuery.data) ?? []) as StaffProfileRow[]
  const profileByUser = useMemo(() => new Map(profileRows.map((row) => [row.user_id, row])), [profileRows])
  const servicesQuery = useGetService({ is_active: true, limit: 200 })
  const serviceRows = (pickData<{ services?: { id: string; title?: string }[] }>(servicesQuery.data)?.services ?? []) as {
    id: string
    title?: string
  }[]
  const profileDetailQuery = useGetStaffProfilesUserId(profileUser?.id ?? 'none', {
    query: { enabled: profileOpen && !!profileUser && canReadStaffProfile },
  })
  const staffServicesQuery = useGetStaffProfilesUserIdServices(servicesUser?.id ?? 'none', {
    query: { enabled: servicesOpen && !!servicesUser && canUpdateStaffProfile },
  })
  const profileDetails = pickData<StaffProfileRow>(profileDetailQuery.data)
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

  const roleRows = (pickData<{ rows?: { id: string; role_name?: string; name?: string; code?: string | null }[] }>(rolesQuery.data) as
    | { rows?: { id: string; role_name?: string; name?: string; code?: string | null }[] }
    | undefined)?.rows ?? []
  const roles = roleRows.map((role) => ({ id: role.id, role_name: role.role_name ?? role.name ?? role.id, code: role.code ?? null }))
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]

  const loading = usersQuery.isLoading
  const selectedRole = roles.find((role) => role.id === selectedRoleId)
  // Vai trò Admin làm việc toàn hệ thống, không bắt buộc cơ sở
  const branchRequired = !selectedRoleId || !roles.length || !isAdminRole(selectedRole?.code)
  const activeFilterCount = [branchFilter, roleFilter, statusFilter].filter(Boolean).length + (search ? 1 : 0)

  // Gõ tìm kiếm có debounce 400ms, quay về trang 1.
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput])

  /** Áp dụng ngay từ khóa (Enter hoặc khi xóa hết) mà không chờ debounce. */
  const applySearch = (value: string) => {
    clearTimeout(debounceRef.current)
    setSearchInput(value)
    setSearch(value.trim())
    setPage(1)
  }

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
    if (!isPlatformAdmin) return
    setEditing(s ?? null)
    form.setFieldsValue(
      s
        ? {
            zalo_name: s.zalo_name,
            email: s.email,
            phone_number: s.phone_number,
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
            branch_id: branches.length === 1 ? branches[0].id : undefined,
          },
    )
    setOpen(true)
  }

  const submit = async () => {
    if (!isPlatformAdmin) return
    const values = await form.validateFields()
    try {
      if (editing) {
        // branch_id: gửi null tường minh để cho phép gỡ cơ sở (undefined = giữ nguyên)
        const payload: PutUsersAdminIdBody = {
          zalo_name: values.zalo_name,
          email: values.email,
          phone_number: values.phone_number,
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
    if (!isPlatformAdmin) return
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
    if (!isPlatformAdmin) return
    try {
      await updateMutation.mutateAsync({ id: row.id, data: { is_active: true } })
      message.success('Đã khôi phục tài khoản. Lịch tuần cũ có hiệu lực trở lại.')
      await usersQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openProfile = (row: StaffRow) => {
    if (!canReadStaffProfile) return
    setProfileUser(row)
    profileForm.resetFields()
    setProfileOpen(true)
  }

  const submitProfile = async () => {
    if (!profileUser || !canUpdateStaffProfile) return
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
    if (!canUpdateStaffProfile) return
    try {
      await upsertProfileMutation.mutateAsync({ userId: row.id, data: { show_in_app: showInApp } })
      message.success(showInApp ? 'Đã hiện chuyên viên trên app' : 'Đã ẩn chuyên viên khỏi app')
      await staffProfilesQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openServices = (row: StaffRow) => {
    if (!canUpdateStaffProfile) return
    setServicesUser(row)
    setCheckedServiceIds([])
    setServicesOpen(true)
  }

  const submitServices = async () => {
    if (!servicesUser || !canUpdateStaffProfile) return
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
        subtitle="Quản lý thông tin và vai trò của nhân viên"
        extra={
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
              placeholder="Tìm theo tên, email, SĐT"
              style={{ width: 260 }}
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                if (!e.target.value) applySearch('')
              }}
              onPressEnter={() => applySearch(searchInput)}
            />
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={openFilters}
              activeFilterCount={activeFilterCount}
              form={filterForm}
              onApply={applyFilters}
              onClear={clearFilters}
              columnOptions={STAFF_COLUMN_OPTIONS}
              draftVisibleColumns={draftVisibleColumns}
              onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as StaffColumnKey[])}
              filterItems={(
                <>
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
                </>
              )}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void usersQuery.refetch()} />
            {isPlatformAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                Thêm chuyên viên
              </Button>
            )}
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
      <Table<StaffRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        locale={{ emptyText: <TableEmpty description="Chưa có nhân viên nào khớp điều kiện." /> }}
        scroll={{ x: 1240 }}
        pagination={false}
        columns={[
          {
            title: 'Nhân viên',
            key: 'staff',
            dataIndex: 'zalo_name',
            width: 180,
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
            width: 155,
            render: (_: unknown, s: StaffRow) => (
              <Space size={4} wrap>
                <Tag color="purple">{s.user_roles?.[0]?.role?.role_name || 'Nhân viên'}</Tag>
                {s.user_roles?.some(({ role }) => isAdminRole(role?.code)) && <Tag color="gold">Quản trị hệ thống</Tag>}
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
              const hasTechnicianRole = s.user_roles?.some(({ role }) => isTechnicianRole(role?.code))
              const hasAdminRoleTag = s.user_roles?.some(({ role }) => isAdminRole(role?.code))
              return hasAdminRoleTag && !hasTechnicianRole ? 'Toàn hệ thống' : <Tag color="orange">Chưa gán</Tag>
            },
          },
          {
            title: 'Trạng thái',
            key: 'status',
            dataIndex: 'is_active',
            width: 100,
            render: (v: boolean | undefined) => (v === false ? <Tag>Đã nghỉ việc</Tag> : <Tag color="green">Đang làm</Tag>),
          },
          { title: 'SĐT', key: 'phone', dataIndex: 'phone_number', width: 130, render: (v: string | undefined) => v || '—' },
          { title: 'Email', key: 'email', dataIndex: 'email', width: 185, ellipsis: true, render: (v: string | undefined) => v || '—' },
          {
            title: 'Chức danh & dịch vụ phụ trách',
            key: 'profile',
            width: 230,
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
            width: 100,
            render: (_: unknown, s: StaffRow) => {
              const profile = profileByUser.get(s.id)
              if (!canUpdateStaffProfile) {
                return (
                  <Tag color={profile?.show_in_app === false ? 'default' : 'green'}>
                    {profile?.show_in_app === false ? 'Đã ẩn' : 'Đang hiện'}
                  </Tag>
                )
              }
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
            title: 'Hành động',
            key: 'actions',
            width: 90,
            fixed: 'right' as const,
            render: (_: unknown, s: StaffRow) => {
              const actionItems = [
                ...(isPlatformAdmin ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
                ...(canReadStaffProfile ? [{ key: 'profile', icon: <ProfileOutlined />, label: canUpdateStaffProfile ? 'Hồ sơ' : 'Xem hồ sơ' }] : []),
                ...(canUpdateStaffProfile ? [{ key: 'services', icon: <AppstoreOutlined />, label: 'Dịch vụ' }] : []),
                ...(isPlatformAdmin
                  ? s.is_active === false
                    ? [{ key: 'restore', icon: <UndoOutlined />, label: 'Khôi phục' }]
                    : [{ key: 'deactivate', icon: <LockOutlined />, danger: true, label: 'Khóa' }]
                  : []),
              ]
              if (!actionItems.length) return <Typography.Text type="secondary">—</Typography.Text>
              return (
                <RowActionsMenu
                  items={actionItems}
                  onSelect={(key) => {
                    if (key === 'edit') openModal(s)
                    else if (key === 'profile') openProfile(s)
                    else if (key === 'services') openServices(s)
                    else if (key === 'restore') {
                      Modal.confirm({
                        title: 'Khôi phục tài khoản này?',
                        content: 'Nhân viên sẽ đăng nhập lại được và lịch tuần cũ có hiệu lực trở lại.',
                        okText: 'Khôi phục',
                        cancelText: 'Hủy',
                        onOk: () => restore(s),
                      })
                    } else if (key === 'deactivate') {
                      Modal.confirm({
                        title: 'Khóa tài khoản nhân viên này?',
                        content: 'Thu hồi phiên đăng nhập, không còn xuất hiện khi xếp ca/slot mới. Hồ sơ và lịch hẹn đã đặt được giữ nguyên.',
                        okText: 'Khóa',
                        okButtonProps: { danger: true },
                        cancelText: 'Hủy',
                        onOk: () => deactivate(s),
                      })
                    }
                  }}
                />
              )
            },
          },
        ].filter((column) => column.key === 'actions' || visibleColumns.includes(column.key as StaffColumnKey))}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="nhân viên" />

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
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`Hồ sơ chuyên viên — ${profileUser?.zalo_name || profileUser?.email || ''}`}
        open={profileOpen}
        onCancel={() => setProfileOpen(false)}
        onOk={canUpdateStaffProfile ? () => void submitProfile() : undefined}
        footer={canUpdateStaffProfile ? undefined : <Button onClick={() => setProfileOpen(false)}>Đóng</Button>}
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
            <Input disabled={!canUpdateStaffProfile} maxLength={255} placeholder="VD: KTV Minh" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="title" label="Chức danh">
                <Input disabled={!canUpdateStaffProfile} maxLength={255} placeholder="VD: Chuyên viên da liễu" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="expertise" label="Chuyên môn chính">
                <Input disabled={!canUpdateStaffProfile} maxLength={500} placeholder="VD: Trị mụn, trẻ hóa" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="bio" label="Giới thiệu tóm tắt">
            <Input.TextArea disabled={!canUpdateStaffProfile} rows={3} maxLength={2000} placeholder="Tiểu sử ngắn hiển thị trên Mini App" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              {canUpdateStaffProfile ? (
                <Form.Item name="photo_file_id" label="Ảnh đại diện">
                  <ServiceImageField />
                </Form.Item>
              ) : (
                <Form.Item label="Ảnh đại diện">
                  {profileDetails?.photo_file_id ? (
                    <Image src={profileDetails.photo_file_id} alt="Ảnh đại diện KTV" width={72} height={72} style={{ objectFit: 'cover', borderRadius: 6 }} />
                  ) : <Typography.Text type="secondary">Chưa có ảnh</Typography.Text>}
                </Form.Item>
              )}
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="sort_order" label="Thứ tự sắp xếp" initialValue={0}>
                <InputNumber disabled={!canUpdateStaffProfile} min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="show_in_app" label="Hiển thị trên Mini App" valuePropName="checked" initialValue={true}>
            <Switch disabled={!canUpdateStaffProfile} />
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
