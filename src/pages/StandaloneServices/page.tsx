import { Button } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { Can } from '@casl/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import StandaloneServiceHistory, { STANDALONE_SERVICE_QUERY, standaloneServiceRows } from '@/components/StandaloneServiceHistory'

/** Dịch vụ lẻ — hồ sơ các lần khách dùng dịch vụ riêng, không trừ buổi gói */
export default function StandaloneServices() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const focusAppointmentId = searchParams.get('appointment_id')
  const consumeFocusAppointment = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('appointment_id')
    setSearchParams(next, { replace: true })
  }

  // Share cache với StandaloneServiceHistory qua STANDALONE_SERVICE_QUERY
  const appointmentsQuery = useQuery(STANDALONE_SERVICE_QUERY)
  const rows = standaloneServiceRows(appointmentsQuery.data)
  const statusCount = (status: string) => rows.filter((row) => String(row.status) === status).length
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng lượt dịch vụ', value: rows.length.toLocaleString('vi-VN'), icon: <TeamOutlined />, tone: 'primary' },
    { key: 'pending', label: 'Chờ duyệt', value: statusCount('pending').toLocaleString('vi-VN'), icon: <ClockCircleOutlined />, tone: 'secondary' },
    { key: 'ongoing', label: 'Đang làm', value: statusCount('in_progress').toLocaleString('vi-VN'), icon: <PlayCircleOutlined />, tone: 'tertiary' },
    { key: 'done', label: 'Đã hoàn tất', value: statusCount('completed').toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'neutral' },
  ]

  return (
    <>
      <StatCards items={statItems} />
      <PageTitle
        subtitle="Hồ sơ các lần khách dùng dịch vụ riêng, không trừ buổi gói"
        extra={
          <Can I="CREATE" a="APPOINTMENT">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/appointments?create=1')}>
              Thêm dịch vụ lẻ
            </Button>
          </Can>
        }
      >
        Dịch vụ lẻ
      </PageTitle>
      <StandaloneServiceHistory
        hideCreate
        focusAppointmentId={focusAppointmentId}
        onFocusConsumed={consumeFocusAppointment}
      />
    </>
  )
}