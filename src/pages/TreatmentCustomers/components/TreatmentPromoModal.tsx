import { Alert, Button, Card, Col, Empty, Form, InputNumber, Modal, Row, Select, Space, Spin, Tabs, Typography } from 'antd'
import type { FormInstance } from 'antd'
import type { DiscountRule } from '@/api/models'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import { Can } from '@casl/react'
import type { RewardRedemptionRow } from './constants'

interface TreatmentPromoModalProps {
  open: boolean
  promoRow: CustomerTreatment | null
  formatMoney: (value: unknown) => string
  availableDiscounts: DiscountRule[]
  discountForm: FormInstance
  discountSubmitting: boolean
  onApplyDiscount: () => void
  redeemForm: FormInstance
  pointsLoading: boolean
  pointsError: boolean
  pointsLoaded: boolean
  pointsErrorMessage: string
  isPointsEnabled: boolean
  redemptionConfigReady: boolean
  redeemBalance: number
  redeemPointsValue: number
  redeemMoney: number
  pointValue: number
  minRedeemMoney: number
  maxRedeemMoney: number
  minRedeemPercent: number
  maxRedeemPercent: number
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
  redeemForm,
  pointsLoading,
  pointsError,
  pointsLoaded,
  pointsErrorMessage,
  isPointsEnabled,
  redemptionConfigReady,
  redeemBalance,
  redeemPointsValue,
  redeemMoney,
  pointValue,
  minRedeemMoney,
  maxRedeemMoney,
  minRedeemPercent,
  maxRedeemPercent,
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
          type="warning" showIcon style={{ marginBottom: 12 }}
          message={`Giảm giá hiện tại: ${formatMoney(promoRow?.discount_amount ?? 0)} — Điểm đã dùng: ${promoRow?.points_used ?? 0} (${formatMoney(promoRow?.points_discount ?? 0)})`}
        />
        <Tabs
          items={[
            {
              key: 'discount',
              label: 'Áp ưu đãi',
              children: (
                <>
                  {availableDiscounts.length === 0 && (
                    <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Khách hiện không đủ điều kiện ưu đãi nào, hoặc chưa tải được danh sách." />
                  )}
                  {availableDiscounts.length > 0 && (
                    <Form form={discountForm} layout="vertical" style={{ marginBottom: 16 }}>
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
                              <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
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
                    <Alert type="error" showIcon style={{ marginBottom: 12 }} message="Không tải được số dư và cấu hình điểm" description={pointsErrorMessage} />
                  ) : null}
                  {pointsLoaded && !isPointsEnabled ? (
                    <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Tính năng đổi điểm đang tắt theo cấu hình hệ thống." />
                  ) : null}
                  {pointsLoaded && isPointsEnabled && !redemptionConfigReady ? (
                    <Alert type="error" showIcon style={{ marginBottom: 12 }} message="Cấu hình quy đổi điểm chưa hợp lệ. Kiểm tra giá trị điểm và tỷ lệ tối thiểu/tối đa." />
                  ) : null}
                  <Form.Item
                    name="points"
                    label="Số điểm muốn dùng"
                    rules={[
                      { required: true, message: 'Nhập số điểm' },
                      { validator: async (_, value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Số điểm phải là số nguyên dương')) },
                    ]}
                  >
                    <InputNumber min={1} max={redeemBalance > 0 ? redeemBalance : undefined} precision={0} style={{ width: '100%' }} disabled={!isPointsEnabled || !redemptionConfigReady || redeemBalance <= 0} />
                  </Form.Item>
                  {pointsLoaded && isPointsEnabled && redemptionConfigReady ? (
                    <Card size="small" style={{ marginBottom: 12 }}>
                      <Space direction="vertical" size={4}>
                        <Typography.Text>Điểm hiện có: <Typography.Text strong>{redeemBalance.toLocaleString('vi-VN')}</Typography.Text></Typography.Text>
                        <Typography.Text>Giá trị dự kiến: <Typography.Text strong>{redeemPointsValue > 0 ? formatMoney(redeemMoney) : '—'}</Typography.Text></Typography.Text>
                        <Typography.Text type="secondary">
                          1 điểm = {formatMoney(pointValue)} · Mức được phép: {formatMoney(minRedeemMoney)}–{formatMoney(maxRedeemMoney)} ({minRedeemPercent}–{maxRedeemPercent}% công nợ {formatMoney(redeemDebt)})
                        </Typography.Text>
                      </Space>
                    </Card>
                  ) : null}
                  {redeemValidationMessage && redeemPointsValue > 0 ? (
                    <Alert type="error" showIcon style={{ marginBottom: 12 }} message={redeemValidationMessage} />
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
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
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

