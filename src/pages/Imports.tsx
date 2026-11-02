import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Steps, Table, Tag, Typography, Upload, message } from 'antd'
import { InboxOutlined, PlayCircleOutlined, SafetyOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import { usePostImportsKind } from '@/api/endpoints/imports'
import { useGetBranches } from '@/api/endpoints/branches'
import { apiClient } from '@/api/mutator/custom-instance'
import type { UploadFile } from 'antd'

/** Báo cáo trả về từ BE (đặc tả 5.38 — client sinh tự động chưa có model đầy đủ). */
interface ImportReport {
  id?: string
  kind?: string
  dry_run?: boolean
  filename?: string | null
  total_rows?: number
  valid_rows?: number
  error_rows?: number
  created_count?: number
  updated_count?: number
  errors?: Array<{ row: number; message: string }>
  preview?: Record<string, unknown>[]
}

interface HistoryRow {
  id: string
  kind: string
  filename?: string | null
  dry_run?: boolean
  status?: string
  total_rows?: number
  valid_rows?: number
  error_rows?: number
  created_count?: number
  updated_count?: number
  created_at?: string
  creator?: { id: string; zalo_name?: string } | null
}

const PROFILE_FIELDS = ['customer_code', 'full_name', 'phone', 'birthday', 'address', 'email']
const TREATMENT_FIELDS = ['phone', 'package_name', 'sessions_total', 'sessions_used', 'total_amount', 'paid_amount']

const FIELD_LABELS: Record<string, string> = {
  customer_code: 'Mã khách cũ',
  full_name: 'Họ tên',
  phone: 'Số điện thoại',
  birthday: 'Ngày sinh',
  address: 'Địa chỉ',
  email: 'Email',
  package_name: 'Tên gói liệu trình',
  sessions_total: 'Tổng số buổi',
  sessions_used: 'Số buổi đã thực hiện',
  total_amount: 'Tổng giá trị hợp đồng',
  paid_amount: 'Đã thanh toán',
}

const KIND_LABELS: Record<string, string> = {
  'customer-profiles': 'Hồ sơ khách hàng',
  'customer-treatments': 'Gói liệu trình dở dang',
}

export default function Imports() {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<'customer-profiles' | 'customer-treatments'>('customer-profiles')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [branchId, setBranchId] = useState<string | undefined>()
  const [report, setReport] = useState<ImportReport | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [running, setRunning] = useState(false)
  const [jsonRows, setJsonRows] = useState('')
  const [form] = Form.useForm()

  const branchesQuery = useGetBranches()
  const branches = (pickData<Array<{ id: string; name: string }>>(branchesQuery.data) ?? []) as Array<{ id: string; name: string }>
  const fields = kind === 'customer-profiles' ? PROFILE_FIELDS : TREATMENT_FIELDS
  const importMutation = usePostImportsKind()

  const parsedFileName = fileList[0]?.name ?? ''
  const excelColumns = useMemo(() => {
    // Cột hiển thị theo tên file — mapping thực tế do người dùng chọn theo file của Vista.
    return fields.map((_field, index) => ({ label: `Cột ${index + 1}`, value: index }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const reloadHistory = async () => {
    try {
      const res = await apiClient.get('/imports/all')
      setHistory((pickData<HistoryRow[]>(res.data) ?? []) as HistoryRow[])
    } catch {
      /* lịch sử chỉ mang tham khảo */
    }
  }

  const buildFormData = (dryRun: boolean): FormData => {
    const data = new FormData()
    if (fileList[0]?.originFileObj) data.append('file', fileList[0].originFileObj as File)
    data.append('dry_run', String(dryRun))
    data.append('column_mapping', JSON.stringify(mapping))
    if (branchId) data.append('branch_id', branchId)
    return data
  }

  const runImport = async (dryRun: boolean) => {
    if (!fileList.length && !jsonRows.trim()) {
      message.warning('Chọn file CSV/Excel hoặc dán dữ liệu JSON để nhập')
      return
    }
    if (dryRun && !fileList.length) {
      // Chế độ dán JSON: rows đã là object đúng trường — không cần ánh xạ cột
      let parsed: unknown
      try {
        parsed = JSON.parse(jsonRows)
      } catch {
        message.error('JSON không hợp lệ')
        return
      }
      if (!Array.isArray(parsed) || !parsed.length) {
        message.error('Dữ liệu phải là mảng các dòng')
        return
      }
      setRunning(true)
      try {
        const res = await apiClient.post(`/imports/${kind}`, { dry_run: dryRun, rows: parsed, branch_id: branchId })
        const data = pickData<ImportReport>(res.data)
        setReport(data)
        await reloadHistory()
        if (!dryRun) message.success(`Đã nhập: tạo ${data?.created_count ?? 0}, cập nhật ${data?.updated_count ?? 0}`)
      } catch (err) {
        message.error(errorMessage(err))
      } finally {
        setRunning(false)
      }
      return
    }
    if (dryRun && !Object.values(mapping).some((v) => v >= 0)) {
      message.warning('Ánh xạ tối thiểu một cột dữ liệu trước khi chạy')
      return
    }
    setRunning(true)
    try {
      const res = await importMutation.mutateAsync({ kind, data: buildFormData(dryRun) as never })
      const data = pickData<ImportReport>(res)
      setReport(data)
      await reloadHistory()
      if (!dryRun) {
        message.success(`Đã nhập: tạo ${data?.created_count ?? 0}, cập nhật ${data?.updated_count ?? 0}`)
        await queryClient.invalidateQueries({ queryKey: ['getCustomerProfiles'] })
        await queryClient.invalidateQueries({ queryKey: ['getCustomerTreatments'] })
      }
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  const errorColumns = [
    { title: 'Dòng', dataIndex: 'row', key: 'row', width: 80, render: (v: number) => <Tag color="red">#{v}</Tag> },
    { title: 'Lý do lỗi', dataIndex: 'message', key: 'message' },
  ]

  const historyColumns = [
    { title: 'Thời điểm', dataIndex: 'created_at', key: 'created_at', width: 150, render: (v?: string) => (v ? dayjs(v).format('DD/MM HH:mm') : '—') },
    { title: 'Đối tượng', dataIndex: 'kind', key: 'kind', width: 170, render: (v: string) => KIND_LABELS[v] ?? v },
    { title: 'File', dataIndex: 'filename', key: 'filename', ellipsis: true },
    { title: 'Loại', key: 'dry_run', width: 100, render: (_: unknown, row: HistoryRow) => (row.dry_run ? <Tag>Chạy thử</Tag> : <Tag color="green">Chạy thật</Tag>) },
    { title: 'Dòng', key: 'rows', width: 150, render: (_: unknown, row: HistoryRow) => `${row.valid_rows ?? 0}/${row.total_rows ?? 0} hợp lệ` },
    { title: 'Tạo / Cập nhật', key: 'counts', width: 120, render: (_: unknown, row: HistoryRow) => `${row.created_count ?? 0} / ${row.updated_count ?? 0}` },
  ]

  return (
    <div>
      <PageTitle>Nhập dữ liệu khách cũ</PageTitle>
      <Steps
        size="small"
        current={report && !report.dry_run ? 2 : report ? 1 : 0}
        items={[{ title: 'Tải file & ánh xạ cột' }, { title: 'Kiểm tra thử (không ghi DB)' }, { title: 'Nhập vào hệ thống' }]}
        style={{ marginBottom: 16 }}
      />

      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <Space wrap align="start">
            <Form.Item label="Đối tượng nhập" style={{ minWidth: 220 }}>
              <Select
                value={kind}
                onChange={(v) => { setKind(v); setMapping({}); setReport(null) }}
                options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
            <Form.Item label="Cơ sở" style={{ minWidth: 220 }} required>
              <Select
                placeholder="Chọn cơ sở nhập vào"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                value={branchId}
                onChange={setBranchId}
              />
            </Form.Item>
          </Space>

          <Form.Item label="File dữ liệu (.csv / .xlsx)">
            <Upload.Dragger
              maxCount={1}
              accept=".csv,.xlsx,.xls"
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => { setFileList(fl); setReport(null) }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Kéo thả file hoặc bấm để chọn</p>
              <p className="ant-upload-hint">Dòng đầu là tiêu đề cột sẽ được tự động bỏ qua</p>
            </Upload.Dragger>
          </Form.Item>

          <Typography.Title level={5}>Ánh xạ cột</Typography.Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {fields.map((field) => (
              <Form.Item key={field} label={FIELD_LABELS[field]} style={{ marginBottom: 8 }}>
                <Select
                  allowClear
                  placeholder="Bỏ qua"
                  options={excelColumns}
                  value={mapping[field] ?? undefined}
                  onChange={(v) => setMapping((m) => ({ ...m, [field]: v ?? -1 }))}
                />
              </Form.Item>
            ))}
          </div>

          <Typography.Title level={5} style={{ marginTop: 8 }}>Hoặc dán dữ liệu JSON (chạy nhanh không cần file)</Typography.Title>
          <Input.TextArea
            rows={4}
            placeholder={'[\n  {"full_name": "Nguyễn Văn A", "phone": "0912345678", "birthday": "01/02/1990"},\n  {"full_name": "Trần Thị B", "phone": "0987654321"}\n]'}
            value={jsonRows}
            onChange={(e) => { setJsonRows(e.target.value); setReport(null) }}
          />

          <Space style={{ marginTop: 16 }}>
            <Button icon={<SafetyOutlined />} loading={running} onClick={() => void runImport(true)}>
              1. Kiểm tra thử (Dry Run)
            </Button>
            <Button type="primary" danger icon={<PlayCircleOutlined />} disabled={!report || (report?.error_rows ?? 0) > (report?.total_rows ?? 1)} loading={running} onClick={() => {
              Modal.confirm({
                title: 'Chạy thật vào cơ sở dữ liệu?',
                content: `Hệ thống sẽ nhập ${report?.valid_rows ?? 0} dòng hợp lệ (tạo/cập nhật theo SĐT, không tạo trùng).`,
                okText: 'Chạy thật',
                onOk: () => void runImport(false),
              })
            }}>
              2. Bắt đầu nhập vào hệ thống
            </Button>
          </Space>
        </Form>
      </Card>

      {report && (
        <Card title={`Báo cáo — ${report.dry_run ? 'Chạy thử' : 'Chạy thật'}: ${report.filename ?? parsedFileName}`} style={{ marginBottom: 16 }}>
          <Space wrap size={24} style={{ marginBottom: 12 }}>
            <Typography.Text>Tổng dòng: <b>{report.total_rows}</b></Typography.Text>
            <Typography.Text>Hợp lệ: <b style={{ color: '#389e0d' }}>{report.valid_rows}</b></Typography.Text>
            <Typography.Text>Lỗi: <b style={{ color: '#cf1322' }}>{report.error_rows}</b></Typography.Text>
            {!report.dry_run && <Typography.Text>Tạo mới: <b>{report.created_count}</b></Typography.Text>}
            {!report.dry_run && <Typography.Text>Cập nhật: <b>{report.updated_count}</b></Typography.Text>}
          </Space>
          {(report.error_rows ?? 0) > 0 && (
            <>
              <Typography.Title level={5}>Chi tiết lỗi từng dòng</Typography.Title>
              <Table rowKey={(r) => String(r.row)} size="small" columns={errorColumns} dataSource={report.errors ?? []} pagination={{ pageSize: 5 }} />
            </>
          )}
          {(report.preview?.length ?? 0) > 0 && (
            <>
              <Typography.Title level={5}>Xem trước dữ liệu hợp lệ (10 dòng đầu)</Typography.Title>
              <Table
                rowKey={(_, i) => String(i)}
                size="small"
                columns={Object.keys(report.preview![0]).map((key) => ({ title: FIELD_LABELS[key] ?? key, dataIndex: key, key, ellipsis: true }))}
                dataSource={report.preview}
                pagination={false}
              />
            </>
          )}
        </Card>
      )}

      <Card title="Lịch sử nhập gần đây">
        <Button size="small" style={{ marginBottom: 8 }} onClick={() => void reloadHistory()}>Làm mới</Button>
        <Table rowKey="id" size="small" columns={historyColumns} dataSource={history} pagination={{ pageSize: 5 }} />
      </Card>

      {report && !report.dry_run && <Alert style={{ marginTop: 12 }} type="success" showIcon message="Nhập hoàn tất" description="Chạy lại cùng file sẽ cập nhật theo SĐT thay vì tạo trùng (idempotent upsert)." />}
    </div>
  )
}
