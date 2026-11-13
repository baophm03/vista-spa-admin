import { useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Form, InputNumber, Space, Typography, message } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage, pickData } from '@/api/helpers'
import { getGetCustomerProfilesIdPointsQueryKey } from '@/api/endpoints/customer-profiles'
import { getGetTreatmentCustomersQueryKey, getTreatmentCustomers, usePostTreatmentCustomersIdRedeemPoints } from '@/api/endpoints/treatment-customers'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { GetCustomerProfilesIdPoints200AllOfResponseDataRedemption } from '@/api/models/getCustomerProfilesIdPoints200AllOfResponseDataRedemption'
import TargetPicker from './TargetPicker'

type Props = {
  customerProfileId: string
  points: number
  policy?: GetCustomerProfilesIdPoints200AllOfResponseDataRedemption
  onRedeemed: () => Promise<void>
}

const money = (value: number) => `${value.toLocaleString('vi-VN')} ₫`

export default function PointsUseTab({ customerProfileId, points, policy, onRedeemed }: Props) {
  const queryClient = useQueryClient()
  const [targetId, setTargetId] = useState<string>()
  const [pointsToUse, setPointsToUse] = useState<number | null>(null)
  const treatmentParams = { page: 1, limit: 200, customer_profile_id: customerProfileId, has_debt: true }
  const treatmentsQuery = useQuery({
    queryKey: getGetTreatmentCustomersQueryKey(treatmentParams),
    queryFn: async () => getTreatmentCustomers(treatmentParams),
    enabled: Boolean(customerProfileId),
  })
  const treatments = (pickData<CustomerTreatment[]>(treatmentsQuery.data) ?? [])
    .filter((row) => Number(row.debt_amount ?? 0) > 0 && row.status !== 'CANCELLED')
  const selectedTreatment = treatments.find((row) => row.id === targetId)
  const treatmentMutation = usePostTreatmentCustomersIdRedeemPoints()
  const redemptionEnabled = policy?.enabled === true
  const pointValue = Number(policy?.point_value)
  const minPercent = Number(policy?.min_percent)
  const maxPercent = Number(policy?.max_percent)
  const balancePercent = Number(policy?.balance_max_percent)
  const configReady = Number.isFinite(pointValue) && pointValue > 0
    && Number.isFinite(minPercent) && minPercent >= 0
    && Number.isFinite(maxPercent) && maxPercent <= 100 && minPercent <= maxPercent
    && Number.isInteger(balancePercent) && balancePercent >= 1 && balancePercent <= 99
  const remainingAmount = Number(selectedTreatment?.debt_amount ?? 0)
  const invoiceAmount = selectedTreatment
    ? Math.max(Number(selectedTreatment.total_amount ?? 0) - Number(selectedTreatment.discount_amount ?? 0), 0)
    : 0
  const maxByBalance = Number.isFinite(balancePercent) ? Math.floor(points * balancePercent / 100) : 0
  const minMoneyByInvoice = invoiceAmount * minPercent / 100
  const maxMoneyAllowed = Math.min(invoiceAmount * maxPercent / 100, remainingAmount)
  const minByInvoice = configReady ? Math.ceil(minMoneyByInvoice / pointValue) : 0
  const maxByInvoice = configReady ? Math.floor(maxMoneyAllowed / pointValue) : 0
  const maxAllowed = Math.min(points, maxByBalance, maxByInvoice)
  const canRedeem = redemptionEnabled && configReady && Boolean(targetId) && remainingAmount > 0
    && maxAllowed >= minByInvoice
    && Number.isInteger(pointsToUse) && Number(pointsToUse) >= minByInvoice && Number(pointsToUse) <= maxAllowed
  const validationMessage = useMemo(() => {
    if (!redemptionEnabled) return 'Tính năng đổi điểm đang tắt trong cài đặt.'
    if (!configReady) return 'Cần cấu hình đầy đủ quy tắc đổi điểm trước khi sử dụng.'
    if (!targetId) return 'Chọn gói liệu trình còn công nợ để thanh toán.'
    if (remainingAmount <= 0) return 'Gói liệu trình này đã được thanh toán đủ.'
    if (maxAllowed < minByInvoice) {
      if (remainingAmount < minMoneyByInvoice) return 'Số tiền còn phải trả thấp hơn mức đổi tối thiểu theo hóa đơn.'
      if (points < minByInvoice) return 'Số điểm hiện có chưa đủ mức đổi tối thiểu theo hóa đơn.'
      return 'Giới hạn số điểm dùng mỗi lần chưa đủ mức đổi tối thiểu.'
    }
    if (!pointsToUse || !Number.isInteger(pointsToUse)) return 'Nhập số điểm nguyên muốn sử dụng.'
    if (pointsToUse < minByInvoice) return `Mỗi lần cần dùng ít nhất ${minByInvoice.toLocaleString('vi-VN')} điểm theo giá trị hóa đơn.`
    if (pointsToUse > maxAllowed) return `Mỗi lần chỉ được dùng tối đa ${maxAllowed.toLocaleString('vi-VN')} điểm.`
    return ''
  }, [redemptionEnabled, configReady, targetId, remainingAmount, maxAllowed, minByInvoice, minMoneyByInvoice, points, pointsToUse])

  const submit = async () => {
    if (!canRedeem || !targetId || !pointsToUse) return
    try {
      await treatmentMutation.mutateAsync({ id: targetId, data: { points: pointsToUse } })
      message.success('Đã dùng điểm thanh toán hóa đơn')
      setPointsToUse(null)
      setTargetId(undefined)
      await Promise.all([
        onRedeemed(),
        queryClient.invalidateQueries({ queryKey: getGetTreatmentCustomersQueryKey(treatmentParams) }),
        queryClient.invalidateQueries({ queryKey: getGetCustomerProfilesIdPointsQueryKey(customerProfileId) }),
      ])
    } catch (error) {
      message.error(errorMessage(error, 'Không thể dùng điểm cho gói liệu trình này'))
    }
  }

  const targetOptions = treatments.map((row) => {
    const packageName = String(row.package_snapshot?.name ?? row.package_snapshot?.package_name ?? 'Gói liệu trình')
    return { value: row.id, label: `${packageName} · Còn phải trả ${money(Number(row.debt_amount ?? 0))}` }
  })

  return (
    <Card>
      <Space direction="vertical" size="middle" className="w-full">
        <div>
          <Typography.Title level={5} className="mb-1!">Dùng điểm thanh toán hóa đơn</Typography.Title>
          <Typography.Text type="secondary">Chọn gói liệu trình còn công nợ để dùng điểm giảm số tiền cần thanh toán.</Typography.Text>
        </div>
        {!redemptionEnabled && <Alert type="warning" showIcon message="Tính năng đổi điểm đang tắt." />}
        {policy && configReady && (
          <Alert type="info" showIcon message={`Mỗi lần được giảm ${minPercent}–${maxPercent}% giá trị hóa đơn; tối đa dùng ${balancePercent}% số điểm đang có.`} />
        )}
        <TargetPicker
          targetId={targetId}
          options={targetOptions}
          loading={treatmentsQuery.isLoading}
          onTargetChange={(nextTargetId) => { setTargetId(nextTargetId); setPointsToUse(null) }}
        />
        {treatmentsQuery.isError && <Alert type="error" showIcon message="Không tải được gói liệu trình" description={errorMessage(treatmentsQuery.error)} />}
        {targetId && (
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Typography.Text type="secondary" className="block">Còn phải trả</Typography.Text>
              <Typography.Text strong>{money(remainingAmount)}</Typography.Text>
            </div>
            <Form.Item label="Số điểm muốn dùng" className="mb-0!">
              <InputNumber
                min={minByInvoice || 1}
                max={maxAllowed || undefined}
                precision={0}
                value={pointsToUse}
                disabled={!configReady || !redemptionEnabled || remainingAmount <= 0 || maxAllowed <= 0 || minByInvoice > maxAllowed}
                onChange={(value) => setPointsToUse(typeof value === 'number' ? value : null)}
                className="w-48!"
                aria-label="Số điểm muốn sử dụng"
              />
            </Form.Item>
            <Button type="primary" loading={treatmentMutation.isPending} disabled={!canRedeem} onClick={() => void submit()}>
              Dùng điểm
            </Button>
          </div>
        )}
        {validationMessage && targetId && <Typography.Text type="secondary">{validationMessage}</Typography.Text>}
        {!treatmentsQuery.isLoading && treatments.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Khách chưa có gói liệu trình còn công nợ." />
        )}
      </Space>
    </Card>
  )
}
