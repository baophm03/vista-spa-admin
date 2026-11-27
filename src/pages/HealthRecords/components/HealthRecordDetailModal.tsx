import { useState } from 'react'
import { Button, Typography } from 'antd'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  GiftOutlined,
  HomeOutlined,
  MailOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  PlusOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useAbility } from '@casl/react'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import { displayName } from '@/utils/displayName'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import CustomerAvatar from '@/pages/Customers/components/CustomerAvatar'
import DetailModal, {
  DetailCard,
  DetailChip,
  DetailEmpty,
  DetailHero,
  DetailInfoRow,
  DetailLoading,
  DetailNote,
  DetailProgress,
  type ChipTone,
} from '@/components/base/DetailModal'
import {
  currentHealth,
  displayDate,
  type HealthRow,
  type ServiceHistoryAppointment,
  type SkinTypeOption,
  hasAllergy,
} from './constants'
import { AllergyCard, HealthRecordCard, HealthStatusCard } from './HealthRecordParts'

interface HealthRecordDetailModalProps {
  detail: HealthRow | null
  onClose: () => void
  onOpenRecordForm: (row: HealthRow, record?: CustomerHealthRecord) => void
  skinTypes: SkinTypeOption[]
  history: CustomerHealthRecord[]
  historyLoading: boolean
  historyError: boolean
  onRetryHistory: () => void
  detailTreatments: CustomerTreatment[]
  packageNames: Record<string, string>
  detailAppointments: ServiceHistoryAppointment[]
}

type TabKey = 'overview' | 'records' | 'treatments' | 'services'

const TREATMENT_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  ACTIVE: { label: 'Đang dùng', tone: 'success' },
  FINISHED: { label: 'Hoàn tất', tone: 'primary' },
}

export default function HealthRecordDetailModal({
  detail,
  onClose,
  onOpenRecordForm,
  skinTypes,
  history,
  historyLoading,
  historyError,
  onRetryHistory,
  detailTreatments,
  packageNames,
  detailAppointments,
}: HealthRecordDetailModalProps) {
  // Mở khách khác → quay về tab Tổng quan
  const [tabState, setTabState] = useState<{ id?: string; tab: TabKey }>({ tab: 'overview' })
  const tab = tabState.id === detail?.id ? tabState.tab : 'overview'
  const canUpdate = useAbility().can('UPDATE', 'CUSTOMER')

  if (!detail) return null
  const current = currentHealth(detail, skinTypes)

  const createButton = (
    <Button type="primary" icon={<PlusOutlined />} className="keep-label" onClick={() => onOpenRecordForm(detail)}>Tạo phiếu khám</Button>
  )
  const editRecord = (record: CustomerHealthRecord) => canUpdate ? () => onOpenRecordForm(detail, record) : undefined
  const historyFailed = (
    <DetailEmpty
      icon={<FileTextOutlined />}
      title="Không tải được dữ liệu"
      description="Kiểm tra kết nối rồi thử lại."
      action={<Button onClick={onRetryHistory}>Thử lại</Button>}
    />
  )

  const renderOverview = () => {
    const isLegacy = !detail.latestRecord
    const activeTreatments = detailTreatments.filter((treatment) => treatment.status === 'ACTIVE').length
    return (
      <div className="dm-stack">
        <DetailHero
          caption={isLegacy ? 'Thông tin cũ trên hồ sơ' : 'Lần khám gần nhất'}
          title={current.checked_date ? displayDate(current.checked_date) : 'Chưa có phiếu khám'}
          sub={isLegacy ? 'Chưa được tính là một lần khám' : <><UserOutlined /> {current.checked_by || 'Chưa ghi người khám'}</>}
          stats={[
            { label: 'Phiếu khám', value: historyLoading ? '–' : history.length },
            { label: 'Liệu trình đang dùng', value: historyLoading ? '–' : activeTreatments },
            { label: 'Dịch vụ lẻ đã làm', value: historyLoading ? '–' : detailAppointments.length },
          ]}
        />

        <div className="dm-overview">
          <HealthStatusCard fields={current} onEdit={detail.latestRecord ? editRecord(detail.latestRecord) : undefined} />

          <div className="dm-stack">
            <AllergyCard allergies={current.allergies} />
            <DetailCard title="Liên hệ">
              <div className="dm-info-list">
                <DetailInfoRow icon={<PhoneOutlined />} label="Điện thoại" value={detail.phone && <a href={`tel:${detail.phone}`}>{detail.phone}</a>} />
                <DetailInfoRow icon={<CalendarOutlined />} label="Ngày sinh" value={detail.birthday ? displayDate(String(detail.birthday)) : undefined} />
                <DetailInfoRow icon={<MailOutlined />} label="Email" value={detail.email ? String(detail.email) : detail.user?.email} />
              </div>
            </DetailCard>
          </div>
        </div>
      </div>
    )
  }

  const renderRecords = () => {
    if (historyLoading) return <DetailLoading label="Đang tải lịch sử khám" />
    if (historyError) return historyFailed
    if (!history.length) {
      return (
        <DetailEmpty
          icon={<FileTextOutlined />}
          title="Chưa có phiếu khám"
          description="Phiếu khám sẽ hiện ở đây sau lần khám đầu tiên."
          action={canUpdate && createButton}
        />
      )
    }
    return (
      <div className="dm-stack">
        {history.map((record, index) => (
          <HealthRecordCard key={record.id} record={record} skinTypes={skinTypes} latest={index === 0} onEdit={editRecord(record)} />
        ))}
      </div>
    )
  }

  const renderTreatments = () => {
    if (historyLoading) return <DetailLoading label="Đang tải liệu trình" />
    if (historyError) return historyFailed
    if (!detailTreatments.length) return <DetailEmpty icon={<MedicineBoxOutlined />} title="Khách chưa có liệu trình" />
    return (
      <div className="dm-stack">
        {detailTreatments.map((treatment) => {
          const status = TREATMENT_STATUS[String(treatment.status)] ?? { label: 'Đã hủy', tone: 'danger' as ChipTone }
          const used = treatment.sessions_used ?? 0
          const total = treatment.sessions_total ?? 0
          return (
            <DetailCard
              key={treatment.id}
              title={(treatment.package_id && packageNames[treatment.package_id]) || (treatment.package_snapshot as { name?: string } | undefined)?.name || 'Gói liệu trình'}
              extra={<DetailChip tone={status.tone}>{status.label}</DetailChip>}
            >
              {treatment.quota_type === 'SESSIONS' && total > 0 ? (
                <DetailProgress
                  percent={(used / total) * 100}
                  left={<>Đã dùng <b>{used}/{total}</b> buổi</>}
                  right={`Còn ${Math.max(0, total - used)} buổi`}
                />
              ) : (
                <div className="dm-meta mb-0!"><ClockCircleOutlined /> Không giới hạn buổi</div>
              )}
            </DetailCard>
          )
        })}
      </div>
    )
  }

  const renderServices = () => {
    if (historyLoading) return <DetailLoading label="Đang tải lịch sử dịch vụ" />
    if (historyError) return historyFailed
    if (!detailAppointments.length) return <DetailEmpty icon={<GiftOutlined />} title="Khách chưa làm dịch vụ lẻ" />
    return (
      <div className="dm-stack">
        {detailAppointments.map((appointment) => (
          <DetailCard
            key={appointment.id}
            title={appointment.service?.title || 'Dịch vụ'}
            extra={<DetailChip tone={appointment.status === 'completed' ? 'success' : 'pending'}>{appointment.status === 'completed' ? 'Hoàn tất' : 'Đang làm'}</DetailChip>}
          >
            <div className="dm-info-list dm-info-list-inline">
              <DetailInfoRow icon={<CalendarOutlined />} label="Thời gian" value={`${displayDate(appointment.appt_date)} ${appointment.start_time?.slice(0, 5) || ''}`.trim()} />
              <DetailInfoRow icon={<UserOutlined />} label="KTV" value={appointment.staff?.zalo_name} />
              <DetailInfoRow icon={<WalletOutlined />} label="Giá dịch vụ" value={`${Number(appointment.service_amount ?? appointment.service?.price ?? 0).toLocaleString('vi-VN')} ₫`} />
            </div>
            {appointment.diary && <DetailNote title="Nhật ký">{appointment.diary}</DetailNote>}
            {appointment.result && <DetailNote title="Kết quả / dặn dò">{appointment.result}</DetailNote>}
          </DetailCard>
        ))}
      </div>
    )
  }

  return (
    <DetailModal<TabKey>
      open
      onClose={() => { setTabState({ tab: 'overview' }); onClose() }}
      navLabel="Mục hồ sơ sức khỏe"
      leading={<CustomerAvatar profile={detail} size={52} />}
      title={displayName(detail)}
      meta={(
        <>
          {detail.customer_code && (
            <Typography.Text className="dm-code" copyable={{ text: detail.customer_code, tooltips: ['Sao chép mã', 'Đã sao chép'] }}>
              {detail.customer_code}
            </Typography.Text>
          )}
          {current.skin_type && <DetailChip tone="primary">{current.skin_type}</DetailChip>}
          {hasAllergy(current.allergies) && <DetailChip tone="danger">Dị ứng</DetailChip>}
        </>
      )}
      tabs={[
        { key: 'overview', label: 'Tổng quan', icon: <HomeOutlined /> },
        { key: 'records', label: 'Phiếu khám', icon: <FileTextOutlined />, count: historyLoading ? undefined : history.length },
        { key: 'treatments', label: 'Liệu trình', icon: <MedicineBoxOutlined /> },
        { key: 'services', label: 'Dịch vụ lẻ', icon: <GiftOutlined /> },
      ]}
      activeTab={tab}
      onTabChange={(next) => setTabState({ id: detail.id, tab: next })}
      footer={canUpdate && createButton}
    >
      {tab === 'overview' && renderOverview()}
      {tab === 'records' && renderRecords()}
      {tab === 'treatments' && renderTreatments()}
      {tab === 'services' && renderServices()}
    </DetailModal>
  )
}
