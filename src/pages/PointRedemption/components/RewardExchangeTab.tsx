import { useState } from 'react'
import { Alert, Button, Card, Col, Empty, Modal, Row, Spin, Tag, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { errorMessage, pickData } from '@/api/helpers'
import { getGetCustomerProfilesIdPointsQueryKey, postCustomerProfilesIdRedeemReward } from '@/api/endpoints/customer-profiles'
import { getGetRewardRedemptionsQueryKey, getGetRewardsQueryKey, getRewards } from '@/api/endpoints/rewards'
import type { PostCustomerProfilesIdRedeemRewardBody } from '@/api/models/postCustomerProfilesIdRedeemRewardBody'
import type { RewardRow } from '@/pages/Rewards/components/constants'
import { remainingLabel, TYPE_META } from '@/pages/Rewards/components/constants'

interface Props {
  customerProfileId: string
  points: number
  maxPointsPerExchange: number
  onRedeemed: () => Promise<void>
}

export default function RewardExchangeTab({ customerProfileId, points, maxPointsPerExchange, onRedeemed }: Props) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<RewardRow | null>(null)
  const rewardsQuery = useQuery({
    queryKey: getGetRewardsQueryKey({ is_active: true }),
    queryFn: async () => getRewards({ is_active: true }),
  })
  const rewards = (pickData<RewardRow[]>(rewardsQuery.data) ?? []).filter((reward) => {
    if (reward.is_active === false) return false
    if (reward.quantity_total != null && Number(reward.quantity_given ?? 0) >= Number(reward.quantity_total)) return false
    const today = dayjs().startOf('day')
    if (reward.valid_from && dayjs(String(reward.valid_from)).isAfter(today)) return false
    if (reward.valid_to && dayjs(String(reward.valid_to)).endOf('day').isBefore(today)) return false
    return true
  })
  const redeemMutation = useMutation({
    mutationFn: async (rewardId: string) => postCustomerProfilesIdRedeemReward(
      customerProfileId,
      { reward_id: rewardId } as PostCustomerProfilesIdRedeemRewardBody,
    ),
  })
  const canRedeem = Boolean(target)
    && points >= Number(target?.points_cost ?? 0)
    && Number(target?.points_cost ?? 0) <= maxPointsPerExchange

  const submit = async () => {
    if (!target || !canRedeem || redeemMutation.isPending) return
    try {
      await redeemMutation.mutateAsync(target.id)
      message.success(`Đã đổi quà “${target.name}” cho khách`)
      setTarget(null)
      await Promise.all([
        onRedeemed(),
        queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetRewardRedemptionsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetCustomerProfilesIdPointsQueryKey(customerProfileId) }),
      ])
    } catch (error) {
      message.error(errorMessage(error, 'Không thể đổi quà cho khách'))
    }
  }

  return (
    <>
      {rewardsQuery.isError && <Alert className="mb-4" type="error" showIcon message="Không tải được danh sách quà" description={errorMessage(rewardsQuery.error)} />}
      <Spin spinning={rewardsQuery.isLoading}>
        {rewards.length ? (
          <Row gutter={[16, 16]}>
            {rewards.map((reward) => {
              const cost = Number(reward.points_cost ?? 0)
              const exceedsCap = cost > maxPointsPerExchange
              const notEnoughPoints = cost > points
              const disabled = exceedsCap || notEnoughPoints
              return (
                <Col key={reward.id} xs={24} sm={12} xl={8}>
                  <Card
                    title={reward.name}
                    extra={<Tag color={TYPE_META[reward.type as keyof typeof TYPE_META]?.color}>{TYPE_META[reward.type as keyof typeof TYPE_META]?.label ?? 'Quà'}</Tag>}
                    className="h-full"
                  >
                    <div className="mb-4 min-h-20">
                      {reward.description && <Typography.Paragraph className="mb-2!" type="secondary">{reward.description}</Typography.Paragraph>}
                      {reward.type === 'BENEFIT' && reward.benefit_amount != null && (
                        <Typography.Text type="secondary">Giảm {Number(reward.benefit_amount).toLocaleString('vi-VN')} ₫ khi áp dụng đúng dịch vụ.</Typography.Text>
                      )}
                    </div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Typography.Text strong>{cost.toLocaleString('vi-VN')} điểm</Typography.Text>
                      <Typography.Text type="secondary">Còn {remainingLabel(reward)}</Typography.Text>
                    </div>
                    {exceedsCap && <Typography.Text type="warning" className="mb-2 block">Quà vượt giới hạn điểm được dùng trong một lần đổi.</Typography.Text>}
                    {notEnoughPoints && <Typography.Text type="secondary" className="mb-2 block">Khách chưa đủ điểm để đổi quà này.</Typography.Text>}
                    <Button block type="primary" disabled={disabled} onClick={() => setTarget(reward)}>Đổi quà</Button>
                  </Card>
                </Col>
              )
            })}
          </Row>
        ) : !rewardsQuery.isLoading ? (
          <Empty description="Hiện chưa có quà nào sẵn sàng để đổi." />
        ) : null}
      </Spin>
      <Modal
        title="Xác nhận đổi quà"
        open={Boolean(target)}
        onCancel={() => setTarget(null)}
        onOk={() => void submit()}
        confirmLoading={redeemMutation.isPending}
        okText="Xác nhận đổi"
        cancelText="Hủy"
        okButtonProps={{ disabled: !canRedeem }}
      >
        <Typography.Paragraph>
          Đổi <strong>{target?.name}</strong> sẽ trừ <strong>{Number(target?.points_cost ?? 0).toLocaleString('vi-VN')} điểm</strong> của khách.
        </Typography.Paragraph>
        <Typography.Text type="secondary">
          Mỗi lần đổi được dùng tối đa {maxPointsPerExchange.toLocaleString('vi-VN')} điểm; khách hiện có {points.toLocaleString('vi-VN')} điểm.
        </Typography.Text>
      </Modal>
    </>
  )
}
