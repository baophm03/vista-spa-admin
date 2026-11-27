import { Button, Dropdown, message, Modal } from 'antd'
import {
  CalendarOutlined,
  DollarOutlined,
  EditOutlined,
  HomeOutlined,
  MoreOutlined,
  PlusOutlined,
  StarOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { openHtmlPrint, errorMessage, pickData } from '@/api/helpers'
import { useGetConfig } from '@/api/endpoints/config'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import { useBrandDateTime } from '@/themeRuntime'
import CustomerAvatar from '@/pages/Customers/components/CustomerAvatar'
import DetailModal, {
  DetailCard,
  DetailChip,
  DetailEmpty,
  DetailField,
  DetailHero,
  DetailLoading,
  DetailProgress,
  type ChipTone,
  type DetailStat,
} from '@/components/base/DetailModal'
import { PAY_METHOD, QUOTA_LABEL, STATUS_META, bonusRemaining, sessionUsage, treatmentProgress, type PaymentRow } from './constants'
import SessionTimeline from './SessionTimeline'
import PointsHistoryPanel from './PointsHistoryPanel'

export type TreatmentDetailTab = 'overview' | 'sessions' | 'payments' | 'points'

const STATUS_TONE: Record<string, ChipTone> = {
  ACTIVE: 'primary',
  FINISHED: 'success',
  CANCELLED: 'neutral',
  EXPIRED: 'pending',
}

interface TreatmentDetailModalProps {
  detail: CustomerTreatment | null
  detailLoading: boolean
  payOpen: boolean
  detailTab: TreatmentDetailTab
  onTabChange: (tab: TreatmentDetailTab) => void
  profileName: (row: CustomerTreatment) => string
  profilePhone?: (row: CustomerTreatment) => string | undefined
  packageName: (row: CustomerTreatment) => string
  formatMoney: (value: unknown) => string
  currencySymbol: string
  canReadPayments: boolean
  canUpdate: boolean
  canCreateSessions: boolean
  isAdmin: boolean
  addingSessionId: string | null
  onAddSession: (row: CustomerTreatment) => void
  onPay: (row: CustomerTreatment) => void
  payments: PaymentRow[]
  payLoading: boolean
  paymentMethodLabels: Record<string, string>
  supplementalInfo: { key: string; label: string; value: string | undefined }[]
  focusSessionId: string | undefined
  onFocusSessionHandled: () => void
  staffOptions: { value: string; label: string }[]
  sessionCustomFields: CustomFieldDefWithOptions[]
  sessionsRefreshKey: number
  refresh: () => void
  refreshSelectedDetail: () => Promise<void>
  onCancelTreatment: (row: CustomerTreatment) => Promise<void>
  onEdit: (row: CustomerTreatment) => void
  onClose: () => void
}

export default function TreatmentDetailModal({
  detail,
  detailLoading,
  payOpen,
  detailTab,
  onTabChange,
  profileName,
  profilePhone,
  packageName,
  formatMoney,
  currencySymbol,
  canReadPayments,
  canUpdate,
  canCreateSessions,
  isAdmin,
  addingSessionId,
  onAddSession,
  onPay,
  payments,
  payLoading,
  paymentMethodLabels,
  supplementalInfo,
  focusSessionId,
  onFocusSessionHandled,
  staffOptions,
  sessionCustomFields,
  sessionsRefreshKey,
  refresh,
  refreshSelectedDetail,
  onCancelTreatment,
  onEdit,
  onClose,
}: TreatmentDetailModalProps) {
  const { formatDateTime } = useBrandDateTime()
  // Module hóa đơn tắt thì BE trả 404 "Module đang tắt" — ẩn nút In phiếu thay vì cho bấm lỗi
  const configQuery = useGetConfig(undefined, { query: { staleTime: 5 * 60 * 1000 } })
  const invoiceEnabled = pickData<{ settings?: Record<string, unknown> }>(configQuery.data)?.settings?.['module.invoice'] === true
  if (!detail) return null

  const status = STATUS_META[detail.status ?? '']
  const debt = Number(detail.debt_amount ?? 0)
  const usage = sessionUsage(detail)
  const tab = detailTab === 'payments' && !canReadPayments ? 'overview' : detailTab
  // Hết hạn mức (tính cả buổi chưa hoàn tất) thì không cho tạo thêm — huỷ/xoá buổi chưa làm mới tạo lại được
  const canAddSession = canCreateSessions && detail.status === 'ACTIVE' && detail.can_add_session !== false
  const canEdit = canUpdate && detail.status !== 'CANCELLED'
  const canCollect = canEdit && debt > 0
  // CT-06: chỉ Admin được hủy gói liệu trình
  const canCancel = isAdmin && canUpdate && detail.status === 'ACTIVE'
  // INV-01 — In phiếu hóa đơn gói liệu trình (mở hộp thoại In của trình duyệt)
  const canPrint = canReadPayments && invoiceEnabled
  const phone = profilePhone?.(detail)

  const renderOverview = () => {
    if (detailLoading) return <DetailLoading label="Đang tải tổng quan liệu trình" />
    const unlimited = detail.quota_type === 'UNLIMITED'
    const stats: DetailStat[] = [
      ...(canReadPayments ? [{ label: 'Đã trả', value: formatMoney(detail.paid_amount) }] : []),
      { label: 'Công nợ', value: formatMoney(detail.debt_amount), tone: debt > 0 ? 'pending' as const : 'success' as const },
      ...(detail.quota_type === 'SESSIONS' ? [{ label: 'Còn lại', value: `${usage.remaining} buổi` }] : []),
    ]
    return (
      <div className="dm-stack">
        <DetailHero
          caption={unlimited ? 'Liệu trình trọn đời' : 'Tiến độ liệu trình'}
          title={unlimited
            ? 'Không giới hạn buổi'
            : detail.quota_type === 'SESSIONS'
              ? `${usage.used} / ${usage.total} buổi`
              : `${formatMoney(detail.value_used)} / ${formatMoney(detail.value_total)}`}
          sub={QUOTA_LABEL[detail.quota_type ?? ''] ?? detail.quota_type}
          stats={stats}
        >
          {!unlimited && <DetailProgress percent={treatmentProgress(detail) ?? 0} />}
        </DetailHero>

        <DetailCard title="Thông tin gói">
          <div className="dm-grid">
            <DetailField label="Gói" value={packageName(detail)} />
            {detail.service?.title && <DetailField label="Dịch vụ" value={detail.service.title} />}
            {/* Buổi tặng còn lại = sessions_bonus - sessions_bonus_used (helper chung, khớp công thức backend) */}
            {detail.quota_type === 'SESSIONS' && Number(detail.sessions_bonus ?? 0) > 0 && (
              <DetailField label="Buổi tặng còn lại" value={`${bonusRemaining(detail)} buổi`} />
            )}
            {detail.referrer && <DetailField label="Người giới thiệu" value={detail.referrer.full_name || detail.referrer.zalo_name} />}
            {phone && <DetailField label="Điện thoại" value={<a href={`tel:${phone}`}>{phone}</a>} />}
          </div>
        </DetailCard>

        {supplementalInfo.length > 0 && (
          <DetailCard title="Thông tin bổ sung">
            <div className="dm-grid">
              {supplementalInfo.map(({ key, label, value }) => <DetailField key={key} label={label} value={value} emptyText="—" />)}
            </div>
          </DetailCard>
        )}
      </div>
    )
  }

  const renderPayments = () => {
    if (payLoading) return <DetailLoading label="Đang tải lịch sử thanh toán" />
    if (!payments.length) return <DetailEmpty icon={<WalletOutlined />} title="Chưa có lần thanh toán nào" />
    return (
      <DetailCard title="Lịch sử thanh toán" extra={<span className="dm-extra">Đã trả {formatMoney(detail.paid_amount)}</span>}>
        <div className="dm-list">
          {payments.map((payment) => (
            <div key={payment.id} className="dm-list-item">
              <div className="dm-list-main">
                <div className="dm-amount">{formatMoney(payment.amount)}</div>
                <div className="dm-label">
                  {formatDateTime(payment.paid_at || payment.created_at)}
                  {payment.note ? ` · ${payment.note}` : ''}
                </div>
              </div>
              <DetailChip tone="success">{paymentMethodLabels[payment.method ?? ''] ?? PAY_METHOD[payment.method ?? ''] ?? payment.method ?? '—'}</DetailChip>
            </div>
          ))}
        </div>
      </DetailCard>
    )
  }

  const moreItems = [
    ...(canPrint ? [{ key: 'print', label: 'In phiếu' }] : []),
    ...(canCancel ? [{ key: 'cancel', label: 'Hủy liệu trình', danger: true }] : []),
  ]
  const onMore = (key: string) => {
    if (key === 'print') {
      void openHtmlPrint(`/invoices/${detail.id}/print/admin`).catch((err) => message.error(errorMessage(err, 'Không mở được phiếu in. Vui lòng kiểm tra cấu hình hóa đơn.')))
    }
    if (key === 'cancel') {
      Modal.confirm({
        title: 'Hủy liệu trình này?',
        okText: 'Hủy liệu trình',
        okButtonProps: { danger: true },
        cancelText: 'Không',
        onOk: () => onCancelTreatment(detail),
      })
    }
  }
  const hasFooter = moreItems.length > 0 || canEdit || canAddSession || canCollect

  return (
    <DetailModal<TreatmentDetailTab>
      open={!payOpen}
      onClose={onClose}
      navLabel="Mục chi tiết liệu trình"
      leading={<CustomerAvatar profile={{ ...(detail as { user?: object }).user, full_name: profileName(detail) } as never} size={52} />}
      title={profileName(detail)}
      meta={(
        <>
          <span className="dm-code">{packageName(detail)}</span>
          {status && <DetailChip tone={STATUS_TONE[detail.status ?? ''] ?? 'neutral'}>{status.label}</DetailChip>}
          {debt > 0 && <DetailChip tone="pending">Còn nợ {formatMoney(debt)}</DetailChip>}
        </>
      )}
      tabs={[
        { key: 'overview', label: 'Tổng quan', icon: <HomeOutlined /> },
        { key: 'sessions', label: 'Buổi điều trị', icon: <CalendarOutlined /> },
        ...(canReadPayments ? [{ key: 'payments' as const, label: 'Thanh toán', icon: <WalletOutlined />, count: payLoading ? undefined : payments.length }] : []),
        { key: 'points', label: 'Điểm thưởng', icon: <StarOutlined /> },
      ]}
      activeTab={tab}
      onTabChange={onTabChange}
      footer={hasFooter && (
        <>
          {moreItems.length > 0 && (
            <Dropdown menu={{ items: moreItems, onClick: ({ key }) => onMore(key) }} trigger={['click']} placement="topLeft">
              <Button className="dm-footer-start dm-more" icon={<MoreOutlined />} aria-label="Thao tác khác" />
            </Dropdown>
          )}
          {/* CT-04 — Sửa số tiền (chưa thu tiền) / hạn sử dụng / ghi chú / custom fields */}
          {canEdit && <Button icon={<EditOutlined />} onClick={() => onEdit(detail)}>Sửa</Button>}
          {canAddSession && (
            <Button
              type={canCollect ? 'default' : 'primary'}
              icon={<PlusOutlined />}
              disabled={addingSessionId !== null}
              loading={addingSessionId === detail.id}
              onClick={() => onAddSession(detail)}
            >
              1 buổi
            </Button>
          )}
          {canCollect && (
            <Button type="primary" icon={<DollarOutlined />} onClick={() => onPay(detail)}>
              Thu tiền<span className="max-md:hidden"> ({formatMoney(debt)})</span>
            </Button>
          )}
        </>
      )}
    >
      {tab === 'overview' && renderOverview()}
      {tab === 'sessions' && (
        <SessionTimeline
          ctId={detail.id}
          ctStatus={detail.status}
          treatmentTotalAmount={detail.total_amount}
          formatMoney={formatMoney}
          currencySymbol={currencySymbol}
          staffOptions={staffOptions}
          customFieldDefinitions={sessionCustomFields}
          isAdmin={isAdmin}
          onChanged={() => { refresh(); void refreshSelectedDetail() }}
          refreshKey={sessionsRefreshKey}
          focusSessionId={focusSessionId}
          onFocusSessionHandled={onFocusSessionHandled}
        />
      )}
      {tab === 'payments' && renderPayments()}
      {tab === 'points' && <PointsHistoryPanel profileId={detail.user_id} />}
    </DetailModal>
  )
}
