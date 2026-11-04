import { Empty, Modal, Table, Typography } from 'antd'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { useBrandDateTime } from '@/themeRuntime'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import { ADJUST_TYPE_LABEL, adjustmentDiffLines, type TreatmentAdjustmentRow } from './constants'

interface TreatmentHistoryModalProps {
  open: boolean
  historyRow: CustomerTreatment | null
  profileName: (row: CustomerTreatment) => string
  loading: boolean
  rows: TreatmentAdjustmentRow[]
  page: number
  onPageChange: (page: number) => void
  onCancel: () => void
}

export default function TreatmentHistoryModal({
  open,
  historyRow,
  profileName,
  loading,
  rows,
  page,
  onPageChange,
  onCancel,
}: TreatmentHistoryModalProps) {
  const { formatDateTime } = useBrandDateTime()
  return (
      <Modal
        title={`Lịch sử điều chỉnh — ${historyRow ? profileName(historyRow) : ''}`}
      open={open}
        onCancel={onCancel}
        footer={null}
        width={860}
      >
        {loading ? (
          <Typography.Text type="secondary">Đang tải…</Typography.Text>
        ) : rows.length === 0 ? (
          <Empty description="Gói chưa từng bị điều chỉnh" className="my-6!" />
        ) : (
          <>
            <Table<TreatmentAdjustmentRow>
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={paginateRows(rows as TreatmentAdjustmentRow[], page, 8)}
              pagination={false}
              columns={[
                { title: 'Thời gian', dataIndex: 'created_at', width: 130, render: (v: string) => formatDateTime(v) },
                { title: 'Loại', dataIndex: 'type', width: 140, render: (v: string) => ADJUST_TYPE_LABEL[v] ?? v },
                {
                  title: 'Giá trị',
                  dataIndex: 'amount',
                  width: 90,
                  render: (v: number | null, row: TreatmentAdjustmentRow) =>
                    v == null ? '—' : /CONVERT|SESSIONS|BONUS/.test(row.type) ? `${v} buổi` : Number(v).toLocaleString('vi-VN'),
                },
                { title: 'Lý do', dataIndex: 'reason', render: (v: string) => v },
                {
                  title: 'Thay đổi',
                  key: 'diff',
                  width: 280,
                  render: (_: unknown, row: TreatmentAdjustmentRow) => {
                    const lines = adjustmentDiffLines(row)
                    return (
                      <div className="grid gap-0.5 text-xs">
                        {lines.map((line) => (
                          <div key={line.label}>
                            <span className="text-[#6F7071]">{line.label}: </span>
                            <span className="text-[#8C9091]">{line.before}</span>
                            {' → '}
                            <span className="font-semibold">{line.after}</span>
                          </div>
                        ))}
                      </div>
                    )
                  },
                },
              ]}
            />
            <ListPagination page={page} limit={8} total={rows.length} onChange={onPageChange} noun="lần điều chỉnh" />
          </>
        )}
      </Modal>
  )
}

