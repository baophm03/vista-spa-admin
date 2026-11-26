import { Alert, Card, Form, Grid, Input, InputNumber, Modal, Select, Space, Tabs, Typography } from 'antd'
import { TreatmentLoading } from './shared'
import type { FormInstance } from 'antd'
import type { LookupItem } from '@/api/models/lookupItem'
import type { CustomerTreatment } from '@/api/models/customerTreatment'

export type ManualDiscountMode = 'percent' | 'amount'
export type PromoTab = 'manual' | 'discount' | 'redeem'

interface TreatmentPaymentModalProps {
  form: FormInstance
  open: boolean
  currencySymbol: string
  lookupLoading: boolean
  lookupError: string
  activePaymentMethods: LookupItem[]
  submitting: boolean
  /** Ngữ cảnh ưu đãi: gói đang thu tiền (fetch fresh lúc mở modal). */
  promoRow: CustomerTreatment | null
  formatMoney: (value: unknown) => string
  promoTab: PromoTab
  onPromoTabChange: (tab: PromoTab) => void
  /** Voucher treatment-package khách đang giữ, khớp gói liệu trình của lần thu này (từ API /voucher-customers). */
  customerVouchers: Array<{ voucherId: string; assignmentId: string | null; title: string; discountType: 'PERCENT' | 'AMOUNT' | 'GIFT' | null | undefined; discountValue: number | string | null | undefined }>
  vouchersLoading: boolean
  selectedVoucherId: string | null
  onPickVoucher: (voucherId: string | null) => void
  manualForm: FormInstance
  manualMode: ManualDiscountMode
  onManualModeChange: (mode: ManualDiscountMode) => void
  redeemForm: FormInstance
  pointsLoading: boolean
  pointsError: boolean
  pointsLoaded: boolean
  pointsErrorMessage: string
  isPointsEnabled: boolean
  redemptionConfigReady: boolean
  redeemBalance: number
  balanceMaxRedeemPercent: number
  redeemPointsValue: number
  redeemMoney: number
  pointValue: number
  redeemInvoiceAmount: number
  minRedeemMoney: number
  maxRedeemMoney: number
  minRedeemPercent: number
  maxRedeemPercent: number
  maxRedeemPoints: number | null
  redeemValidationMessage: string
  /** Mức giảm dự kiến từ lựa chọn hiện tại và số tiền còn lại phải thu. */
  promoDiscount: number
  promoRemaining: number
  canReadDiscount: boolean
  canRedeemPoints: boolean
  onCancel: () => void
  onOk: () => void
}

function BillRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <Typography.Text type={muted ? 'secondary' : undefined} strong={strong}>{label}</Typography.Text>
      <Typography.Text type={muted ? 'secondary' : undefined} strong={strong}>{value}</Typography.Text>
    </div>
  )
}

export default function TreatmentPaymentModal({
  form,
  open,
  currencySymbol,
  lookupLoading,
  lookupError,
  activePaymentMethods,
  submitting,
  promoRow,
  formatMoney,
  promoTab,
  onPromoTabChange,
  customerVouchers,
  vouchersLoading,
  selectedVoucherId,
  onPickVoucher,
  manualForm,
  manualMode,
  onManualModeChange,
  redeemForm,
  pointsLoading,
  pointsError,
  pointsLoaded,
  pointsErrorMessage,
  isPointsEnabled,
  redemptionConfigReady,
  redeemBalance,
  balanceMaxRedeemPercent,
  redeemPointsValue,
  redeemMoney,
  pointValue,
  redeemInvoiceAmount,
  maxRedeemMoney,
  minRedeemPercent,
  maxRedeemPercent,
  maxRedeemPoints,
  redeemValidationMessage,
  promoDiscount,
  canReadDiscount,
  canRedeemPoints,
  onCancel,
  onOk,
}: TreatmentPaymentModalProps) {
  const promoItems = [
    ...(canReadDiscount ? [{
      key: 'manual' as const,
      label: 'Giảm trực tiếp',
      children: (
        <Form form={manualForm} layout="vertical">
          <Form.Item
            name="value"
            label={manualMode === 'percent' ? 'Mức giảm' : 'Số tiền giảm'}
          >
            <InputNumber
              min={0}
              max={manualMode === 'percent' ? 100 : undefined}
              precision={0}
              step={manualMode === 'percent' ? 1 : 10000}
              placeholder={manualMode === 'percent' ? 'Nhập %' : 'Nhập số tiền'}
              className="w-full!"
              addonAfter={
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onManualModeChange(manualMode === 'percent' ? 'amount' : 'percent')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onManualModeChange(manualMode === 'percent' ? 'amount' : 'percent')
                    }
                  }}
                  style={{ cursor: 'pointer', userSelect: 'none', fontWeight: 600, display: 'inline-block', minWidth: 16, textAlign: 'center' }}
                >
                  {manualMode === 'percent' ? '%' : '₫'}
                </span>
              }
            />
          </Form.Item>
        </Form>
      ),
    }] : []),
    ...(canReadDiscount ? [{
      key: 'discount' as const,
      label: 'Áp ưu đãi',
      children: vouchersLoading ? <TreatmentLoading label="Đang tải voucher" count={1} /> : (
        <Form layout="vertical">
          <Form.Item label="Voucher khách đang có">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Chọn voucher của khách để áp giảm"
              value={selectedVoucherId ?? undefined}
              options={customerVouchers.map((voucher) => ({
                value: voucher.voucherId,
                label: `${voucher.title} — ${voucher.discountType === 'PERCENT' ? `Giảm ${Number(voucher.discountValue ?? 0)}%` : `Giảm ${formatMoney(voucher.discountValue)}`}`,
              }))}
              notFoundContent="Khách chưa có voucher phù hợp với gói này"
              onChange={(value) => onPickVoucher((value as string | undefined) ?? null)}
            />
          </Form.Item>
        </Form>
      ),
    }] : []),
    ...(canRedeemPoints ? [{
      key: 'redeem' as const,
      label: 'Đổi điểm',
      children: pointsLoading ? <TreatmentLoading label="Đang tải số dư điểm" count={1} /> : (
        <Form form={redeemForm} layout="vertical">
          {pointsError ? (
            <Alert type="error" showIcon className="mb-3" message="Không tải được số dư và cấu hình điểm" description={pointsErrorMessage} />
          ) : null}
          {pointsLoaded && !isPointsEnabled ? (
            <Alert type="warning" showIcon className="mb-3" message="Tính năng đổi điểm đang tắt theo cấu hình hệ thống." />
          ) : null}
          {pointsLoaded && isPointsEnabled && !redemptionConfigReady ? (
            <Alert type="error" showIcon className="mb-3" message="Cấu hình đổi điểm chưa hợp lệ. Kiểm tra giá trị điểm và các tỷ lệ giới hạn." />
          ) : null}
          <Form.Item
            name="points"
            label="Số điểm muốn dùng"
          >
            <InputNumber
              min={1}
              max={maxRedeemPoints != null && maxRedeemPoints > 0 ? maxRedeemPoints : undefined}
              precision={0}
              placeholder="Nhập số điểm"
              className="w-full!"
              disabled={!isPointsEnabled || !redemptionConfigReady || !maxRedeemPoints || maxRedeemPoints <= 0}
            />
          </Form.Item>
          {pointsLoaded && isPointsEnabled && redemptionConfigReady ? (
            <Card size="small" className="mb-3">
              <Space direction="vertical" size={4}>
                <Typography.Text>Điểm hiện có: <Typography.Text strong>{redeemBalance.toLocaleString('vi-VN')}</Typography.Text></Typography.Text>
                <Typography.Text>Tối đa lần này: <Typography.Text strong>{maxRedeemPoints?.toLocaleString('vi-VN') ?? 0} điểm</Typography.Text> ({balanceMaxRedeemPercent}% số dư và giới hạn hóa đơn)</Typography.Text>
                <Typography.Text>Giá trị dự kiến: <Typography.Text strong>{redeemPointsValue > 0 ? formatMoney(redeemMoney) : '—'}</Typography.Text></Typography.Text>
                <Typography.Text type="secondary">
                  1 điểm = {formatMoney(pointValue)} · Giảm {minRedeemPercent}–{maxRedeemPercent}% trên hóa đơn {formatMoney(redeemInvoiceAmount)}.
                </Typography.Text>
                <Typography.Text type="secondary">
                  Mức giảm tối đa {formatMoney(maxRedeemMoney)}; không vượt số tiền còn phải trả {formatMoney(promoRow?.debt_amount ?? 0)}.
                </Typography.Text>
              </Space>
            </Card>
          ) : null}
          {redeemValidationMessage && redeemPointsValue > 0 ? (
            <Alert type="error" showIcon className="mb-3" message={redeemValidationMessage} />
          ) : null}
        </Form>
      ),
    }] : []),
  ]

  // Bill bên phải — số liệu thực tế của gói + lựa chọn ưu đãi đang chọn
  const appliedDiscountAmount = Number(promoRow?.discount_amount ?? 0) + Number(promoRow?.points_discount ?? 0)
  const paidAmount = Number(promoRow?.paid_amount ?? 0)
  const afterDiscountAmount = Math.max(Number(promoRow?.total_amount ?? 0) - appliedDiscountAmount - promoDiscount, 0)
  const remainingAmount = Math.max(afterDiscountAmount - paidAmount, 0)
  // Chi tiết dòng ưu đãi đang chọn theo tab
  const selectedPromoLabel = promoDiscount > 0
    ? promoTab === 'discount'
      ? 'Áp ưu đãi (voucher)'
      : promoTab === 'redeem'
        ? 'Đổi điểm'
        : 'Giảm trực tiếp'
    : null

  const isMobile = !Grid.useBreakpoint().md

  // Panel "Hóa đơn" — desktop cột phải 260px; mobile đưa lên đầu, full-width
  const billPanel = (
    <div
      style={{
        width: isMobile ? '100%' : 260,
        boxSizing: isMobile ? 'border-box' : undefined,
        flexShrink: 0,
        background: 'var(--brand-bg, #fafafa)',
        borderRadius: 10,
        padding: isMobile ? 12 : 16,
        alignSelf: 'flex-start',
      }}
    >
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: isMobile ? 8 : 12 }}>Hóa đơn</Typography.Title>
      <Space direction="vertical" size={6} className="w-full!">
        <BillRow label="Số tiền gốc" value={formatMoney(promoRow?.total_amount ?? 0)} />
        <BillRow label="Ưu đãi đã áp dụng" value={`-${formatMoney(appliedDiscountAmount)}`} muted={appliedDiscountAmount <= 0} />
        {selectedPromoLabel && <BillRow label={selectedPromoLabel} value={`-${formatMoney(promoDiscount)}`} />}
        <BillRow label="Đã thanh toán" value={`-${formatMoney(paidAmount)}`} muted={paidAmount <= 0} />
      </Space>
      <div style={{ borderTop: '1px dashed #d9d9d9', margin: isMobile ? '8px 0' : '12px 0', paddingTop: isMobile ? 8 : 12 }}>
        <BillRow label="Còn lại" value={formatMoney(remainingAmount)} strong />
      </div>
      {promoRow?.points_used ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Điểm đã dùng: {promoRow.points_used.toLocaleString('vi-VN')} ({formatMoney(promoRow.points_discount ?? 0)})
        </Typography.Text>
      ) : null}
    </div>
  )

  return (
    <Modal
      className="treatment-form-modal"
      title="Ghi nhận thanh toán"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Thanh toán"
      cancelText="Hủy"
      confirmLoading={submitting}
      okButtonProps={{ disabled: lookupLoading || !!lookupError || activePaymentMethods.length === 0 }}
      width={isMobile ? 'calc(100vw - 24px)' : 'min(880px, calc(100vw - 24px))'}
    >
      <div style={{ display: 'flex', gap: isMobile ? 12 : 20, alignItems: 'stretch', flexDirection: isMobile ? 'column' : 'row' }}>
        {isMobile && billPanel}
        <div style={{ flex: 1, minWidth: 0 }}>
          {promoItems.length > 0 && (
            <Tabs
              activeKey={promoTab}
              onChange={(key) => onPromoTabChange(key as PromoTab)}
              items={promoItems}
            />
          )}
          <Form form={form} layout="vertical">
            {lookupError && <Alert type="error" showIcon message="Không thể ghi nhận thanh toán" description={lookupError} className="mb-4" />}
            <Form.Item name="amount" label="Số tiền" rules={[{ required: true, message: 'Nhập số tiền' }]}>
              <InputNumber min={1} step={50000} suffix={currencySymbol} className="w-full!" />
            </Form.Item>
            {lookupLoading ? (
              <TreatmentLoading label="Đang tải phương thức thanh toán" count={1} />
            ) : (
              <Form.Item name="method" label="Phương thức" rules={[{ required: true }]}>
                <Select
                  disabled={!!lookupError || activePaymentMethods.length === 0}
                  options={activePaymentMethods.map((item) => ({ value: item.code, label: item.label }))}
                />
              </Form.Item>
            )}
            <Form.Item name="note" label="Ghi chú">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>
        </div>
        {!isMobile && billPanel}
      </div>
    </Modal>
  )
}
