import { Tabs } from 'antd'
import { useSearchParams } from 'react-router-dom'
import PageTitle from '@/components/base/PageTitle'
import CommissionRulesPanel from '@/pages/CommissionRules/page'
import ReferralsPanel from '@/pages/Referrals/page'

export default function Commissions() {
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')

  const tabItems = [
    { key: 'received', label: 'Đã nhận', children: <ReferralsPanel /> },
    { key: 'rules', label: 'Quy tắc', children: <CommissionRulesPanel /> },
  ]

  const defaultTab = tabItems.some((tab) => tab.key === requestedTab) ? requestedTab : 'received'

  return (
    <>
      <PageTitle subtitle="Hoa hồng đã nhận và quy tắc tính tự động theo từng cơ sở">Hoa hồng</PageTitle>
      <Tabs defaultActiveKey={defaultTab} items={tabItems} />
    </>
  )
}
