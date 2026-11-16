import { Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import dayjs from 'dayjs'
import type { ReactNode } from 'react'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'
import { STATUS_META } from './constants'
import type { AppointmentRow } from './constants'

interface AppointmentsTableProps {
  rows: AppointmentRow[]
  loading: boolean
  branchName: (id?: string) => string
  onRowClick: (row: AppointmentRow) => void
  /** Menu hành động của từng dòng (duyệt/bắt đầu/đổi lịch/hủy...) — giữ logic nghiệp vụ ở page */
  renderActions: (row: AppointmentRow) => ReactNode
}

export default function AppointmentsTable({ rows, loading, branchName, onRowClick, renderActions }: AppointmentsTableProps) {
  const columns = ([
    {
      title: 'Khách hàng',
      key: 'customer',
      dataIndex: ['customer_profile', 'full_name'],
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v || '—'}</div>
          <div style={{ fontSize: 12, color: '#6F7071' }}>{row.customer_profile?.phone}</div>
        </div>
      ),
    },
    {
      title: 'Thời gian',
      key: 'time',
      dataIndex: 'appt_date',
      width: 160,
      render: (v, row) => `${dayjs(v).format('DD/MM/YYYY')} ${row.start_time?.slice(0, 5)}`,
    },
    { title: 'Cơ sở', key: 'branch', dataIndex: ['branch', 'name'], width: 130, render: (v: string | undefined, row: AppointmentRow) => v || branchName(row.branch_id) },
    { title: 'Nguồn', key: 'source', dataIndex: 'created_via', width: 100, render: (v) => (v === 'APP' ? <Tag>Mini App</Tag> : <Tag>Nhân viên</Tag>) },
    {
      title: 'Trạng thái',
      key: 'status',
      dataIndex: 'status',
      width: 130,
      render: (v: AppointmentStatus) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag>,
    },
    {
      title: 'Hành động', align: 'center' as const,
      key: 'actions',
      width: 90,
      fixed: 'right' as const,
      render: (_, row) => renderActions(row),
    },
  ] satisfies TableColumnsType<AppointmentRow>)

  return (
    <Table<AppointmentRow>
      rowKey="id"
      loading={loading}
      dataSource={rows}
      scroll={{ x: 1080 }}
      pagination={false}
      onRow={(row) => ({
        onClick: () => onRowClick(row),
        style: { cursor: 'pointer' },
      })}
      columns={columns}
    />
  )
}
