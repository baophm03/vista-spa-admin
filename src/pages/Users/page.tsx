import ResponsiveTable from '@/components/base/ResponsiveTable'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Avatar, Button, Form, Input, Modal, Select, Space, Switch, Tag, Typography, message } from 'antd'
import { useAbility } from '@casl/react'
import {
  EditOutlined,
  LockOutlined,
  PlusOutlined,
  ProfileOutlined,
  UndoOutlined,
  UserOutlined,
} from '@ant-design/icons'
import MobileUI from '@/components/base/MobileUI'
import PageTitle from '@/components/base/PageTitle'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { UserCreate } from '@/api/models/userCreate'
import type { PutUsersIdAdminBody } from '@/api/models/putUsersIdAdminBody'
import type { StaffProfile } from '@/api/models/staffProfile'
import { useProfileStore } from '@/stores/profile-store'
import { getGetUsersAdminQueryKey, useDeleteUsersIdAdmin, usePostUsersAdmin, usePutUsersIdAdmin, useGetUsersAdmin } from '@/api/endpoints/users'
import { useGetRolesAdmin } from '@/api/endpoints/roles'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { fileSrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import { useGetUsersStaffAdmin, useGetUsersStaffIdAdmin, usePutUsersStaffIdAdmin } from '@/api/endpoints/staff'

import UserModal from './components/UserModal'
import UserProfileModal from './components/UserProfileModal'
import {
  isAdminRole,
  isUserRole,
  roleTagColor,
  type UserRow,
} from './components/constants'

export default function Users() {
  const queryClient = useQueryClient()
  const ability = useAbility()
  const urlMap = useFileUrlMap()
  const currentUser = useProfileStore((state) => state.profile)
  const isPlatformAdmin = !!currentUser?.is_admin
  const isSuperAdmin = !!currentUser?.is_super_admin
  const currentUserRoleNames = currentUser?.roles ?? []
  const currentUserRoleRows = (currentUser?.user_roles ?? []) as { role?: { code?: string | null } | null }[]
  const isBranchAdmin = !isPlatformAdmin && (
    currentUserRoleNames.some((role) => role.trim().toLowerCase() === 'admin') ||
    currentUserRoleRows.some(({ role }) => isAdminRole(role?.code))
  )
  const currentBranchId = typeof currentUser?.branch_id === 'string' ? currentUser.branch_id : undefined
  const canReadUserProfile = isPlatformAdmin || ability.can('READ', 'User_PROFILE')
  const canUpdateUserProfile = isPlatformAdmin || ability.can('UPDATE', 'User_PROFILE')
  const canCreateUser = isSuperAdmin
  const isGlobalAdminRow = (row: UserRow) => Boolean(
    row.is_admin || (!row.branch_id && row.user_roles?.some(({ role }) => isAdminRole(role?.code))),
  )
  const isHighestAdminRow = (row: UserRow) => Boolean(
    row.is_super_admin || (!row.branch_id && row.user_roles?.some(({ role }) => isAdminRole(role?.code))),
  )
  const canManageUserRow = (row: UserRow) => {
    const targetIsAdminRole = row.user_roles?.some(({ role }) => isAdminRole(role?.code)) ?? false
    const targetIsGlobalAdmin = isGlobalAdminRow(row)
    const targetIsHighestAdmin = isHighestAdminRow(row)
    if (isSuperAdmin) return !targetIsHighestAdmin || row.id === currentUser?.id
    if (isPlatformAdmin) return !targetIsHighestAdmin && !targetIsGlobalAdmin && !targetIsAdminRole
    return Boolean(
      isBranchAdmin && currentBranchId && row.branch_id === currentBranchId &&
      !row.is_admin && !row.is_super_admin && !targetIsAdminRole,
    )
  }
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<string>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [form] = Form.useForm()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const usersQuery = useGetUsersAdmin({
    currentPage: page,
    pageSize: limit,
    has_role: true,
    ...(search ? { q: search } : {}),
    ...(branchFilter ? { branch_id: branchFilter } : {}),
  })
  const rolesQuery = useGetRolesAdmin()
  const branchesQuery = useGetBranchesAdmin()
  const createMutation = usePostUsersAdmin()
  const updateMutation = usePutUsersIdAdmin()
  const deleteMutation = useDeleteUsersIdAdmin()

  // KT — hồ sơ chuyên viên & dịch vụ phụ trách
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileUser, setProfileUser] = useState<UserRow | null>(null)
  const [profileForm] = Form.useForm()

  const UserProfilesQuery = useGetUsersStaffAdmin(branchFilter ? { branch_id: branchFilter } : undefined, {
    query: { enabled: canReadUserProfile },
  })
  const profileRows = (pickData<StaffProfile[]>(UserProfilesQuery.data) ?? []) as StaffProfile[]
  const profileByUser = useMemo(() => new Map(profileRows.map((row) => [row.user_id, row])), [profileRows])
  const profileDetailQuery = useGetUsersStaffIdAdmin(profileUser?.id ?? 'none', {
    query: { enabled: profileOpen && !!profileUser && canReadUserProfile },
  })
  const profileDetails = pickData<StaffProfile>(profileDetailQuery.data)
  const upsertProfileMutation = usePutUsersStaffIdAdmin()

  useEffect(() => {
    if (!profileOpen) return
    const profile = pickData<StaffProfile>(profileDetailQuery.data)
    if (!profile) return
    profileForm.setFieldsValue({
      display_name: profile.display_name,
      title: profile.title ?? '',
      photo_file_id: (profile as any).photo_file?.id ?? profile.photo_file_id ?? '',
      expertise: profile.expertise ?? '',
      bio: profile.bio ?? '',
      sort_order: profile.sort_order ?? 0,
      show_in_app: profile.show_in_app !== false,
    })
  }, [profileOpen, profileDetailQuery.data, profileForm])

  // Legacy envelope: responseData = { count, rows, totalPages, currentPage }
  const usersPage = pickData<{ count?: number; rows?: UserRow[] }>(usersQuery.data)
  const rows = (Array.isArray(usersPage) ? [] : usersPage?.rows ?? []) as UserRow[]
  const total = Array.isArray(usersPage) ? 0 : usersPage?.count ?? rows.length

  const roleRows = (pickData<{ rows?: { id: string; role_name?: string; name?: string; code?: string | null }[] }>(rolesQuery.data) as
    | { rows?: { id: string; role_name?: string; name?: string; code?: string | null }[] }
    | undefined)?.rows ?? []
  // Loại vai trò Khách hàng — tài khoản khách không thuộc trang quản lý nhân sự
  const roles = roleRows
    .filter((role) => isUserRole(role.code))
    .map((role) => ({ id: role.id, role_name: role.role_name ?? role.name ?? role.id, code: role.code ?? null }))
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]

  const loading = usersQuery.isLoading

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

  const openModal = (s?: UserRow) => {
    if (s ? !canManageUserRow(s) : !canCreateUser) return
    setEditing(s ?? null)
    form.setFieldsValue(
      s
        ? {
          zalo_name: s.zalo_name,
          email: s.email,
          phone: s.phone,
          branch_id: s.branch_id ?? undefined,
          role_id: s.user_roles?.[0]?.role_id,
          password: '',
        }
        : {
          zalo_name: '',
          email: '',
          phone: '',
          password: '',
          role_id: undefined,
          branch_id: undefined,
        },
    )
    setOpen(true)
  }

  const submit = async () => {
    if (editing ? !canManageUserRow(editing) : !canCreateUser) return
    const values = await form.validateFields()
    try {
      if (editing) {
        // branch_id: gửi null tường minh để cho phép gỡ cơ sở (undefined = giữ nguyên)
        const payload: PutUsersIdAdminBody = {
          zalo_name: values.zalo_name,
          email: values.email,
          phone: values.phone,
          ...(isSuperAdmin && !editing.is_super_admin ? {
            branch_id: (values.branch_id || null) as PutUsersIdAdminBody['branch_id'],
            role_id: values.role_id,
          } : {}),
          ...(values.password ? { password: values.password } : {}),
        }
        await updateMutation.mutateAsync({ id: editing.id, data: payload })
        message.success(values.password ? 'Đã cập nhật tài khoản và mật khẩu mới' : 'Đã cập nhật tài khoản')
      } else {
        const payload: UserCreate = {
          email: values.email,
          phone: values.phone,
          password: values.password,
          role_id: values.role_id,
          full_name: values.zalo_name,
          branch_id: values.branch_id,
        }
        await createMutation.mutateAsync({ data: payload })
        message.success('Đã thêm chuyên viên')
      }
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: getGetUsersAdminQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  /** LIFE-01 — khóa mềm: giữ hồ sơ/lịch, thu hồi phiên; báo số lịch hẹn tương lai cần xử lý. */
  const deactivate = async (row: UserRow) => {
    if (!canManageUserRow(row)) return
    try {
      const result = await deleteMutation.mutateAsync({ id: row.id })
      const futureCount = Number(pickData<{ future_appointments?: number }>(result)?.future_appointments ?? 0)
      if (futureCount > 0) {
        message.warning(`Đã khóa tài khoản. Có ${futureCount} lịch hẹn tương lai cần phân công lại cho KTV khác.`)
      } else {
        message.success('Đã khóa tài khoản. Hồ sơ và lịch đã đặt được giữ nguyên.')
      }
      await queryClient.invalidateQueries({ queryKey: getGetUsersAdminQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const restore = async (row: UserRow) => {
    if (!canManageUserRow(row)) return
    try {
      await updateMutation.mutateAsync({ id: row.id, data: { is_active: true } })
      message.success('Đã khôi phục tài khoản. Lịch tuần cũ có hiệu lực trở lại.')
      await queryClient.invalidateQueries({ queryKey: getGetUsersAdminQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openProfile = (row: UserRow) => {
    if (!canReadUserProfile) return
    setProfileUser(row)
    profileForm.resetFields()
    setProfileOpen(true)
  }

  const submitProfile = async () => {
    if (!profileUser || !canUpdateUserProfile || !canManageUserRow(profileUser)) return
    const values = await profileForm.validateFields()
    try {
      await upsertProfileMutation.mutateAsync({
        id: profileUser.id,
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
      await UserProfilesQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const toggleInApp = async (row: UserRow, showInApp: boolean) => {
    if (!canUpdateUserProfile || !canManageUserRow(row)) return
    try {
      await upsertProfileMutation.mutateAsync({ id: row.id, data: { show_in_app: showInApp } })
      message.success(showInApp ? 'Đã hiện chuyên viên trên app' : 'Đã ẩn chuyên viên khỏi app')
      await UserProfilesQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  return (
    <MobileUI>
      <PageTitle
        subtitle="Quản lý thông tin và vai trò của nhân viên"
        left={
          <>
            <Input.Search
              allowClear
              placeholder="Tìm theo tên, email, SĐT"
              className="w-full! max-md:col-span-full md:w-[260px]!"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                if (!e.target.value) applySearch('')
              }}
              onSearch={() => applySearch(searchInput)}
            />
            {/* Mobile: [Cơ sở][+] cùng 1 hàng (docs 6.2.1); từ tablet tan vào hàng toolbar */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-md:col-span-full md:contents">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tất cả cơ sở"
              className="w-full! md:w-[220px]!"
              value={branchFilter}
              onChange={(value) => {
                setBranchFilter(value)
                setPage(1)
              }}
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            />
              {canCreateUser && <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm chuyên viên</Button>}
            </div>
          </>
        }
      >
        Quản lý nhân sự
      </PageTitle>
      {usersQuery.isError && (
        <div className="mb-4">
          <Typography.Text type="danger">Không tải được danh sách nhân viên: {errorMessage(usersQuery.error)}</Typography.Text>
        </div>
      )}
      <ResponsiveTable<UserRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        locale={{ emptyText: <TableEmpty description="Chưa có nhân viên nào khớp điều kiện." /> }}
        scroll={{ x: 1160 }}
        pagination={false}
        onMobileCardClick={openProfile}
        onRow={(s) => ({ onClick: () => openProfile(s), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Nhân viên',
            key: 'User',
            dataIndex: 'zalo_name',
            width: 220,
            render: (_: unknown, s: UserRow) => {
              const profile = profileByUser.get(s.id)
              const photo = fileSrc((profile as any)?.photo_file) ?? resolveFileSrc(urlMap, profile?.photo_file_id)
              return (
                <Space>
                  {photo ? (
                    <img src={photo} alt="" width={36} height={36} className="rounded-full object-cover" />
                  ) : (
                    <Avatar size={36} className="bg-[var(--brand-primary)]!" icon={<UserOutlined />} />
                  )}
                  <Space direction="vertical" size={0}>
                    <span className="font-semibold">{s.zalo_name || s.email || '—'}</span>
                    {s.email && <Typography.Text type="secondary" className="text-xs!">{s.email}</Typography.Text>}
                  </Space>
                </Space>
              )
            },
          },
          {
            title: 'Vai trò',
            key: 'role',
            width: 220,
            render: (_: unknown, s: UserRow) => (
              <Tag color={roleTagColor(s.user_roles?.[0]?.role?.code)}>{s.user_roles?.[0]?.role?.role_name || 'Nhân viên'}</Tag>
            ),
          },
          {
            title: 'Trạng thái',
            key: 'status',
            dataIndex: 'is_active',
            width: 110,
            render: (v: boolean | undefined) => (v === false ? <Tag>Đã nghỉ việc</Tag> : <Tag color="green">Đang làm</Tag>),
          },
          { title: 'SĐT', key: 'phone', dataIndex: 'phone', width: 130, render: (v: string | undefined) => v || '—' },
          {
            title: 'Chức danh',
            key: 'profile',
            width: 180,
            render: (_: unknown, s: UserRow) => <Typography.Text>{profileByUser.get(s.id)?.title || '—'}</Typography.Text>,
          },
          {
            title: <span className="whitespace-nowrap">Hiện trên app</span>,
            key: 'in_app',
            width: 130,
            render: (_: unknown, s: UserRow) => {
              const profile = profileByUser.get(s.id)
              if (!canUpdateUserProfile || !canManageUserRow(s)) {
                return (
                  <Tag color={profile?.show_in_app === false ? 'default' : 'green'}>
                    {profile?.show_in_app === false ? 'Đã ẩn' : 'Đang hiện'}
                  </Tag>
                )
              }
              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={profile?.show_in_app !== false}
                    size="small"
                    loading={upsertProfileMutation.isPending}
                    onChange={(checked) => void toggleInApp(s, checked)}
                  />
                </div>
              )
            },
          },
          {
            title: 'Thao tác', align: 'center' as const,
            key: 'actions',
            width: 100,
            fixed: 'right' as const,
            render: (_: unknown, s: UserRow) => {
              const canManageRow = canManageUserRow(s)
              const actionItems = [
                ...(canManageRow ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
                ...(canReadUserProfile ? [{ key: 'profile', icon: <ProfileOutlined />, label: canUpdateUserProfile && canManageRow ? 'Hồ sơ' : 'Xem hồ sơ' }] : []),
                ...(canManageRow && !isHighestAdminRow(s)
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
        ]}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="nhân viên" />

      <UserModal
        form={form}
        open={open}
        editing={editing}
        branches={branches}
        roles={roles}
        canEditAccess={isSuperAdmin && !editing?.is_super_admin}
        onCancel={() => setOpen(false)}
        onOk={submit}
      />

      <UserProfileModal
        form={profileForm}
        open={profileOpen}
        profileUser={profileUser}
        canUpdate={canUpdateUserProfile && !!profileUser && canManageUserRow(profileUser)}
        profileDetails={profileDetails}
        saving={upsertProfileMutation.isPending}
        onCancel={() => setProfileOpen(false)}
        onOk={() => void submitProfile()}
      />
    </MobileUI>
  )
}
