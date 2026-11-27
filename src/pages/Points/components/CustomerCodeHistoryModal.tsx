import { useEffect, useState } from 'react'
import { Alert, Button, Modal, Table, Tabs, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useBrandDateTime } from '@/themeRuntime'
import { getUsersCustomersIdCodeHistoryAdmin, getUsersCustomersIdPointsAdmin } from '@/api/endpoints/customers'
import type { MembershipTransaction } from '@/api/models'
import { errorMessage, pickData } from '@/api/helpers'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import { paginateRows } from '@/utils/listTable'

interface CodeHistoryRow {
  id: string
  old_code?: string
  new_code?: string
  reason?: string | null
  changed_at?: string | null
  rank?: { name?: string } | null
}

interface PointsHistoryResponse {
  points?: number
  history?: MembershipTransaction[]
}

interface CustomerCodeHistoryModalProps {
  open: boolean
  profileId?: string
  onClose: () => void
  title?: string
  emptyDescription?: string
  includePointsHistory?: boolean
}

function describeReason(reason?: string | null) {
  if (reason === 'rank-up') return 'Nâng hạng tự động'
  if (reason?.startsWith('rank-override:')) {
    const note = reason.slice('rank-override:'.length).trim()
    return note ? `Gán hạng: ${note}` : 'Gán hạng'
  }
  return reason || '—'
}

const POINT_TYPES: Record<string, string> = {
  PAYMENT: 'Thanh toán',
  MANUAL: 'Điều chỉnh tay',
  RANK: 'Hạng',
  REWARD: 'Đổi quà',
  REWARD_CANCEL: 'Hủy đổi quà',
  REDEEM: 'Trừ vào gói',
  WHEEL: 'Vòng quay',
}

function pointType(row: MembershipTransaction) {
  return POINT_TYPES[row.ref_type ?? ''] ?? row.ref_type ?? '—'
}

function pointDelta(row: MembershipTransaction) {
  const delta = Number(row.points_earned ?? 0)
  return <Typography.Text strong type={delta < 0 ? 'danger' : undefined}>{delta > 0 ? '+' : ''}{delta.toLocaleString('vi-VN')}</Typography.Text>
}

export default function CustomerCodeHistoryModal({
  open,
  profileId,
  onClose,
  title = 'Lịch sử mã khách',
  emptyDescription = 'Chưa có lịch sử đổi mã',
  includePointsHistory = false,
}: CustomerCodeHistoryModalProps) {
  const { formatDateTime } = useBrandDateTime()
  const [rows, setRows] = useState<CodeHistoryRow[]>([])
  const [pointRows, setPointRows] = useState<MembershipTransaction[]>([])
  const [pointBalance, setPointBalance] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pointsError, setPointsError] = useState('')
  const [pointPage, setPointPage] = useState(1)

  const load = async () => {
    if (!profileId) return
    setLoading(true)
    setError('')
    setPointsError('')
    setPointPage(1)
    const results = await Promise.allSettled([
      getUsersCustomersIdCodeHistoryAdmin(profileId),
      ...(includePointsHistory ? [getUsersCustomersIdPointsAdmin(profileId)] : []),
    ])

    const codeResult = results[0]
    if (codeResult.status === 'fulfilled') {
      setRows(pickData<CodeHistoryRow[]>(codeResult.value) ?? [])
    } else {
      setRows([])
      setError(errorMessage(codeResult.reason))
    }

    if (includePointsHistory) {
      const pointsResult = results[1]
      if (pointsResult?.status === 'fulfilled') {
        const pointsData = pickData<PointsHistoryResponse>(pointsResult.value)
        setPointRows(pointsData?.history ?? [])
        setPointBalance(pointsData?.points)
      } else {
        setPointRows([])
        setPointBalance(undefined)
        setPointsError(errorMessage(pointsResult?.reason))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    if (open) void load()
    else {
      setRows([])
      setPointRows([])
      setPointBalance(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profileId, includePointsHistory])

  const rankHistoryTable = (
    <Table<CodeHistoryRow>
      className="desktop-only"
      rowKey="id"
      loading={loading}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 620 }}
      locale={{ emptyText: <TableEmpty description={emptyDescription} /> }}
      columns={[
        { title: 'Mã cũ', dataIndex: 'old_code', render: (value?: string) => <Typography.Text code>{value}</Typography.Text> },
        { title: 'Mã mới', dataIndex: 'new_code', render: (value?: string) => <Typography.Text code>{value}</Typography.Text> },
        { title: 'Hạng liên quan', dataIndex: ['rank', 'name'], render: (value?: string) => value || '—' },
        { title: 'Lý do', dataIndex: 'reason', render: (value?: string) => describeReason(value) },
        {
          title: 'Thời điểm',
          dataIndex: 'changed_at',
          width: 150,
          render: (value?: string) => formatDateTime(value),
        },
      ]}
    />
  )

  const visiblePointRows = paginateRows(pointRows, pointPage, 10)
  const pointTime = (row: MembershipTransaction) =>
    row.created_at ? formatDateTime(row.created_at) : row.trans_date || '—'

  const pointsHistoryTable = (
    <>
      {pointBalance !== undefined && (
        <Typography.Paragraph style={{ marginBottom: 12 }}>
          Điểm hiện tại: <Typography.Text strong>{Number(pointBalance).toLocaleString('vi-VN')}</Typography.Text>
        </Typography.Paragraph>
      )}
      {pointsError ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được lịch sử điểm"
          description={pointsError}
          action={<Button icon={<ReloadOutlined />} onClick={() => void load()}>Thử lại</Button>}
        />
      ) : (
        <>
          <Table<MembershipTransaction>
            className="desktop-only"
            rowKey="id"
            loading={loading}
            dataSource={visiblePointRows}
            pagination={false}
            scroll={{ x: 650 }}
            locale={{ emptyText: <TableEmpty description="Chưa có lịch sử điểm" /> }}
            columns={[
              {
                title: 'Thời điểm',
                width: 160,
                render: (_, row) => pointTime(row),
              },
              {
                title: 'Loại',
                width: 130,
                render: (_, row) => <Tag color={Number(row.points_earned ?? 0) >= 0 ? 'green' : 'red'}>{pointType(row)}</Tag>,
              },
              {
                title: 'Điểm',
                width: 90,
                align: 'right',
                render: (_, row) => pointDelta(row),
              },
              { title: 'Lý do', dataIndex: 'reason', render: (value?: string | null) => value || '—' },
              { title: 'Mã giao dịch', dataIndex: 'trans_code', render: (value?: string) => <Typography.Text code>{value || '—'}</Typography.Text> },
            ]}
          />
          <MobileCards
            rows={visiblePointRows}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText="Chưa có lịch sử điểm"
            renderCard={(row) => (
              <>
                <div className="mobile-card-head flex-wrap">
                  <span className="mobile-card-title">{pointType(row)}</span>
                  {pointDelta(row)}
                </div>
                <div className="mobile-card-rows">
                  <MobileCardRow label="Thời điểm" value={pointTime(row)} />
                  <MobileCardRow label="Mã giao dịch" value={row.trans_code || '—'} />
                  <MobileCardRow label="Lý do" value={row.reason || '—'} />
                </div>
              </>
            )}
          />
          <div className="max-md:[&>div]:flex-wrap max-md:[&>div>span]:basis-full max-md:[&>div>div]:max-w-full max-md:[&>div>div]:flex-wrap">
            <ListPagination page={pointPage} limit={10} total={pointRows.length} onChange={setPointPage} noun="giao dịch điểm" hideOnSinglePage />
          </div>
        </>
      )}
    </>
  )

  const rankHistoryContent = error ? (
    <Alert
      type="error"
      showIcon
      message="Không tải được lịch sử hạng"
      description={error}
      action={<Button icon={<ReloadOutlined />} onClick={() => void load()}>Thử lại</Button>}
    />
  ) : (
    <>
      {rankHistoryTable}
      <MobileCards
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        emptyText={emptyDescription}
        renderCard={(row) => (
          <>
            {row.rank?.name && <div className="mobile-card-head"><span className="mobile-card-title">{row.rank.name}</span></div>}
            <div className="mobile-card-rows">
              <MobileCardRow label="Mã cũ" value={row.old_code || '—'} />
              <MobileCardRow label="Mã mới" value={row.new_code || '—'} />
              <MobileCardRow label="Lý do" value={describeReason(row.reason)} />
              <MobileCardRow label="Thời điểm" value={formatDateTime(row.changed_at)} />
            </div>
          </>
        )}
      />
    </>
  )

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={includePointsHistory ? 'min(1040px, calc(100vw - 24px))' : 'min(760px, calc(100vw - 24px))'}
      destroyOnHidden
    >
      {includePointsHistory ? (
        <Tabs
          items={[
            { key: 'rank', label: 'Lịch sử hạng', children: rankHistoryContent },
            { key: 'points', label: 'Lịch sử điểm', children: pointsHistoryTable },
          ]}
        />
      ) : rankHistoryContent}
    </Modal>
  )
}
