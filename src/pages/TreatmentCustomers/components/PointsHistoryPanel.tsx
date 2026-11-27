import { useState } from 'react'
import dayjs from 'dayjs'
import { Button, Typography } from 'antd'
import { StarOutlined } from '@ant-design/icons'
import { DetailCard, DetailEmpty, DetailHero, DetailLoading } from '@/components/base/DetailModal'
import ResponsiveTable from '@/components/base/ResponsiveTable'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import { useGetUsersCustomersIdPointsAdmin } from '@/api/endpoints/customers'
import type { MembershipTransaction } from '@/api/models/membershipTransaction'
/** LY-01 — Lịch sử biến động điểm của khách (trong drawer chi tiết). */
export default function PointsHistoryPanel({ profileId }: { profileId: string }) {
  const pointsQuery = useGetUsersCustomersIdPointsAdmin(profileId)
  const [pointPage, setPointPage] = useState(1)
  const data = pickData<{ points?: number; history?: MembershipTransaction[] }>(pointsQuery.data)
  const REF_LABEL: Record<string, string> = {
    PAYMENT: 'Thanh toán',
    MANUAL: 'Chỉnh tay',
    RANK: 'Xét hạng',
    REWARD: 'Đổi quà',
    WHEEL: 'Quay số',
    REDEEM: 'Đổi tiền gói',
  }
  const rows = data?.history ?? []
  if (pointsQuery.isLoading) return <DetailLoading label="Đang tải lịch sử điểm thưởng" />
  if (pointsQuery.isError && !data) {
    return <DetailEmpty icon={<StarOutlined />} title="Không tải được lịch sử điểm thưởng"
      description={errorMessage(pointsQuery.error)}
      action={<Button onClick={() => void pointsQuery.refetch()}>Thử lại</Button>} />
  }
  return (
    <div className="dm-stack">
      <DetailHero caption="Điểm khả dụng" title={Number(data?.points ?? 0).toLocaleString('vi-VN')} sub={`${rows.length} lần biến động điểm`} />
      {rows.length === 0 ? (
        <DetailEmpty icon={<StarOutlined />} title="Chưa có biến động điểm nào" />
      ) : (
        <DetailCard title="Lịch sử điểm">
          <ResponsiveTable
            rowKey={(r) => String(r.id ?? r.trans_code ?? r.trans_date)}
            size="small"
            dataSource={paginateRows(rows, pointPage, 8)}
            pagination={false}
            columns={[
              { title: 'Thời gian', dataIndex: 'created_at', width: 140, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—') },
              { title: 'Loại', dataIndex: 'ref_type', width: 130, render: (v: string) => REF_LABEL[v] ?? v },
              {
                title: 'Điểm',
                dataIndex: 'points_earned',
                width: 90,
                render: (v: number) => (
                  <Typography.Text type={Number(v) >= 0 ? 'success' : 'danger'}>
                    {Number(v) >= 0 ? '+' : ''}{v}
                  </Typography.Text>
                ),
              },
              { title: 'Lý do', dataIndex: 'reason', render: (v: string | null) => v || '—' },
            ]}
          />
          <ListPagination page={pointPage} limit={8} total={rows.length} onChange={setPointPage} noun="biến động điểm" />
        </DetailCard>
      )}
    </div>
  )
}
