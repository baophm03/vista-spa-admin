import { Alert, Button, Card, Col, Empty, Form, InputNumber, Modal, Row, Segmented, Select, Space, Spin, Tabs, Typography } from 'antd'
import type { FormInstance } from 'antd'
import type { DiscountRule } from '@/api/models'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import { Can } from '@casl/react'
import type { RewardRedemptionRow } from './constants'

export type ManualDiscountMode = 'percent' | 'amount'

interface TreatmentPromoModalProps {
  open: boolean
  promoRow: CustomerTreatment | null
  formatMoney: (value: unknown) => string
  availableDiscounts: DiscountRule[]
  discountForm: FormInstance
  discountSubmitting: boolean
  onApplyDiscount: () => void
  /** Giảm thủ công không qua voucher: % hoặc số tiền nhập tay */
  manualForm: FormInstance
  manualMode: ManualDiscountMode
  onManualModeChange: (mode: ManualDiscountMode) => void
  manualSubmitting: boolean
  onManualDiscount: () => void
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
  redeemDebt: number
  redeemValidationMessage: string
  canSubmitRedeem: boolean
  redeemSubmitting: boolean
  onRedeemPoints: () => void
  rewardsLoading: boolean
  rewardsError: boolean
  rewardsErrorMessage: string
  applicableRewardRedemptions: RewardRedemptionRow[]
  canApplyReward: boolean
  applyingRewardId: string | null
  onApplyReward: (redemption: RewardRedemptionRow) => void
  onCancel: () => void
}

export default function TreatmentPromoModal({
  open,
  promoRow,
  formatMoney,
  availableDiscounts,
  discountForm,
  discountSubmitting,
  onApplyDiscount,
  manualForm,
  manualMode,
  onManualModeChange,
  manualSubmitting,
  onManualDiscount,
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
  minRedeemMoney,
  maxRedeemMoney,
  minRedeemPercent,
  maxRedeemPercent,
  maxRedeemPoints,
  redeemDebt,
  redeemValidationMessage,
  canSubmitRedeem,
  redeemSubmitting,
  onRedeemPoints,
  rewardsLoading,
  rewardsError,
  rewardsErrorMessage,
  applicableRewardRedemptions,
  canApplyReward,
  applyingRewardId,
  onApplyReward,
  onCancel,
}: TreatmentPromoModalProps) {
  return (
      <Modal
        title={`Ưu đãi & điểm — gói #${(promoRow?.id ?? '').slice(0, 8)}`}
      open={open}
        onCancel={onCancel}
        footer={null}
        width={640}
      >
        <Alert
          type="warning" showIcon className="mb-3"
          message={`Giảm giá hiện tại: ${formatMoney(promoRow?.discount_amount ?? 0)} — Điểm đã dùng: ${promoRow?.points_used ?? 0} (${formatMoney(promoRow?.points_discount ?? 0)})`}
        />
        <Tabs
          items={[
            {
              key: 'manual',
              label: 'Giảm trực tiếp',
              children: (
                <>
                  <Alert
                    type="info" showIcon className="mb-3"
                    message="Giảm giá thủ công không qua voucher/ưu đãi nào"
                    description="Chọn giảm theo % hoặc theo số tiền nhập tay. Mức % cộng dồn với ưu đãi đã áp và không vượt trần hệ thống; số tiền không vượt công nợ còn lại. Có thể gỡ lại trong Lịch sử."
                  />
                  <Form form={manualForm} layout="vertical">
                    <Form.Item label="Kiểu giảm" style={{ marginBottom: 12 }}>
                      <Segmented
                        block
                        value={manualMode}
                        options={[
                          { label: 'Giảm theo %', value: 'percent' },
                          { label: 'Giảm theo số tiền', value: 'amount' },
                        ]}
                        onChange={(value) => onManualModeChange(value as ManualDiscountMode)}
                      />
                    </Form.Item>
                    <Form.Item
                      name="value"
                      label={manualMode === 'percent' ? 'Mức giảm (%)' : 'Số tiền giảm'}
                      rules={[
                        { required: true, message: manualMode === 'percent' ? 'Nhập mức giảm (%)' : 'Nhập số tiền giảm' },
                        { validator: async (_, value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Phải là số lớn hơn 0')) },
                      ]}
                      extra={manualMode === 'percent'
                        ? 'Tổng % cộng dồn (ưu đãi đã áp + giảm thủ công) không vượt trần hệ thống discount.max_total_percent.'
                        : `Không vượt công nợ còn lại: ${formatMoney(promoRow?.debt_amount ?? 0)}`}
                    >
                      <InputNumber
                        min={0}
                        max={manualMode === 'percent' ? 100 : undefined}
                        precision={manualMode === 'percent' ? 0 : 0}
                        step={manualMode === 'percent' ? 1 : 10000}
                        className="w-full!"
                        addonAfter={manualMode === 'amount' ? 'đ' : '%'}
                      />
                    </Form.Item>
                    {manualMode === 'percent' && (
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        Ước tính trên gói {formatMoney(promoRow?.total_amount ?? 0)}.
                      </Typography.Text>
                    )}
                    <Can I="READ" a="DISCOUNT">
                      <Button type="primary" loading={manualSubmitting} onClick={onManualDiscount}>
                        Áp dụng giảm trực tiếp
                      </Button>
                    </Can>
                  </Form>
                </>
              ),
            },
            {
              key: 'discount',
              label: 'Áp ưu đãi',
              children: (
                <>
                  {availableDiscounts.length === 0 && (
                    <Alert type="info" showIcon className="mb-3" message="Khách hiện không đủ điều kiện ưu đãi nào, hoặc chưa tải được danh sách." />
                  )}
                  {availableDiscounts.length > 0 && (
                    <Form form={discountForm} layout="vertical" className="mb-4">
                      <Form.Item name="rule_id" label="Quy tắc ưu đãi đủ điều kiện" rules={[{ required: true, message: 'Chọn quy tắc' }]}>
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder="Chọn ưu đãi"
                          options={availableDiscounts.map((rule) => ({
                            value: rule.id!,
                            label: `${rule.code} — ${rule.name} (${rule.percent_min ?? 0}–${rule.percent_max ?? 0}%)`,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item noStyle shouldUpdate={(p, c) => p.rule_id !== c.rule_id}>
                        {({ getFieldValue }) => {
                          const rule = availableDiscounts.find((r) => r.id === getFieldValue('rule_id'))
                          if (!rule) return null
                          return (
                            <Form.Item
                              name="percent"
                              label="Mức giảm (%)"
                              initialValue={rule.percent_max ?? rule.percent_min}
                              rules={[
                                { required: true, message: 'Nhập mức giảm' },
                                {
                                  validator: (_rule_, value) => {
                                    const min = rule.percent_min ?? 0
                                    const max = rule.percent_max ?? 100
                                    if (value == null) return Promise.resolve()
                                    if (value < min || value > max) {
                                      return Promise.reject(new Error(`Ngoài khoảng ${min}–${max}% — vượt khoảng cần quyền discount.override`))
                                    }
                                    return Promise.resolve()
                                  },
                                },
                              ]}
                              extra={`Khoảng cho phép: ${rule.percent_min ?? 0}–${rule.percent_max ?? 0}%. Trần tổng xếp chồng: ${rule.max_total_percent ?? 50}%.`}
                            >
                              <InputNumber min={0} max={100} precision={0} className="w-full!" />
                            </Form.Item>
                          )
                        }}
                      </Form.Item>
                      <Can I="READ" a="DISCOUNT">
                        <Button type="primary" loading={discountSubmitting} onClick={onApplyDiscount}>
                          Áp dụng
                        </Button>
                      </Can>
                    </Form>
                  )}
                </>
              ),
            },
            {
              key: 'redeem',
              label: 'Đổi điểm',
              children: (
                <Form form={redeemForm} layout="vertical">
                  {pointsLoading ? <Spin size="small" /> : null}
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
                    rules={[
                      { required: true, message: 'Nhập số điểm' },
                      { validator: async (_, value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Số điểm phải là số nguyên dương')) },
                    ]}
                  >
                    <InputNumber min={1} max={maxRedeemPoints > 0 ? maxRedeemPoints : undefined} precision={0} className="w-full!" disabled={!isPointsEnabled || !redemptionConfigReady || maxRedeemPoints <= 0} />
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
                          Mức giảm tối đa {formatMoney(maxRedeemMoney)}; không vượt số tiền còn phải trả {formatMoney(redeemDebt)}.
                        </Typography.Text>
                      </Space>
                    </Card>
                  ) : null}
                  {redeemValidationMessage && redeemPointsValue > 0 ? (
                    <Alert type="error" showIcon className="mb-3" message={redeemValidationMessage} />
                  ) : null}
                  <Can I="POINTS_ADJUST" a="MEMBERSHIP">
                    <Button type="primary" loading={redeemSubmitting} disabled={!canSubmitRedeem} onClick={onRedeemPoints}>
                      Đổi điểm
                    </Button>
                  </Can>
                </Form>
              ),
            },
            {
              key: 'rewards',
              label: 'Quà đã đổi',
              children: (
                <Space direction="vertical" size={12} className="w-full!">
                  <Alert
                    type="info"
                    showIcon
                    message="Áp quà sẽ trừ trực tiếp vào công nợ gói này"
                    description="Chỉ hiện lượt đổi còn dùng được và đúng dịch vụ của gói. Gói cần còn công nợ ít nhất bằng mức giảm; nên áp trước khi thu đủ tiền. Khi xác nhận, hệ thống đồng thời đánh dấu quà đã dùng."
                  />
                  {rewardsLoading && <Spin />}
                  {rewardsError && (
                    <Alert type="error" showIcon message="Không tải được quà đã đổi" description={rewardsErrorMessage} />
                  )}
                  {!rewardsLoading && !rewardsError && applicableRewardRedemptions.length === 0 && (
                    <Empty description="Khách chưa có quà giảm tiền phù hợp với dịch vụ của gói này" />
                  )}
                  {applicableRewardRedemptions.map((redemption) => (
                    <Card key={redemption.id} size="small" styles={{ body: { padding: 12 } }}>
                      <Row align="middle" justify="space-between" gutter={[12, 8]}>
                        <Col flex="auto">
                          <Typography.Text strong>{redemption.reward?.name ?? 'Quà đổi điểm'}</Typography.Text>
                          <div>
                            <Typography.Text type="secondary">
                              Đã trừ {Number(redemption.points_spent).toLocaleString('vi-VN')} điểm · Giảm {formatMoney(redemption.reward?.benefit_amount)}
                            </Typography.Text>
                          </div>
                        </Col>
                        <Col>
                          <Button
                            type="primary"
                            disabled={!canApplyReward || (promoRow?.status !== 'ACTIVE') || Number(promoRow?.debt_amount ?? 0) < Number(redemption.reward?.benefit_amount ?? 0)}
                            loading={applyingRewardId === redemption.id}
                            onClick={() => onApplyReward(redemption)}
                          >
                            Áp vào gói
                          </Button>
                        </Col>
                      </Row>
                      {!canApplyReward && (
                        <Typography.Text type="secondary">Tài khoản chưa có quyền áp dụng quà đổi vào hóa đơn.</Typography.Text>
                      )}
                      {promoRow?.status === 'ACTIVE' && Number(promoRow.debt_amount ?? 0) < Number(redemption.reward?.benefit_amount ?? 0) && (
                        <Typography.Text type="danger">Công nợ gói này thấp hơn mức giảm của quà.</Typography.Text>
                      )}
                    </Card>
                  ))}
                </Space>
              ),
            },
          ]}
        />
      </Modal>


  )
}

