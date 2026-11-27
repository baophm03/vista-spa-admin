import { Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import dayjs from 'dayjs'
import type { ReactNode } from 'react'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'
import { displayName } from '@/utils/displayName'
import { STATUS_META, appointmentTopic } from './constants'
import type { AppointmentRow } from './constants'

interface AppointmentsTableProps {
  rows: AppointmentRow[]
  loading: boolean
  branchName: (id?: string) => string
  staffName: (row: AppointmentRow) => string
  onRowClick: (row: AppointmentRow) => void
  /** Menu hành động của từng dòng (duyệt/bắt đầu/đổi lịch/hủy...) — giữ logic nghiệp vụ ở page */
  renderActions: (row: AppointmentRow, inCard?: boolean) => ReactNode
}

export default function AppointmentsTable({ rows, loading, branchName, staffName, onRowClick, renderActions }: AppointmentsTableProps) {
  const columns = ([
    {
      title: 'Khách hàng',
      key: 'customer',
      dataIndex: ['user', 'full_name'],
      width: 232,
      ellipsis: true,
      render: (_: unknown, row: AppointmentRow) => <span className="font-medium">{displayName(row.user)}</span>,
    },
    {
      title: 'Chủ đề',
      key: 'topic',
      width: 220,
      ellipsis: true,
      render: (_: unknown, row: AppointmentRow) => {
        const topic = appointmentTopic(row)
        if (!topic) return <span className="text-slate-400">—</span>
        return (
          <span title={`${topic.kind}: ${topic.label}`}>
            <span className="text-xs text-slate-500">{topic.kind}: </span>
            {topic.label}
          </span>
        )
      },
    },
    {
      title: <span className="whitespace-nowrap">Số điện thoại</span>,
      key: 'phone',
      dataIndex: ['user', 'phone'],
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
    <>
      <Table<AppointmentRow>
        className="desktop-only max-lg:hidden!"
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
      {/* Mobile: card theo Figma "Vista Admin / Thẻ lịch hẹn" — tên + tag trạng thái, các hàng label/value */}
      <MobileCards
        className="md:max-lg:grid! md:max-lg:grid-cols-2 md:max-lg:[&>.mobile-card]:min-w-0"
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        emptyText="Chưa có lịch hẹn nào"
        onCardClick={onRowClick}
        renderCard={(row) => {
          const actions = renderActions(row, true)
          return (
            <>
              <div className="mobile-card-head">
                <div className="mobile-card-title">{row.user?.full_name || '—'}</div>
                <Tag color={STATUS_META[row.status as AppointmentStatus]?.color} style={{ marginInlineEnd: 0 }}>
                  {STATUS_META[row.status as AppointmentStatus]?.label ?? row.status}
                </Tag>
              </div>
              <div className="mobile-card-rows">
                <MobileCardRow label="Chủ đề" value={appointmentTopic(row)?.label || '—'} />
                <MobileCardRow label="Thời gian" value={`${dayjs(row.appt_date).format('DD/MM/YYYY')} ${row.start_time?.slice(0, 5) ?? ''}`} />
                <MobileCardRow label="Số điện thoại" value={row.user?.phone || '—'} />
                <MobileCardRow label="Cơ sở" value={branchName(row.branch_id)} />
                <MobileCardRow label="KTV phụ trách" value={staffName(row)} />
              </div>
              {actions && (
                <div className="mobile-card-actions" onClick={(event) => event.stopPropagation()}>
                  {actions}
                </div>
              )}
            </>
          )
        }}
      />
    </>
  )
}
