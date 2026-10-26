import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, DatePicker, Empty, Select, Space, Spin, Table, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HealthMetric } from '@/api/models/healthMetric'
import type { LookupItem } from '@/api/models/lookupItem'
import type { LookupList } from '@/api/models/lookupList'
import { getCustomerProfilesIdHealthMetrics } from '@/api/endpoints/customer-profiles'
import { getLookupLists } from '@/api/endpoints/settings'
import { errorMessage, pickData } from '@/api/helpers'

type MetricRow = HealthMetric & {
  session?: { session_no?: number } | null
  created_by_user?: { zalo_name?: string } | null
  created_by?: string | null
}

type LookupListWithItems = LookupList & { lookup_items?: LookupItem[] | null }

export default function CustomerProfileHealthMetricsTab({ profileId, onLoadingChange }: { profileId: string; onLoadingChange?: (loading: boolean) => void }) {
  const [rows, setRows] = useState<MetricRow[]>([])
  const [items, setItems] = useState<LookupItem[]>([])
  const [metricCode, setMetricCode] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    onLoadingChange?.(true)
    // API trả toàn bộ chỉ số của hồ sơ; lọc theo chỉ số/khoảng ngày tại client (endpoint không nhận query params trong spec).
    Promise.all([getCustomerProfilesIdHealthMetrics(profileId), getLookupLists({ key: 'health.metrics' })])
      .then(([metricsResult, catalogsResult]) => {
        if (!active) return
        setRows(pickData<MetricRow[]>(metricsResult))
        const configuredItems = (pickData<LookupListWithItems[]>(catalogsResult) ?? [])
          .find((row) => row.key === 'health.metrics')?.lookup_items ?? []
        setItems(configuredItems.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.code.localeCompare(b.code)))
      })
      .catch((err) => { if (active) setError(errorMessage(err)) })
      .finally(() => {
        if (!active) return
        setLoading(false)
        onLoadingChange?.(false)
      })
    return () => { active = false }
  }, [onLoadingChange, profileId, refresh])

  const names = useMemo(() => Object.fromEntries(items.map((item) => [item.code, item.label])), [items])
  const activeItems = items.filter((item) => item.is_active !== false)
  const inRange = (row: MetricRow) => {
    if (!dateRange) return true
    const measured = dayjs(row.measured_at)
    return (!dateRange[0] || !measured.isBefore(dateRange[0].startOf('day')))
      && (!dateRange[1] || !measured.isAfter(dateRange[1].endOf('day')))
  }
  const filteredRows = useMemo(() => rows
    .filter((row) => (!metricCode || row.metric_code === metricCode) && inRange(row)), [rows, metricCode, dateRange])
  const chartData = metricCode
    ? filteredRows.filter((row) => row.value_num !== null && row.value_num !== undefined)
      .slice()
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
      .map((row) => ({ date: dayjs(row.measured_at).format('DD/MM/YY HH:mm'), value: Number(row.value_num), unit: row.unit || '' }))
    : []

  if (loading) return <div className="py-9 text-center"><Spin tip="Đang tải chỉ số sức khỏe…" /></div>
  if (error) return <Alert type="error" showIcon message="Không tải được dữ liệu sức khỏe" description={error} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => setRefresh((value) => value + 1)}>Thử lại</Button>} />

  return (
    <div className="grid gap-4">
      <Space wrap>
        <Select
          value={metricCode || undefined}
          allowClear
          placeholder="Tất cả chỉ số"
          style={{ minWidth: 220 }}
          options={activeItems.map((item) => ({ value: item.code, label: <Space size={6}>{item.color && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: item.color, display: 'inline-block' }} />}{item.label}</Space> }))}
          onChange={(value) => setMetricCode(value || '')}
        />
        <DatePicker.RangePicker value={dateRange} onChange={(value) => setDateRange(value as [dayjs.Dayjs, dayjs.Dayjs] | null)} />
        <Button icon={<ReloadOutlined />} onClick={() => setRefresh((value) => value + 1)}>Tải lại</Button>
      </Space>
      {activeItems.length === 0 && <Alert type="info" showIcon message="Chưa có danh mục chỉ số đang hoạt động" description="Quản trị viên có thể cấu hình mã chỉ số trong Cấu hình dữ liệu khách hàng." />}
      {!filteredRows.length ? <Empty description="Chưa có dữ liệu sức khỏe trong bộ lọc này" /> : (
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
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            dataSource={filteredRows}
            columns={[
              { title: 'Thời điểm đo', dataIndex: 'measured_at', render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm') },
              { title: 'Chỉ số', dataIndex: 'metric_code', render: (value: string) => names[value] || value },
              { title: 'Giá trị', render: (_: unknown, row: MetricRow) => row.value_num ?? row.value_text ?? '—' },
              { title: 'Đơn vị', dataIndex: 'unit', render: (value?: string | null) => value || '—' },
              { title: 'Buổi', dataIndex: ['session', 'session_no'], render: (value?: number) => value ? 'Buổi ' + value : '—' },
              { title: 'Người ghi', dataIndex: ['created_by_user', 'zalo_name'], render: (value: string, row: MetricRow) => value || row.created_by || '—' },
              { title: 'Ghi chú', dataIndex: 'note', render: (value?: string | null) => value || '—' },
            ]}
          />
        </>
      )}
    </div>
  )
}
