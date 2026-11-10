import { useMemo, useState } from 'react'
import { Alert, Button, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckOutlined, ProfileOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import { customInstance } from '@/api/mutator/custom-instance'
import { usePutSessionsIdDone, usePutSessionsIdStart } from '@/api/endpoints/treatment-customers'
import type { TreatmentSession } from '@/api/models/treatmentSession'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'

type SessionRow = TreatmentSession & {
  appointment?: { appt_date?: string; start_time?: string } | null
  staff?: { id?: string; zalo_name?: string; email?: string } | null
  customer_treatment?: {
    customer_profile?: { id?: string; customer_code?: string; full_name?: string; phone?: string } | null
    package?: { id?: string; name?: string } | null
  } | null
}

/** Lượt dịch vụ KH (standalone_service) gán cho KTV — map về cùng dạng 1 dòng "việc được giao" */
type ServiceRow = {
  kind: 'service'
  id: string
  status: string
  cs_date: string
  start_time?: string | null
  visit_done_at?: string | null
  customer_profile?: { full_name?: string; customer_code?: string; phone?: string } | null
  service?: { title?: string } | null
  staff?: { zalo_name?: string } | null
}

type MergedRow = ({ kind: 'treatment' } & SessionRow) | ServiceRow

type SessionsResponse = {
  responseData?: SessionRow[] | { rows?: SessionRow[] }
  data?: SessionRow[]
  meta?: { page?: number; limit?: number; total?: number }
}

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'scheduled', label: 'Chưa làm' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'done', label: 'Đã làm' },
  { value: 'completed', label: 'Hoàn tất' },
]

const STATUS_META: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Chưa làm', color: 'default' },
  in_progress: { label: 'Đang làm', color: 'processing' },
  done: { label: 'Đã làm', color: 'orange' },
  completed: { label: 'Hoàn tất', color: 'green' },
}

/** Map trạng thái dịch vụ lẻ về cùng thang với buổi liệu trình */
function serviceStatus(row: ServiceRow): string {
  if (row.status === 'completed') return 'completed'
  if (row.status === 'in_progress') return row.visit_done_at ? 'done' : 'in_progress'
  return 'scheduled'
}

function rowTime(row: MergedRow): string | null {
  if (row.kind === 'service') return row.cs_date ? `${String(row.cs_date).slice(0, 10)}T${row.start_time?.slice(0, 5) || '00:00'}` : null
  const appointment = row.appointment
  if (appointment?.appt_date) return appointment.start_time ? `${appointment.appt_date}T${appointment.start_time}` : appointment.appt_date
  return row.scheduled_at || null
}

function rowCustomer(row: MergedRow) {
  if (row.kind === 'service') return row.customer_profile ?? null
  return row.customer_treatment?.customer_profile ?? null
}

export default function MySessions() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [startingId, setStartingId] = useState<string | null>(null)
  const [finishingId, setFinishingId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const startMutation = usePutSessionsIdStart()
  const doneMutation = usePutSessionsIdDone()

  const sessionsQuery = useQuery({
    queryKey: ['my-sessions'],
    queryFn: () => customInstance<SessionsResponse>({
      url: '/sessions',
      method: 'GET',
      params: { page: 1, limit: 200 },
    }),
  })
  const sessionRows = (pickData<SessionRow[]>(sessionsQuery.data) ?? []) as SessionRow[]

  // Lượt dịch vụ KH của KTV — BE tự scope theo user đang login (mirror logic cũ của /appointments:
  // KTV/thiếu quyền duyệt chỉ thấy bản ghi gán cho mình), FE không cần truyền staff_id
  const standaloneQuery = useQuery({
    queryKey: ['my-sessions-standalone'],
    queryFn: () => customInstance<SessionsResponse>({
      url: '/standaloneServices',
      method: 'GET',
      params: { page: 1, limit: 200 },
    }),
  })
  const standaloneRows = useMemo(() => (pickData<{ rows?: ServiceRow[] } | undefined>(standaloneQuery.data)?.rows ?? [])
    .filter((row) => row.status !== 'cancelled')
    .map((row): ServiceRow => ({ ...row, kind: 'service' })), [standaloneQuery.data])

  const rows = useMemo(() => {
    const merged: MergedRow[] = [
      ...sessionRows.map((row): MergedRow => ({ ...row, kind: 'treatment' })),
      ...standaloneRows,
    ]
    return merged
      .filter((row) => !status || (row.kind === 'service' ? serviceStatus(row) : row.status) === status)
      .sort((a, b) => {
        const timeA = rowTime(a)
        const timeB = rowTime(b)
        if (!timeA && !timeB) return 0
        if (!timeA) return 1 // chưa xếp lịch xuống cuối
        if (!timeB) return -1
        return timeA.localeCompare(timeB)
      })
  }, [sessionRows, standaloneRows, status])

  const isLoading = sessionsQuery.isLoading || standaloneQuery.isLoading
  const listError = sessionsQuery.isError ? sessionsQuery.error : standaloneQuery.isError ? standaloneQuery.error : null
  const total = rows.length
  const pageRows = rows.slice((page - 1) * 10, page * 10)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['my-sessions'] })
    await queryClient.invalidateQueries({ queryKey: ['my-sessions-standalone'] })
  }

  const startSession = async (row: SessionRow) => {
    setStartingId(row.id)
    try {
      await startMutation.mutateAsync({ id: row.id })
      message.success('Đã bắt đầu buổi điều trị')
      await refresh()
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setStartingId(null)
    }
  }

  const finishSession = async (row: SessionRow) => {
    setFinishingId(row.id)
    try {
      await doneMutation.mutateAsync({ id: row.id, data: {} as never })
      message.success('Đã đánh dấu buổi làm xong; lễ tân sẽ hoàn tất sau')
      await refresh()
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setFinishingId(null)
    }
  }

  const openServiceProfile = (row: ServiceRow) => {
    // Mở thẳng hồ sơ lượt dịch vụ ở page Dịch vụ KH (bắt đầu/đánh dấu làm xong cần chốt giá — dùng flow sẵn có)
    navigate(`/standalone-services?appointment_id=${row.id}`)
  }

  const actionCell = (row: MergedRow) => {
    if (row.kind === 'service') {
      const mapped = serviceStatus(row)
      return mapped === 'completed'
        ? <Typography.Text type="secondary">—</Typography.Text>
        : <Button size="small" icon={<ProfileOutlined />} onClick={() => openServiceProfile(row)}>Mở hồ sơ</Button>
    }
    return row.status === 'scheduled'
      ? <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={startingId === row.id} onClick={() => void startSession(row)}>Bắt đầu</Button>
      : row.status === 'in_progress'
        ? <Button size="small" icon={<CheckOutlined />} loading={finishingId === row.id} onClick={() => void finishSession(row)}>Đã làm xong</Button>
        : <Typography.Text type="secondary">—</Typography.Text>
  }

  const columns: TableColumnsType<MergedRow> = [
    {
      title: 'Buổi',
      key: 'label',
      width: 110,
      render: (_value, row) => {
        if (row.kind === 'service') return <strong>Dịch vụ lẻ</strong>
        return <strong>{row.is_warranty ? 'Bảo hành' : `Buổi ${row.session_no}`}</strong>
      },
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_value, row) => {
        const customer = rowCustomer(row)
        return <Space direction="vertical" size={0}>
          <span>{customer?.full_name || 'Khách hàng'}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{customer?.customer_code || customer?.phone || '—'}</Typography.Text>
        </Space>
      },
    },
    {
      title: 'Nội dung',
      key: 'content',
      render: (_value, row) => row.kind === 'service' ? row.service?.title || '—' : row.customer_treatment?.package?.name || '—',
    },
    {
      title: 'KTV',
      key: 'staff',
      render: (_value, row) => ('zalo_name' in (row.staff ?? {}) ? row.staff?.zalo_name : undefined) || 'Chưa gán',
    },
    {
      title: 'Lịch hẹn',
      key: 'scheduled_at',
      render: (_value, row) => {
        const time = rowTime(row)
        if (!time) return 'Chưa xếp lịch'
        const hasTime = time.includes('T') && !time.endsWith('T00:00')
        return dayjs(time).format(hasTime ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY')
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      render: (_value, row) => {
        const mapped = row.kind === 'service' ? serviceStatus(row) : row.status || ''
        const statusInfo = STATUS_META[mapped] ?? { label: mapped || '—', color: 'default' }
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
      },
    },
    {
      title: 'Thao tác', align: 'center' as const,
      key: 'actions',
      width: 150,
      render: (_value, row) => actionCell(row),
    },
  ]

  return <>
    <PageTitle
      subtitle="Danh sách buổi điều trị & lượt dịch vụ được giao cho tài khoản KTV"
      left={
        <>
          <Select
            value={status}
            className="min-w-[180px]"
            options={STATUS_OPTIONS}
            onChange={(value) => { setStatus(value); setPage(1) }}
          />
        </>
      }
    >
      Buổi của tôi
    </PageTitle>
    {listError && <Alert
      style={{ marginBottom: 16 }}
      type="error"
      showIcon
      message="Không tải được danh sách buổi"
      description={errorMessage(listError)}
      action={<Button size="small" onClick={() => { void sessionsQuery.refetch(); void standaloneQuery.refetch() }}>Thử lại</Button>}
    />}
    <Table<MergedRow>
      className="desktop-only"
      rowKey="id"
      loading={isLoading}
      columns={columns}
      dataSource={pageRows}
      scroll={{ x: 950 }}
      pagination={false}
      locale={{ emptyText: 'Chưa có buổi nào được giao cho bạn' }}
    />
    <MobileCards
      rows={pageRows}
      rowKey={(row) => row.id}
      loading={isLoading}
      emptyText="Chưa có buổi nào được giao cho bạn"
      renderCard={(row) => {
        const mapped = row.kind === 'service' ? serviceStatus(row) : row.status || ''
        const statusInfo = STATUS_META[mapped] ?? { label: mapped || '—', color: 'default' }
        const time = rowTime(row)
        return (
          <>
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">{row.kind === 'service' ? 'Dịch vụ lẻ' : row.is_warranty ? 'Bảo hành' : `Buổi ${row.session_no}`}</div>
                <div className="mobile-card-sub">{rowCustomer(row)?.full_name || 'Khách hàng'} · {row.kind === 'service' ? row.service?.title || '—' : row.customer_treatment?.package?.name || '—'}</div>
              </div>
              <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Lịch hẹn" value={
                time
                  ? dayjs(time).format(time.includes('T') && !time.endsWith('T00:00') ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY')
                  : 'Chưa xếp lịch'
              } />
              <MobileCardRow label="KTV" value={row.staff?.zalo_name || 'Chưa gán'} />
            </div>
            <div className="mobile-card-actions">
              {actionCell(row)}
            </div>
          </>
        )
      }}
    />
    <ListPagination page={page} limit={10} total={total} onChange={setPage} noun="việc được giao" />
  </>
}
