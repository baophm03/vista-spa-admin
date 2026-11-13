import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Spin, Table, Tag } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Appointment } from '@/api/models/appointment'
import { getAppointments } from '@/api/endpoints/appointments'
import { errorMessage, pickData } from '@/api/helpers'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { paginateRows } from '@/utils/listTable'

type AppointmentRow = Appointment & {
  service?: { title?: string } | null
  staff?: { zalo_name?: string } | null
}

const APPOINTMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'orange' },
  approved: { label: 'Đã duyệt', color: 'purple' },
  in_progress: { label: 'Đang thực hiện', color: 'blue' },
  completed: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'default' },
  rejected: { label: 'Từ chối', color: 'red' },
}

export default function CustomerProfileAppointmentsTab({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getAppointments({ customer_profile_id: profileId, page: 1, limit: 200 })
      .then((result) => { if (active) setRows(pickData<AppointmentRow[]>(result)) })
      .catch((err) => { if (active) setError(errorMessage(err)) })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => { active = false }
  }, [profileId, refresh])

  if (loading) return <div className="py-9 text-center"><Spin tip="Đang tải lịch hẹn…" /></div>
  if (error) return <Alert type="error" showIcon message="Không tải được lịch hẹn" description={error} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => { setPage(1); setRefresh((value) => value + 1) }}>Thử lại</Button>} />
  if (!rows.length) return <Empty description="Khách chưa có lịch hẹn" />

  return <>
    <Table<AppointmentRow>
      className="desktop-only"
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={paginateRows(rows, page, 8)}
    columns={[
      { title: 'Ngày', dataIndex: 'appt_date', render: (value: string) => dayjs(value).format('DD/MM/YYYY') },
      { title: 'Giờ', dataIndex: 'start_time' },
      { title: 'Dịch vụ', dataIndex: ['service', 'title'], render: (value?: string) => value || '—' },
      { title: 'KTV', dataIndex: ['staff', 'zalo_name'], render: (value?: string) => value || '—' },
      { title: 'Trạng thái', dataIndex: 'status', render: (value: string) => {
        const status = APPOINTMENT_STATUS[value?.toLowerCase()]
        return <Tag color={status?.color ?? 'default'}>{status?.label ?? value ?? '—'}</Tag>
      } },
      { title: 'Ghi chú', dataIndex: 'note', ellipsis: true, render: (value?: string | null) => value || '—' },
    ]}
    />
    <MobileCards
      rows={paginateRows(rows, page, 8)}
      rowKey={(row) => row.id}
      emptyText="Khách chưa có lịch hẹn"
      renderCard={(row) => {
        const status = APPOINTMENT_STATUS[row.status?.toLowerCase() ?? '']
        return (
          <>
            <div className="mobile-card-head">
              <div className="mobile-card-title">{row.service?.title || 'Lịch hẹn'}</div>
              <Tag color={status?.color ?? 'default'}>{status?.label ?? row.status ?? '—'}</Tag>
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Thời gian" value={`${dayjs(row.appt_date).format('DD/MM/YYYY')}${row.start_time ? ` ${row.start_time.slice(0, 5)}` : ''}`} />
              <MobileCardRow label="KTV" value={row.staff?.zalo_name || '—'} />
              <MobileCardRow label="Ghi chú" value={row.note || '—'} />
            </div>
          </>
        )
      }}
    />
    <ListPagination page={page} limit={8} total={rows.length} onChange={setPage} noun="lịch hẹn" />
  </>
}
