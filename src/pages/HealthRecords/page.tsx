import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  FileAddOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import { getCustomerProfilesIdHealthRecordsAdmin, getHealthRecordsAdmin, postCustomerProfilesIdHealthRecordsAdmin, putCustomerProfilesIdHealthRecordsRecordIdAdmin } from '@/api/endpoints/customer-profiles'
import { getTreatmentCustomersAdmin } from '@/api/endpoints/treatment-customers'
import { getAppointmentsAdmin } from '@/api/endpoints/appointments'
import { getSkinTypesAdmin } from '@/api/endpoints/skin-types'
import { getTreatmentPackagesAdmin } from '@/api/endpoints/treatment-packages'
import { getUsersAdmin } from '@/api/endpoints/users'
import { errorMessage, pickData } from '@/api/helpers'
import HealthRecordDrawer from './components/HealthRecordDrawer'
import HealthRecordModal from './components/HealthRecordModal'
import {
  currentHealth,
  displayDate,
  skinTypeCode,
  type ExaminerOption,
  type HealthRow,
  type ServiceHistoryAppointment,
  type SkinTypeOption,
} from './components/constants'
import type { Branch } from '@/api/models'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'

 export default function HealthRecords() {
  const [rows, setRows] = useState<HealthRow[]>([])
  const [searchText, setSearchText] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<HealthRow | null>(null)
  const [history, setHistory] = useState<CustomerHealthRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(false)
  const [detailRefresh, setDetailRefresh] = useState(0)
  const [detailTreatments, setDetailTreatments] = useState<CustomerTreatment[]>([])
  const [detailAppointments, setDetailAppointments] = useState<ServiceHistoryAppointment[]>([])
  const [packageNames, setPackageNames] = useState<Record<string, string>>({})
  const [staffs, setStaffs] = useState<ExaminerOption[]>([])
  const [skinTypes, setSkinTypes] = useState<SkinTypeOption[]>([])
  const [skinTypesLoading, setSkinTypesLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [recordCustomer, setRecordCustomer] = useState<HealthRow | null>(null)
  const [editingRecord, setEditingRecord] = useState<CustomerHealthRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
const branchesQuery = useGetBranchesAdmin()
const branches = useMemo(() => (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[], [branchesQuery.data])
  


  const load = useCallback(async (nextPage = page, search = keyword): Promise<HealthRow[] | null> => {
    setLoading(true)
    try {
      // BE trả bản ghi phiếu khám mới nhất của từng khách kèm customer_profile + tìm q trên khách/nội dung phiếu
      const latestRecords = await getHealthRecordsAdmin({
        page: nextPage,
        limit: 10,
        ...(search.trim() ? { q: search.trim() } : {}),
      } as never)
      const latestList = (pickData<CustomerHealthRecord[]>(latestRecords) ?? []) as CustomerHealthRecord[]
      const nextRows = latestList.map((record) => ({
        ...((record as unknown as { customer_profile?: Record<string, unknown> }).customer_profile ?? {}),
        id: record.customer_profile_id,
        latestRecord: record,
      })) as unknown as HealthRow[]
      setTotal((latestRecords as unknown as { meta?: { total?: number } })?.meta?.total ?? nextRows.length)
      setRows(nextRows)
      return nextRows
    } catch (err) {
      message.error(errorMessage(err))
      return null
    } finally {
      setLoading(false)
    }
  }, [page, keyword])

  useEffect(() => {
    void load()
    const loadExaminerOptions = async () => {
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
      setStaffs([...uniqueNames.values()].sort((a, b) =>
        (a.zalo_name || a.email || '').localeCompare(b.zalo_name || b.email || '', 'vi'),
      ))
    }

    void loadExaminerOptions()
    getSkinTypesAdmin()
      .then((body) => setSkinTypes(pickData<SkinTypeOption[]>(body) ?? []))
      .catch((err) => message.error(`Không tải được danh mục loại da: ${errorMessage(err)}`))
      .finally(() => setSkinTypesLoading(false))
    getTreatmentPackagesAdmin({ page: 1, limit: 200, is_active: true })
      .then((body) => {
        const names: Record<string, string> = {}
        for (const item of pickData<Array<{ id: string; name: string }>>(body) ?? []) names[item.id] = item.name
        setPackageNames(names)
      })
      .catch(() => undefined)
  }, [load])

  useEffect(() => {
    if (!detail) return
    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(false)
    setHistory([])
    setDetailTreatments([])
    setDetailAppointments([])
    Promise.all([
      getCustomerProfilesIdHealthRecordsAdmin(detail.id),
      getTreatmentCustomersAdmin({ customer_profile_id: detail.id, limit: 50 }),
      getAppointmentsAdmin({ customer_profile_id: detail.id, page: 1, limit: 100 }).catch(() => null),
    ])
      .then(([recordsResult, treatmentsResult, appointmentsResult]) => {
        if (cancelled) return
        setHistory(pickData<CustomerHealthRecord[]>(recordsResult) ?? [])
        setDetailTreatments(pickData<CustomerTreatment[]>(treatmentsResult) ?? [])
        setDetailAppointments((pickData<ServiceHistoryAppointment[]>(appointmentsResult) ?? []).filter((appointment) =>
          !appointment.customer_treatment_id && ['in_progress', 'completed'].includes(String(appointment.status)),
        ))
      })
      .catch(() => {
        if (!cancelled) setHistoryError(true)
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detail, detailRefresh])

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setKeyword(nextKeyword.trim())
    setPage(1)
  }

  const openRecordForm = (row: HealthRow, record?: CustomerHealthRecord) => {
    setRecordCustomer(row)
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
    setModalOpen(true)
  }

  const submit = async () => {
    const values = (await form.validateFields()) as Record<string, Dayjs | string | undefined>
    if (!recordCustomer) return
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
        await putCustomerProfilesIdHealthRecordsRecordIdAdmin(recordCustomer.id, editingRecord.id, dto as never)
        message.success('Đã cập nhật phiếu khám')
      } else {
        await postCustomerProfilesIdHealthRecordsAdmin(recordCustomer.id, dto as never)
        message.success('Đã tạo phiếu khám')
      }
      setModalOpen(false)
      const nextRows = await load()
      if (detail && detail.id === recordCustomer.id) {
        setDetail(nextRows?.find((row) => row.id === detail.id) ?? detail)
      } else if (detail) {
        setDetailRefresh((value) => value + 1)
      }
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitle
        className="max-md:mb-3"
        subtitle="Hồ sơ sức khỏe và chỉ số của khách hàng"
        left={
          <Input.Search
            aria-label="Tìm hồ sơ sức khỏe"
            allowClear
            placeholder="Tìm khách, SĐT, tình trạng da..."
            className="w-full! min-w-0 md:w-[260px]!"
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); if (!e.target.value) applySearch('') }}
            onSearch={(v) => applySearch(v)}
          />
        }
      >
        Sổ sức khỏe
      </PageTitle>

      <Table<HealthRow>
        className="desktop-only"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 900 }}
        pagination={false}
        onRow={(row) => ({ onClick: () => setDetail(row), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Khách hàng',
            width: 210,
            render: (_, row) => (
              <div>
                <div style={{ fontWeight: 600 }}>{row.full_name}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.phone}</Typography.Text>
              </div>
            ),
          },
          {
            title: 'Loại da',
            width: 130,
            render: (_, row) => currentHealth(row, skinTypes).skin_type ? <Tag color="purple">{currentHealth(row, skinTypes).skin_type}</Tag> : '—',
          },
          {
            title: 'Tình trạng da',
            render: (_, row) => <Typography.Text ellipsis={{ tooltip: currentHealth(row, skinTypes).condition }}>{currentHealth(row, skinTypes).condition || '—'}</Typography.Text>,
          },
          {
            title: 'Dị ứng',
            width: 150,
            render: (_, row) => {
              const allergies = currentHealth(row, skinTypes).allergies
              return !allergies || allergies.toLocaleLowerCase('vi') === 'không'
                ? <Typography.Text type="secondary">{allergies || '—'}</Typography.Text>
                : <Tag color="red">{allergies}</Tag>
            },
          },
          {
            title: 'Khám bởi',
            width: 140,
            render: (_, row) => currentHealth(row, skinTypes).checked_by || '—',
          },
          {
            title: 'Ngày khám',
            width: 115,
            render: (_, row) => displayDate(currentHealth(row, skinTypes).checked_date),
          },
          {
            key: 'actions',
            title: 'Thao tác', align: 'center' as const,
            width: 90,
            fixed: 'right' as const,
            render: (_, row) => (
              <RowActionsMenu
                items={[
                  { key: 'record', icon: <FileAddOutlined />, label: 'Ghi nhận khám' },
                ]}
                onSelect={(key) => {
                  if (key === 'record') openRecordForm(row)
                }}
              />
            ),
          },
        ]}
      />
      <MobileCards
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        emptyText={keyword ? 'Không có kết quả' : 'Chưa có hồ sơ sức khỏe'}
        emptyDescription={keyword ? 'Thử tìm theo tên khách hoặc số điện thoại' : undefined}
        renderCard={(row) => {
          const health = currentHealth(row, skinTypes)
          return (
            <>
              <div className="mobile-card-head flex-wrap">
                <div className="min-w-0">
                  <div className="mobile-card-title">{row.full_name || 'Khách hàng'}</div>
                  {row.phone && <div className="mobile-card-sub">{row.phone}</div>}
                </div>
                {health.skin_type && (
                  <Tag className="me-0! max-w-full whitespace-normal! wrap-anywhere" color="purple">{health.skin_type}</Tag>
                )}
              </div>
              <div className="mobile-card-rows">
                <MobileCardRow label="Tình trạng da" value={health.condition || '—'} />
                <MobileCardRow label="Dị ứng" value={health.allergies || '—'} />
                <MobileCardRow label="Khám bởi" value={health.checked_by || '—'} />
                <MobileCardRow label="Ngày khám" value={displayDate(health.checked_date)} />
              </div>
              <div className="mobile-card-actions flex-wrap">
                <Button onClick={() => setDetail(row)}>Xem chi tiết</Button>
                <Button type="primary" icon={<FileAddOutlined />} onClick={() => openRecordForm(row)}>Ghi nhận khám</Button>
              </div>
            </>
          )
        }}
      />
      <ListPagination page={page} limit={10} total={total} onChange={setPage} noun="hồ sơ sức khỏe" />

      <HealthRecordDrawer
        detail={detail}
        onClose={() => setDetail(null)}
        onOpenRecordForm={openRecordForm}
        skinTypes={skinTypes}
        history={history}
        historyLoading={historyLoading}
        historyError={historyError}
        onRetryHistory={() => setDetailRefresh((value) => value + 1)}
        detailTreatments={detailTreatments}
        packageNames={packageNames}
        detailAppointments={detailAppointments}
      />

      <HealthRecordModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onSubmit={() => void submit()}
        saving={saving}
        editingRecord={editingRecord}
        recordCustomer={recordCustomer}
        form={form}
        staffs={staffs}
        skinTypes={skinTypes}
        skinTypesLoading={skinTypesLoading}
        branches={branches}
      />
    </>
  )
}
