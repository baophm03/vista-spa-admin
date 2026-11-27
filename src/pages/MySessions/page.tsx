import { useMemo, useState } from 'react'
import { displayName } from '@/utils/displayName'
import { Alert, Button, Input, Select, Skeleton, Space, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'

import { getGetSessionsAdminQueryKey, useGetSessionsAdmin, usePutSessionsIdDoneAdmin, usePutSessionsIdStartAdmin } from '@/api/endpoints/treatment-sessions'
import type { GetSessionsAdminParams } from '@/api/models/getSessionsAdminParams'
import type { TreatmentSession } from '@/api/models/treatmentSession'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import type { Branch } from '@/api/models'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import './my-sessions.css'

type SessionRow = TreatmentSession & {
  appointment?: { appt_date?: string; start_time?: string } | null
  staff?: { id?: string; zalo_name?: string; email?: string } | null
  customer_treatment?: {
    user?: { id?: string; customer_code?: string; full_name?: string; phone?: string } | null
    package?: { id?: string; name?: string } | null
  } | null
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

const SORT_OPTIONS = [
  { value: 'asc', label: 'Lịch hẹn cũ trước' },
  { value: 'desc', label: 'Lịch hẹn mới trước' },
] as const

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd')
}

function rowTime(row: SessionRow): string | null {
  const appointment = row.appointment
  if (appointment?.appt_date) return appointment.start_time ? `${appointment.appt_date}T${appointment.start_time}` : appointment.appt_date
  return row.scheduled_at || null
}

function formatSessionTime(row: SessionRow) {
  const time = rowTime(row)
  if (!time) return 'Chưa xếp lịch'
  const hasTime = time.includes('T') && !time.endsWith('T00:00')
  return dayjs(time).format(hasTime ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY')
}

export default function MySessions() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'asc' | 'desc'>('asc')
  const [startingId, setStartingId] = useState<string | null>(null)
  const [finishingId, setFinishingId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const startMutation = usePutSessionsIdStartAdmin()
  const doneMutation = usePutSessionsIdDoneAdmin()
  const branchesQuery = useGetBranchesAdmin()
  const branches = useMemo(() => pickData<Branch[]>(branchesQuery.data) ?? [], [branchesQuery.data])

  const sessionsQuery = useGetSessionsAdmin({ page: 1, limit: 200 } as GetSessionsAdminParams)
  const sessionRows = useMemo(() => pickData<SessionRow[]>(sessionsQuery.data) ?? [], [sessionsQuery.data])

  const rows = useMemo(() => {
    const terms = normalizeSearch(search.trim()).split(/\s+/).filter(Boolean)
    return sessionRows
      .filter((row) => {
        if (status && row.status !== status) return false
        if (!terms.length) return true
        const customer = row.customer_treatment?.user
        const text = normalizeSearch([
          displayName(customer, ''),
          customer?.phone,
          customer?.customer_code,
          row.customer_treatment?.package?.name,
        ].filter(Boolean).join(' '))
        return terms.every((term) => text.includes(term))
      })
      .sort((a, b) => {
        const timeA = rowTime(a)
        const timeB = rowTime(b)
        if (!timeA) return timeB ? 1 : 0
        if (!timeB) return -1
        return sort === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA)
      })
  }, [sessionRows, search, sort, status])

  const isLoading = sessionsQuery.isFetching && !sessionsQuery.data
  const listError = sessionsQuery.isError && !isLoading ? sessionsQuery.error : null
  const total = rows.length
  const currentPage = Math.min(page, Math.max(1, Math.ceil(total / 10)))
  const pageRows = rows.slice((currentPage - 1) * 10, currentPage * 10)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetSessionsAdminQueryKey() })
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
  const branchName = (id?: string) => id && branchesQuery.isLoading
    ? <Skeleton.Input active size="small" />
    : branches.find((branch) => branch.id === id)?.name ?? '—'
  const hasNoMatches = Boolean((status || search.trim()) && sessionRows.length)
  const emptyText = hasNoMatches ? 'Không có kết quả' : 'Chưa có buổi nào được giao cho bạn'

  const actionCell = (row: SessionRow) => {
    return row.status === 'scheduled'
      ? <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={startingId === row.id} onClick={() => void startSession(row)}>Bắt đầu</Button>
      : row.status === 'in_progress'
        ? <Button size="small" icon={<CheckOutlined />} loading={finishingId === row.id} onClick={() => void finishSession(row)}>Đã làm xong</Button>
        : <Typography.Text type="secondary">—</Typography.Text>
  }

  const columns: TableColumnsType<SessionRow> = [
    {
      title: 'Lịch hẹn',
      key: 'scheduled_at',
      width: 150,
      render: (_value, row) => <Space direction="vertical" size={0}>
        <strong>{row.is_warranty ? 'Bảo hành' : `Buổi ${row.session_no}`}</strong>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatSessionTime(row)}</Typography.Text>
      </Space>,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_value, row) => {
        const customer = row.customer_treatment?.user
        return <Space direction="vertical" size={0}>
          <span>{displayName(customer, 'Khách hàng')}</span>
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
    { key: 'branch', title: 'Cơ sở', dataIndex: 'branch_id', width: 120, render: (value?: string) => branchName(value) },
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
      className="mb-3!"
      subtitle="Danh sách buổi điều trị được giao cho tài khoản KTV"
    >
      Buổi của tôi
    </PageTitle>
    <div className="my-session-toolbar toolbar-row mb-3 grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_180px_190px] lg:grid-cols-[minmax(220px,320px)_180px_190px] lg:justify-end">
      <Input.Search
        allowClear
        className="col-span-2 min-w-0 md:col-span-1"
        aria-label="Tìm buổi điều trị"
        placeholder="Tìm khách, SĐT, mã KH hoặc gói"
        value={search}
        onChange={(event) => { setSearch(event.target.value); setPage(1) }}
      />
      <Select
        aria-label="Lọc theo trạng thái"
        value={status}
        className="min-w-0"
        options={STATUS_OPTIONS}
        onChange={(value) => { setStatus(value); setPage(1) }}
      />
      <Select<'asc' | 'desc'>
        aria-label="Sắp xếp theo lịch hẹn"
        value={sort}
        className="min-w-0"
        options={[...SORT_OPTIONS]}
        onChange={(value) => { setSort(value); setPage(1) }}
      />
    </div>
    {listError && <Alert
      className="mb-4! rounded-lg! max-lg:mb-3! "
      type="error"
      showIcon
      title="Không tải được danh sách buổi"
      description={
        <>
          <div className="wrap-anywhere">{errorMessage(listError)}</div>
          <div className="mt-2 flex justify-end">
            <Button size="small" loading={sessionsQuery.isFetching} onClick={() => { void sessionsQuery.refetch() }}>Thử lại</Button>
          </div>
        </>
      }
    />}
    {!listError && !isLoading && <Table<SessionRow>
      className="desktop-only max-lg:hidden!"
      rowKey="id"
      columns={columns}
      dataSource={pageRows}
      scroll={{ x: 950 }}
      pagination={false}
      locale={{ emptyText }}
    />}
    {!listError && <MobileCards
      className={isLoading ? 'my-session-loading' : 'my-session-cards'}
      rows={pageRows}
      rowKey={(row) => row.id}
      loading={isLoading}
      emptyText={emptyText}
      emptyDescription={hasNoMatches ? 'Thử đổi từ khóa hoặc bộ lọc.' : undefined}
      renderCard={(row) => {
        const statusInfo = STATUS_META[row.status || ''] ?? { label: row.status || '—', color: 'default' }
        const canAct = row.status === 'scheduled' || row.status === 'in_progress'
        return (
          <>
            <div className="mobile-card-head">
              <div className="mobile-card-title min-w-0">
                {displayName(row.customer_treatment?.user, 'Khách hàng')}
              </div>
              <Tag className="me-0! shrink-0" color={statusInfo.color}>{statusInfo.label}</Tag>
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Buổi" value={row.is_warranty ? 'Bảo hành' : `Buổi ${String(row.session_no).padStart(2, '0')}`} />
              <MobileCardRow label="Nội dung" value={row.customer_treatment?.package?.name || '—'} />
              <MobileCardRow label="KTV" value={row.staff?.zalo_name || 'Chưa gán'} />
              <MobileCardRow label="Lịch hẹn" value={formatSessionTime(row)} />
              <MobileCardRow label="Cơ sở" value={branchName(row.branch_id)} />
            </div>
            {canAct && <div className="mobile-card-actions items-center justify-between!">
              <Typography.Text type="secondary" className="text-xs!">Thao tác</Typography.Text>
              {actionCell(row)}
            </div>}
          </>
        )
      }}
    />}
    {!listError && <ListPagination page={currentPage} limit={10} total={total} onChange={setPage} noun="buổi được giao" hideOnSinglePage />}
  </>
}
