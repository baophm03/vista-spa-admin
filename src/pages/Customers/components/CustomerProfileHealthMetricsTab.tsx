import { useEffect, useMemo, useState } from 'react'
import { Button, DatePicker, Select, Space } from 'antd'
import { FileTextOutlined, HeartOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import { useAbility } from '@casl/react'
import dayjs from 'dayjs'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import type { HealthMetric } from '@/api/models/healthMetric'
import type { LookupItem } from '@/api/models/lookupItem'
import type { LookupList } from '@/api/models/lookupList'
import { getUsersCustomersIdHealthMetricsAdmin, getUsersCustomersIdHealthRecordsAdmin } from '@/api/endpoints/customers'
import { getSkinTypesAdmin } from '@/api/endpoints/skin-types'
import { getLookupListsAdmin } from '@/api/endpoints/lookup-lists'
import { errorMessage, pickData } from '@/api/helpers'
import { useBrandDateTime } from '@/themeRuntime'
import ListPagination from '@/components/base/ListPagination'
import { DetailCard, DetailEmpty, DetailHero, DetailLoading, DetailNote } from '@/components/base/DetailModal'
import { AllergyCard, HealthRecordCard, HealthStatusCard } from '@/pages/HealthRecords/components/HealthRecordParts'
import { currentHealth, displayDate, healthDetails, type HealthRow, type SkinTypeOption } from '@/pages/HealthRecords/components/constants'
import { paginateRows } from '@/utils/listTable'
import useHealthRecordForm from '@/pages/HealthRecords/components/useHealthRecordForm'
import type { CustomerProfileRow } from './CustomerProfileOverviewTab'

type MetricRow = HealthMetric & {
  session?: { session_no?: number } | null
  created_by_user?: { zalo_name?: string } | null
  created_by?: string | null
}

type LookupListWithItems = LookupList & { lookup_items?: LookupItem[] | null }

export default function CustomerProfileHealthMetricsTab({ profileId, profile }: { profileId: string; profile?: CustomerProfileRow }) {
  const { formatDateTime, getDateTimeParts } = useBrandDateTime()
  const [rows, setRows] = useState<MetricRow[]>([])
  const [records, setRecords] = useState<CustomerHealthRecord[]>([])
  const [skinTypes, setSkinTypes] = useState<SkinTypeOption[]>([])
  const [items, setItems] = useState<LookupItem[]>([])
  const [metricCode, setMetricCode] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState(1)
  const canEditRecords = useAbility().can('UPDATE', 'CUSTOMER')
  const { openForm, modal: recordModal } = useHealthRecordForm({
    skinTypes,
    skinTypesLoading: loading,
    onSaved: () => setRefresh((value) => value + 1),
  })
  const recordTarget = profile ?? ({ id: profileId } as CustomerProfileRow)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    // API trả toàn bộ dữ liệu của hồ sơ; lọc theo chỉ số/khoảng ngày tại client (endpoint không nhận query params trong spec).
    Promise.all([
      getUsersCustomersIdHealthMetricsAdmin(profileId),
      getLookupListsAdmin({ key: 'health.metrics' }),
      getUsersCustomersIdHealthRecordsAdmin(profileId),
      getSkinTypesAdmin(),
    ])
      .then(([metricsResult, catalogsResult, recordsResult, skinTypesResult]) => {
        if (!active) return
        setRows(pickData<MetricRow[]>(metricsResult))
        const configuredItems = (pickData<LookupListWithItems[]>(catalogsResult) ?? [])
          .find((row) => row.key === 'health.metrics')?.lookup_items ?? []
        setItems(configuredItems.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.code.localeCompare(b.code)))
        setRecords(pickData<CustomerHealthRecord[]>(recordsResult) ?? [])
        setSkinTypes(pickData<SkinTypeOption[]>(skinTypesResult) ?? [])
      })
      .catch((err) => { if (active) setError(errorMessage(err)) })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => { active = false }
  }, [profileId, refresh])

  const names = useMemo(() => Object.fromEntries(items.map((item) => [item.code, item.label])), [items])
  const activeItems = items.filter((item) => item.is_active !== false)
  const inRange = (row: MetricRow) => {
    if (!dateRange) return true
    const measuredDate = getDateTimeParts(row.measured_at)?.date
    if (!measuredDate) return false
    return measuredDate >= dateRange[0].format('YYYY-MM-DD')
      && measuredDate <= dateRange[1].format('YYYY-MM-DD')
  }
  const filteredRows = useMemo(() => rows
    .filter((row) => (!metricCode || row.metric_code === metricCode) && inRange(row)), [rows, metricCode, dateRange])
  const chartData = metricCode
    ? filteredRows.filter((row) => row.value_num !== null && row.value_num !== undefined)
      .slice()
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
      .map((row) => ({ date: formatDateTime(row.measured_at), value: Number(row.value_num), unit: row.unit || '' }))
    : []

  if (loading) return <DetailLoading label="Đang tải dữ liệu sức khỏe" />
  if (error) return <DetailEmpty icon={<HeartOutlined />} title="Không tải được dữ liệu sức khỏe" description={error} action={<Button onClick={() => setRefresh((value) => value + 1)}>Thử lại</Button>} />

  const sortedRecords = records.slice().sort((a, b) => new Date(b.checked_date || b.created_at || 0).getTime() - new Date(a.checked_date || a.created_at || 0).getTime())
  const latestRecord = sortedRecords[0]
  // Cùng nguồn với /health-records: phiếu mới nhất, chưa có phiếu thì lấy dữ liệu cũ trên hồ sơ
  const current = currentHealth({ ...recordTarget, latestRecord: latestRecord ?? null } as HealthRow, skinTypes)
  const isLegacy = !latestRecord
  const hasLegacyData = isLegacy && healthDetails(current).some((field) => !!field.value)
  // Giá trị đo gần nhất của từng chỉ số
  const latestMetrics = [...new Map(rows.slice()
    .sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime())
    .map((row) => [row.metric_code, row] as const)
    .reverse()).values()].sort((a, b) => (names[a.metric_code] || a.metric_code).localeCompare(names[b.metric_code] || b.metric_code, 'vi'))
  const editRecord = (record: CustomerHealthRecord) => canEditRecords ? () => openForm(recordTarget, record) : undefined
  const createLink = canEditRecords && (
    <button type="button" className="dm-link" onClick={() => openForm(recordTarget)}><PlusOutlined /> Tạo phiếu khám</button>
  )

  return (
    <div className="dm-stack">
      <DetailHero
        caption={isLegacy ? (hasLegacyData ? 'Thông tin cũ trên hồ sơ' : 'Sổ sức khỏe') : 'Lần khám gần nhất'}
        title={current.checked_date ? displayDate(current.checked_date) : 'Chưa có phiếu khám'}
        sub={isLegacy
          ? (hasLegacyData ? 'Chưa được tính là một lần khám' : 'Tạo phiếu khám đầu tiên để bắt đầu sổ sức khỏe')
          : <><UserOutlined /> {current.checked_by || 'Chưa ghi người khám'}</>}
        stats={[
          { label: 'Phiếu khám', value: records.length },
          { label: 'Lần đo chỉ số', value: rows.length },
          { label: 'Chỉ số theo dõi', value: latestMetrics.length },
        ]}
      />

      {(latestRecord || hasLegacyData) ? (
        <div className="dm-overview">
          <HealthStatusCard fields={current} onEdit={latestRecord ? editRecord(latestRecord) : undefined} />
          <div className="dm-stack">
            <AllergyCard allergies={current.allergies} />
            <DetailCard title="Chỉ số mới nhất">
              {latestMetrics.length ? (
                <div className="dm-list">
                  {latestMetrics.map((row) => (
                    <div key={row.metric_code} className="dm-list-item">
                      <div className="dm-list-main">
                        <div className="dm-value">{names[row.metric_code] || row.metric_code}</div>
                        <div className="dm-label">{formatDateTime(row.measured_at)}</div>
                      </div>
                      <span className="dm-amount">{row.value_num ?? row.value_text ?? '—'}{row.unit ? ` ${row.unit}` : ''}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="dm-value dm-value-empty">Chưa có lần đo nào</div>}
            </DetailCard>
          </div>
        </div>
      ) : (
        <DetailEmpty
          icon={<FileTextOutlined />}
          title="Chưa có phiếu khám"
          description="Phiếu khám sẽ hiện ở đây sau lần khám đầu tiên."
          action={canEditRecords && <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(recordTarget)}>Tạo phiếu khám</Button>}
        />
      )}

      {sortedRecords.length > 0 && (
        <>
          <div className="dm-section-head">
            <h3>Lịch sử phiếu khám <span className="dm-nav-count">{sortedRecords.length}</span></h3>
            {createLink}
          </div>
          {sortedRecords.map((record, index) => (
            <HealthRecordCard key={record.id} record={record} skinTypes={skinTypes} latest={index === 0} onEdit={editRecord(record)} />
          ))}
        </>
      )}
      {recordModal}

      <DetailCard title="Chỉ số theo dõi" extra={<span className="dm-extra">{filteredRows.length} lần đo</span>}>
        <div className="dm-filters">
          <Select
            value={metricCode || undefined}
            allowClear
            placeholder="Tất cả chỉ số"
            options={activeItems.map((item) => ({ value: item.code, label: <Space size={6}>{item.color && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: item.color, display: 'inline-block' }} />}{item.label}</Space> }))}
            onChange={(value) => { setMetricCode(value || ''); setPage(1) }}
          />
          <DatePicker.RangePicker format="DD/MM/YYYY" value={dateRange} onChange={(value) => { setDateRange(value as [dayjs.Dayjs, dayjs.Dayjs] | null); setPage(1) }} />
        </div>
        {activeItems.length === 0 && (
          <DetailNote title="Chưa có danh mục chỉ số đang hoạt động">Quản trị viên có thể cấu hình mã chỉ số trong Cấu hình dữ liệu khách hàng.</DetailNote>
        )}
        {!filteredRows.length ? <div className="dm-value dm-value-empty mt-4">Chưa có chỉ số đo trong bộ lọc này</div> : (
          <>
            {!metricCode && filteredRows.some((row) => row.value_num !== null && row.value_num !== undefined) && (
              <div className="dm-label mt-4">Chọn một chỉ số để xem biểu đồ theo thời gian.</div>
            )}
            {metricCode && chartData.length > 0 && (
              <>
                <div className="dm-subtitle">{names[metricCode] || metricCode}</div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEEAF1" />
                    <XAxis dataKey="date" minTickGap={24} tick={{ fontSize: 12, fill: '#746B80' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#746B80' }} />
                    <Tooltip formatter={(value, _name, item) => [String(value) + ((item?.payload as { unit?: string })?.unit ? ' ' + (item?.payload as { unit?: string }).unit : ''), 'Giá trị']} />
                    <Line type="monotone" dataKey="value" stroke="var(--brand-primary)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
            <div className="dm-subtitle">Lịch sử đo</div>
            <div className="dm-list">
              {paginateRows(filteredRows, page, 8).map((row) => (
                <div key={row.id} className="dm-list-item">
                  <div className="dm-list-main">
                    <div className="dm-value">{names[row.metric_code] || row.metric_code}</div>
                    <div className="dm-label">
                      {[formatDateTime(row.measured_at), row.session?.session_no && `Buổi ${row.session.session_no}`, row.created_by_user?.zalo_name || row.created_by, row.note].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className="dm-amount">{row.value_num ?? row.value_text ?? '—'}{row.unit ? ` ${row.unit}` : ''}</span>
                </div>
              ))}
            </div>
            <ListPagination page={page} limit={8} total={filteredRows.length} onChange={setPage} noun="chỉ số sức khỏe" />
          </>
        )}
      </DetailCard>
    </div>
  )
}
