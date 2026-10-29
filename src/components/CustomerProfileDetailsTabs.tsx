import { lazy, Suspense, useState } from 'react'
import { Tabs } from 'antd'
import type { CustomerProfileRow, CustomerProfileSummary } from '@/components/CustomerProfileOverviewTab'
import type { CustomFieldDefWithOptions } from '@/components/CustomerProfileCustomFields'

const CustomerProfileAppointmentsTab = lazy(() => import('@/components/CustomerProfileAppointmentsTab'))
const CustomerProfileHealthMetricsTab = lazy(() => import('@/components/CustomerProfileHealthMetricsTab'))
const CustomerProfileOverviewTab = lazy(() => import('@/components/CustomerProfileOverviewTab'))
const CustomerProfileTreatmentsTab = lazy(() => import('@/components/CustomerProfileTreatmentsTab'))

type TabKey = 'overview' | 'treatments' | 'appointments' | 'metrics'

interface Props {
  profile: CustomerProfileRow
  summary: CustomerProfileSummary | null
  branchName: (id?: string) => string
  fieldDefinitions: CustomFieldDefWithOptions[]
  onLoadingChange?: (loading: boolean) => void
  onMembershipUpdated?: () => Promise<void> | void
}

export default function CustomerProfileDetailsTabs({ profile, summary, branchName, fieldDefinitions, onLoadingChange, onMembershipUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const content = activeTab === 'overview'
    ? <CustomerProfileOverviewTab profile={profile} summary={summary} branchName={branchName} fieldDefinitions={fieldDefinitions} onMembershipUpdated={onMembershipUpdated} />
    : activeTab === 'treatments'
      ? <CustomerProfileTreatmentsTab key={profile.id} profileId={profile.id} onLoadingChange={onLoadingChange} />
      : activeTab === 'appointments'
        ? <CustomerProfileAppointmentsTab key={profile.id} profileId={profile.id} onLoadingChange={onLoadingChange} />
        : <CustomerProfileHealthMetricsTab key={profile.id} profileId={profile.id} onLoadingChange={onLoadingChange} />

  const handleTabChange = (key: string) => {
    const nextTab = key as TabKey
    setActiveTab(nextTab)
    onLoadingChange?.(nextTab !== 'overview')
  }

  return (
    <>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          { key: 'overview', label: 'Tổng quan', children: null },
          { key: 'treatments', label: 'Gói, buổi, ảnh, thanh toán', children: null },
          { key: 'appointments', label: 'Lịch hẹn', children: null },
          { key: 'metrics', label: 'Sức khỏe, chỉ số', children: null },
        ]}
      />
      <Suspense fallback={<div className="py-9 text-center">Đang mở hồ sơ…</div>}>
        <div className="pt-1">{content}</div>
      </Suspense>
    </>
  )
}
