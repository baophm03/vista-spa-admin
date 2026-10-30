import { useMemo, useState } from 'react'
import { Alert, Tabs } from 'antd'
import PageTitle from '@/components/base/PageTitle'
import { pickData } from '@/api/helpers'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetUsers } from '@/api/endpoints/users'
import type { Branch } from '@/api/models/branch'
import { useCustomerProfileAccess, normalizeRole } from '@/utils/customerProfileAccess'
import { useProfileStore } from '@/stores/profile-store'
import type { ScheduleAccess, ScheduleStaff } from './schedule/types'
import WeeklyScheduleTab from './schedule/WeeklyScheduleTab'
import ShiftCatalogTab from './schedule/ShiftCatalogTab'
import DayOffTab from './schedule/DayOffTab'

export default function StaffSchedule() {
  const profile = useProfileStore((s) => s.profile)
  const { isAdmin, isReceptionist, isTechnician } = useCustomerProfileAccess()
  const [activeTab, setActiveTab] = useState('weekly')

  const branchesQuery = useGetBranches()
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]

  const staffsQuery = useGetUsers({ currentPage: 1, pageSize: 500, has_role: true })
  const allUsers = (pickData<{ rows?: ScheduleStaff[] } | undefined>(staffsQuery.data)?.rows ?? []) as ScheduleStaff[]
  const staff = useMemo(
    () => allUsers.filter((person) => person.user_roles?.some(({ role }) => {
      const roleName = normalizeRole(role?.role_name)
      return roleName.includes('ktv') || roleName.includes('ky thuat vien') || roleName === 'technician'
    })),
    [allUsers],
  )

  const loadingShared = branchesQuery.isLoading || staffsQuery.isLoading
  const sharedError = [
    branchesQuery.isError ? `Cơ sở: ${branchesQuery.error?.message ?? ''}` : '',
    staffsQuery.isError ? `Danh sách nhân sự: ${staffsQuery.error?.message ?? ''}` : '',
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
      void staffsQuery.refetch()
    }, access }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branches, staff, sharedError, access],
  )

  const items = [
    { key: 'weekly', label: 'Lịch tuần', children: activeTab === 'weekly' ? <WeeklyScheduleTab {...shared} loadingShared={loadingShared} /> : null },
    { key: 'shifts', label: 'Danh mục ca', children: activeTab === 'shifts' ? <ShiftCatalogTab {...shared} loadingShared={loadingShared} /> : null },
    { key: 'days-off', label: 'Ngày nghỉ', children: activeTab === 'days-off' ? <DayOffTab {...shared} loadingShared={loadingShared} /> : null },
  ]

  return <>
    <PageTitle subtitle="Lịch làm việc của nhân viên theo tuần">Lịch làm việc KTV</PageTitle>
    <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    {!!sharedError && <Alert style={{ marginTop: 12 }} type="warning" showIcon message="Một phần dữ liệu dùng chung chưa tải được" description={sharedError} action={<a onClick={() => {
      void branchesQuery.refetch()
      void staffsQuery.refetch()
    }}>Tải lại</a>} />}
  </>
}
