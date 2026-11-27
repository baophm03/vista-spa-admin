import ResponsiveTable from '@/components/base/ResponsiveTable'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Checkbox, Form, Modal, Progress, Select, Space, Steps, Tag, Typography, Upload, message } from 'antd'
import { InboxOutlined, PlayCircleOutlined, SafetyOutlined, ThunderboltOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import MobileUI from '@/components/base/MobileUI'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import { getImportJobsAdmin, getImportJobsIdAdmin, postImportsKindAdmin } from '@/api/endpoints/imports'
import { getGetUsersCustomersAdminQueryKey } from '@/api/endpoints/customers'
import { getGetTreatmentCustomersAdminQueryKey } from '@/api/endpoints/treatment-customers'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { getCustomFieldDefsAdmin } from '@/api/endpoints/custom-field-defs'
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
  warnings?: Array<{ row: number; message: string }>
  preview?: Record<string, unknown>[]
}

/** Job xử lý nền (file lớn) — poll GET /import-jobs/{id} để lấy tiến độ. */
interface ActiveBackgroundJob {
  id: string
  filename: string
}

interface JobProgress {
  status: 'QUEUED' | 'PARSING' | 'VALIDATING' | 'IMPORTING' | 'DONE' | 'FAILED'
  processed: number
  total: number
  errorMessage?: string | null
}

const JOB_STATUS_LABELS: Record<JobProgress['status'], string> = {
  QUEUED: 'Đang chờ nhận việc',
  PARSING: 'Đang đọc file',
  VALIDATING: 'Đang kiểm tra dữ liệu',
  IMPORTING: 'Đang nhập vào hệ thống',
  DONE: 'Hoàn tất',
  FAILED: 'Thất bại',
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
  'customers': 'Hồ sơ khách hàng',
  'customer-treatments': 'Gói liệu trình dở dang',
}

/** Chuẩn hoá tên cột/trường để so khớp tự động: bỏ dấu tiếng Việt, khoảng trắng, ký tự đặc biệt. */
function normalizeHeaderText(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Biệt danh thường gặp của từng trường để tự ghép cột theo tên. */
const AUTO_MAP_ALIASES: Record<string, string[]> = {
  customer_code: ['makhach', 'makh', 'customercode'],
  full_name: ['hovaten', 'tenkhach', 'tenkhachhang', 'fullname', 'name', 'hotenkhachhang'],
  phone: ['sdt', 'sodienthoai', 'phone', 'mobile', 'dienthoai'],
  birthday: ['ngaysinh', 'sinhnhat', 'birthday', 'dob'],
  address: ['diachi', 'address', 'diachikhachhang'],
  email: ['email', 'thudientu'],
  package_name: ['tengoi', 'tengoilieutrinh', 'goilieutrinh', 'packagename', 'goidieutri'],
  sessions_total: ['tongsobuoi', 'tongbuoi', 'sobuoi', 'sessionstotal'],
  sessions_used: ['sobuoidathuchien', 'dathuchien', 'sobuoidadung', 'sobuoidasudung', 'buoidadung'],
  total_amount: ['tonggiatrihopdong', 'tonggiatri', 'tongtien', 'giatrihopdong', 'totalamount'],
  paid_amount: ['dathanhtoan', 'datra', 'sotiendatra', 'tiendatra', 'paidamount', 'sotiendathanhtoan', 'thanhtoan'],
  branch_id: ['coso', 'chinhanh', 'branch', 'branchid', 'cosoapdung'],
}

interface AutoMapField {
  key: string
  aliases: string[]
}

function buildAutoMapFields(kind: 'customers' | 'customer-treatments', defs: CustomFieldDef[]): AutoMapField[] {
  const baseKeys = kind === 'customers' ? PROFILE_FIELDS : TREATMENT_FIELDS
  const fields: AutoMapField[] = baseKeys.map((key) => ({
    key,
    aliases: [key, FIELD_LABELS[key] ?? key, ...(AUTO_MAP_ALIASES[key] ?? [])].map(normalizeHeaderText),
  }))
  if (kind === 'customer-treatments') {
    fields.push({
      key: 'branch_id',
      aliases: ['branch_id', 'Cơ sở áp dụng', 'Cơ sở trong file (tùy chọn)', 'Cơ sở', ...(AUTO_MAP_ALIASES.branch_id ?? [])].map(normalizeHeaderText),
    })
  }
  for (const def of defs) {
    fields.push({ key: `custom_fields.${def.key}`, aliases: [def.key, def.label ?? ''].map(normalizeHeaderText).filter(Boolean) })
  }
  return fields
}

/** Ghép cột tự động theo tên: khớp chính xác trước, rồi mới tới khớp chứa (>=3 ký tự). Mỗi cột chỉ ghép một trường. */
function autoMapColumns(headers: string[], fields: AutoMapField[]): Record<string, number> {
  const normalizedHeaders = headers.map((header) => normalizeHeaderText(header))
  const used = new Set<number>()
  const result: Record<string, number> = {}
  const findColumn = (aliases: string[], exact: boolean): number => {
    for (let col = 0; col < normalizedHeaders.length; col++) {
      if (used.has(col) || !normalizedHeaders[col]) continue
      const header = normalizedHeaders[col]
      const matched = aliases.some((alias) => {
        if (!alias || alias.length < 2) return false
        if (exact) return alias === header
        return (header.length >= 3 && header.includes(alias)) || (alias.length >= 3 && alias.includes(header))
      })
      if (matched) return col
    }
    return -1
  }
  for (const field of fields) {
    const exact = findColumn(field.aliases, true)
    if (exact >= 0) {
      result[field.key] = exact
      used.add(exact)
    }
  }
  for (const field of fields) {
    if (result[field.key] !== undefined) continue
    const fuzzy = findColumn(field.aliases, false)
    if (fuzzy >= 0) {
      result[field.key] = fuzzy
      used.add(fuzzy)
    }
  }
  return result
}

interface ImportField {
  key: string
  label: string
  required: boolean
}

/** Bản nháp phiên nhập — giữ ở cấp module để không mất khi chuyển sang menu khác rồi quay lại (tải lại trang thì làm mới). */
interface ImportDraft {
  kind: 'customers' | 'customer-treatments'
  file: File | null
  mapping: Record<string, number>
  branchId?: string
  report: ImportReport | null
  sourceHeaders: string[]
}

let importDraft: ImportDraft | null = null

export default function Imports() {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<'customers' | 'customer-treatments'>('customers')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [branchId, setBranchId] = useState<string | undefined>()
  const [report, setReport] = useState<ImportReport | null>(null)
  const [activeJob, setActiveJob] = useState<ActiveBackgroundJob | null>(null)
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null)
  const [processInBackground, setProcessInBackground] = useState(false)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [running, setRunning] = useState(false)
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([])
  const [customFieldsLoading, setCustomFieldsLoading] = useState(true)
  const [customFieldsError, setCustomFieldsError] = useState('')
  const [sourceColumns, setSourceColumns] = useState<Array<{ label: string; value: number }>>([])
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([])
  const [headersLoading, setHeadersLoading] = useState(false)
  const headerRequestId = useRef(0)
  const [form] = Form.useForm()

  const branchesQuery = useGetBranchesAdmin()
  const branches = (pickData<Array<{ id: string; name: string }>>(branchesQuery.data) ?? []) as Array<{ id: string; name: string }>
  const customFieldEntity = kind === 'customers' ? 'CUSTOMER' : 'CUSTOMER_TREATMENT'
  const baseFields = kind === 'customers' ? PROFILE_FIELDS : TREATMENT_FIELDS
  const requiredBaseFields: readonly string[] = kind === 'customers' ? ['full_name', 'phone'] : TREATMENT_FIELDS
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
  const mainOptionalBaseKeys = kind === 'customers' ? ['customer_code', 'email'] : []
  const mainOptionalBaseFields = fields.filter((field) => mainOptionalBaseKeys.includes(field.key))
  const optionalFields = fields.filter((field) => !field.required && !mainOptionalBaseKeys.includes(field.key))
  const mappingFields = [
    ...requiredBaseImportFields,
    ...mainOptionalBaseFields,
    ...(kind === 'customer-treatments' ? [branchField] : []),
    ...requiredCustomFields,
    ...optionalFields,
  ]
  const fieldLabels = {
    ...FIELD_LABELS,
    ...Object.fromEntries(customFieldDefs.map((definition) => [`custom_fields.${definition.key}`, definition.label])),
  }

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
  const originFile = fileList[0]?.originFileObj as File | undefined
  // xlsx nén mạnh — 100KB tương đương khoảng 2-3 nghìn dòng
  const isLargeFile = Boolean(originFile && originFile.size > 100 * 1024)

  useEffect(() => {
    let active = true
    setCustomFieldDefs([])
    setCustomFieldsError('')
    setCustomFieldsLoading(true)
    getCustomFieldDefsAdmin({ entity: customFieldEntity, is_active: true })
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

  // Khôi phục bản nháp khi quay lại trang
  const draftRestoredRef = useRef(false)
  useEffect(() => {
    if (draftRestoredRef.current) return
    draftRestoredRef.current = true
    const draft = importDraft
    if (!draft) return
    setKind(draft.kind)
    setMapping(draft.mapping ?? {})
    if (draft.branchId) setBranchId(draft.branchId)
    if (draft.report) setReport(draft.report)
    if (draft.sourceHeaders.length) {
      setSourceHeaders(draft.sourceHeaders)
      setSourceColumns(draft.sourceHeaders.map((header, index) => ({
        label: `${header || 'Không có tiêu đề'} (cột ${index + 1})`,
        value: index,
      })))
    }
    if (draft.file) {
      setFileList([{ uid: '-restored', name: draft.file.name, status: 'done', originFileObj: draft.file } as unknown as UploadFile])
    }
  }, [])

  const handleFileChange = async (nextFileList: UploadFile[]) => {
    setFileList(nextFileList)
    setMapping({})
    setReport(null)
    setSourceColumns([])
    setSourceHeaders([])
    const requestId = ++headerRequestId.current
    const file = nextFileList[0]?.originFileObj
    if (!file) {
      setHeadersLoading(false)
      return
    }

    setHeadersLoading(true)
    // File lớn nên bật sẵn chế độ xử lý nền (user vẫn tắt được)
    setProcessInBackground(Boolean(file && file.size > 100 * 1024))
    try {
      const response = await postImportsKindAdmin(kind, { file: file as File, preview_headers: true })
      if (headerRequestId.current !== requestId) return
      const headers = pickData<string[]>(response) ?? []
      setSourceHeaders(headers)
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

  /** Tự ghép cột theo tên: chỉ điền các trường chưa ghép, không đè lựa chọn thủ công. */
  const applyAutoMap = () => {
    if (!sourceHeaders.length) return
    const auto = autoMapColumns(sourceHeaders, buildAutoMapFields(kind, customFieldDefs))
    setMapping((current) => {
      const used = new Set<number>()
      for (const value of Object.values(current)) if (typeof value === 'number' && value >= 0) used.add(value)
      const next = { ...current }
      for (const [key, col] of Object.entries(auto)) {
        if ((next[key] == null || next[key] < 0) && !used.has(col)) {
          next[key] = col
          used.add(col)
        }
      }
      return next
    })
  }

  useEffect(() => {
    applyAutoMap()
    // Chạy lại khi đổi file / đổi loại dữ liệu / tải xong trường tùy chỉnh
  }, [sourceHeaders, customFieldDefs, kind])

  // Lưu bản nháp liên tục để chuyển tab không mất dữ liệu
  useEffect(() => {
    const file = fileList[0]?.originFileObj as File | undefined
    importDraft = {
      kind,
      file: file ?? null,
      mapping,
      branchId,
      report,
      sourceHeaders,
    }
  }, [kind, fileList, mapping, branchId, report, sourceHeaders])

  // Poll tiến độ job xử lý nền mỗi 2 giây; xong thì hiển thị báo cáo như đồng bộ
  useEffect(() => {
    if (!activeJob) return
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const res = await getImportJobsIdAdmin(activeJob.id)
        const job = pickData<Record<string, any>>(res)
        if (cancelled || !job) return
        setJobProgress({ status: job.status, processed: job.processed_rows ?? 0, total: job.total_rows ?? 0, errorMessage: job.error_message ?? null })
        if (job.status === 'DONE') {
          setActiveJob(null)
          setReport({
            id: job.id,
            kind: job.kind,
            dry_run: job.dry_run,
            filename: job.filename,
            total_rows: job.total_rows,
            valid_rows: job.valid_rows,
            error_rows: job.error_rows,
            created_count: job.created_count,
            updated_count: job.updated_count,
            errors: job.errors?.rows ?? [],
            warnings: job.warnings?.rows ?? [],
            preview: job.preview ?? [],
          })
          await reloadHistory()
          if (!job.dry_run) {
            message.success(`Đã nhập: tạo ${job.created_count ?? 0}, cập nhật ${job.updated_count ?? 0}`)
            await queryClient.invalidateQueries({ queryKey: getGetUsersCustomersAdminQueryKey() })
            await queryClient.invalidateQueries({ queryKey: getGetTreatmentCustomersAdminQueryKey() })
          }
        } else if (job.status === 'FAILED') {
          setActiveJob(null)
          message.error(`Xử lý nền thất bại: ${job.error_message ?? 'lỗi không xác định'}`)
          await reloadHistory()
        }
      } catch {
        /* lỗi poll tạm thời — chờ nhịp sau */
      }
    }, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [activeJob])

  const reloadHistory = async () => {
    try {
      // GET /imports/all cũ không còn — dùng GET /import-jobs/admin (50 job nền gần nhất)
      const res = await getImportJobsAdmin()
      setHistory((pickData<HistoryRow[]>(res) ?? []) as HistoryRow[])
    } catch {
      /* lịch sử chỉ mang tham khảo */
    }
  }

  // orval tự dựng FormData chỉ với các field spec khai báo (bỏ qua process_mode),
  // nên chạy import thật vẫn gọi thẳng apiClient với URL /admin mới.
  const buildImportBody = (dryRun: boolean) => {
    const originFile = fileList[0]?.originFileObj as File | undefined
    const body = new FormData()
    if (originFile) body.append('file', originFile)
    body.append('dry_run', String(dryRun))
    body.append('column_mapping', JSON.stringify(mapping))
    if (kind === 'customer-treatments' && branchId) body.append('branch_id', branchId)
    // File lớn → yêu cầu BE xếp hàng xử lý nền (worker), tránh treo request
    if (processInBackground) body.append('process_mode', 'async')
    return body
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
    if (kind === 'customer-treatments' && !dryRun && !branchId && (mapping.branch_id == null || mapping.branch_id < 0)) {
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
      const response = await apiClient.post(`/imports/${kind}/admin`, buildImportBody(dryRun))
      const data = pickData<ImportReport & { job_id?: string; async?: boolean }>(response.data)
      if (data?.job_id) {
        // File lớn đã nộp việc cho worker — theo dõi tiến độ thay vì đợi
        setReport(null)
        setActiveJob({ id: data.job_id, filename: parsedFileName })
        setJobProgress({ status: 'QUEUED', processed: 0, total: 0 })
        message.info('File lớn — đã nộp việc xử lý nền, theo dõi tiến độ bên dưới')
        await reloadHistory()
        return
      }
      setReport(data)
      await reloadHistory()
      if (!dryRun) {
        message.success(`Đã nhập: tạo ${data?.created_count ?? 0}, cập nhật ${data?.updated_count ?? 0}`)
        await queryClient.invalidateQueries({ queryKey: getGetUsersCustomersAdminQueryKey() })
        await queryClient.invalidateQueries({ queryKey: getGetTreatmentCustomersAdminQueryKey() })
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
    <MobileUI>
      <PageTitle>Nhập dữ liệu khách cũ</PageTitle>
      <Steps
        size="small"
        current={report && !report.dry_run ? 2 : report ? 1 : 0}
        items={[{ title: 'Tải file' }, { title: 'Kiểm tra dữ liệu' }, { title: 'Nhập vào hệ thống' }]}
        className="mb-4 max-lg:mb-3"
      />

      <Card className="mb-4 max-lg:mb-3">
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12, maxWidth: 760 }}>
            <Form.Item label="Đối tượng nhập" style={{ width: '100%', minWidth: 0, marginBottom: 8 }}>
              <Select
                value={kind}
                onChange={(v) => { setKind(v); setMapping({}); setReport(null) }}
                options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
            {kind === 'customer-treatments' && (
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
            )}
            {kind !== 'customer-treatments' && (
              <Typography.Text type="secondary" style={{ alignSelf: 'center', maxWidth: 360, lineHeight: 1.5 }}>
                Hồ sơ khách hàng không gắn với cơ sở và được dùng chung toàn hệ thống.
              </Typography.Text>
            )}
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

          {isLargeFile && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 8 }}
              message="File lớn — nên xếp hàng xử lý nền để không làm chậm hệ thống."
              description={
                <Checkbox
                  checked={processInBackground}
                  onChange={(e) => setProcessInBackground(e.target.checked)}
                >
                  Xử lý nền (theo dõi tiến độ, không phải đợi trên trang)
                </Checkbox>
              }
            />
          )}

          <Space align="center" style={{ marginBottom: 4 }}>
            <Typography.Title level={5} style={{ marginBottom: 0 }}>Ghép cột dữ liệu</Typography.Title>
            <Button size="small" icon={<ThunderboltOutlined />} disabled={!sourceHeaders.length || headersLoading} onClick={applyAutoMap}>
              Tự động ghép cột
            </Button>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            {kind === 'customers'
              ? 'Hồ sơ khách cần có họ tên và số điện thoại. Mã khách cũ, Email và các thông tin khác có thể ghép thêm.'
              : 'Gói liệu trình cần đủ thông tin số buổi và số tiền để tính số buổi còn lại, công nợ chính xác.'}
          </Typography.Paragraph>
          {customFieldsError && <Alert type="error" showIcon message="Không tải được trường admin đã cấu hình" description={customFieldsError} style={{ marginBottom: 12 }} />}
          {customFieldsLoading && <Typography.Text type="secondary">Đang tải trường đã cấu hình…</Typography.Text>}
          {sourceColumns.length === 0 && fileList.length > 0 && !headersLoading && <Alert type="warning" showIcon message="Chưa đọc được tiêu đề cột trong file" style={{ marginBottom: 12 }} />}
          {customFieldDefs.some((definition) => definition.data_type === 'multiselect') && <Typography.Text type="secondary">Với trường chọn nhiều, ngăn cách các lựa chọn trong file bằng dấu chấm phẩy (;).</Typography.Text>}
          <div style={{ marginTop: 12 }}>{renderFieldMappings(mappingFields)}</div>
          <div className="mt-4 flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2">
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
          </div>
        </Form>
      </Card>

      {activeJob && (
        <Card title={`Đang xử lý nền — ${activeJob.filename}`} className="mb-4 max-lg:mb-3">
          <Progress
            percent={jobProgress?.total ? Math.round((jobProgress.processed / jobProgress.total) * 100) : 0}
            status={jobProgress?.status === 'FAILED' ? 'exception' : 'active'}
          />
          <Typography.Text type="secondary">
            {JOB_STATUS_LABELS[jobProgress?.status ?? 'QUEUED']}
            {jobProgress?.total ? ` — ${jobProgress.processed}/${jobProgress.total} dòng` : ''}
          </Typography.Text>
        </Card>
      )}

      {report && (
        <Card title={`Báo cáo — ${report.dry_run ? 'Kiểm tra dữ liệu' : 'Đã nhập vào hệ thống'}: ${report.filename ?? parsedFileName}`} className="mb-4 max-lg:mb-3">
          <Space wrap size={24} style={{ marginBottom: 12 }}>
            <Typography.Text>Tổng dòng: <b>{report.total_rows}</b></Typography.Text>
            <Typography.Text>Hợp lệ: <b style={{ color: '#389e0d' }}>{report.valid_rows}</b></Typography.Text>
            <Typography.Text>Lỗi: <b style={{ color: '#cf1322' }}>{report.error_rows}</b></Typography.Text>
            {(report.warnings?.length ?? 0) > 0 && <Typography.Text>Cảnh báo trùng: <b style={{ color: '#d46b08' }}>{report.warnings?.length}</b></Typography.Text>}
            {!report.dry_run && <Typography.Text>Tạo mới: <b>{report.created_count}</b></Typography.Text>}
            {!report.dry_run && <Typography.Text>Cập nhật: <b>{report.updated_count}</b></Typography.Text>}
          </Space>
          {(report.error_rows ?? 0) > 0 && (
            <>
              <Typography.Title level={5}>Chi tiết lỗi từng dòng</Typography.Title>
              <ResponsiveTable rowKey={(r) => String(r.row)} size="small" columns={errorColumns} dataSource={report.errors ?? []} pagination={{ pageSize: 5 }} />
            </>
          )}
          {(report.warnings?.length ?? 0) > 0 && (
            <>
              <Typography.Title level={5}>Chi tiết cảnh báo trùng lặp</Typography.Title>
              <Alert
                type="warning"
                showIcon
                message="Dòng trùng trong file bị chặn (chỉ dòng đầu tiên được nhập). Khách/gói đã có sẵn trong hệ thống không bị tạo trùng — được cập nhật theo SĐT."
                style={{ marginBottom: 8 }}
              />
              <ResponsiveTable rowKey={(r) => `w-${r.row}-${r.message}`} size="small" columns={errorColumns} dataSource={report.warnings ?? []} pagination={{ pageSize: 5 }} />
            </>
          )}
          {(report.preview?.length ?? 0) > 0 && (
            <>
              <Typography.Title level={5}>Xem trước dữ liệu hợp lệ (10 dòng đầu)</Typography.Title>
              <ResponsiveTable
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
        <ResponsiveTable rowKey="id" size="small" columns={historyColumns} dataSource={history} pagination={{ pageSize: 5 }} />
      </Card>

      {report && !report.dry_run && <Alert style={{ marginTop: 12 }} type="success" showIcon message="Nhập hoàn tất" description="Chạy lại cùng file sẽ cập nhật theo SĐT thay vì tạo trùng (idempotent upsert)." />}
    </MobileUI>
  )
}
