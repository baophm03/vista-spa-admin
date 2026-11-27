import { lazy, Suspense, useState } from 'react'
import { Typography, message } from 'antd'
import { CalendarOutlined, HeartOutlined, HomeOutlined, MedicineBoxOutlined } from '@ant-design/icons'
import { displayName } from '@/utils/displayName'
import DetailModal, { DetailChip, DetailLoading } from '@/components/base/DetailModal'
import type { CustomerProfileRow, CustomerProfileSummary } from './CustomerProfileOverviewTab'
import type { CustomFieldDefWithOptions } from './CustomerProfileCustomFields'
import { AvatarEditor } from '@/components/base/UserAvatar'
import { avatarSources } from '@/utils/avatar'
import { putUsersCustomersIdAdmin } from '@/api/endpoints/customers'
import { errorMessage } from '@/api/helpers'
import { customerRankName } from './customerAccount'

const CustomerProfileAppointmentsTab = lazy(() => import('./CustomerProfileAppointmentsTab'))
const CustomerProfileHealthMetricsTab = lazy(() => import('./CustomerProfileHealthMetricsTab'))
const CustomerProfileOverviewTab = lazy(() => import('./CustomerProfileOverviewTab'))
const CustomerProfileTreatmentsTab = lazy(() => import('./CustomerProfileTreatmentsTab'))

type TabKey = 'overview' | 'treatments' | 'appointments' | 'metrics'

interface CustomerDetailModalProps {
  selected: CustomerProfileRow | null
  summary: CustomerProfileSummary | null
  profileFieldDefs: CustomFieldDefWithOptions[]
  onClose: () => void
  onMembershipUpdated: () => Promise<void> | void
  /** Có quyền sửa hồ sơ → hiện "Chỉnh sửa" ở thẻ Thông tin khách hàng */
  onEdit?: (profile: CustomerProfileRow) => void
}

export default function CustomerDetailModal({
  selected,
  summary,
  profileFieldDefs,
  onClose,
  onMembershipUpdated,
  onEdit,
}: CustomerDetailModalProps) {
  // Mở khách khác → quay về tab Tổng quan
  const [tabState, setTabState] = useState<{ id?: string; tab: TabKey }>({ tab: 'overview' })
  // Ảnh vừa đổi hiển thị ngay, chờ tải lại hồ sơ (undefined = dùng ảnh từ hồ sơ)
  const [photoOverride, setPhotoOverride] = useState<{ id?: string; src: string | null }>()
  if (!selected) return null
  const avatar = avatarSources(selected, photoOverride?.id === selected.id ? photoOverride.src : undefined)
  const changePhoto = async (fileId: string | null, src: string | null) => {
    try {
      await putUsersCustomersIdAdmin(selected.id, { photo_file_id: fileId } as never)
      setPhotoOverride({ id: selected.id, src })
      message.success(fileId ? 'Đã đổi ảnh đại diện' : 'Đã gỡ ảnh đại diện')
      await onMembershipUpdated()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }
  const tab = tabState.id === selected.id ? tabState.tab : 'overview'
  const rankName = summary?.membership?.card_rank?.name || summary?.rank?.name || customerRankName(selected)
  const debt = Number(summary?.debt_amount ?? 0)

  return (
    <DetailModal<TabKey>
      open
      onClose={() => { setTabState({ tab: 'overview' }); onClose() }}
      navLabel="Mục hồ sơ khách hàng"
      leading={(
        <AvatarEditor
          systemSrc={avatar.system}
          zaloSrc={avatar.zalo}
          name={displayName(selected)}
          editable={!!onEdit}
          onChange={changePhoto}
        />
      )}
      title={displayName(selected)}
      meta={(
        <>
          {selected.customer_code && (
            <Typography.Text className="dm-code" copyable={{ text: selected.customer_code, tooltips: ['Sao chép mã', 'Đã sao chép'] }}>
              {selected.customer_code}
            </Typography.Text>
          )}
          {rankName && <DetailChip tone="primary">{rankName}</DetailChip>}
          {debt > 0 && <DetailChip tone="pending">Còn nợ</DetailChip>}
        </>
      )}
      tabs={[
        { key: 'overview', label: 'Tổng quan', icon: <HomeOutlined /> },
        { key: 'appointments', label: 'Lịch hẹn', icon: <CalendarOutlined /> },
        { key: 'treatments', label: 'Dịch vụ & thanh toán', icon: <MedicineBoxOutlined /> },
        { key: 'metrics', label: 'Sức khỏe, chỉ số', icon: <HeartOutlined /> },
      ]}
      activeTab={tab}
      onTabChange={(next) => setTabState({ id: selected.id, tab: next })}
    >
      <Suspense fallback={<DetailLoading label="Đang mở hồ sơ" />}>
        {tab === 'overview' && (
          <CustomerProfileOverviewTab
            profile={selected}
            summary={summary}
            fieldDefinitions={profileFieldDefs}
            onMembershipUpdated={onMembershipUpdated}
            onEdit={onEdit}
          />
        )}
        {tab === 'treatments' && <CustomerProfileTreatmentsTab key={selected.id} profileId={selected.id} />}
        {tab === 'appointments' && <CustomerProfileAppointmentsTab key={selected.id} profileId={selected.id} />}
        {tab === 'metrics' && <CustomerProfileHealthMetricsTab key={selected.id} profileId={selected.id} profile={selected} />}
      </Suspense>
    </DetailModal>
  )
}
