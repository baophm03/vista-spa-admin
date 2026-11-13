import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Form,
  Input,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  FileAddOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import {
  getCustomerProfiles,
  getCustomerProfilesIdHealthRecords,
  getHealthRecordsLatest,
  postCustomerProfilesIdHealthRecords,
  putCustomerProfilesIdHealthRecordsRecordId,
} from '@/api/endpoints/customer-profiles'
import { getTreatmentCustomers } from '@/api/endpoints/treatment-customers'
import { getAppointments } from '@/api/endpoints/appointments'
import { getSkinTypes } from '@/api/endpoints/settings'
import { getTreatmentPackages } from '@/api/endpoints/services'
import { getUsers } from '@/api/endpoints/users'
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

export default function HealthRecords() {
  const [rows, setRows] = useState<HealthRow[]>([])
  const [searchText, setSearchText] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
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

  const load = useCallback(async (): Promise<HealthRow[] | null> => {
    setLoading(true)
    try {
      const [profileResult, latestRecords] = await Promise.all([
        getCustomerProfiles({ page: 1, limit: 200 }),
        getHealthRecordsLatest(),
      ])
      const latestByProfile = new Map(
        (pickData<CustomerHealthRecord[]>(latestRecords) ?? []).map((record) => [record.customer_profile_id, record]),
      )
      const nextRows = (pickData<HealthRow[]>(profileResult) ?? []).map((row) => ({ ...row, latestRecord: latestByProfile.get(row.id) }))
      setRows(nextRows)
      return nextRows
    } catch (err) {
      message.error(errorMessage(err))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const loadExaminerOptions = async () => {
      const result = await getUsers({ currentPage: 1, pageSize: 200, has_role: true }).catch(() => null)
      const userRows = (pickData<{ rows?: Array<{ id: string; zalo_name?: string; email?: string; user_roles?: Array<{ role?: { role_name?: string } | null }> }> }>(result)?.rows ?? [])
      const ktvUsers = userRows.filter((user) =>
        (user.user_roles ?? []).some((assignment) => {
          const roleName = String(assignment.role?.role_name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi')
          return roleName === 'ktv' || roleName.includes('chuyen vien') || roleName.includes('ky thuat vien')
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
    getSkinTypes()
      .then((body) => setSkinTypes(pickData<SkinTypeOption[]>(body) ?? []))
      .catch((err) => message.error(`Không tải được danh mục loại da: ${errorMessage(err)}`))
      .finally(() => setSkinTypesLoading(false))
    getTreatmentPackages({ page: 1, limit: 200, is_active: true })
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
      getCustomerProfilesIdHealthRecords(detail.id),
      getTreatmentCustomers({ customer_profile_id: detail.id, limit: 50 }),
      getAppointments({ customer_profile_id: detail.id, page: 1, limit: 100 }).catch(() => null),
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

  const filteredRows = useMemo(() => {
    const term = keyword.trim().toLocaleLowerCase('vi')
    if (!term) return rows
    return rows.filter((row) => {
      const fields = currentHealth(row, skinTypes)
      return [row.full_name, row.phone, row.email, row.customer_code, fields.condition, fields.medical_history]
        .some((value) => value?.toLocaleLowerCase('vi').includes(term))
    })
  }, [rows, keyword, skinTypes])

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
    }
    setSaving(true)
    try {
      if (editingRecord) {
        await putCustomerProfilesIdHealthRecordsRecordId(recordCustomer.id, editingRecord.id, dto as never)
        message.success('Đã cập nhật phiếu khám')
      } else {
        await postCustomerProfilesIdHealthRecords(recordCustomer.id, dto as never)
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
        subtitle="Hồ sơ sức khỏe và chỉ số của khách hàng"
        left={
          <Input
            allowClear
            prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
            placeholder="Tìm khách, SĐT, tình trạng da..."
            className="w-[260px]!"
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value)
              if (!event.target.value) applySearch('')
            }}
            onPressEnter={() => applySearch(searchText)}
          />
        }
      >
        Sổ sức khỏe
      </PageTitle>

      <Table<HealthRow>
        rowKey="id"
        loading={loading}
        dataSource={paginateRows(filteredRows, page, 10)}
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
            title: 'Hành động', align: 'center' as const,
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
      <ListPagination page={page} limit={10} total={filteredRows.length} onChange={setPage} noun="hồ sơ sức khỏe" />

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
      />
    </>
  )
}
