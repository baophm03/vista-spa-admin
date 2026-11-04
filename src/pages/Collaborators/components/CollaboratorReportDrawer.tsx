import { Alert, Button, Drawer, Space, Spin, Typography } from 'antd'
import { errorMessage, pickData } from '@/api/helpers'
import { useGetCollaboratorsIdSummary } from '@/api/endpoints/admin'

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

export default function CollaboratorReportDrawer({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const summaryQuery = useGetCollaboratorsIdSummary(id, { query: { enabled: open && !!id } })
  const summary = pickData<{ referral_count?: number; total_package_value?: number; total_commission?: number }>(
    summaryQuery.data,
  )

  return (
    <Drawer title="Báo cáo cộng tác viên" width={420} open={open} onClose={onClose}>
      {summaryQuery.isLoading ? (
        <Spin />
      ) : summaryQuery.isError ? (
        <Alert
          type="error" showIcon
          title="Không tải được báo cáo"
          description={errorMessage(summaryQuery.error)}
          action={<Button size="small" onClick={() => void summaryQuery.refetch()}>Thử lại</Button>}
        />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert type="info" showIcon title="Số liệu tổng hợp theo toàn bộ lịch sử giới thiệu của CTV." />
          <div>
            <Typography.Text type="secondary">Số khách được giới thiệu</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{(summary?.referral_count ?? 0).toLocaleString('vi-VN')}</div>
          </div>
          <div>
            <Typography.Text type="secondary">Tổng giá trị gói điều trị</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{formatVnd(summary?.total_package_value)}</div>
          </div>
          <div>
            <Typography.Text type="secondary">Tổng hoa hồng (đang ACTIVE)</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#389e0d' }}>{formatVnd(summary?.total_commission)}</div>
          </div>
        </Space>
      )}
    </Drawer>
  )
}
