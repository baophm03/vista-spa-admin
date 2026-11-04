import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Collapse,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CalendarOutlined,
  FileAddOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ProfileOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import type { CustomerProfileRow } from '@/components/CustomerProfileOverviewTab'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { Appointment } from '@/api/models/appointment'
import {
  getCustomerProfiles,
  getCustomerProfilesIdHealthRecords,
  getHealthRecordsLatest,
  postCustomerProfilesIdHealthRecords,
  putCustomerProfilesIdHealthRecordsRecordId,
} from '@/api/endpoints/customer-profiles'
import { getCustomerTreatments } from '@/api/endpoints/customer-treatments'
import { getAppointments } from '@/api/endpoints/appointments'
import { getSkinTypes } from '@/api/endpoints/settings'
import { getTreatmentPackages } from '@/api/endpoints/services'
import { getUsers } from '@/api/endpoints/users'
import { errorMessage, pickData } from '@/api/helpers'
import { Can } from '@casl/react'

const labelStyle = { fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8D93', fontWeight: 600 }

interface HealthFields {
  checked_date?: string
  checked_by?: string
  medical_history?: string
  skin_type?: string
  condition?: string
  allergies?: string
  protocol?: string
  products_used?: string
  advice?: string
  note?: string
}

type HealthRow = CustomerProfileRow & { latestRecord?: CustomerHealthRecord | null }
type ServiceHistoryAppointment = Appointment & {
  service?: { title?: string; price?: number | string | null } | null
  staff?: { zalo_name?: string } | null
  service_amount?: number | string | null
  visit_done_at?: string | null
  diary?: string | null
  result?: string | null
}

interface SkinTypeOption {
  code: string
  label: string
  sort_order?: number
}

type ExaminerOption = { id: string; zalo_name?: string | null; email?: string | null }

function readLegacyHealth(row: HealthRow): HealthFields {
  const fields = (row.custom_fields ?? {}) as Record<string, unknown>
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = fields[key]
      if (typeof candidate === 'string' && candidate.trim()) return candidate
    }
    return undefined
  }
  return {
    checked_date: value('checked_date'),
    checked_by: value('checked_by'),
    medical_history: value('tien_su_benh_ly', 'medical_history'),
    skin_type: value('skin_type', 'loai_da'),
    condition: value('condition', 'tinh_trang_da_ban_dau', 'tinh_trang_da'),
    allergies: value('allergies', 'di_ung'),
    protocol: value('phac_do_dieu_tri', 'protocol'),
    products_used: value('san_pham_su_dung', 'products_used'),
    advice: value('loi_dan_ktv', 'advice'),
    note: value('ghi_chu', 'note') || row.note || undefined,
  }
}

function skinTypeLabel(value: string | null | undefined, options: SkinTypeOption[]): string | undefined {
  if (!value) return undefined
  const normalizedValue = value.trim().toLocaleLowerCase('vi')
  const option = options.find((item) =>
    item.code.trim().toLocaleLowerCase('vi') === normalizedValue
    || item.label.trim().toLocaleLowerCase('vi') === normalizedValue,
  )
  return option?.label ?? value
}

function skinTypeCode(value: string | null | undefined, options: SkinTypeOption[]): string | undefined {
  if (!value) return undefined
  const normalizedValue = value.trim().toLocaleLowerCase('vi')
  return options.find((option) =>
    option.code.trim().toLocaleLowerCase('vi') === normalizedValue
    || option.label.trim().toLocaleLowerCase('vi') === normalizedValue,
  )?.code ?? value
}

function currentHealth(row: HealthRow, skinTypes: SkinTypeOption[]): HealthFields {
  const record = row.latestRecord
  const fields = !record ? readLegacyHealth(row) : {
    checked_date: record.checked_date,
    checked_by: record.checked_by ?? undefined,
    medical_history: record.medical_history ?? undefined,
    skin_type: record.skin_type ?? undefined,
    condition: record.condition,
    allergies: record.allergies ?? undefined,
    protocol: record.protocol ?? undefined,
    products_used: record.products_used ?? undefined,
    advice: record.advice ?? undefined,
    note: record.note ?? undefined,
  }
  return { ...fields, skin_type: skinTypeLabel(fields.skin_type, skinTypes) }
}

const healthDetails = (fields: HealthFields) => [
  { label: 'Tiền sử bệnh lý', value: fields.medical_history },
  { label: 'Loại da', value: fields.skin_type },
  { label: 'Tình trạng da', value: fields.condition },
  { label: 'Dị ứng', value: fields.allergies },
  { label: 'Phác đồ điều trị', value: fields.protocol },
  { label: 'Sản phẩm đã dùng', value: fields.products_used },
  { label: 'Lời dặn KTV', value: fields.advice },
  { label: 'Ghi chú', value: fields.note },
]

function displayDate(date?: string) {
  return date && dayjs(date).isValid() ? dayjs(date).format('DD/MM/YYYY') : '—'
}

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
    getTreatmentPackages({ page: 1, limit: 200 })
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
      getCustomerTreatments({ customer_profile_id: detail.id, limit: 50 }),
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
        extra={
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
              placeholder="Tìm khách, SĐT, tình trạng da..."
              style={{ width: 260 }}
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value)
                if (!event.target.value) applySearch('')
              }}
              onPressEnter={() => applySearch(searchText)}
            />
          </Space>
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

      <Drawer
        title={detail ? `${detail.full_name} — ${detail.customer_code}` : 'Hồ sơ sức khỏe'}
        width={560}
        open={!!detail}
        onClose={() => setDetail(null)}
        extra={detail && <Can I="UPDATE" a="CUSTOMER"><Button type="primary" icon={<PlusOutlined />} onClick={() => openRecordForm(detail)}>Tạo phiếu khám</Button></Can>}
      >
        {detail && (() => {
          const current = currentHealth(detail, skinTypes)
          const hasLegacy = !detail.latestRecord && healthDetails(current).some((field) => !!field.value)
          return (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card size="small" title={<Space><ProfileOutlined />Tổng quan sức khỏe</Space>}>
                {hasLegacy && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 14 }}
                    message="Thông tin cũ trên hồ sơ"
                    description="Khách chưa có phiếu khám mới. Dữ liệu này vẫn được giữ nguyên và chưa được tính là một lần khám."
                  />
                )}
                {detail.latestRecord && (
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Theo phiếu khám ngày {displayDate(detail.latestRecord.checked_date)}
                  </Typography.Text>
                )}
                <Descriptions column={1} size="small" labelStyle={{ width: 150, color: '#7E8581' }}>
                  <Descriptions.Item label="Khám bởi">{current.checked_by || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Ngày khám">{displayDate(current.checked_date)}</Descriptions.Item>
                  {healthDetails(current).map((field) => (
                    <Descriptions.Item key={field.label} label={field.label}>{field.value || '—'}</Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>

              <Card
                size="small"
                title={<Space><FileTextOutlined />Lịch sử phiếu khám</Space>}
              >
                {historyLoading ? (
                  <div style={{ padding: 24, textAlign: 'center' }}>Đang tải lịch sử khám...</div>
                ) : historyError ? (
                  <Alert
                    type="error"
                    showIcon
                    message="Không tải được lịch sử phiếu khám"
                    action={<Button size="small" onClick={() => setDetailRefresh((value) => value + 1)}>Thử lại</Button>}
                  />
                ) : history.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phiếu khám mới" />
                ) : (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {history.map((record) => (
                      <Card
                        key={record.id}
                        size="small"
                        title={<Space><CalendarOutlined />{displayDate(record.checked_date)}{record.checked_by ? ` · ${record.checked_by}` : ''}</Space>}
                        extra={<Button size="small" onClick={() => openRecordForm(detail, record)}>Sửa</Button>}
                      >
                        <Descriptions column={1} size="small" labelStyle={{ width: 145, color: '#7E8581' }}>
                          {healthDetails({
                            medical_history: record.medical_history ?? undefined,
                            skin_type: skinTypeLabel(record.skin_type, skinTypes),
                            condition: record.condition,
                            allergies: record.allergies ?? undefined,
                            protocol: record.protocol ?? undefined,
                            products_used: record.products_used ?? undefined,
                            advice: record.advice ?? undefined,
                            note: record.note ?? undefined,
                          }).map((field) => (
                            <Descriptions.Item key={field.label} label={field.label}>{field.value || '—'}</Descriptions.Item>
                          ))}
                        </Descriptions>
                      </Card>
                    ))}
                  </Space>
                )}
              </Card>

              <Card size="small" title={<Space><MedicineBoxOutlined />Liệu trình</Space>}>
                {detailTreatments.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Khách chưa có liệu trình" />
                ) : (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {detailTreatments.map((treatment) => (
                      <div key={treatment.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Typography.Text style={{ flex: 1 }}>{packageNames[treatment.package_id] || 'Gói liệu trình'}</Typography.Text>
                        <Typography.Text type="secondary">
                          {treatment.quota_type === 'SESSIONS'
                            ? `${treatment.sessions_used ?? 0}/${treatment.sessions_total ?? '?'} buổi`
                            : 'Không giới hạn buổi'}
                        </Typography.Text>
                        <Tag color={treatment.status === 'ACTIVE' ? 'green' : treatment.status === 'FINISHED' ? 'blue' : 'default'}>
                          {treatment.status === 'ACTIVE' ? 'Đang dùng' : treatment.status === 'FINISHED' ? 'Hoàn tất' : 'Đã hủy'}
                        </Tag>
                      </div>
                    ))}
                  </Space>
                )}
              </Card>

              <Card size="small" title={<Space><CalendarOutlined />Lịch sử dịch vụ lẻ</Space>}>
                {historyLoading ? (
                  <div style={{ padding: 16, textAlign: 'center' }}>Đang tải lịch sử dịch vụ…</div>
                ) : detailAppointments.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Khách chưa có lần làm dịch vụ lẻ" />
                ) : (
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    {detailAppointments.map((appointment) => (
                      <Card
                        key={appointment.id}
                        size="small"
                        title={`${displayDate(appointment.appt_date)} ${appointment.start_time?.slice(0, 5) || ''} · ${appointment.service?.title || 'Dịch vụ'}`}
                        extra={<Tag color={appointment.status === 'completed' ? 'green' : appointment.status === 'in_progress' ? 'blue' : 'default'}>{appointment.status === 'completed' ? 'Hoàn tất' : appointment.status === 'in_progress' ? 'Đang làm' : appointment.status || '—'}</Tag>}
                      >
                        <Descriptions column={1} size="small" labelStyle={{ width: 110, color: '#7E8581' }}>
                          <Descriptions.Item label="KTV">{appointment.staff?.zalo_name || '—'}</Descriptions.Item>
                          <Descriptions.Item label="Giá dịch vụ">{Number(appointment.service_amount ?? appointment.service?.price ?? 0).toLocaleString('vi-VN')} ₫</Descriptions.Item>
                          {appointment.diary && <Descriptions.Item label="Nhật ký">{appointment.diary}</Descriptions.Item>}
                          {appointment.result && <Descriptions.Item label="Kết quả / dặn dò">{appointment.result}</Descriptions.Item>}
                        </Descriptions>
                      </Card>
                    ))}
                  </Space>
                )}
              </Card>
            </Space>
          )
        })()}
      </Drawer>

      <Modal
        title={editingRecord ? 'Sửa phiếu khám' : 'Tạo phiếu khám'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={720}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>Hủy</Button>,
          <Button key="save" type="primary" loading={saving} onClick={() => void submit()}>{editingRecord ? 'Lưu thay đổi' : 'Lưu phiếu khám'}</Button>,
        ]}
      >
        {recordCustomer && (
          <>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 18 }}>
              {recordCustomer.full_name} · {recordCustomer.phone} · {recordCustomer.customer_code}
            </Typography.Text>
            <Form form={form} layout="vertical" requiredMark={false}>
              <Divider orientation="horizontal" titlePlacement="start" plain style={{ marginTop: 0, color: '#52635A', fontSize: 13 }}>Thông tin khám</Divider>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Form.Item name="checked_date" label={<span style={labelStyle}>Ngày khám</span>} rules={[{ required: true, message: 'Chọn ngày khám' }]}>
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
                <Form.Item name="checked_by" label={<span style={labelStyle}>Người khám</span>}>
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn chuyên viên"
                    options={staffs.map((staff) => {
                      const name = staff.zalo_name || staff.email || staff.id.slice(0, 8)
                      return { value: name, label: name }
                    })}
                  />
                </Form.Item>
                <Form.Item name="skin_type" label={<span style={labelStyle}>Loại da</span>}>
                  <Select
                    allowClear
                    loading={skinTypesLoading}
                    disabled={skinTypesLoading || skinTypes.length === 0}
                    placeholder={skinTypesLoading ? 'Đang tải loại da...' : 'Chọn loại da'}
                    notFoundContent="Chưa có loại da được cấu hình"
                    options={skinTypes.map((type) => ({ value: type.code, label: type.label }))}
                  />
                </Form.Item>
                <Form.Item name="allergies" label={<span style={labelStyle}>Dị ứng</span>}>
                  <Input placeholder="Ví dụ: hương liệu, cồn khô" />
                </Form.Item>
              </div>
              <Form.Item name="medical_history" label={<span style={labelStyle}>Tiền sử bệnh lý</span>}>
                <Input.TextArea rows={2} placeholder="Bệnh lý, thuốc đang sử dụng, lưu ý sức khỏe..." />
              </Form.Item>
              <Form.Item name="condition" label={<span style={labelStyle}>Tình trạng da</span>} rules={[{ required: true, whitespace: true, message: 'Nhập tình trạng da' }]}>
                <Input.TextArea rows={3} placeholder="Mô tả tình trạng da khi khám..." />
              </Form.Item>
              <Collapse
                ghost
                style={{ marginTop: 8, background: '#F7FAF8', borderRadius: 12, padding: '0 12px' }}
                items={[{
                  key: 'treatment-details',
                  forceRender: true,
                  label: (
                    <div>
                      <Typography.Text strong>Điều trị và ghi chú</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>Tùy chọn</Typography.Text>
                    </div>
                  ),
                  children: (
                    <>
                      <Form.Item name="protocol" label={<span style={labelStyle}>Phác đồ điều trị</span>}>
                        <Input.TextArea rows={2} placeholder="Các bước và kế hoạch điều trị..." />
                      </Form.Item>
                      <Form.Item name="products_used" label={<span style={labelStyle}>Sản phẩm đã dùng</span>}>
                        <Input.TextArea rows={2} placeholder="Nhập tên sản phẩm đã sử dụng trong lần khám này..." />
                      </Form.Item>
                      <Form.Item name="advice" label={<span style={labelStyle}>Lời dặn KTV</span>}>
                        <Input.TextArea rows={2} placeholder="Hướng dẫn chăm sóc hoặc lưu ý cho khách..." />
                      </Form.Item>
                      <Form.Item name="note" label={<span style={labelStyle}>Ghi chú</span>} style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="Ghi chú thêm cho lần khám..." />
                      </Form.Item>
                    </>
                  ),
                }]}
              />
            </Form>
          </>
        )}
      </Modal>
    </>
  )
}