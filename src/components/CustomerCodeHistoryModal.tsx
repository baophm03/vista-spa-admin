import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Modal, Table, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useBrandDateTime } from '@/themeRuntime'
import { getCustomerProfilesIdCodeHistory } from '@/api/endpoints/customer-profiles'
import { errorMessage, pickData } from '@/api/helpers'

interface CodeHistoryRow {
  id: string
  old_code?: string
  new_code?: string
  reason?: string | null
  changed_at?: string | null
  rank?: { name?: string } | null
}

interface CustomerCodeHistoryModalProps {
  open: boolean
  profileId?: string
  onClose: () => void
}

function describeReason(reason?: string | null) {
  if (reason === 'rank-up') return 'Nâng hạng tự động'
  if (reason?.startsWith('rank-override:')) {
    const note = reason.slice('rank-override:'.length).trim()
    return note ? `Gán hạng thủ công: ${note}` : 'Gán hạng thủ công'
  }
  return reason || '—'
}

export default function CustomerCodeHistoryModal({ open, profileId, onClose }: CustomerCodeHistoryModalProps) {
  const { formatDateTime } = useBrandDateTime()
  const [rows, setRows] = useState<CodeHistoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!profileId) return
    setLoading(true)
    setError('')
    try {
      setRows(pickData<CodeHistoryRow[]>(await getCustomerProfilesIdCodeHistory(profileId)))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void load()
    else setRows([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profileId])

  return (
    <Modal
      title="Lịch sử mã khách"
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(760px, calc(100vw - 24px))"
      destroyOnHidden
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được lịch sử mã khách"
          description={error}
          action={<Button icon={<ReloadOutlined />} onClick={() => void load()}>Thử lại</Button>}
        />
      ) : null}
      {!error && (
        <Table<CodeHistoryRow>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 620 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lịch sử đổi mã" /> }}
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
      )}
    </Modal>
  )
}
