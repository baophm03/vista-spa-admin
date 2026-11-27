import { useEffect, useMemo, useState } from 'react'
import { Form, message } from 'antd'
import { useAbility } from '@casl/react'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import type { Branch } from '@/api/models'
import { postUsersCustomersIdHealthMetricsAdmin, postUsersCustomersIdHealthRecordsAdmin, putUsersCustomersIdHealthRecordsRecordIdAdmin } from '@/api/endpoints/customers'
import { getLookupListsAdmin } from '@/api/endpoints/lookup-lists'
import type { LookupItem } from '@/api/models/lookupItem'
import { getSkinTypesAdmin } from '@/api/endpoints/skin-types'
import { getUsersAdmin } from '@/api/endpoints/users'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { errorMessage, pickData } from '@/api/helpers'
import HealthRecordModal, { type MetricOption } from './HealthRecordModal'
import { skinTypeCode, type ExaminerOption, type HealthRow, type SkinTypeOption } from './constants'

async function loadExaminerOptions(): Promise<ExaminerOption[]> {
  const result = await getUsersAdmin({ currentPage: 1, pageSize: 200, has_role: true }).catch(() => null)
  const userRows = (pickData<{ rows?: Array<{ id: string; zalo_name?: string; email?: string; user_roles?: Array<{ role?: { code?: string | null; role_name?: string | null } | null }> }> }>(result)?.rows ?? [])
  const ktvUsers = userRows.filter((user) =>
    (user.user_roles ?? []).some((assignment) => {
      const normalized = (value: string | null | undefined) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi')
      const roleCode = normalized(assignment.role?.code)
      const roleName = normalized(assignment.role?.role_name)
      // Code 'staff' là chuẩn hiện tại (role cũ từng là 'ktv'); role_name dự phòng ('Kỹ thuật viên / Chuyên viên')
      return roleCode === 'staff' || roleCode === 'ktv' || roleName === 'ktv' || roleName.includes('chuyen vien') || roleName.includes('ky thuat vien')
    }),
  )

  // Phiếu khám lưu tên người khám dạng văn bản, nên gộp các tài khoản KTV trùng tên.
  const uniqueNames = new Map<string, ExaminerOption>()
  for (const staff of ktvUsers) {
    const name = (staff.zalo_name || staff.email || '').trim()
    if (!name) continue
    const normalizedName = name.toLocaleLowerCase('vi')
    if (!uniqueNames.has(normalizedName)) uniqueNames.set(normalizedName, { id: staff.id, zalo_name: staff.zalo_name, email: staff.email })
  }
  return [...uniqueNames.values()].sort((a, b) =>
    (a.zalo_name || a.email || '').localeCompare(b.zalo_name || b.email || '', 'vi'),
  )
}

/** Danh mục chỉ số đang dùng (Cấu hình dữ liệu khách hàng → Chỉ số sức khỏe, lookup `health.metrics`) */
async function loadMetricOptions(): Promise<MetricOption[]> {
  const lists = pickData<Array<{ key: string; lookup_items?: LookupItem[] | null }>>(await getLookupListsAdmin({ key: 'health.metrics' })) ?? []
  return (lists.find((row) => row.key === 'health.metrics')?.lookup_items ?? [])
    .filter((item) => item.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label, 'vi'))
    .map((item) => ({ code: item.code, label: item.label, color: item.color ?? undefined }))
}

/** "42" / "42,5" → số; còn lại giữ dạng chữ (BE nhận đúng 1 trong value_num / value_text) */
function metricValue(raw: string) {
  const text = raw.trim()
  const normalized = text.replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(normalized) ? { value_num: Number(normalized) } : { value_text: text }
}

interface UseHealthRecordFormOptions {
  /** Gọi sau khi lưu thành công — `customerId` là khách vừa được ghi phiếu */
  onSaved?: (customerId: string) => void | Promise<void>
  /** Trang đã tải danh mục loại da thì truyền vào để khỏi tải lại */
  skinTypes?: SkinTypeOption[]
  skinTypesLoading?: boolean
}

/** Form tạo / sửa phiếu khám dùng chung (Sổ sức khỏe, tab Sức khỏe trong chi tiết khách hàng).
 *  `openForm(null)` → form có ô chọn khách hàng để tạo phiếu đầu tiên cho khách chưa có sổ. */
export default function useHealthRecordForm({ onSaved, skinTypes: providedSkinTypes, skinTypesLoading: providedSkinTypesLoading }: UseHealthRecordFormOptions = {}) {
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [customer, setCustomer] = useState<HealthRow | null>(null)
  const [editingRecord, setEditingRecord] = useState<CustomerHealthRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [staffs, setStaffs] = useState<ExaminerOption[] | null>(null)
  const [ownSkinTypes, setOwnSkinTypes] = useState<SkinTypeOption[] | null>(null)
  const [metricOptions, setMetricOptions] = useState<MetricOption[] | null>(null)
  const canCreateMetrics = useAbility().can('CREATE', 'HEALTH_METRIC')
  const branchesQuery = useGetBranchesAdmin(undefined, { query: { enabled: open } })
  const branches = useMemo(() => (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[], [branchesQuery.data])
  const skinTypes = providedSkinTypes ?? ownSkinTypes ?? []
  const skinTypesLoading = providedSkinTypes ? !!providedSkinTypesLoading : ownSkinTypes === null

  // Danh mục chỉ tải khi mở form lần đầu
  useEffect(() => {
    if (!open) return
    if (staffs === null) void loadExaminerOptions().then(setStaffs)
    if (canCreateMetrics && metricOptions === null) void loadMetricOptions().catch(() => []).then(setMetricOptions)
    if (!providedSkinTypes && ownSkinTypes === null) {
      getSkinTypesAdmin()
        .then((body) => setOwnSkinTypes(pickData<SkinTypeOption[]>(body) ?? []))
        .catch((err) => { setOwnSkinTypes([]); message.error(`Không tải được danh mục loại da: ${errorMessage(err)}`) })
    }
  }, [open, staffs, providedSkinTypes, ownSkinTypes, canCreateMetrics, metricOptions])

  const openForm = (row: HealthRow | null, record?: CustomerHealthRecord) => {
    setCustomer(row)
    setEditingRecord(record ?? null)
    form.resetFields()
    form.setFieldsValue({
      checked_date: record?.checked_date ? dayjs(record.checked_date) : dayjs(),
      checked_by: record?.checked_by ?? undefined,
      medical_history: record?.medical_history ?? undefined,
      skin_type: skinTypeCode(record?.skin_type, skinTypes),
      condition: record?.condition ?? undefined,
      allergies: record?.allergies ?? undefined,
      protocol: record?.protocol ?? undefined,
      products_used: record?.products_used ?? undefined,
      advice: record?.advice ?? undefined,
      note: record?.note ?? undefined,
      branch_id: (record as { branch_id?: string } | null)?.branch_id ?? undefined,
    })
    setOpen(true)
  }

  const submit = async () => {
    const values = (await form.validateFields()) as Record<string, Dayjs | string | undefined>
    const customerId = customer?.id ?? (values.user_id as string | undefined)
    if (!customerId) return
    const dto = {
      checked_date: (values.checked_date as Dayjs).format('YYYY-MM-DD'),
      checked_by: (values.checked_by as string) || null,
      medical_history: (values.medical_history as string) || null,
      skin_type: (values.skin_type as string) || null,
      condition: String(values.condition ?? '').trim(),
      allergies: (values.allergies as string) || null,
      protocol: (values.protocol as string) || null,
      products_used: (values.products_used as string) || null,
      advice: (values.advice as string) || null,
      note: (values.note as string) || null,
      branch_id: (values.branch_id as string) || null,
    }
    setSaving(true)
    try {
      if (editingRecord) {
        await putUsersCustomersIdHealthRecordsRecordIdAdmin(customerId, editingRecord.id, dto as never)
        message.success('Đã cập nhật phiếu khám')
      } else {
        await postUsersCustomersIdHealthRecordsAdmin(customerId, dto as never)
        // Chỉ số đo trong lần khám → Chỉ số theo dõi của khách (thời điểm đo = ngày khám + giờ hiện tại)
        const now = dayjs()
        const measuredAt = (values.checked_date as Dayjs).hour(now.hour()).minute(now.minute()).second(0).millisecond(0).toISOString()
        const metrics = ((values.metrics as unknown as Array<{ metric_code?: string; value?: string; unit?: string }> | undefined) ?? [])
          .filter((metric) => metric?.metric_code && String(metric.value ?? '').trim())
        const results = await Promise.allSettled(metrics.map((metric) => postUsersCustomersIdHealthMetricsAdmin(customerId, {
          metric_code: metric.metric_code,
          ...metricValue(String(metric.value)),
          unit: metric.unit?.trim() || null,
          measured_at: measuredAt,
        } as never)))
        const failed = results.filter((result) => result.status === 'rejected')
        if (failed.length) {
          message.warning(`Đã tạo phiếu khám, nhưng ${failed.length}/${metrics.length} chỉ số chưa lưu được: ${errorMessage((failed[0] as PromiseRejectedResult).reason)}`)
        } else {
          message.success(metrics.length ? `Đã tạo phiếu khám và ${metrics.length} chỉ số` : 'Đã tạo phiếu khám')
        }
      }
      setOpen(false)
      await onSaved?.(customerId)
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const modal = (
    <HealthRecordModal
      open={open}
      onCancel={() => setOpen(false)}
      onSubmit={() => void submit()}
      saving={saving}
      editingRecord={editingRecord}
      recordCustomer={customer}
      form={form}
      staffs={staffs ?? []}
      skinTypes={skinTypes}
      skinTypesLoading={skinTypesLoading}
      branches={branches}
      metricOptions={!editingRecord && canCreateMetrics ? (metricOptions ?? []) : null}
      metricOptionsLoading={metricOptions === null}
    />
  )

  return { openForm, modal }
}
