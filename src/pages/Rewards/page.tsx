import { Tabs } from 'antd'
import PageTitle from '@/components/base/PageTitle'
import RedemptionsTab from './components/RedemptionsTab'
import RewardCatalogTab from './components/RewardCatalogTab'

export default function Rewards() {
  return (
    <>
      <PageTitle subtitle="Quà tặng khi đổi điểm và lịch sử đổi thưởng">Quà đổi điểm</PageTitle>
      <Tabs
        className="max-md:[&_.ant-tabs-nav-list]:w-full max-md:[&_.ant-tabs-tab]:flex-1 max-md:[&_.ant-tabs-tab]:justify-center max-md:[&_.ant-tabs-tab+.ant-tabs-tab]:ms-0!"
        items={[
          { key: 'catalog', label: 'Quà tặng', children: <RewardCatalogTab /> },
          { key: 'redemptions', label: 'Lượt đổi', children: <RedemptionsTab /> },
        ]}
      />
    </>
  )
}
