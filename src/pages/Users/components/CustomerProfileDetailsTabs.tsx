import { lazy, Suspense, useState } from 'react'
import { Select, Tabs } from 'antd'
import type { CustomerProfileRow, CustomerProfileSummary } from './CustomerProfileOverviewTab'
import type { CustomFieldDefWithOptions } from './CustomerProfileCustomFields'

const CustomerProfileAppointmentsTab = lazy(() => import('./CustomerProfileAppointmentsTab'))
const CustomerProfileHealthMetricsTab = lazy(() => import('./CustomerProfileHealthMetricsTab'))
const CustomerProfileOverviewTab = lazy(() => import('./CustomerProfileOverviewTab'))
const CustomerProfileTreatmentsTab = lazy(() => import('./CustomerProfileTreatmentsTab'))

type TabKey = 'overview' | 'treatments' | 'appointments' | 'metrics'

const TAB_OPTIONS: { value: TabKey; label: string }[] = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'treatments', label: 'Gói, buổi, thanh toán' },
  { value: 'appointments', label: 'Lịch hẹn' },
  { value: 'metrics', label: 'Sức khỏe, chỉ số' },
]

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
      {/* Desktop: tab navigation — Mobile: select thay cho hàng tab */}
      <Tabs
        className="desktop-only"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
        items={TAB_OPTIONS.map((tab) => ({ key: tab.value, label: tab.label, children: null }))}
      />
      <div className="mobile-only" style={{ marginBottom: 12 }}>
        <Select
          style={{ width: '100%' }}
          value={activeTab}
          onChange={(key) => setActiveTab(key as TabKey)}
          options={TAB_OPTIONS}
        />
      </div>
      <Suspense fallback={<div className="py-9 text-center">Đang mở hồ sơ…</div>}>
        <div className="pt-1">{content}</div>
      </Suspense>
    </>
  )
}
