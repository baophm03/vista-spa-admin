import { useState } from 'react'
import { Alert, Button, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import { customInstance } from '@/api/mutator/custom-instance'
import { usePutSessionsIdDone, usePutSessionsIdStart } from '@/api/endpoints/customer-treatments'
import type { TreatmentSession } from '@/api/models/treatmentSession'
import { useBrandDateTime } from '@/themeRuntime'
import ListPagination from '@/components/base/ListPagination'

type SessionRow = TreatmentSession & {
  appointment?: { appt_date?: string; start_time?: string } | null
  customer_treatment?: {
    customer_profile?: { id?: string; customer_code?: string; full_name?: string; phone?: string } | null
    package?: { id?: string; name?: string } | null
  } | null
}

type SessionsResponse = {
  responseData?: SessionRow[]
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

export default function MySessions() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [startingId, setStartingId] = useState<string | null>(null)
  const [finishingId, setFinishingId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { formatDateTime } = useBrandDateTime()
  const startMutation = usePutSessionsIdStart()
  const doneMutation = usePutSessionsIdDone()

  const sessionsQuery = useQuery({
    queryKey: ['my-sessions', page, status],
    queryFn: () => customInstance<SessionsResponse>({
      url: '/sessions',
      method: 'GET',
      params: { page, limit: 10, ...(status ? { status } : {}) },
    }),
  })
  const rows = (pickData<SessionRow[]>(sessionsQuery.data) ?? []) as SessionRow[]
  const total = pickMeta(sessionsQuery.data)?.total ?? rows.length

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

  const columns: TableColumnsType<SessionRow> = [
    {
      title: 'Buổi',
      dataIndex: 'session_no',
      width: 90,
      render: (value: number, row) => <strong>{row.is_warranty ? 'Bảo hành' : `Buổi ${value}`}</strong>,
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
      title: 'Liệu trình',
      key: 'package',
      render: (_value, row) => row.customer_treatment?.package?.name || '—',
    },
    {
      title: 'Lịch hẹn',
      key: 'scheduled_at',
      render: (_value, row) => {
        const appointment = row.appointment
        if (appointment?.appt_date) {
          const dateTime = appointment.start_time
            ? `${appointment.appt_date}T${appointment.start_time}`
            : appointment.appt_date
          return dayjs(dateTime).format(appointment.start_time ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY')
        }
        return row.scheduled_at ? formatDateTime(row.scheduled_at) : 'Chưa xếp lịch'
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (value?: string) => {
        const statusInfo = STATUS_META[value || ''] ?? { label: value || '—', color: 'default' }
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      render: (_value, row) => row.status === 'scheduled'
        ? <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={startingId === row.id} onClick={() => void startSession(row)}>Bắt đầu</Button>
        : row.status === 'in_progress'
          ? <Button size="small" icon={<CheckOutlined />} loading={finishingId === row.id} onClick={() => void finishSession(row)}>Đã làm xong</Button>
          : <Typography.Text type="secondary">—</Typography.Text>,
    },
  ]

  return <>
    <PageTitle subtitle="Danh sách các buổi được giao cho tài khoản KTV">Buổi của tôi</PageTitle>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <Typography.Text type="secondary">KTV chỉ xem và thao tác trên buổi được phân công.</Typography.Text>
      <Space wrap>
        <Select
          value={status}
          style={{ minWidth: 180 }}
          options={STATUS_OPTIONS}
          onChange={(value) => { setStatus(value); setPage(1) }}
        />
        <Button icon={<ReloadOutlined />} loading={sessionsQuery.isFetching} onClick={() => void sessionsQuery.refetch()}>Tải lại</Button>
      </Space>
    </div>
    {sessionsQuery.isError && <Alert
      style={{ marginBottom: 16 }}
      type="error"
      showIcon
      message="Không tải được danh sách buổi"
      description={errorMessage(sessionsQuery.error)}
      action={<Button size="small" onClick={() => void sessionsQuery.refetch()}>Thử lại</Button>}
    />}
    <Table<SessionRow>
      rowKey="id"
      loading={sessionsQuery.isLoading}
      columns={columns}
      dataSource={rows}
      scroll={{ x: 850 }}
      pagination={false}
      locale={{ emptyText: 'Chưa có buổi nào được giao cho bạn' }}
    />
    <ListPagination page={page} limit={10} total={total} onChange={setPage} noun="buổi điều trị" />
  </>
}
