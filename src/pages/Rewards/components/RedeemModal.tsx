import { useEffect, useState } from 'react'
import { displayName } from '@/utils/displayName'
import { Alert, Descriptions, Form, type FormInstance, Modal, Select, Typography } from 'antd'
import { useGetCustomerProfilesAdmin, useGetCustomerProfilesIdPointsAdmin } from '@/api/endpoints/customer-profiles'
import { pickData } from '@/api/helpers'
import type { CustomerProfile } from '@/api/models/customerProfile'
import type { GetCustomerProfilesIdPointsAdmin200AllOfResponseData } from '@/api/models/getCustomerProfilesIdPointsAdmin200AllOfResponseData'
import type { RewardRow } from './constants'

interface RedeemModalProps {
  redeemTarget: RewardRow | null
  onCancel: () => void
  onSubmit: () => void
  confirmLoading: boolean
  form: FormInstance
}

const formatPoints = (value: number) => value.toLocaleString('vi-VN')

export default function RedeemModal({
  redeemTarget,
  onCancel,
  onSubmit,
  confirmLoading,
  form,
}: RedeemModalProps) {
  // Tìm khách phía server: gõ tới đâu gọi GET /customerProfiles?q=... tới đó (debounce 300ms).
  const [customerSearchInput, setCustomerSearchInput] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setCustomerSearch(customerSearchInput.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [customerSearchInput])

  // Ghi nhớ khách đã chọn kèm id quà: đổi mục tiêu quà thì lựa chọn cũ tự hết hiệu lực,
  // không cần effect reset state.
  const [selection, setSelection] = useState<{ rewardId?: string; customer?: CustomerProfile }>({})
  const open = !!redeemTarget

  // Đóng modal thì xoá lựa chọn khách cũ (form cũng đã resetFields).
  const [lastOpen, setLastOpen] = useState(open)
  if (lastOpen !== open) {
    setLastOpen(open)
    if (!open) {
      if (selection.customer) setSelection({})
      if (customerSearchInput) setCustomerSearchInput('')
      if (customerSearch) setCustomerSearch('')
    }
  }

  const selectedCustomer = selection.rewardId === redeemTarget?.id ? selection.customer : undefined
  const customerId = selectedCustomer?.id

  const customersQuery = useGetCustomerProfilesAdmin(
    { page: 1, limit: 50, q: customerSearch || undefined },
    { query: { enabled: open } },
  )
  const customersPayload = pickData<CustomerProfile[] | { items?: CustomerProfile[] }>(customersQuery.data)
  const customerList: CustomerProfile[] = Array.isArray(customersPayload) ? customersPayload : customersPayload?.items ?? []
  const customerOptions = (selectedCustomer ? [selectedCustomer, ...customerList] : customerList)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .map((item) => ({ value: item.id, label: `${displayName(item)} — ${item.phone}` }))

  const pointsQuery = useGetCustomerProfilesIdPointsAdmin(customerId ?? '', {
    query: { enabled: Boolean(customerId) },
  })
  const pointsData = pickData<GetCustomerProfilesIdPointsAdmin200AllOfResponseData>(pointsQuery.data)
  const balance = customerId && typeof pointsData?.points === 'number' ? Math.max(0, pointsData.points) : undefined
  const cost = Number(redeemTarget?.points_cost ?? 0)
  const remaining = balance === undefined ? undefined : balance - cost
  const insufficient = balance !== undefined && cost > balance

  return (
    <Modal
      title={<span className="wrap-anywhere">Đổi hộ khách: {redeemTarget?.name ?? ''}</span>}
      width="min(520px, calc(100vw - 24px))"
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={confirmLoading}
      okText="Đổi quà"
      cancelText="Đóng"
      okButtonProps={{ disabled: insufficient }}
    >
      <Form form={form} layout="vertical" style={{ marginBottom: 16 }}>
        <Form.Item name="customer_profile_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách' }]}>
          <Select
            showSearch
            filterOption={false}
            placeholder="Tìm theo tên hoặc SĐT"
            onSearch={setCustomerSearchInput}
            searchValue={customerSearchInput}
            onChange={(value: string) => {
              setSelection({
                rewardId: redeemTarget?.id,
                customer: customerList.find((item) => item.id === value) ?? selectedCustomer,
              })
              setCustomerSearchInput('')
            }}
            loading={customersQuery.isFetching}
            notFoundContent={customersQuery.isFetching ? 'Đang tìm khách hàng…' : 'Không tìm thấy khách phù hợp'}
            options={customerOptions}
          />
        </Form.Item>
      </Form>
      <Descriptions
        size="small"
        column={1}
        bordered
        className="wrap-anywhere"
        style={{ marginBottom: 16 }}
        items={[
          { key: 'cost', label: 'Điểm cần đổi', children: <strong>{formatPoints(cost)} điểm</strong> },
          {
            key: 'balance',
            label: 'Điểm hiện có của khách',
            children: !customerId
              ? <Typography.Text type="secondary">Chọn khách để xem số điểm</Typography.Text>
              : pointsQuery.isLoading
                ? <Typography.Text type="secondary">Đang tải…</Typography.Text>
                : balance === undefined
                  ? <Typography.Text type="secondary">Không đọc được số điểm</Typography.Text>
                  : <strong style={{ color: insufficient ? '#cf1322' : undefined }}>{formatPoints(balance)} điểm</strong>,
          },
          {
            key: 'remaining',
            label: 'Còn lại sau khi đổi',
            children: remaining === undefined
              ? <Typography.Text type="secondary">—</Typography.Text>
              : <span style={{ color: remaining < 0 ? '#cf1322' : undefined }}>{formatPoints(remaining)} điểm</span>,
          },
        ]}
      />
      {insufficient && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Khách không đủ điểm"
          description={`Cần ${formatPoints(cost)} điểm nhưng khách chỉ còn ${formatPoints(balance!)} điểm. Hãy chọn quà khác hoặc cộng thêm điểm cho khách.`}
        />
      )}
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        Hệ thống sẽ trừ {formatPoints(cost)} điểm của khách và tạo lượt đổi ở trạng thái Chưa dùng.
      </Typography.Paragraph>
    </Modal>
  )
}

