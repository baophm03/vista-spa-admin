import { useEffect, useState } from 'react'
import { Button } from 'antd'
import { CalendarOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { Appointment } from '@/api/models/appointment'
import { getAppointmentsAdmin } from '@/api/endpoints/appointments'
import { errorMessage, pickData } from '@/api/helpers'
import ListPagination from '@/components/base/ListPagination'
import { DetailCard, DetailChip, DetailEmpty, DetailLoading, type ChipTone } from '@/components/base/DetailModal'
import { paginateRows } from '@/utils/listTable'

type AppointmentRow = Appointment & {
  service?: { title?: string } | null
  staff?: { zalo_name?: string } | null
}

const APPOINTMENT_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  pending: { label: 'Chờ duyệt', tone: 'pending' },
  approved: { label: 'Đã duyệt', tone: 'primary' },
  in_progress: { label: 'Đang thực hiện', tone: 'primary' },
  completed: { label: 'Hoàn tất', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
  rejected: { label: 'Từ chối', tone: 'danger' },
}

export default function CustomerProfileAppointmentsTab({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getAppointmentsAdmin({ user_id: profileId, page: 1, limit: 200 })
      .then((result) => { if (active) setRows(pickData<AppointmentRow[]>(result)) })
      .catch((err) => { if (active) setError(errorMessage(err)) })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => { active = false }
  }, [profileId, refresh])

  if (loading) return <DetailLoading label="Đang tải lịch hẹn" />
  if (error) return <DetailEmpty icon={<CalendarOutlined />} title="Không tải được lịch hẹn" description={error} action={<Button onClick={() => { setPage(1); setRefresh((value) => value + 1) }}>Thử lại</Button>} />
  if (!rows.length) return <DetailEmpty icon={<CalendarOutlined />} title="Khách chưa có lịch hẹn" />

  return (
    <DetailCard title="Lịch hẹn" extra={<span className="dm-extra">{rows.length} lịch hẹn</span>}>
      <div className="dm-list">
        {paginateRows(rows, page, 8).map((row) => {
          const status = APPOINTMENT_STATUS[row.status?.toLowerCase() ?? '']
          return (
            <button
              key={row.id}
              type="button"
              className="dm-list-item dm-list-link"
              aria-label={`Mở chi tiết lịch hẹn ${row.service?.title || ''}`.trim()}
              onClick={() => navigate(`/appointments?appointment_id=${encodeURIComponent(row.id)}&detail=1`)}
            >
              <div className="dm-list-main">
                <div className="dm-value">{row.service?.title || 'Lịch hẹn'}</div>
                <div className="dm-label">
                  {[`${dayjs(row.appt_date).format('DD/MM/YYYY')}${row.start_time ? ` ${row.start_time.slice(0, 5)}` : ''}`, row.staff?.zalo_name && `KTV ${row.staff.zalo_name}`, row.note].filter(Boolean).join(' · ')}
                </div>
              </div>
              <DetailChip tone={status?.tone ?? 'neutral'}>{status?.label ?? row.status ?? '—'}</DetailChip>
              <RightOutlined className="dm-list-chevron" />
            </button>
          )
        })}
      </div>
      <ListPagination page={page} limit={8} total={rows.length} onChange={setPage} noun="lịch hẹn" />
    </DetailCard>
  )
}
