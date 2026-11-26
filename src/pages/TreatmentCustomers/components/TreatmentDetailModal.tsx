import { Button, Divider, Grid, message, Modal, Popconfirm, Progress, Select, Table, Tabs, Tag, Typography } from 'antd'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import { openHtmlPrint, errorMessage, pickData } from '@/api/helpers'
import { useGetConfig } from '@/api/endpoints/config'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import { useBrandDateTime } from '@/themeRuntime'
import useDesktopLayout from '@/hooks/useDesktopLayout'
import { PAY_METHOD, QUOTA_LABEL, STATUS_META, bonusRemaining, sessionUsage, treatmentProgress, type PaymentRow } from './constants'
import { SubHead, TreatmentLoading } from './shared'
import SessionTimeline from './SessionTimeline'
import PointsHistoryPanel from './PointsHistoryPanel'

interface TreatmentDetailModalProps {
  detail: CustomerTreatment | null
  detailLoading: boolean
  payOpen: boolean
  /** Mobile và tablet: 'summary' hiện tóm tắt và thao tác, 'tabs' hiện lịch sử.
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
  onEdit: (row: CustomerTreatment) => void
  onClose: () => void
}

export default function TreatmentDetailModal({
  detail,
  detailLoading,
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
  onEdit,
  onClose,
}: TreatmentDetailModalProps) {
  const { formatDateTime } = useBrandDateTime()
  const isMobile = !Grid.useBreakpoint().md
  const isDesktop = useDesktopLayout()
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
          {(isDesktop || mobileSection !== 'tabs') && (
          detailLoading ? (
            <aside className="min-w-0 flex-[1_1_260px] lg:max-w-[330px]">
              <TreatmentLoading label="Đang tải tổng quan liệu trình" count={1} />
            </aside>
          ) : (
          <aside
            className={`flex-[1_1_260px] rounded-[14px] border border-[var(--brand-border)] bg-[var(--brand-bg)] ${isMobile ? 'p-3' : 'p-[18px]'} lg:sticky lg:top-0 lg:max-h-[calc(100vh-140px)] lg:max-w-[330px] lg:overflow-y-auto`}
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
              {detail.service?.title && (
                <div className="flex justify-between gap-2.5">
                  <span>Dịch vụ</span>
                  <strong className="text-right">{detail.service.title}</strong>
                </div>
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
              {/* Hết hạn mức (tính cả buổi chưa hoàn tất) thì không cho tạo thêm — huỷ/xoá buổi chưa làm mới tạo lại được */}
              {canCreateSessions && detail.status === 'ACTIVE' && detail.can_add_session !== false && (
                <Button block disabled={addingSessionId !== null} loading={addingSessionId === detail.id} onClick={() => onAddSession(detail)}>
                  +1 buổi
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
          )
          )}

          {/* Vùng chính: desktop dùng thanh Tabs, mobile dùng Select — nội dung render DUY NHẤT
                ở khối phía dưới; trước đây Tabs lẫn khối dưới cùng cùng render nội dung gây double render */}
          {(isDesktop || mobileSection !== 'summary') && (
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
            {detailTab === 'payments' && canReadPayments && (payLoading ? (
              <TreatmentLoading label="Đang tải lịch sử thanh toán" />
            ) : (
              <>
                {/* Desktop: bảng trong khung viền (giữ giao diện tab cũ); MobileCards tự ẩn trên desktop */}
                <div className="hidden overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white md:block">
                  <SubHead>Lịch sử thanh toán</SubHead>
                  <Table<PaymentRow>
                    rowKey="id"
                    size="small"
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
            ))}
            {detailTab === 'points' && <PointsHistoryPanel profileId={detail.user_id} />}
          </div>
          )}
        </div>
      )}
    </Modal>
  )
}
