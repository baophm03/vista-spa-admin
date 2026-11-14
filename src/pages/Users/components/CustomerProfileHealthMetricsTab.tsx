import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { HistoryOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import type { HealthMetric } from '@/api/models/healthMetric'
import type { LookupItem } from '@/api/models/lookupItem'
import type { LookupList } from '@/api/models/lookupList'
import { getCustomerProfilesIdHealthMetrics, getCustomerProfilesIdHealthRecords } from '@/api/endpoints/customer-profiles'
import { getSkinTypes } from '@/api/endpoints/settings'
import { getLookupLists } from '@/api/endpoints/lookup-lists'
import { errorMessage, pickData } from '@/api/helpers'
import { useBrandDateTime } from '@/themeRuntime'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { paginateRows } from '@/utils/listTable'

type MetricRow = HealthMetric & {
  session?: { session_no?: number } | null
  created_by_user?: { zalo_name?: string } | null
  created_by?: string | null
}

type LookupListWithItems = LookupList & { lookup_items?: LookupItem[] | null }

interface SkinTypeOption {
  code: string
  label: string
  sort_order?: number
}

/** Áp mã/nhãn loại da trong danh mục sang nhãn hiển thị (đồng bộ với trang Sổ sức khỏe). */
function skinTypeLabel(value: string | null | undefined, options: SkinTypeOption[]): string | undefined {
  if (!value) return undefined
  const normalizedValue = value.trim().toLocaleLowerCase('vi')
  const option = options.find((item) =>
    item.code.trim().toLocaleLowerCase('vi') === normalizedValue
    || item.label.trim().toLocaleLowerCase('vi') === normalizedValue,
  )
  return option?.label ?? value
}

function recordDate(value?: string | null): string {
  return value && dayjs(value).isValid() ? dayjs(value).format('DD/MM/YYYY') : '—'
}

/** Khối phiếu khám sức khỏe (health_records — nguồn của menu "Sổ sức khỏe") hiển thị trong hồ sơ khách. */
function HealthRecordBlock({ records, skinTypes }: { records: CustomerHealthRecord[]; skinTypes: SkinTypeOption[] }) {
  const [showHistory, setShowHistory] = useState(false)
  if (!records.length) {
    return (
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Chưa có phiếu khám sức khỏe — ghi nhận tại menu "Sổ sức khỏe".
      </Typography.Text>
    )
  }
  const sorted = records.slice().sort((a, b) => new Date(b.checked_date || b.created_at || 0).getTime() - new Date(a.checked_date || a.created_at || 0).getTime())
  const latest = sorted[0]
  const older = sorted.slice(1)
  const renderFields = (record: CustomerHealthRecord) => [
    { label: 'Tiền sử bệnh lý', value: record.medical_history },
    { label: 'Loại da', value: skinTypeLabel(record.skin_type, skinTypes) },
    { label: 'Tình trạng da', value: record.condition },
    { label: 'Dị ứng', value: record.allergies },
    { label: 'Phác đồ điều trị', value: record.protocol },
    { label: 'Sản phẩm đã dùng', value: record.products_used },
    { label: 'Lời dặn KTV', value: record.advice },
    { label: 'Ghi chú', value: record.note },
  ]
  return (
    <div className="grid gap-3" style={{ marginBottom: 8 }}>
      <Card
        size="small"
        title={(
          <Space size={8} wrap>
            <span>Phiếu khám gần nhất — {recordDate(latest.checked_date || latest.created_at)}</span>
            {latest.checked_by && <Tag>{latest.checked_by}</Tag>}
          </Space>
        )}
      >
        <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
          {renderFields(latest).map((field) => (
            <Descriptions.Item key={field.label} label={field.label}>{field.value || '—'}</Descriptions.Item>
          ))}
        </Descriptions>
      </Card>
      {older.length > 0 && (
        <>
          <Button type="link" size="small" icon={<HistoryOutlined />} style={{ alignSelf: 'flex-start', padding: 0 }}
            onClick={() => setShowHistory((value) => !value)}>
            {showHistory ? 'Ẩn các phiếu cũ' : `Xem ${older.length} phiếu cũ hơn`}
          </Button>
          {showHistory && older.map((record, index) => (
            <Card key={record.id} size="small" type="inner" title={`Phiếu khám — ${recordDate(record.checked_date || record.created_at)}`}
              extra={record.checked_by ? <Tag>{record.checked_by}</Tag> : undefined}
              style={index === older.length - 1 ? { marginBottom: 4 } : undefined}>
              <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
                {renderFields(record).map((field) => (
                  <Descriptions.Item key={field.label} label={field.label}>{field.value || '—'}</Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}

export default function CustomerProfileHealthMetricsTab({ profileId }: { profileId: string }) {
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

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    // API trả toàn bộ dữ liệu của hồ sơ; lọc theo chỉ số/khoảng ngày tại client (endpoint không nhận query params trong spec).
    Promise.all([
      getCustomerProfilesIdHealthMetrics(profileId),
      getLookupLists({ key: 'health.metrics' }),
      getCustomerProfilesIdHealthRecords(profileId),
      getSkinTypes(),
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

  if (loading) return <div className="py-9 text-center"><Spin tip="Đang tải dữ liệu sức khỏe…" /></div>
  if (error) return <Alert type="error" showIcon message="Không tải được dữ liệu sức khỏe" description={error} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => setRefresh((value) => value + 1)}>Thử lại</Button>} />

  return (
    <div className="grid gap-4">
      <Typography.Title level={5} style={{ marginBottom: 0 }}>Sổ sức khỏe</Typography.Title>
      <HealthRecordBlock records={records} skinTypes={skinTypes} />
      <Typography.Title level={5} style={{ marginBottom: 0 }}>Chỉ số theo dõi</Typography.Title>
      <Space wrap>
        <Select
          value={metricCode || undefined}
          allowClear
          placeholder="Tất cả chỉ số"
          style={{ minWidth: 220 }}
          options={activeItems.map((item) => ({ value: item.code, label: <Space size={6}>{item.color && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: item.color, display: 'inline-block' }} />}{item.label}</Space> }))}
          onChange={(value) => { setMetricCode(value || ''); setPage(1) }}
        />
        <DatePicker.RangePicker value={dateRange} onChange={(value) => { setDateRange(value as [dayjs.Dayjs, dayjs.Dayjs] | null); setPage(1) }} />
      </Space>
      {activeItems.length === 0 && <Alert type="info" showIcon message="Chưa có danh mục chỉ số đang hoạt động" description="Quản trị viên có thể cấu hình mã chỉ số trong Cấu hình dữ liệu khách hàng." />}
      {!filteredRows.length ? <Empty description="Chưa có chỉ số đo trong bộ lọc này" /> : (
        <>
          {!metricCode && filteredRows.some((row) => row.value_num !== null && row.value_num !== undefined) && <Typography.Text type="secondary">Chọn một chỉ số để xem biểu đồ theo thời gian.</Typography.Text>}
          {metricCode && chartData.length > 0 && (
            <Card size="small" title={names[metricCode] || metricCode}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" minTickGap={24} />
                  <YAxis />
                  <Tooltip formatter={(value, _name, item) => [String(value) + ((item?.payload as { unit?: string })?.unit ? ' ' + (item?.payload as { unit?: string }).unit : ''), 'Giá trị']} />
                  <Line type="monotone" dataKey="value" stroke="#6B3FA0" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
          <Table<MetricRow>
            className="desktop-only"
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={paginateRows(filteredRows, page, 8)}
            columns={[
              { title: 'Thời điểm đo', dataIndex: 'measured_at', render: (value: string) => formatDateTime(value) },
              { title: 'Chỉ số', dataIndex: 'metric_code', render: (value: string) => names[value] || value },
              { title: 'Giá trị', render: (_: unknown, row: MetricRow) => row.value_num ?? row.value_text ?? '—' },
              { title: 'Đơn vị', dataIndex: 'unit', render: (value?: string | null) => value || '—' },
              { title: 'Buổi', dataIndex: ['session', 'session_no'], render: (value?: number) => value ? 'Buổi ' + value : '—' },
              { title: 'Người ghi', dataIndex: ['created_by_user', 'zalo_name'], render: (value: string, row: MetricRow) => value || row.created_by || '—' },
              { title: 'Ghi chú', dataIndex: 'note', render: (value?: string | null) => value || '—' },
            ]}
          />
          <MobileCards
            rows={paginateRows(filteredRows, page, 8)}
            rowKey={(row) => row.id}
            emptyText="Chưa có chỉ số đo trong bộ lọc này"
            renderCard={(row) => (
              <>
                <div className="mobile-card-head">
                  <div className="mobile-card-title">{names[row.metric_code] || row.metric_code}</div>
                </div>
                <div className="mobile-card-rows">
                  <MobileCardRow label="Giá trị" value={`${row.value_num ?? row.value_text ?? '—'}${row.unit ? ` ${row.unit}` : ''}`} />
                  <MobileCardRow label="Thời điểm đo" value={formatDateTime(row.measured_at)} />
                  {row.session?.session_no && <MobileCardRow label="Buổi" value={`Buổi ${row.session.session_no}`} />}
                  <MobileCardRow label="Người ghi" value={row.created_by_user?.zalo_name || row.created_by || '—'} />
                  {row.note && <MobileCardRow label="Ghi chú" value={row.note} />}
                </div>
              </>
            )}
          />
          <ListPagination page={page} limit={8} total={filteredRows.length} onChange={setPage} noun="chỉ số sức khỏe" />
        </>
      )}
    </div>
  )
}
