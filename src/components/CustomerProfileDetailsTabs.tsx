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
  onMembershipUpdated?: () => Promise<void> | void
}

export default function CustomerProfileDetailsTabs({ profile, summary, branchName, fieldDefinitions, onMembershipUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const content = activeTab === 'overview'
    ? <CustomerProfileOverviewTab profile={profile} summary={summary} branchName={branchName} fieldDefinitions={fieldDefinitions} onMembershipUpdated={onMembershipUpdated} />
    : activeTab === 'treatments'
      ? <CustomerProfileTreatmentsTab key={profile.id} profileId={profile.id} />
      : activeTab === 'appointments'
        ? <CustomerProfileAppointmentsTab key={profile.id} profileId={profile.id} />
        : <CustomerProfileHealthMetricsTab key={profile.id} profileId={profile.id} />

  return (
    <>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
        items={[
          { key: 'overview', label: 'Tổng quan', children: null },
          { key: 'treatments', label: 'Gói, buổi, thanh toán', children: null },
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
