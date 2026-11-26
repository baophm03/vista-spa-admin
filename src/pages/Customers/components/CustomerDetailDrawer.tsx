import { Drawer, Typography } from 'antd'
import { displayName } from '@/utils/displayName'
import CustomerProfileDetailsTabs from './CustomerProfileDetailsTabs'
import type { CustomerProfileRow, CustomerProfileSummary } from './CustomerProfileOverviewTab'
import type { CustomFieldDefWithOptions } from './CustomerProfileCustomFields'
import CustomerAvatar from './CustomerAvatar'

interface CustomerDetailDrawerProps {
  selected: CustomerProfileRow | null
  summary: CustomerProfileSummary | null
  profileFieldDefs: CustomFieldDefWithOptions[]
  onClose: () => void
  onMembershipUpdated: () => Promise<void> | void
}

export default function CustomerDetailDrawer({
  selected,
  summary,
  profileFieldDefs,
  onClose,
  onMembershipUpdated,
}: CustomerDetailDrawerProps) {
  return (
    <Drawer
      title={selected ? `${displayName(selected)} — ${selected.customer_code}` : ''}
      width="min(980px, calc(100vw - 24px))"
      open={!!selected}
      onClose={onClose}
    >
      {selected && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <CustomerAvatar profile={selected} size={60} />
            <div style={{ minWidth: 0 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>{displayName(selected)}</Typography.Title>
              <Typography.Text type="secondary">{selected.phone}</Typography.Text>
            </div>
          </div>

          <CustomerProfileDetailsTabs
            key={selected.id}
            profile={selected}
            summary={summary}
            fieldDefinitions={profileFieldDefs}
            onMembershipUpdated={onMembershipUpdated}
          />
        </div>
      )}
    </Drawer>
  )
}
