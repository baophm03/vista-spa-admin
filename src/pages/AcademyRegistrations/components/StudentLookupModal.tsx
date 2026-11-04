import { Button, Empty, Input, Modal, Table, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { Can } from '@casl/react'
import { STATUS_META, type RegistrationRow } from './constants'

export default function StudentLookupModal({ open, lookupValue, onLookupValueChange, hasQuery, loading, rows, onClose, onCreateFromLookup }: {
  open: boolean
  lookupValue: string
  onLookupValueChange: (v: string) => void
  hasQuery: boolean
  loading: boolean
  rows: RegistrationRow[]
  onClose: () => void
  onCreateFromLookup: (row: RegistrationRow) => void
}) {
  return (
    <Modal
      title="Tra cứu lịch sử học viên"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width="min(900px, calc(100vw - 24px))"
    >
      <Input
        placeholder="Nhập SĐT hoặc email để tra cứu"
        style={{ width: 280, marginBottom: 12 }}
        value={lookupValue}
        onChange={(e) => onLookupValueChange(e.target.value)}
        prefix={<SearchOutlined />}
      />
      {hasQuery ? (
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={[
            { title: 'Khóa học', key: 'course', render: (_: unknown, row: RegistrationRow) => row.course?.name ?? '—' },
            { title: 'Họ tên', dataIndex: 'full_name' },
            { title: 'SĐT', dataIndex: 'phone' },
            { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag> },
            {
              title: '', key: 'act', render: (_: unknown, row: RegistrationRow) => (
                <Can I="CREATE" a="ACADEMY">
                  {row.status === 'CANCELLED' && (
                    <Button size="small" onClick={() => onCreateFromLookup(row)}>Đăng ký lại khóa này</Button>
                  )}
                </Can>
              )
            },
          ]}
          dataSource={rows}
          pagination={false}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nhập SĐT hoặc email để tra cứu" style={{ padding: '16px 0' }} />
      )}
    </Modal>
  )
}
