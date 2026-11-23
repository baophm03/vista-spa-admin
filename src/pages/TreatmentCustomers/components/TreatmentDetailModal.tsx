import { Button, Divider, Grid, message, Modal, Popconfirm, Progress, Select, Table, Tabs, Tag, Typography } from 'antd'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import { openHtmlPrint, errorMessage, pickData } from '@/api/helpers'
import { useGetConfig } from '@/api/endpoints/config'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import { useBrandDateTime } from '@/themeRuntime'
import { PAY_METHOD, QUOTA_LABEL, STATUS_META, bonusRemaining, sessionUsage, treatmentProgress, type PaymentRow } from './constants'
import { SubHead } from './shared'
import SessionTimeline from './SessionTimeline'
import PointsHistoryPanel from './PointsHistoryPanel'

interface TreatmentDetailModalProps {
  detail: CustomerTreatment | null
  payOpen: boolean
  /** Mobile: chọn hiển thị 1 phần — 'summary' = panel tóm tắt+nút, 'tabs' = Buổi/TT/Điểm.
   *  Desktop bỏ qua, luôn hiện cả 2 cột. */
  mobileSection?: 'summary' | 'tabs'
  detailTab: 'sessions' | 'payments' | 'points'
  onTabChange: (tab: 'sessions' | 'payments' | 'points') => void
  profileName: (row: CustomerTreatment) => string
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
  onConvert: (row: CustomerTreatment) => void
  onEdit: (row: CustomerTreatment) => void
  onClose: () => void
}

export default function TreatmentDetailModal({
  detail,
  payOpen,
  mobileSection,
  detailTab,
  onTabChange,
  profileName,
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
  onConvert,
  onEdit,
  onClose,
}: TreatmentDetailModalProps) {
  const { formatDateTime } = useBrandDateTime()
  const isMobile = !Grid.useBreakpoint().md
  // Module hóa đơn tắt thì BE trả 404 "Module đang tắt" — ẩn nút In phiếu thay vì cho bấm lỗi
  const configQuery = useGetConfig(undefined, { query: { staleTime: 5 * 60 * 1000 } })
  const invoiceEnabled = pickData<{ settings?: Record<string, unknown> }>(configQuery.data)?.settings?.['module.invoice'] === true
  return (
    <Modal
      open={!!detail && !payOpen}
      onCancel={onClose}
      title={detail ? `${profileName(detail)} · ${packageName(detail)}` : 'Chi tiết liệu trình'}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width="min(1200px, calc(100vw - 24px))"
      style={{ top: 20 }}
    >
      {detail && (
        <div className="flex flex-wrap items-start gap-5">
          {/* Rail trái: tóm tắt + hành động — card nền brand-bg như modal lần làm dịch vụ */}
          {/* Cố định rail trái: scroll cột phải thì aside đứng yên (trừ mobile xếp chồng) */}
          {/* Mobile mobileSection='tabs' → ẩn rail này, chỉ hiện phần tab cho gọn */}
          {(!isMobile || mobileSection !== 'tabs') && (
          <aside
            className={`flex-[1_1_260px] rounded-[14px] border border-[var(--brand-border)] bg-[var(--brand-bg)] ${isMobile ? 'p-3' : 'max-w-[330px] p-[18px]'}`}
            style={isMobile ? undefined : { position: 'sticky', top: 0, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}
          >
            <Typography.Text type="secondary" className={isMobile ? 'text-[11px] font-extrabold tracking-[1.2px]' : 'text-xs font-extrabold tracking-[1.2px]'}>
              {detail.quota_type === 'UNLIMITED' ? 'LIỆU TRÌNH TRỌN ĐỜI' : 'TIẾN ĐỘ LIỆU TRÌNH'}
            </Typography.Text>
            <Typography.Title level={4} className={`mb-0! ${isMobile ? 'mt-1! text-lg!' : 'mt-[5px]!'}`}>{packageName(detail)}</Typography.Title>
            <Typography.Text type="secondary" className="block text-[12.5px]">
              {QUOTA_LABEL[detail.quota_type ?? ''] ?? detail.quota_type}
            </Typography.Text>
            {detail.quota_type !== 'UNLIMITED' ? (
              <>
                <Progress percent={treatmentProgress(detail) ?? 0} size="small" showInfo={false} strokeColor="var(--brand-primary)" className={isMobile ? 'mt-1.5' : 'mt-2.5'} />
                <div className={`flex justify-between gap-2.5 ${isMobile ? 'text-[12.5px]' : 'text-[13px]'}`}>
                  <span>Đã dùng</span>
                  <strong>
                    {detail.quota_type === 'SESSIONS'
                      ? `${sessionUsage(detail).used} / ${sessionUsage(detail).total} buổi`
                      : `${formatMoney(detail.value_used)} / ${formatMoney(detail.value_total)}`}
                  </strong>
                </div>
              </>
            ) : (
              <Typography.Text type="secondary" className="mt-1 block">Không giới hạn số buổi</Typography.Text>
            )}
            <Divider className={isMobile ? 'my-2!' : 'my-3!'} />
            <div className={`grid ${isMobile ? 'gap-1.5 text-[13px]' : 'gap-[9px] text-[13.5px]'}`}>
              {canReadPayments && (
                <div className="flex justify-between gap-2.5">
                  <span>Đã trả</span><strong>{formatMoney(detail.paid_amount)}</strong>
                </div>
              )}
              <div className="flex justify-between gap-2.5">
                <span>Công nợ</span>
                <strong className={(detail.debt_amount ?? 0) > 0 ? 'text-[#D97706]' : 'text-[#159447]'}>{formatMoney(detail.debt_amount)}</strong>
              </div>
              {detail.quota_type === 'SESSIONS' && (
                <div className="flex justify-between gap-2.5">
                  <span>Còn lại</span><strong>{sessionUsage(detail).remaining} buổi</strong>
                </div>
              )}
              {/* Buổi tặng còn lại = sessions_bonus - sessions_bonus_used (helper chung, khớp công thức backend) */}
              {detail.quota_type === 'SESSIONS' && Number(detail.sessions_bonus ?? 0) > 0 && (
                <div className="flex justify-between gap-2.5">
                  <span>Buổi tặng còn lại</span>
                  <strong>{bonusRemaining(detail)} buổi</strong>
                </div>
              )}
              {/* Combo: quota còn lại theo từng dịch vụ */}
              {!!detail.services?.length && (
                <>
                  <Divider className="my-3!" />
                  <Typography.Text type="secondary" className="text-xs font-extrabold tracking-[1.2px]">
                    QUOTA THEO DỊCH VỤ
                  </Typography.Text>
                  <div className="mt-2 grid gap-[7px] text-[13px]">
                    {detail.services.map((service) => (
                      <div key={service.service_id} className="flex items-center justify-between gap-2.5">
                        <span className="truncate">{service.service_name}</span>
                        <strong className="whitespace-nowrap">
                          {service.qty_remaining}/{service.qty_total} buổi
                          {!!service.qty_reserved && <span className="font-medium text-[#777]"> · giữ {service.qty_reserved}</span>}
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {detail.referrer && (
                <div className="flex justify-between gap-2.5">
                  <span>Người giới thiệu</span>
                  <strong>{detail.referrer.full_name || detail.referrer.zalo_name}</strong>
                </div>
              )}
              <div className="flex items-center justify-between gap-2.5">
                <span>Trạng thái</span>
                <Tag color={STATUS_META[detail.status ?? '']?.color} className="me-0">
                  {STATUS_META[detail.status ?? '']?.label ?? detail.status}
                </Tag>
              </div>
            </div>
            {supplementalInfo.length > 0 && (
              <div className={`border-t border-[var(--brand-border-soft)] ${isMobile ? 'mt-2 pt-2' : 'mt-3 pt-3'}`}>
                <Typography.Text strong style={isMobile ? { fontSize: 13 } : undefined}>Thông tin bổ sung</Typography.Text>
                {supplementalInfo.map(({ key, label, value }) => (
                  <div key={key} className={`flex justify-between gap-3 ${isMobile ? 'mt-1 text-[12.5px]' : 'mt-1.5 text-[13px]'}`}>
                    <span className="text-[#6F7071]">{label}</span>
                    <span className="text-right wrap-anywhere">{value ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className={`flex flex-col ${isMobile ? 'mt-2.5 gap-1.5' : 'mt-4 gap-2'}`}>
              {canCreateSessions && detail.status === 'ACTIVE' && (
                <Button block disabled={addingSessionId !== null} loading={addingSessionId === detail.id} onClick={() => onAddSession(detail)}>
                  +1 buổi
                </Button>
              )}
              {/* TA-02 — Đổi buổi tặng: chỉ hiện khi còn buổi tặng khả dụng (quyền chi tiết do backend chốt: convertible_note hoặc treatment.convert) */}
              {canUpdate && detail.status === 'ACTIVE' && detail.quota_type === 'SESSIONS' && bonusRemaining(detail) > 0 && (
                <Button block onClick={() => onConvert(detail)}>
                  Đổi buổi tặng
                </Button>
              )}
              {/* CT-04 — Sửa số tiền (chưa thu tiền) / hạn sử dụng / ghi chú / custom fields */}
              {canUpdate && detail.status !== 'CANCELLED' && (
                <Button block onClick={() => onEdit(detail)}>
                  Sửa liệu trình
                </Button>
              )}
              {canUpdate && detail.status !== 'CANCELLED' && (detail.debt_amount ?? 0) > 0 && (
                <Button
                  block
                  type="primary"
                  onClick={() => onPay(detail)}
                >
                  Thu tiền ({formatMoney(detail.debt_amount)})
                </Button>
              )}
              {/* INV-01 — In phiếu hóa đơn gói liệu trình (mở hộp thoại In của trình duyệt) */}
              {canReadPayments && invoiceEnabled && <Button
                block
                onClick={() =>
                  void openHtmlPrint(`/invoices/${detail.id}/print/admin`).catch((err) => message.error(errorMessage(err, 'Không mở được phiếu in. Vui lòng kiểm tra cấu hình hóa đơn.')))
                }
              >
                In phiếu
              </Button>}
              {/* CT-06: chỉ Admin được hủy gói liệu trình */}
              {isAdmin && canUpdate && detail.status === 'ACTIVE' && (
                <Popconfirm title="Hủy liệu trình này?" okText="Hủy" cancelText="Không" onConfirm={() => void onCancelTreatment(detail)}>
                  <Button block danger>
                    Hủy liệu trình
                  </Button>
                </Popconfirm>
              )}
            </div>
          </aside>
          )}

          {/* Vùng chính: desktop dùng thanh Tabs, mobile dùng Select — nội dung render DUY NHẤT
                ở khối phía dưới; trước đây Tabs lẫn khối dưới cùng cùng render nội dung gây double render */}
          {/* Mobile mobileSection='summary' → ẩn phần tab, popup chỉ còn panel tóm tắt gọn */}
          {(!isMobile || mobileSection !== 'summary') && (
          <div className="min-w-0 flex-[3_1_560px]">
            <Tabs
              className="max-md:hidden!"
              activeKey={detailTab}
              onChange={(key) => onTabChange(key as typeof detailTab)}
              items={[
                { key: 'sessions', label: 'Buổi điều trị' },
                ...(canReadPayments ? [{ key: 'payments', label: 'Lịch sử thanh toán' }] : []),
                { key: 'points', label: 'Điểm thưởng' },
              ]}
            />
            <Select
              className="mb-6! w-full md:hidden!"
              value={detailTab}
              onChange={(key) => onTabChange(key as typeof detailTab)}
              options={([
                { value: 'sessions', label: 'Buổi điều trị' },
                ...(canReadPayments ? [{ value: 'payments', label: 'Lịch sử thanh toán' }] : []),
                { value: 'points', label: 'Điểm thưởng' },
              ])}
            />
            {detailTab === 'sessions' && (
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
            {detailTab === 'payments' && canReadPayments && (
              <>
                {/* Desktop: bảng trong khung viền (giữ giao diện tab cũ); MobileCards tự ẩn trên desktop */}
                <div className="hidden overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white md:block">
                  <SubHead>Lịch sử thanh toán</SubHead>
                  <Table<PaymentRow>
                    rowKey="id"
                    size="small"
                    loading={payLoading}
                    dataSource={payments}
                    pagination={false}
                    locale={{ emptyText: <TableEmpty description="Chưa có lần thanh toán nào" /> }}
                    columns={[
                      {
                        title: 'Thời gian',
                        key: 'time',
                        width: 170,
                        render: (_, p) => {
                          const t = p.paid_at || p.created_at
                          return formatDateTime(t)
                        },
                      },
                      {
                        title: 'Số tiền',
                        dataIndex: 'amount',
                        width: 140,
                        render: (v) => <b>{formatMoney(v)}</b>,
                      },
                      {
                        title: 'Phương thức',
                        dataIndex: 'method',
                        width: 130,
                        render: (v: string) => paymentMethodLabels[v] ?? PAY_METHOD[v] ?? v ?? '—',
                      },
                      { title: 'Ghi chú', dataIndex: 'note', render: (v) => v || '—' },
                    ]}
                  />
                </div>
                <MobileCards
                  rows={payments}
                  rowKey={(p) => p.id}
                  loading={payLoading}
                  emptyText="Chưa có lần thanh toán nào"
                  renderCard={(p) => (
                    <>
                      <div className="mobile-card-head">
                        <div className="mobile-card-title">{formatMoney(p.amount)}</div>
                        <Tag color="green">{paymentMethodLabels[p.method ?? ''] ?? PAY_METHOD[p.method ?? ''] ?? p.method ?? '—'}</Tag>
                      </div>
                      <div className="mobile-card-rows">
                        <MobileCardRow label="Thời gian" value={formatDateTime(p.paid_at || p.created_at)} />
                        {p.note && <MobileCardRow label="Ghi chú" value={p.note} />}
                      </div>
                    </>
                  )}
                />
              </>
            )}
            {detailTab === 'points' && <PointsHistoryPanel profileId={detail.customer_profile_id} />}
          </div>
          )}
        </div>
      )}
    </Modal>
  )
}