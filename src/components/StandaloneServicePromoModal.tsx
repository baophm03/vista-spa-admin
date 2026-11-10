import { Alert, Button, Card, Empty, Form, InputNumber, Modal, Row, Col, Space, Spin, Tabs, Typography } from 'antd'
import type { FormInstance } from 'antd'
import { Can } from '@casl/react'
import type { RewardRedemptionRow } from '@/pages/TreatmentCustomers/components/constants'

/** Modal "Ưu đãi & điểm" cho Dịch vụ KH — mirror TreatmentPromoModal (bỏ tab Áp ưu đãi/discount rules) */
interface StandaloneServicePromoModalProps {
  open: boolean
  row: { id: string; status?: string } | null
  formatMoney: (value: unknown) => string
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

export default function StandaloneServicePromoModal({
  open,
  row,
  formatMoney,
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
}: StandaloneServicePromoModalProps) {
  const promoApplied = Number((row as { points_discount?: number | string | null } | null)?.points_discount ?? 0)
  const promoPointsUsed = Number((row as { points_used?: number | string | null } | null)?.points_used ?? 0)
  const promoDiscount = Number((row as { discount_amount?: number | string | null } | null)?.discount_amount ?? 0)
  const promoActive = row ? !['completed', 'cancelled'].includes(String(row.status)) : false

  return (
    <Modal
      title={`Ưu đãi & điểm — lượt dịch vụ #${(row?.id ?? '').slice(0, 8)}`}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={640}
    >
      <Alert
        type="warning" showIcon className="mb-3"
        message={`Giảm giá hiện tại: ${formatMoney(promoDiscount)} — Điểm đã dùng: ${promoPointsUsed} (${formatMoney(promoApplied)})`}
      />
      <Tabs
        items={[
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
                  <Alert type="error" showIcon className="mb-3" message="Cấu hình quy đổi điểm chưa hợp lệ. Kiểm tra giá trị điểm và tỷ lệ tối thiểu/tối đa." />
                ) : null}
                {!promoActive ? (
                  <Alert type="warning" showIcon className="mb-3" message="Chỉ đổi điểm cho lượt dịch vụ chưa hoàn tất hoặc chưa hủy." />
                ) : null}
                <Form.Item
                  name="points"
                  label="Số điểm muốn dùng"
                  rules={[
                    { required: true, message: 'Nhập số điểm' },
                    { validator: async (_, value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Số điểm phải là số nguyên dương')) },
                  ]}
                >
                  <InputNumber min={1} max={redeemBalance > 0 ? redeemBalance : undefined} precision={0} className="w-full!" disabled={!promoActive || !isPointsEnabled || !redemptionConfigReady || redeemBalance <= 0} />
                </Form.Item>
                {pointsLoaded && isPointsEnabled && redemptionConfigReady ? (
                  <Card size="small" className="mb-3">
                    <Space direction="vertical" size={4}>
                      <Typography.Text>Điểm hiện có: <Typography.Text strong>{redeemBalance.toLocaleString('vi-VN')}</Typography.Text></Typography.Text>
                      <Typography.Text>Giá trị dự kiến: <Typography.Text strong>{redeemPointsValue > 0 ? formatMoney(redeemMoney) : '—'}</Typography.Text></Typography.Text>
                      <Typography.Text type="secondary">
                        1 điểm = {formatMoney(pointValue)} · Mức được phép: {formatMoney(minRedeemMoney)}–{formatMoney(maxRedeemMoney)} ({minRedeemPercent}–{maxRedeemPercent}% dư nợ {formatMoney(redeemDebt)})
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
                  message="Áp quà sẽ trừ trực tiếp vào dư nợ lượt dịch vụ này"
                  description="Chỉ hiện lượt đổi còn dùng được và đúng dịch vụ của lượt. Lượt dịch vụ cần còn dư nợ ít nhất bằng mức giảm; nên áp trước khi thu đủ tiền. Khi xác nhận, hệ thống đồng thời đánh dấu quà đã dùng."
                />
                {rewardsLoading && <Spin />}
                {rewardsError && (
                  <Alert type="error" showIcon message="Không tải được quà đã đổi" description={rewardsErrorMessage} />
                )}
                {!rewardsLoading && !rewardsError && applicableRewardRedemptions.length === 0 && (
                  <Empty description="Khách chưa có quà giảm tiền phù hợp với dịch vụ này" />
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
                          disabled={!canApplyReward || !promoActive || redeemDebt < Number(redemption.reward?.benefit_amount ?? 0)}
                          loading={applyingRewardId === redemption.id}
                          onClick={() => onApplyReward(redemption)}
                        >
                          Áp vào lượt dịch vụ
                        </Button>
                      </Col>
                    </Row>
                    {!canApplyReward && (
                      <Typography.Text type="secondary">Tài khoản chưa có quyền áp dụng quà đổi vào hóa đơn.</Typography.Text>
                    )}
                    {promoActive && redeemDebt > 0 && redeemDebt < Number(redemption.reward?.benefit_amount ?? 0) && (
                      <Typography.Text type="danger">Dư nợ lượt dịch vụ này thấp hơn mức giảm của quà.</Typography.Text>
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
