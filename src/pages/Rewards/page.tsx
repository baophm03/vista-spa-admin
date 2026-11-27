import { Tabs } from 'antd'
import PageTitle from '@/components/base/PageTitle'
import RedemptionsTab from './components/RedemptionsTab'
import RewardCatalogTab from './components/RewardCatalogTab'
import './rewards.css'

export default function Rewards() {
  return (
    <>
      <PageTitle subtitle="Quà tặng khi đổi điểm và lịch sử đổi thưởng">Quà đổi điểm</PageTitle>
      <Tabs
        items={[
          { key: 'catalog', label: 'Quà tặng', children: <RewardCatalogTab /> },
          { key: 'redemptions', label: 'Lượt đổi', children: <RedemptionsTab /> },
        ]}
      />
    </>
  )
}
