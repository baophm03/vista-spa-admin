import { useMemo, useRef, useState } from 'react'
import { useAbility } from '@casl/react'
import { Alert, Tabs, Typography } from 'antd'
import type { TabsProps } from 'antd'
import { pickData } from '@/api/helpers'
import { ToolbarSlotContext } from '../schedule/ToolbarSlotContext'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import { useGetStaffProfilesAdmin } from '@/api/endpoints/staff-profiles'
import type { Branch } from '@/api/models/branch'
import type { StaffProfileRow } from '@/api/models/staffProfileRow'
import { useCustomerProfileAccess, normalizeRole } from '@/utils/customerProfileAccess'
import { useProfileStore } from '@/stores/profile-store'
import type { ScheduleAccess, ScheduleStaff } from '../schedule/types'
import DateScheduleTab from '../schedule/DateScheduleTab'
import ShiftCatalogTab from '../schedule/ShiftCatalogTab'
import DayOffTab from '../schedule/DayOffTab'

export default function StaffSchedule() {
  const ability = useAbility()
  const profile = useProfileStore((s) => s.profile)
  const { isAdmin, isReceptionist, isTechnician } = useCustomerProfileAccess()
  const [activeTab, setActiveTab] = useState('dates')
  // Slot giữa title và tabs — tab "Lịch làm việc" portal toolbar vào đây (ghép 1 hàng như mockup)
  const toolbarSlotRef = useRef<HTMLDivElement | null>(null)

  const isOwnScheduleOnly = isTechnician && !isAdmin
  const canReadStaffProfiles = !!profile?.is_admin || isAdmin || ability.can('READ', 'STAFF_PROFILE')
  // KTV được xem cơ sở của mình; dữ liệu này cũng giúp hiển thị phạm vi áp dụng của mẫu ca.
  const branchesQuery = useGetBranchesAdmin(undefined)
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]

  const staffsQuery = useGetUsersAdmin(
    { currentPage: 1, pageSize: 500, has_role: true, status: 'active' },
    { query: { enabled: !isOwnScheduleOnly, refetchOnMount: 'always', refetchOnWindowFocus: 'always' } },
  )
  const allUsers = (pickData<{ rows?: ScheduleStaff[] } | undefined>(staffsQuery.data)?.rows ?? []) as ScheduleStaff[]
  const staffProfilesQuery = useGetStaffProfilesAdmin(undefined, {
    query: {
      enabled: !isOwnScheduleOnly && canReadStaffProfiles,
      refetchOnMount: 'always',
      refetchOnWindowFocus: 'always',
    },
  })
  const inactiveStaffProfileIds = useMemo(() => {
    const rows = (pickData<StaffProfileRow[] | undefined>(staffProfilesQuery.data) ?? []) as StaffProfileRow[]
    return new Set(rows.filter((row) => row.is_active === false).map((row) => row.user_id))
  }, [staffProfilesQuery.data])
  const ownStaff: ScheduleStaff | null = profile?.id ? {
    id: profile.id,
    zalo_name: profile.zalo_name,
    branch_id: typeof profile.branch_id === 'string' ? profile.branch_id : undefined,
    user_roles: [{ role: { role_name: 'KTV' } }],
  } : null
  const staff = useMemo(
    () => isOwnScheduleOnly
      ? (ownStaff ? [ownStaff] : [])
      : allUsers.filter((person) => person.is_active !== false && !inactiveStaffProfileIds.has(person.id) && person.user_roles?.some(({ role }) => {
          const roleName = normalizeRole(role?.role_name)
          return roleName.includes('ktv') || roleName.includes('ky thuat vien') || roleName === 'technician'
        })),
    [allUsers, inactiveStaffProfileIds, isOwnScheduleOnly, ownStaff],
  )

  const loadingShared = branchesQuery.isLoading || (!isOwnScheduleOnly && staffsQuery.isLoading) || (!isOwnScheduleOnly && canReadStaffProfiles && staffProfilesQuery.isLoading)
  const sharedError = [
    branchesQuery.isError ? `Cơ sở: ${branchesQuery.error?.message ?? ''}` : '',
    !isOwnScheduleOnly && staffsQuery.isError ? `Danh sách nhân sự: ${staffsQuery.error?.message ?? ''}` : '',
    !isOwnScheduleOnly && canReadStaffProfiles && staffProfilesQuery.isError ? `Hồ sơ nhân sự: ${staffProfilesQuery.error?.message ?? ''}` : '',
  ].filter(Boolean).join(' · ')

  const access: ScheduleAccess = useMemo(
    () => ({
      isAdmin,
      isReceptionist,
      isTechnician,
      currentUserId: profile?.id,
    }),
    [isAdmin, isReceptionist, isTechnician, profile?.id],
  )

  const shared = useMemo(
    () => ({ branches, staff, sharedError, retryShared: () => {
      void branchesQuery.refetch()
      if (!isOwnScheduleOnly) void staffsQuery.refetch()
      if (!isOwnScheduleOnly && canReadStaffProfiles) void staffProfilesQuery.refetch()
    }, access }),
    [
      branches,
      staff,
      sharedError,
      access,
      isOwnScheduleOnly,
      canReadStaffProfiles,
      branchesQuery.refetch,
      staffsQuery.refetch,
      staffProfilesQuery.refetch,
    ],
  )

  const items = [
    { key: 'dates', label: 'Lịch làm việc', children: activeTab === 'dates' ? <DateScheduleTab {...shared} loadingShared={loadingShared} /> : null },
    { key: 'shifts', label: 'Danh mục ca', children: activeTab === 'shifts' ? <ShiftCatalogTab {...shared} loadingShared={loadingShared} /> : null },
    { key: 'days-off', label: 'Ngày nghỉ', children: activeTab === 'days-off' ? <DayOffTab {...shared} loadingShared={loadingShared} /> : null },
  ]

  // Tab giữ nguyên vị trí cùng hàng tiêu đề (căn phải); mô tả xuống dòng riêng dưới tiêu đề;
  // cỡ chữ + khoảng cách tab dùng mặc định antd như các trang khác.
  // Lưu ý: antd v6 chỉ style ink bar khi .ant-tabs-nav là con TRỰC TIẾP của 1 div duy nhất
  // (selector `> div > .ant-tabs-nav`) — TabNavBar phải là con trực tiếp của wrapper, không lồng thêm div.
  const renderTabBar: NonNullable<TabsProps['renderTabBar']> = (props, TabNavBar) => (
    <div className="mb-4 flex shrink-0! flex-wrap items-center justify-between gap-x-4 gap-y-2 [&_.ant-tabs-nav]:mb-0!">
      <div className="min-w-0">
        <Typography.Title level={4} className="m-0! text-xl! sm:text-2xl!">Lịch làm việc KTV</Typography.Title>
        <Typography.Text type="secondary" className="mt-1 block text-sm!">
          Xếp lịch làm việc KTV theo từng ngày cụ thể
        </Typography.Text>
      </div>
      {/* Cụm toolbar của tab "Lịch làm việc" portal vào đây — nằm GIỮA hàng, không dồn góc phải */}
      <div ref={toolbarSlotRef} className="flex min-w-0 flex-1 items-center justify-center gap-2" />
      <TabNavBar {...props} />
    </div>
  )
  // Chiếm đúng phần còn lại của viewport (header 64px + padding Content 24/32/48px) —
  // trang không cuộn, chỉ lưới giờ cuộn trong khung (ScheduleTimeGrid tự lo overflow).
  return <>
    <ToolbarSlotContext.Provider value={toolbarSlotRef}>
      <div className="flex h-[calc(100dvh-88px)] min-h-0 flex-col sm:h-[calc(100dvh-96px)] md:overflow-hidden lg:h-[calc(100dvh-112px)]">
      <Tabs
        className="staff-schedule-tabs flex! flex-1! flex-col!"
        activeKey={activeTab}
        onChange={(key: string) => setActiveTab(key)}
        items={items}
        renderTabBar={renderTabBar}
      />
      {!!sharedError && <Alert className="shrink-0!" style={{ marginTop: 12 }} type="warning" showIcon message="Một phần dữ liệu dùng chung chưa tải được" description={sharedError} action={<a onClick={() => {
        void branchesQuery.refetch()
        if (!isOwnScheduleOnly) void staffsQuery.refetch()
        if (!isOwnScheduleOnly && canReadStaffProfiles) void staffProfilesQuery.refetch()
      }}>Tải lại</a>} />}
      </div>
    </ToolbarSlotContext.Provider>
  </>
}
