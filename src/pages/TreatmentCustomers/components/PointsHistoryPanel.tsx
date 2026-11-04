import { useState } from 'react'
import dayjs from 'dayjs'
import { Empty, Statistic, Table, Typography } from 'antd'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { pickData } from '@/api/helpers'
import { useGetCustomerProfilesIdPoints } from '@/api/endpoints/customer-profiles'
import type { MembershipTransaction } from '@/api/models/membershipTransaction'
/** LY-01 — Lịch sử biến động điểm của khách (trong drawer chi tiết). */
export default function PointsHistoryPanel({ profileId }: { profileId: string }) {
  const pointsQuery = useGetCustomerProfilesIdPoints(profileId)
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
  return (
    <div className="pt-2">
      <Statistic title="Điểm khả dụng" value={data?.points ?? 0} className="mb-4" />
      {pointsQuery.isLoading ? (
        <Typography.Text type="secondary">Đang tải…</Typography.Text>
      ) : rows.length === 0 ? (
        <Empty description="Chưa có biến động điểm nào" />
      ) : (
        <>
          <Table
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
        </>
      )}
    </div>
  )
}
