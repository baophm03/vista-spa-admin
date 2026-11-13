import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Modal, Select, Space, Steps, Table, Tag, Typography, Upload, message } from 'antd'
import { InboxOutlined, PlayCircleOutlined, SafetyOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import { usePostImportsKind } from '@/api/endpoints/imports'
import { useGetBranches } from '@/api/endpoints/branches'
import { getCustomFieldDefs } from '@/api/endpoints/settings'
import { apiClient } from '@/api/mutator/custom-instance'
import type { CustomFieldDef } from '@/api/models/customFieldDef'
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
  branch_id: 'Cơ sở áp dụng',
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

interface ImportField {
  key: string
  label: string
  required: boolean
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
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([])
  const [customFieldsLoading, setCustomFieldsLoading] = useState(true)
  const [customFieldsError, setCustomFieldsError] = useState('')
  const [sourceColumns, setSourceColumns] = useState<Array<{ label: string; value: number }>>([])
  const [headersLoading, setHeadersLoading] = useState(false)
  const headerRequestId = useRef(0)
  const [form] = Form.useForm()

  const branchesQuery = useGetBranches()
  const branches = (pickData<Array<{ id: string; name: string }>>(branchesQuery.data) ?? []) as Array<{ id: string; name: string }>
  const customFieldEntity = kind === 'customer-profiles' ? 'CUSTOMER_PROFILE' : 'CUSTOMER_TREATMENT'
  const baseFields = kind === 'customer-profiles' ? PROFILE_FIELDS : TREATMENT_FIELDS
  const requiredBaseFields: readonly string[] = kind === 'customer-profiles' ? ['full_name', 'phone'] : TREATMENT_FIELDS
  const fields: ImportField[] = [
    ...baseFields.map((key) => ({ key, label: FIELD_LABELS[key], required: requiredBaseFields.includes(key) })),
    ...customFieldDefs.map((definition) => ({
      key: `custom_fields.${definition.key}`,
      label: definition.label,
      required: Boolean(definition.required),
    })),
  ]
  const branchField: ImportField = { key: 'branch_id', label: 'Cơ sở trong file (tùy chọn)', required: false }
  const requiredFields = fields.filter((field) => field.required)
  const requiredBaseImportFields = requiredFields.filter((field) => requiredBaseFields.includes(field.key))
  const requiredCustomFields = requiredFields.filter((field) => !requiredBaseFields.includes(field.key))
  const mainOptionalBaseKeys = kind === 'customer-profiles' ? ['customer_code', 'email'] : []
  const mainOptionalBaseFields = fields.filter((field) => mainOptionalBaseKeys.includes(field.key))
  const optionalFields = fields.filter((field) => !field.required && !mainOptionalBaseKeys.includes(field.key))
  const mappingFields = [
    ...requiredBaseImportFields,
    ...mainOptionalBaseFields,
    branchField,
    ...requiredCustomFields,
    ...optionalFields,
  ]
  const fieldLabels = {
    ...FIELD_LABELS,
    ...Object.fromEntries(customFieldDefs.map((definition) => [`custom_fields.${definition.key}`, definition.label])),
  }
  const importMutation = usePostImportsKind()

  const renderFieldMappings = (fieldList: ImportField[]) => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', alignItems: 'start', gap: '8px 12px', width: '100%' }}>
        {fieldList.map((field) => {
          return (
            <Form.Item
              key={field.key}
              label={field.label}
              required={field.required}
              style={{ width: '100%', minWidth: 0, marginBottom: 0 }}
            >
              <Select
                allowClear
                placeholder="Bỏ qua"
                loading={headersLoading}
                disabled={headersLoading || sourceColumns.length === 0}
                options={sourceColumns}
                value={mapping[field.key] ?? undefined}
                onChange={(value) => {
                  setMapping((current) => ({ ...current, [field.key]: value ?? -1 }))
                  setReport(null)
                }}
              />
            </Form.Item>
          )
        })}
      </div>
    )
  }

  const parsedFileName = fileList[0]?.name ?? ''

  useEffect(() => {
    let active = true
    setCustomFieldDefs([])
    setCustomFieldsError('')
    setCustomFieldsLoading(true)
    getCustomFieldDefs({ entity: customFieldEntity, is_active: true })
      .then((body) => {
        if (!active) return
        setCustomFieldDefs((pickData<CustomFieldDef[]>(body) ?? [])
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
      })
      .catch((error) => {
        if (active) setCustomFieldsError(errorMessage(error))
      })
      .finally(() => {
        if (active) setCustomFieldsLoading(false)
      })
    return () => { active = false }
  }, [customFieldEntity])

  const handleFileChange = async (nextFileList: UploadFile[]) => {
    setFileList(nextFileList)
    setMapping({})
    setReport(null)
    setSourceColumns([])
    const requestId = ++headerRequestId.current
    const file = nextFileList[0]?.originFileObj
    if (!file) {
      setHeadersLoading(false)
      return
    }

    setHeadersLoading(true)
    const body = new FormData()
    body.append('file', file as File)
    body.append('preview_headers', 'true')
    try {
      const response = await apiClient.post(`/imports/${kind}`, body)
      if (headerRequestId.current !== requestId) return
      const headers = pickData<string[]>(response.data) ?? []
      setSourceColumns(headers.map((header, index) => ({
        label: `${header || 'Không có tiêu đề'} (cột ${index + 1})`,
        value: index,
      })))
    } catch (error) {
      if (headerRequestId.current === requestId) message.error(`Không đọc được tiêu đề file: ${errorMessage(error)}`)
    } finally {
      if (headerRequestId.current === requestId) setHeadersLoading(false)
    }
  }

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
    if (!fileList.length) {
      message.warning('Chọn file CSV/Excel để nhập')
      return
    }
    if (customFieldsLoading || customFieldsError) {
      message.warning('Chưa tải được cấu hình trường nhập của loại dữ liệu này')
      return
    }
    if (headersLoading || sourceColumns.length === 0) {
      message.warning('Chưa đọc được tiêu đề cột trong file')
      return
    }
    if (!dryRun && !branchId && (mapping.branch_id == null || mapping.branch_id < 0)) {
      message.warning('Chọn cơ sở mặc định hoặc ghép cột Cơ sở trong file')
      return
    }
    const missingRequired = requiredFields.filter((field) => mapping[field.key] == null || mapping[field.key] < 0)
    if (missingRequired.length > 0) {
      message.warning(`Ghép cột bắt buộc: ${missingRequired.map((field) => field.label).join(', ')}`)
      return
    }
    if (!Object.values(mapping).some((value) => value >= 0)) {
      message.warning('Chọn ít nhất một cột dữ liệu trước khi kiểm tra')
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
        await queryClient.invalidateQueries({ queryKey: ['getTreatmentCustomers'] })
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
    { title: 'Loại', key: 'dry_run', width: 130, render: (_: unknown, row: HistoryRow) => (row.dry_run ? <Tag>Kiểm tra dữ liệu</Tag> : <Tag color="green">Đã nhập</Tag>) },
    { title: 'Dòng', key: 'rows', width: 150, render: (_: unknown, row: HistoryRow) => `${row.valid_rows ?? 0}/${row.total_rows ?? 0} hợp lệ` },
    { title: 'Tạo / Cập nhật', key: 'counts', width: 120, render: (_: unknown, row: HistoryRow) => `${row.created_count ?? 0} / ${row.updated_count ?? 0}` },
  ]

  return (
    <div>
      <PageTitle>Nhập dữ liệu khách cũ</PageTitle>
      <Steps
        size="small"
        current={report && !report.dry_run ? 2 : report ? 1 : 0}
        items={[{ title: 'Tải file' }, { title: 'Kiểm tra dữ liệu' }, { title: 'Nhập vào hệ thống' }]}
        style={{ marginBottom: 16 }}
      />

      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12, maxWidth: 760 }}>
            <Form.Item label="Đối tượng nhập" style={{ width: '100%', minWidth: 0, marginBottom: 8 }}>
              <Select
                value={kind}
                onChange={(v) => { setKind(v); setMapping({}); setReport(null) }}
                options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
            <Form.Item label="Cơ sở mặc định" style={{ width: '100%', minWidth: 0, marginBottom: 8 }} required={mapping.branch_id == null || mapping.branch_id < 0}>
              <Select
                placeholder="Dùng khi file không có cơ sở"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                value={branchId}
                onChange={(value) => { setBranchId(value); setReport(null) }}
              />
              <Typography.Text type="secondary" style={{ display: 'block', whiteSpace: 'normal', lineHeight: 1.4 }}>
                Có thể ghép cột Cơ sở bên dưới để lấy cơ sở riêng từng dòng.
              </Typography.Text>
            </Form.Item>
          </div>

          <Form.Item label="File dữ liệu (.csv / .xlsx)">
            <Upload.Dragger
              maxCount={1}
              accept=".csv,.xlsx"
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => { void handleFileChange(fl) }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Kéo thả file hoặc bấm để chọn</p>
              <p className="ant-upload-hint">Dòng đầu là tiêu đề cột sẽ được tự động bỏ qua</p>
            </Upload.Dragger>
          </Form.Item>

          <Typography.Title level={5}>Ghép cột dữ liệu</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            {kind === 'customer-profiles'
              ? 'Hồ sơ khách cần có họ tên và số điện thoại. Mã khách cũ, Email và các thông tin khác có thể ghép thêm.'
              : 'Gói liệu trình cần đủ thông tin số buổi và số tiền để tính số buổi còn lại, công nợ chính xác.'}
          </Typography.Paragraph>
          {customFieldsError && <Alert type="error" showIcon message="Không tải được trường admin đã cấu hình" description={customFieldsError} style={{ marginBottom: 12 }} />}
          {customFieldsLoading && <Typography.Text type="secondary">Đang tải trường đã cấu hình…</Typography.Text>}
          {sourceColumns.length === 0 && fileList.length > 0 && !headersLoading && <Alert type="warning" showIcon message="Chưa đọc được tiêu đề cột trong file" style={{ marginBottom: 12 }} />}
          {customFieldDefs.some((definition) => definition.data_type === 'multiselect') && <Typography.Text type="secondary">Với trường chọn nhiều, ngăn cách các lựa chọn trong file bằng dấu chấm phẩy (;).</Typography.Text>}
          <div style={{ marginTop: 12 }}>{renderFieldMappings(mappingFields)}</div>
          <Space style={{ marginTop: 16 }}>
            <Button icon={<SafetyOutlined />} loading={running} onClick={() => void runImport(true)}>
              1. Kiểm tra dữ liệu
            </Button>
            <Button type="primary" danger icon={<PlayCircleOutlined />} disabled={!report || (report?.error_rows ?? 0) > (report?.total_rows ?? 1)} loading={running} onClick={() => {
              Modal.confirm({
                title: 'Xác nhận nhập dữ liệu?',
                content: `Sẽ nhập ${report?.valid_rows ?? 0} dòng hợp lệ. Khách được thêm mới hoặc cập nhật theo số điện thoại để tránh trùng.`,
                okText: 'Xác nhận nhập',
                onOk: () => void runImport(false),
              })
            }}>
              2. Nhập vào hệ thống
            </Button>
          </Space>
        </Form>
      </Card>

      {report && (
        <Card title={`Báo cáo — ${report.dry_run ? 'Kiểm tra dữ liệu' : 'Đã nhập vào hệ thống'}: ${report.filename ?? parsedFileName}`} style={{ marginBottom: 16 }}>
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
                columns={Object.keys(report.preview![0]).map((key) => ({ title: fieldLabels[key] ?? key, dataIndex: key, key, ellipsis: true }))}
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
