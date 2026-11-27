import { useMemo, useRef, useState } from 'react'
import { useAbility } from '@casl/react'
import { Alert, Tabs } from 'antd'
import type { TabsProps } from 'antd'
import { pickData } from '@/api/helpers'
import MobileUI from '@/components/base/MobileUI'
import useDesktopLayout from '@/hooks/useDesktopLayout'
import PageTitle from '@/components/base/PageTitle'
import { ToolbarSlotContext } from '../schedule/ToolbarSlotContext'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import { useGetUsersStaffAdmin } from '@/api/endpoints/staff'
import type { Branch } from '@/api/models/branch'
import type { StaffProfile } from '@/api/models/staffProfile'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { isReceptionistUser, isTechnicianUser } from '@/utils/userRoles'
import { useProfileStore } from '@/stores/profile-store'
import type { ScheduleAccess, ScheduleStaff } from '../schedule/types'
import DateScheduleTab from '../schedule/DateScheduleTab'
import ShiftCatalogTab from '../schedule/ShiftCatalogTab'
import DayOffTab from '../schedule/DayOffTab'
import '../schedule/schedule-mobile.css'

export default function StaffSchedule() {
  const ability = useAbility()
  // Mobile/tablet: tab mặc định antd như /customer-data-config (vuốt ngang khi tràn)
  const desktop = useDesktopLayout()
  const profile = useProfileStore((s) => s.profile)
  const { isAdmin, isReceptionist, isTechnician } = useCustomerProfileAccess()
  const [activeTab, setActiveTab] = useState('dates')
  // Slot giữa title và tabs — tab "Lịch làm việc" portal toolbar vào đây (ghép 1 hàng như mockup)
  const toolbarSlotRef = useRef<HTMLDivElement | null>(null)

  const isOwnScheduleOnly = isTechnician && !isAdmin
  const canReadStaffProfiles = !!profile?.is_admin || isAdmin || ability.can('READ', 'STAFF')
  // KTV được xem cơ sở của mình; dữ liệu này cũng giúp hiển thị phạm vi áp dụng của mẫu ca.
  const branchesQuery = useGetBranchesAdmin(undefined)
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]

  const staffsQuery = useGetUsersAdmin(
    { currentPage: 1, pageSize: 500, has_role: true, status: 'active' },
    { query: { enabled: !isOwnScheduleOnly, refetchOnMount: 'always', refetchOnWindowFocus: 'always' } },
  )
  const allUsers = (pickData<{ rows?: ScheduleStaff[] } | undefined>(staffsQuery.data)?.rows ?? []) as ScheduleStaff[]
  const staffProfilesQuery = useGetUsersStaffAdmin(undefined, {
    query: {
      enabled: !isOwnScheduleOnly && canReadStaffProfiles,
      refetchOnMount: 'always',
      refetchOnWindowFocus: 'always',
    },
  })
  const inactiveStaffProfileIds = useMemo(() => {
    const rows = (pickData<StaffProfile[] | undefined>(staffProfilesQuery.data) ?? []) as StaffProfile[]
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
      // Lịch dùng chung cho cả KTV ('staff'/'ktv'/'technician') lẫn lễ tân ('rec'/'Lễ tân'...)
      : allUsers.filter((person) => person.is_active !== false && !inactiveStaffProfileIds.has(person.id) && (isTechnicianUser(person) || isReceptionistUser(person))),
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
    () => ({
      branches, staff, sharedError, retryShared: () => {
        void branchesQuery.refetch()
        if (!isOwnScheduleOnly) void staffsQuery.refetch()
        if (!isOwnScheduleOnly && canReadStaffProfiles) void staffProfilesQuery.refetch()
      }, access
    }),
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

  const renderTabBar: NonNullable<TabsProps['renderTabBar']> = (props, TabNavBar) => (
    <div className="mb-3 grid min-w-0 shrink-0! grid-cols-[minmax(0,1fr)_auto] items-center lg:mb-2 gap-x-4 gap-y-3 lg:gap-y-1 [&_.ant-tabs-nav]:col-span-2 [&_.ant-tabs-nav]:col-start-1 [&_.ant-tabs-nav]:row-start-2 [&_.ant-tabs-nav]:mb-0! [&_.ant-tabs-nav]:min-w-0 lg:[&_.ant-tabs-nav]:before:hidden lg:[&_.ant-tabs-nav]:col-span-1 lg:[&_.ant-tabs-nav]:col-start-2 lg:[&_.ant-tabs-nav]:row-start-1 lg:[&_.ant-tabs-tab]:h-9 lg:[&_.ant-tabs-tab]:px-1! lg:[&_.ant-tabs-tab]:py-0! lg:[&_.ant-tabs-tab]:text-[13px]!">
      <PageTitle className="col-span-2 col-start-1 row-start-1 mb-0! lg:col-span-1" subtitle="Xếp lịch làm việc nhân viên theo từng ngày cụ thể">
        Lịch làm việc nhân viên
      </PageTitle>
      <TabNavBar {...props} />
      <div ref={toolbarSlotRef} className="col-span-2 col-start-1 row-start-3 min-w-0 empty:hidden lg:row-start-2" />
    </div>
  )
  // Chiếm đúng phần còn lại của viewport (header 64px + padding Content 24/32/48px) —
  // trang không cuộn, chỉ lưới giờ cuộn trong khung (ScheduleTimeGrid tự lo overflow).
  return <>
    <ToolbarSlotContext.Provider value={toolbarSlotRef}>
      <MobileUI className="flex h-[calc(100dvh-88px)] min-h-0 flex-col sm:h-[calc(100dvh-96px)] md:overflow-hidden lg:h-[calc(100dvh-112px)]">
        <Tabs
          className="staff-schedule-tabs flex! flex-1! flex-col!"
          activeKey={activeTab}
          onChange={(key: string) => setActiveTab(key)}
          items={items}
          size={desktop ? 'small' : 'middle'}
          tabBarGutter={desktop ? 16 : undefined}
          renderTabBar={renderTabBar}
        />
        {!!sharedError && <Alert className="shrink-0!" style={{ marginTop: 12 }} type="warning" showIcon message="Một phần dữ liệu dùng chung chưa tải được" description={sharedError} action={<a onClick={() => {
          void branchesQuery.refetch()
          if (!isOwnScheduleOnly) void staffsQuery.refetch()
          if (!isOwnScheduleOnly && canReadStaffProfiles) void staffProfilesQuery.refetch()
        }}>Tải lại</a>} />}
      </MobileUI>
    </ToolbarSlotContext.Provider>
  </>
}
