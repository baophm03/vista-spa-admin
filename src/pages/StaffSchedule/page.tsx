import { useMemo, useState } from 'react'
import { Alert, Grid, Select, Tabs } from 'antd'
import PageTitle from '@/components/base/PageTitle'
import { pickData } from '@/api/helpers'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetUsers } from '@/api/endpoints/users'
import type { Branch } from '@/api/models/branch'
import { useCustomerProfileAccess, normalizeRole } from '@/utils/customerProfileAccess'
import { useProfileStore } from '@/stores/profile-store'
import type { ScheduleAccess, ScheduleStaff } from '../schedule/types'
import WeeklyScheduleTab from '../schedule/WeeklyScheduleTab'
import ShiftCatalogTab from '../schedule/ShiftCatalogTab'
import DayOffTab from '../schedule/DayOffTab'

export default function StaffSchedule() {
  const profile = useProfileStore((s) => s.profile)
  const { isAdmin, isReceptionist, isTechnician } = useCustomerProfileAccess()
  const [activeTab, setActiveTab] = useState('weekly')
  // Mobile (dưới breakpoint md): chuyển vùng nội dung bằng Select thay vì Tabs
  const isMobile = !Grid.useBreakpoint().md

  const isOwnScheduleOnly = isTechnician && !isAdmin
  // KTV được xem cơ sở của mình; dữ liệu này cũng giúp hiển thị phạm vi áp dụng của mẫu ca.
  const branchesQuery = useGetBranches(undefined)
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]

  const staffsQuery = useGetUsers({ currentPage: 1, pageSize: 500, has_role: true }, { query: { enabled: !isOwnScheduleOnly } })
  const allUsers = (pickData<{ rows?: ScheduleStaff[] } | undefined>(staffsQuery.data)?.rows ?? []) as ScheduleStaff[]
  const ownStaff: ScheduleStaff | null = profile?.id ? {
    id: profile.id,
    zalo_name: profile.zalo_name,
    branch_id: typeof profile.branch_id === 'string' ? profile.branch_id : undefined,
    user_roles: [{ role: { role_name: 'KTV' } }],
  } : null
  const staff = useMemo(
    () => isOwnScheduleOnly
      ? (ownStaff ? [ownStaff] : [])
      : allUsers.filter((person) => person.user_roles?.some(({ role }) => {
          const roleName = normalizeRole(role?.role_name)
          return roleName.includes('ktv') || roleName.includes('ky thuat vien') || roleName === 'technician'
        })),
    [allUsers, isOwnScheduleOnly, ownStaff],
  )

  const loadingShared = branchesQuery.isLoading || (!isOwnScheduleOnly && staffsQuery.isLoading)
  const sharedError = [
    branchesQuery.isError ? `Cơ sở: ${branchesQuery.error?.message ?? ''}` : '',
    !isOwnScheduleOnly && staffsQuery.isError ? `Danh sách nhân sự: ${staffsQuery.error?.message ?? ''}` : '',
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
    }, access }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branches, staff, sharedError, access, isOwnScheduleOnly],
  )

  const items = [
    { key: 'weekly', label: 'Lịch tuần', children: activeTab === 'weekly' ? <WeeklyScheduleTab {...shared} loadingShared={loadingShared} /> : null },
    { key: 'shifts', label: 'Danh mục ca', children: activeTab === 'shifts' ? <ShiftCatalogTab {...shared} loadingShared={loadingShared} /> : null },
    { key: 'days-off', label: 'Ngày nghỉ', children: activeTab === 'days-off' ? <DayOffTab {...shared} loadingShared={loadingShared} /> : null },
  ]

  return <>
    <PageTitle subtitle="Lịch làm việc của nhân viên theo tuần">Lịch làm việc KTV</PageTitle>
    {isMobile ? (
      <>
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          value={activeTab}
          onChange={setActiveTab}
          options={items.map(({ key, label }) => ({ value: key, label }))}
        />
        {items.find((item) => item.key === activeTab)?.children}
      </>
    ) : (
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    )}
    {!!sharedError && <Alert style={{ marginTop: 12 }} type="warning" showIcon message="Một phần dữ liệu dùng chung chưa tải được" description={sharedError} action={<a onClick={() => {
      void branchesQuery.refetch()
      if (!isOwnScheduleOnly) void staffsQuery.refetch()
    }}>Tải lại</a>} />}
  </>
}