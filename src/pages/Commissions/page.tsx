import { Tabs } from 'antd'
import { useSearchParams } from 'react-router-dom'
import PageTitle from '@/components/base/PageTitle'
import CommissionEntriesPanel from '@/pages/CommissionEntries/page'
import CommissionRulesPanel from '@/pages/CommissionRules/page'

export default function Commissions() {
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')

  const tabItems = [
    { key: 'entries', label: 'Sổ hoa hồng', children: <CommissionEntriesPanel /> },
    { key: 'rules', label: 'Quy tắc', children: <CommissionRulesPanel /> },
  ]

  const defaultTab = requestedTab && tabItems.some((tab) => tab.key === requestedTab) ? requestedTab : 'received'

  return (
    <>
      <PageTitle subtitle="Hoa hồng đã nhận và quy tắc tính tự động theo từng cơ sở">Hoa hồng</PageTitle>
      <Tabs defaultActiveKey={defaultTab} items={tabItems} />
    </>
  )
}
