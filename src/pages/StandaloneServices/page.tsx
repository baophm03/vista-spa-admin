import { useState } from 'react'
import { Button, Grid, Input, Select } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons'
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

  // Mobile (dưới breakpoint md): search thu về nút icon, bấm mới mở ô tìm kiếm
  const isMobile = !Grid.useBreakpoint().md
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

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
        left={
          <>
            {/* Mobile: nút icon mở ô tìm kiếm; desktop hiện input luôn — Select trạng thái giữ nguyên */}
            {isMobile && !searchOpen && (
              <Button icon={<SearchOutlined />} aria-label="Tìm kiếm" title="Tìm kiếm" onClick={() => setSearchOpen(true)} />
            )}
            {(searchOpen || !isMobile) && (
              <Input
                allowClear
                autoFocus={isMobile}
                prefix={<SearchOutlined />}
                placeholder="Tìm khách, SĐT, dịch vụ, KTV"
                className={isMobile && searchOpen ? 'min-w-0 flex-1' : 'w-[280px]!'}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onBlur={() => { if (isMobile && !search) setSearchOpen(false) }}
              />
            )}
            <Select value={statusFilter} className="w-[160px]" onChange={setStatusFilter} options={[
              { value: 'all', label: 'Mọi trạng thái' },
              { value: 'pending', label: 'Chờ duyệt' },
              { value: 'approved', label: 'Đã duyệt' },
              { value: 'in_progress', label: 'Đang làm' },
              { value: 'completed', label: 'Hoàn tất' },
            ]} />
          </>
        }
        right={
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
        focusAppointmentId={focusAppointmentId}
        onFocusConsumed={consumeFocusAppointment}
        search={search}
        statusFilter={statusFilter}
      />
    </>
  )
}
