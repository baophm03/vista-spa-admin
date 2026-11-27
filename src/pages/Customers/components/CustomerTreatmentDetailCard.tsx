import { Image } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { DetailCard, DetailChip, DetailField, DetailProgress, type ChipTone } from '@/components/base/DetailModal'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { PaymentLog } from '@/api/models/paymentLog'
import type { SessionPhoto } from '@/api/models/sessionPhoto'
import type { TreatmentSession } from '@/api/models/treatmentSession'
import { useBrandCurrency, useBrandDateTime } from '@/themeRuntime'
import { fileSrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import useSessionStatusConfig from '@/hooks/useSessionStatusConfig'

interface Props {
  treatment: CustomerTreatment & { package_type?: { name?: string; code?: string } | null }
  sessions: TreatmentSession[]
  payments: PaymentLog[]
  photos: SessionPhoto[]
  canReadPayments: boolean
}

const TREATMENT_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  ACTIVE: { label: 'Đang dùng', tone: 'success' },
  FINISHED: { label: 'Hoàn tất', tone: 'primary' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
}

const PAYMENT_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  UNPAID: { label: 'Chưa thanh toán', tone: 'danger' },
  PARTIAL: { label: 'Thanh toán một phần', tone: 'pending' },
  PAID: { label: 'Đã thanh toán', tone: 'success' },
}

const QUOTA_LABEL: Record<string, string> = {
  SESSIONS: 'Theo số buổi',
  VALUE: 'Theo định mức tiền',
  UNLIMITED: 'Trọn đời',
}

const PAYMENT_METHOD: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  POS: 'POS',
  OTHER: 'Khác',
}

function localizedLabel(value: unknown, labels: Record<string, string>) {
  const raw = String(value ?? '')
  return labels[raw] ?? labels[raw.toUpperCase()] ?? (raw || '—')
}

export default function CustomerTreatmentDetailCard({ treatment, sessions, payments, photos, canReadPayments }: Props) {
  const { format: money } = useBrandCurrency()
  const { formatDateTime } = useBrandDateTime()
  const sessionStatusConfig = useSessionStatusConfig()
  const urlMap = useFileUrlMap()
  const photoSrcOf = (photo: SessionPhoto) => fileSrc((photo as any).file) ?? resolveFileSrc(urlMap, (photo as any).file_id)
  const title = (treatment.package_snapshot?.name as string | undefined) || treatment.package_type?.name || 'Gói dịch vụ'
  const treatmentStatus = TREATMENT_STATUS[String(treatment.status ?? '').toUpperCase()] ?? { label: treatment.status || '—', tone: 'neutral' as ChipTone }
  const paymentStatus = PAYMENT_STATUS[String(treatment.payment_status ?? '').toUpperCase()] ?? { label: treatment.payment_status || '—', tone: 'neutral' as ChipTone }
  const quota = treatment.quota_type === 'SESSIONS'
    ? Math.max(0, Number(treatment.sessions_total ?? 0) - Number(treatment.sessions_used ?? 0)) + ' buổi'
    : treatment.quota_type === 'VALUE'
      ? money(Number(treatment.value_total ?? 0) - Number(treatment.value_used ?? 0))
      : 'Không giới hạn'

  const sessionChip = (value: string | null | undefined) => {
    const status = value ? sessionStatusConfig[value.toLowerCase() as keyof typeof sessionStatusConfig] : undefined
    return status
      ? <span className="dm-chip" style={{ color: status.color, background: `${status.color}1A` }}>{status.label}</span>
      : <DetailChip>{value ?? '—'}</DetailChip>
  }
  const navigate = useNavigate()
  // Dịch vụ lẻ (gói SINGLE_SESSION) mở ở /standalone-service-customers, còn lại ở /treatment-customers
  const isSingle = String(treatment.package_type?.code ?? '').toUpperCase() === 'SINGLE_SESSION'
  const openTreatment = (tab: 'overview' | 'sessions' | 'payments') => navigate(
    `/${isSingle ? 'standalone-service-customers' : 'treatment-customers'}?treatment_id=${encodeURIComponent(treatment.id)}${tab === 'overview' ? '' : `&tab=${tab}`}`,
  )
  const used = Number(treatment.sessions_used ?? 0)
  const total = Number(treatment.sessions_total ?? 0)

  return (
    <DetailCard
      title={title}
      extra={(
        <span className="dm-title-row">
          <DetailChip tone={treatmentStatus.tone}>{treatmentStatus.label}</DetailChip>
          <button type="button" className="dm-link" onClick={() => openTreatment('overview')}>Xem chi tiết <RightOutlined /></button>
        </span>
      )}
    >
      {treatment.quota_type === 'SESSIONS' && total > 0 && (
        <div className="mb-4">
          <DetailProgress percent={(used / total) * 100} left={<>Đã dùng <b>{used}/{total}</b> buổi</>} right={`Còn ${quota}`} />
        </div>
      )}
      <div className="dm-grid">
        <DetailField label="Loại hạn mức" value={localizedLabel(treatment.quota_type, QUOTA_LABEL)} />
        <DetailField label="Còn lại" value={quota} />
        {canReadPayments && <DetailField label="Đã thanh toán" value={money(treatment.paid_amount)} />}
        <DetailField label="Công nợ" value={<span className={Number(treatment.debt_amount ?? 0) > 0 ? 'dm-text-pending' : undefined}>{money(treatment.debt_amount)}</span>} />
        {canReadPayments && <DetailField label="Trạng thái thanh toán" value={<DetailChip tone={paymentStatus.tone}>{paymentStatus.label}</DetailChip>} />}
      </div>

      <div className="dm-subtitle">Lịch sử buổi</div>
      {sessions.length ? (
        <div className="dm-list">
          {sessions.map((session) => (
            <button key={session.id} type="button" className="dm-list-item dm-list-link" onClick={() => openTreatment('sessions')}>
              <div className="dm-list-main">
                <div className="dm-value">Buổi {session.session_no} · {formatDateTime(session.scheduled_at)}</div>
                {session.diary && <div className="dm-label">{session.diary}</div>}
              </div>
              {sessionChip(session.status)}
              <RightOutlined className="dm-list-chevron" />
            </button>
          ))}
        </div>
      ) : <div className="dm-value dm-value-empty">Chưa có buổi điều trị</div>}

      {canReadPayments && <>
        <div className="dm-subtitle">Thanh toán</div>
        {payments.length ? (
          <div className="dm-list">
            {payments.map((payment) => (
              <button key={payment.id} type="button" className="dm-list-item dm-list-link" onClick={() => openTreatment('payments')}>
                <div className="dm-list-main">
                  <div className="dm-amount">{money(payment.amount)}</div>
                  <div className="dm-label">{formatDateTime(payment.paid_at)}{payment.note ? ` · ${payment.note}` : ''}</div>
                </div>
                <DetailChip tone="success">{localizedLabel(payment.method, PAYMENT_METHOD)}</DetailChip>
                <RightOutlined className="dm-list-chevron" />
              </button>
            ))}
          </div>
        ) : <div className="dm-value dm-value-empty">Chưa có thanh toán</div>}
      </>}

      <div className="dm-subtitle">Ảnh buổi điều trị</div>
      {photos.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {photos.map((photo) => photoSrcOf(photo)
            ? <Image key={photo.id} width="100%" height="100%" style={{ aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 8 }} src={photoSrcOf(photo) ?? undefined} alt={photo.caption || 'Ảnh buổi điều trị'} />
            : <DetailChip key={photo.id}>{photo.caption || 'Ảnh buổi điều trị'} đã lưu</DetailChip>)}
        </div>
      ) : <div className="dm-value dm-value-empty">Chưa có ảnh buổi điều trị.</div>}
    </DetailCard>
  )
}
