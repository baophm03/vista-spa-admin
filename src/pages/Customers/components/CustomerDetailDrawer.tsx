import { Button, Drawer, Typography } from 'antd'
import { displayName } from '@/utils/displayName'
import { LinkOutlined } from '@ant-design/icons'
import CustomerProfileDetailsTabs from './CustomerProfileDetailsTabs'
import type { CustomerProfileRow, CustomerProfileSummary } from './CustomerProfileOverviewTab'
import type { CustomFieldDefWithOptions } from './CustomerProfileCustomFields'
import CustomerAvatar from './CustomerAvatar'

interface CustomerDetailDrawerProps {
  selected: CustomerProfileRow | null
  summary: CustomerProfileSummary | null
  qrUrl: string
  qrLoading: boolean
  qrError: string
  profileFieldDefs: CustomFieldDefWithOptions[]
  canViewQr: boolean
  isAdmin: boolean
  canManage: boolean
  resettingQr: boolean
  onClose: () => void
  onDownloadQr: () => void
  onPrintQr: () => void
  onResetQr: () => void
  onLink: () => void
  onHistory?: () => void
  onMembershipUpdated: () => Promise<void> | void
}

export default function CustomerDetailDrawer({
  selected,
  summary,
  profileFieldDefs,
  canManage,
  onClose,
  onLink,
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
              <Typography.Text type="secondary">{selected.user?.zalo_name || selected.phone}</Typography.Text>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            {canManage && !selected.user_id && (
              <Button
                icon={<LinkOutlined />}
                onClick={onLink}
                style={{ flex: '1 1 180px', minWidth: 0, justifyContent: 'center' }}
              >Liên kết tài khoản</Button>
            )}
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
