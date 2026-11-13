import { Button, Drawer, Popconfirm, Space, Typography } from 'antd'
import { DownloadOutlined, HistoryOutlined, LinkOutlined, PrinterOutlined } from '@ant-design/icons'
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
  onHistory: () => void
  onMembershipUpdated: () => Promise<void> | void
  branchName: (id?: string) => string
}

export default function CustomerDetailDrawer({
  selected,
  summary,
  qrUrl,
  qrLoading,
  qrError,
  profileFieldDefs,
  canViewQr,
  isAdmin,
  canManage,
  resettingQr,
  onClose,
  onDownloadQr,
  onPrintQr,
  onResetQr,
  onLink,
  onHistory,
  onMembershipUpdated,
  branchName,
}: CustomerDetailDrawerProps) {
  return (
    <Drawer
      title={selected ? `${selected.full_name} — ${selected.customer_code}` : ''}
      width="min(980px, calc(100vw - 24px))"
      open={!!selected}
      onClose={onClose}
    >
      {selected && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <CustomerAvatar profile={selected} size={60} />
            <div style={{ minWidth: 0 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>{selected.full_name}</Typography.Title>
              <Typography.Text type="secondary">{selected.user?.zalo_name || selected.phone}</Typography.Text>
            </div>
          </div>

          {canViewQr && <div style={{ textAlign: 'center', padding: '18px 12px', background: '#FAFBFA', border: '1px solid var(--brand-border-soft)', borderRadius: 12 }}>
            {qrUrl ? (
              <img src={qrUrl} alt={`Mã QR ${selected.customer_code}`} width={180} height={180} style={{ display: 'block', margin: '0 auto' }} />
            ) : qrLoading ? (
              <div role="status" style={{ width: 180, height: 180, margin: '0 auto', display: 'grid', placeItems: 'center', color: '#8A8D93' }}>Đang tải QR…</div>
            ) : (
              <div role="alert" style={{ width: 180, height: 180, margin: '0 auto', display: 'grid', placeItems: 'center', color: '#8A8D93' }}>{qrError || 'Chưa có mã QR'}</div>
            )}
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Quét mã để tra cứu khách hàng
            </Typography.Text>
            <Space wrap style={{ justifyContent: 'center', marginTop: 12 }}>
              <Button icon={<DownloadOutlined />} disabled={!qrUrl} onClick={onDownloadQr}>Tải QR</Button>
              <Button icon={<PrinterOutlined />} disabled={!qrUrl} onClick={onPrintQr}>In QR</Button>
              {isAdmin && (
                <Popconfirm
                  title="Tạo mã QR mới?"
                  description="Mã QR cũ sẽ không còn hiệu lực."
                  okText="Tạo lại"
                  cancelText="Hủy"
                  onConfirm={onResetQr}
                >
                  <Button loading={resettingQr}>Tạo lại QR</Button>
                </Popconfirm>
              )}
            </Space>
          </div>}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            {canManage && !selected.user_id && (
              <Button
                icon={<LinkOutlined />}
                onClick={onLink}
                style={{ flex: '1 1 180px', minWidth: 0, justifyContent: 'center' }}
              >Liên kết tài khoản</Button>
            )}
            {canManage && (
              <Button
                icon={<HistoryOutlined />}
                onClick={onHistory}
                style={{ flex: selected.user_id ? '0 0 auto' : '1 1 180px', minWidth: 0, justifyContent: 'center' }}
              >Lịch sử mã khách</Button>
            )}
          </div>

          <CustomerProfileDetailsTabs
            key={selected.id}
            profile={selected}
            summary={summary}
            branchName={branchName}
            fieldDefinitions={profileFieldDefs}
            onMembershipUpdated={onMembershipUpdated}
          />
        </div>
      )}
    </Drawer>
  )
}
