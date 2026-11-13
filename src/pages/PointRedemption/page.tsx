import { useDeferredValue, useState } from 'react'
import { Alert, Button, Card, Col, Empty, Row, Select, Space, Spin, Statistic, Tabs, Typography } from 'antd'
import { GiftOutlined, SettingOutlined, StarOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useAbility } from '@casl/react'
import { useNavigate } from 'react-router-dom'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import { getCustomerProfiles, getGetCustomerProfilesQueryKey, useGetCustomerProfilesIdPoints } from '@/api/endpoints/customer-profiles'
import type { CustomerProfile } from '@/api/models/customerProfile'
import type { GetCustomerProfilesIdPoints200AllOfResponseData } from '@/api/models/getCustomerProfilesIdPoints200AllOfResponseData'
import PointsUseTab from './components/PointsUseTab'
import RewardExchangeTab from './components/RewardExchangeTab'

export default function PointRedemption() {
  const ability = useAbility()
  const navigate = useNavigate()
  const canRedeemPoints = ability.can('POINTS_ADJUST', 'MEMBERSHIP')
  const canRedeemRewards = ability.can('REDEEM_ADMIN', 'REWARD') && ability.can('READ', 'REWARD')
  const [searchText, setSearchText] = useState('')
  const deferredSearch = useDeferredValue(searchText.trim())
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const customerQuery = useQuery({
    queryKey: getGetCustomerProfilesQueryKey({ page: 1, limit: 20, q: deferredSearch }),
    queryFn: async () => getCustomerProfiles({ page: 1, limit: 20, q: deferredSearch }),
    enabled: deferredSearch.length >= 2,
  })
  const customers = pickData<CustomerProfile[]>(customerQuery.data) ?? []
  const customerOptions = [customer, ...customers]
    .filter((item): item is CustomerProfile => Boolean(item))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .map((item) => ({ value: item.id, label: `${item.full_name} · ${item.phone}` }))

  const pointsQuery = useGetCustomerProfilesIdPoints(customer?.id ?? '', {
    query: { enabled: Boolean(customer?.id) },
  })
  const pointsData = pickData<GetCustomerProfilesIdPoints200AllOfResponseData>(pointsQuery.data)
  const pointBalance = Math.max(0, Number(pointsData?.points ?? 0))
  const policy = pointsData?.redemption
  const balanceMaxPercent = Number(policy?.balance_max_percent)
  const hasValidBalanceLimit = Number.isInteger(balanceMaxPercent) && balanceMaxPercent >= 1 && balanceMaxPercent <= 99
  const maxPointsPerExchange = hasValidBalanceLimit
    ? Math.floor(pointBalance * balanceMaxPercent / 100)
    : 0

  const refreshPoints = async () => {
    await pointsQuery.refetch()
  }

  const tabs = [
    ...(canRedeemPoints ? [{
      key: 'points',
      label: <span><StarOutlined /> Dùng điểm</span>,
      children: customer ? (
        <PointsUseTab
          customerProfileId={customer.id}
          points={pointBalance}
          policy={policy}
          onRedeemed={refreshPoints}
        />
      ) : <Empty description="Chọn khách hàng để dùng điểm vào công nợ dịch vụ." />,
    }] : []),
    ...(canRedeemRewards ? [{
      key: 'rewards',
      label: <span><GiftOutlined /> Đổi quà</span>,
      children: customer ? (
        <RewardExchangeTab
          customerProfileId={customer.id}
          points={pointBalance}
          maxPointsPerExchange={maxPointsPerExchange}
          onRedeemed={refreshPoints}
        />
      ) : <Empty description="Chọn khách hàng để xem quà có thể đổi." />,
    }] : []),
  ]

  return (
    <>
      <PageTitle
        subtitle="Dùng điểm cho công nợ dịch vụ hoặc đổi quà cho khách hàng."
        right={(
          <Space wrap>
            {ability.can('READ', 'MEMBERSHIP') && <Button icon={<StarOutlined />} onClick={() => navigate('/points')}>Điểm & Hạng</Button>}
            {ability.can('READ', 'REWARD') && <Button icon={<GiftOutlined />} onClick={() => navigate('/rewards')}>Quản lý quà</Button>}
            {ability.can('READ', 'SETTING') && <Button icon={<SettingOutlined />} onClick={() => navigate('/settings/system')}>Cài đặt điểm</Button>}
          </Space>
        )}
      >
        Đổi điểm & quà
      </PageTitle>

      <Card className="mb-4">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <Typography.Text strong className="mb-2 block">Khách hàng</Typography.Text>
            <Select
              className="w-full"
              allowClear
              showSearch
              filterOption={false}
              value={customer?.id}
              placeholder="Tìm theo tên, mã khách hoặc số điện thoại"
              searchValue={searchText}
              onSearch={setSearchText}
              onChange={(id) => {
                setCustomer([customer, ...customers].find((item) => item?.id === id) ?? null)
                setSearchText('')
              }}
              onClear={() => { setCustomer(null); setSearchText('') }}
              loading={customerQuery.isFetching}
              notFoundContent={searchText.trim().length < 2 ? 'Nhập ít nhất 2 ký tự để tìm khách' : customerQuery.isError ? 'Không tải được danh sách khách' : 'Không tìm thấy khách phù hợp'}
              options={customerOptions}
              aria-label="Chọn khách hàng"
            />
            {customerQuery.isError && <Typography.Text type="danger" className="mt-1 block">{errorMessage(customerQuery.error)}</Typography.Text>}
          </Col>
          {customer && (
            <>
              <Col xs={12} md={6}>
                <Statistic title="Điểm hiện có" value={pointBalance} loading={pointsQuery.isLoading} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Tối đa mỗi lần đổi" value={maxPointsPerExchange} suffix="điểm" loading={pointsQuery.isLoading} />
              </Col>
            </>
          )}
        </Row>
      </Card>

      {pointsQuery.isError && customer && (
        <Alert className="mb-4" type="error" showIcon message="Không tải được số dư điểm" description={errorMessage(pointsQuery.error)} />
      )}
      {customer && policy && hasValidBalanceLimit && (
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message={`Mỗi lần đổi tối đa ${maxPointsPerExchange.toLocaleString('vi-VN')} điểm (${balanceMaxPercent}% số dư).`}
          description={`Sau lần đổi, khách cần còn lại ít nhất ${(pointBalance - maxPointsPerExchange).toLocaleString('vi-VN')} điểm.`}
        />
      )}
      {customer && pointsQuery.isSuccess && !hasValidBalanceLimit && (
        <Alert className="mb-4" type="warning" showIcon message="Chưa cấu hình hợp lệ giới hạn điểm dùng mỗi lần đổi." description="Cập nhật tỷ lệ từ 1% đến 99% trong Cài đặt hệ thống trước khi đổi điểm hoặc đổi quà." />
      )}
      {!customer ? (
        <Empty description="Chọn khách hàng để bắt đầu đổi điểm hoặc đổi quà." />
      ) : tabs.length ? (
        <Spin spinning={pointsQuery.isLoading}>
          <Tabs items={tabs} destroyInactiveTabPane={false} />
        </Spin>
      ) : (
        <Alert type="warning" showIcon message="Tài khoản chưa có quyền đổi điểm hoặc đổi quà." />
      )}
    </>
  )
}
