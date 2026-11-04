import { Button, Divider, message, Modal, Popconfirm, Progress, Select, Table, Tabs, Tag, Typography } from 'antd'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import { openHtmlPrint, errorMessage } from '@/api/helpers'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import { useBrandDateTime } from '@/themeRuntime'
import { PAY_METHOD, QUOTA_LABEL, STATUS_META, sessionUsage, treatmentProgress, type PaymentRow } from './constants'
import { SubHead } from './shared'
import SessionTimeline from './SessionTimeline'
import PointsHistoryPanel from './PointsHistoryPanel'

interface TreatmentDetailModalProps {
  detail: CustomerTreatment | null
  payOpen: boolean
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
  onClose: () => void
}

export default function TreatmentDetailModal({
  detail,
  payOpen,
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
  onClose,
}: TreatmentDetailModalProps) {
  const { formatDateTime } = useBrandDateTime()
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
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Rail trái: tóm tắt + hành động — card nền brand-bg như modal lần làm dịch vụ */}
            <aside style={{ flex: '1 1 260px', maxWidth: 330, padding: 18, border: '1px solid var(--brand-border)', borderRadius: 14, background: 'var(--brand-bg)' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}>
                {detail.quota_type === 'UNLIMITED' ? 'LIỆU TRÌNH TRỌN GÓI' : 'TIẾN ĐỘ LIỆU TRÌNH'}
              </Typography.Text>
              <Typography.Title level={4} style={{ margin: '5px 0 0' }}>{packageName(detail)}</Typography.Title>
              <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                {QUOTA_LABEL[detail.quota_type ?? ''] ?? detail.quota_type}
              </Typography.Text>
              {detail.quota_type !== 'UNLIMITED' ? (
                <>
                  <Progress percent={treatmentProgress(detail) ?? 0} size="small" showInfo={false} strokeColor="var(--brand-primary)" style={{ marginTop: 10 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                    <span>Đã dùng</span>
                    <strong>
                      {detail.quota_type === 'SESSIONS'
                        ? `${sessionUsage(detail).used} / ${sessionUsage(detail).total} buổi`
                        : `${formatMoney(detail.value_used)} / ${formatMoney(detail.value_total)}`}
                    </strong>
                  </div>
                </>
              ) : (
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>Không giới hạn số buổi</Typography.Text>
              )}
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'grid', gap: 9, fontSize: 13.5 }}>
                {canReadPayments && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span>Đã trả</span><strong>{formatMoney(detail.paid_amount)}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span>Công nợ</span>
                  <strong style={{ color: (detail.debt_amount ?? 0) > 0 ? '#D97706' : '#159447' }}>{formatMoney(detail.debt_amount)}</strong>
                </div>
                {detail.quota_type === 'SESSIONS' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span>Còn lại</span><strong>{sessionUsage(detail).remaining} buổi</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span>Trạng thái</span>
                  <Tag color={STATUS_META[detail.status ?? '']?.color} style={{ marginInlineEnd: 0 }}>
                    {STATUS_META[detail.status ?? '']?.label ?? detail.status}
                  </Tag>
                </div>
              </div>
              {supplementalInfo.length > 0 && (
                <div style={{ borderTop: '1px solid var(--brand-border-soft)', marginTop: 12, paddingTop: 12 }}>
                  <Typography.Text strong>Thông tin bổ sung</Typography.Text>
                  {supplementalInfo.map(({ key, label, value }) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6, fontSize: 13 }}>
                      <span style={{ color: '#6F7071' }}>{label}</span>
                      <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{value ?? '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                {canCreateSessions && detail.status === 'ACTIVE' && detail.quota_type !== 'UNLIMITED' && (
                  <Button block disabled={addingSessionId !== null} loading={addingSessionId === detail.id} onClick={() => onAddSession(detail)}>
                    +1 buổi
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
                {canReadPayments && <Button
                  block
                  onClick={() =>
                    void openHtmlPrint(`/invoices/${detail.id}/print`).catch((err) => message.error(errorMessage(err, 'Không mở được phiếu in — kiểm tra setting module.invoice')))
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

            {/* Vùng chính: buổi + thanh toán — desktop dùng Tabs, mobile dùng Select */}
            <div style={{ flex: '3 1 560px', minWidth: 0 }}>
              <Tabs
                className="desktop-only"
                activeKey={detailTab}
                onChange={(key) => onTabChange(key as typeof detailTab)}
                items={[
                  {
                    key: 'sessions',
                    label: 'Buổi điều trị',
                    children: (
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
                    ),
                  },
                  ...(canReadPayments ? [{
                    key: 'payments',
                    label: 'Lịch sử thanh toán',
                    children: (
                      <div style={{ border: '1px solid var(--brand-border)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
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
                    ),
                  }] : []),
                  {
                    key: 'points',
                    label: 'Điểm thưởng',
                    children: <PointsHistoryPanel profileId={detail.customer_profile_id} />,
                  },
                ]}
              />
              <div className="mobile-only" style={{ marginBottom: 12 }}>
                <Select
                  style={{ width: '100%' }}
                  value={detailTab}
                  onChange={(key) => onTabChange(key as typeof detailTab)}
                  options={([
                    { value: 'sessions', label: 'Buổi điều trị' },
                    ...(canReadPayments ? [{ value: 'payments', label: 'Lịch sử thanh toán' }] : []),
                    { value: 'points', label: 'Điểm thưởng' },
                  ])}
                />
              </div>
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
                  <Table<PaymentRow>
                    className="desktop-only"
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
          </div>
        )}
      </Modal>




  )
}

