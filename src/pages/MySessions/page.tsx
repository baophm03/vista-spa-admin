import { useMemo, useState } from 'react'
import { Alert, Button, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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

function rowTime(row: SessionRow): string | null {
  const appointment = row.appointment
  if (appointment?.appt_date) return appointment.start_time ? `${appointment.appt_date}T${appointment.start_time}` : appointment.appt_date
  return row.scheduled_at || null
}

export default function MySessions() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [startingId, setStartingId] = useState<string | null>(null)
  const [finishingId, setFinishingId] = useState<string | null>(null)
  const queryClient = useQueryClient()
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

  const rows = useMemo(() => sessionRows
    .filter((row) => !status || row.status === status)
    .sort((a, b) => {
      const timeA = rowTime(a)
      const timeB = rowTime(b)
      if (!timeA && !timeB) return 0
      if (!timeA) return 1 // chưa xếp lịch xuống cuối
      if (!timeB) return -1
      return timeA.localeCompare(timeB)
    }), [sessionRows, status])

  const isLoading = sessionsQuery.isLoading
  const listError = sessionsQuery.isError ? sessionsQuery.error : null
  const total = rows.length
  const pageRows = rows.slice((page - 1) * 10, page * 10)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['my-sessions'] })
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

  const actionCell = (row: SessionRow) => {
    return row.status === 'scheduled'
      ? <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={startingId === row.id} onClick={() => void startSession(row)}>Bắt đầu</Button>
      : row.status === 'in_progress'
        ? <Button size="small" icon={<CheckOutlined />} loading={finishingId === row.id} onClick={() => void finishSession(row)}>Đã làm xong</Button>
        : <Typography.Text type="secondary">—</Typography.Text>
  }

  const columns: TableColumnsType<SessionRow> = [
    {
      title: 'Buổi',
      key: 'label',
      width: 110,
      render: (_value, row) => <strong>{row.is_warranty ? 'Bảo hành' : `Buổi ${row.session_no}`}</strong>,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_value, row) => {
        const customer = row.customer_treatment?.customer_profile
        return <Space direction="vertical" size={0}>
          <span>{customer?.full_name || 'Khách hàng'}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{customer?.customer_code || customer?.phone || '—'}</Typography.Text>
        </Space>
      },
    },
    {
      title: 'Nội dung',
      key: 'content',
      render: (_value, row) => row.customer_treatment?.package?.name || '—',
    },
    {
      title: 'KTV',
      key: 'staff',
      render: (_value, row) => row.staff?.zalo_name || 'Chưa gán',
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
        const statusInfo = STATUS_META[row.status || ''] ?? { label: row.status || '—', color: 'default' }
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
      subtitle="Danh sách buổi điều trị được giao cho tài khoản KTV"
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
      action={<Button size="small" onClick={() => { void sessionsQuery.refetch() }}>Thử lại</Button>}
    />}
    <Table<SessionRow>
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
        const statusInfo = STATUS_META[row.status || ''] ?? { label: row.status || '—', color: 'default' }
        const time = rowTime(row)
        return (
          <>
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">{row.is_warranty ? 'Bảo hành' : `Buổi ${row.session_no}`}</div>
                <div className="mobile-card-sub">{row.customer_treatment?.customer_profile?.full_name || 'Khách hàng'} · {row.customer_treatment?.package?.name || '—'}</div>
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
