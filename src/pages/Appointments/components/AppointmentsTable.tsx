import { Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import dayjs from 'dayjs'
import type { ReactNode } from 'react'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'
import { displayName } from '@/utils/displayName'
import { STATUS_META } from './constants'
import type { AppointmentRow } from './constants'

interface AppointmentsTableProps {
  rows: AppointmentRow[]
  loading: boolean
  branchName: (id?: string) => string
  staffName: (row: AppointmentRow) => string
  onRowClick: (row: AppointmentRow) => void
  /** Menu hành động của từng dòng (duyệt/bắt đầu/đổi lịch/hủy...) — giữ logic nghiệp vụ ở page */
  renderActions: (row: AppointmentRow) => ReactNode
}

export default function AppointmentsTable({ rows, loading, branchName, staffName, onRowClick, renderActions }: AppointmentsTableProps) {
  const columns = ([
    {
      title: 'Khách hàng',
      key: 'customer',
      dataIndex: ['customer_profile', 'full_name'],
      width: 232,
      ellipsis: true,
      render: (_: unknown, row: AppointmentRow) => <span className="font-medium">{displayName(row.customer_profile)}</span>,
    },
    {
      title: <span className="whitespace-nowrap">Số điện thoại</span>,
      key: 'phone',
      dataIndex: ['customer_profile', 'phone'],
      width: 128,
      render: (phone) => <span className="whitespace-nowrap tabular-nums">{phone || '—'}</span>,
    },
    {
      title: 'Thời gian',
      key: 'time',
      dataIndex: 'appt_date',
      width: 160,
      render: (v, row) => `${dayjs(v).format('DD/MM/YYYY')} ${row.start_time?.slice(0, 5)}`,
    },
    { title: 'Cơ sở', key: 'branch', dataIndex: ['branch', 'name'], width: 130, render: (v: string | undefined, row: AppointmentRow) => v || branchName(row.branch_id) },
    {
      title: <span className="whitespace-nowrap">KTV phụ trách</span>,
      key: 'staff',
      width: 176,
      ellipsis: true,
      render: (_, row) => (
        <span className={row.staff_id ? undefined : 'text-neutral-500'}>
          {staffName(row)}
        </span>
      ),
    },
    { title: 'Nguồn', key: 'source', dataIndex: 'created_via', width: 100, render: (v) => (v === 'APP' ? <Tag>Mini App</Tag> : <Tag>Nhân viên</Tag>) },
    {
      title: 'Trạng thái',
      key: 'status',
      dataIndex: 'status',
      width: 130,
      render: (v: AppointmentStatus) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag>,
    },
    {
      title: <span className="whitespace-nowrap">Thao tác</span>, align: 'center' as const,
      key: 'actions',
      width: 112,
      fixed: 'right' as const,
      render: (_, row) => renderActions(row),
    },
  ] satisfies TableColumnsType<AppointmentRow>)

  return (
    <Table<AppointmentRow>
      rowKey="id"
      loading={loading}
      dataSource={rows}
      scroll={{ x: 1168 }}
      pagination={false}
      onRow={(row) => ({
        onClick: () => onRowClick(row),
        style: { cursor: 'pointer' },
      })}
      columns={columns}
    />
  )
}
