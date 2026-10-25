import { useMemo, useState } from 'react'
import { Button, DatePicker, Drawer, Empty, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import {
  BarChartOutlined,
  CalendarOutlined,
  CloseOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ProfileOutlined,
  RightOutlined,
  SafetyOutlined,
  SearchOutlined,
  SkinOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '../components/base/PageTitle'
import { useGetCustomerProfiles, usePutCustomerProfilesId } from '../api/endpoints/customer-profiles'
import { useGetCustomerTreatments } from '../api/endpoints/customer-treatments'
import { useGetTreatmentPackages } from '../api/endpoints/treatment-packages'
import { useGetUsers } from '../api/endpoints/users'

interface CustomerProfile {
  id: string
  customer_code: string
  full_name: string
  phone: string
  custom_fields?: HealthFields
}
interface CustomerTreatment {
  id: string
  customer_profile_id?: string
  package_id?: string
  quota_type?: string
  sessions_used?: number
  sessions_total?: number
  status?: string
}

const SKIN_TYPES = ['Da dầu', 'Da khô', 'Da hỗn hợp', 'Da nhạy cảm', 'Da thường']

const eyebrowStyle = { fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A9ADB2', fontWeight: 600 } as const
const labelStyle = { fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8D93', fontWeight: 600 }

/** Hình chữ thập y tế trang trí */
function Cross({ size, color, style }: { size: number; color: string; style?: React.CSSProperties }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      <div style={{ position: 'absolute', left: size * 0.35, top: 0, width: size * 0.3, height: size, borderRadius: size * 0.15, background: color }} />
      <div style={{ position: 'absolute', top: size * 0.35, left: 0, width: size, height: size * 0.3, borderRadius: size * 0.15, background: color }} />
    </div>
  )
}

const cardStyle = {
  background: '#fff',
  borderRadius: 24,
  padding: 20,
  border: '1px solid #EDF3EF',
  boxShadow: '0 10px 34px rgba(23, 107, 75, 0.07)',
} as const

const cardHeaderStyle = { fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', color: '#25332C' }

const iconBadge = (bg: string, color: string) => ({
  width: 34,
  height: 34,
  flexShrink: 0,
  borderRadius: 12,
  background: bg,
  color,
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const OVERVIEW_ROWS = (cf: HealthFields | undefined) => [
  { icon: <SkinOutlined />, bg: '#FDEEF2', color: '#E46C93', label: 'Loại da', value: cf?.skin_type },
  { icon: <BarChartOutlined />, bg: '#EAF1FD', color: '#4A7DE0', label: 'Tình trạng da', value: cf?.condition },
  { icon: <SafetyOutlined />, bg: '#E7F6EE', color: '#2FA36B', label: 'Dị ứng', value: cf?.allergies },
  { icon: <MedicineBoxOutlined />, bg: '#FDF2E7', color: '#E58A3A', label: 'Khám bởi', value: cf?.checked_by },
  {
    icon: <CalendarOutlined />,
    bg: '#F1EBFD',
    color: '#8B5CF6',
    label: 'Ngày khám',
    value: cf?.checked_date ? dayjs(cf.checked_date).format('DD/MM/YYYY') : undefined,
  },
]

interface HealthFields {
  skin_type?: string
  condition?: string
  allergies?: string
  checked_by?: string
  checked_date?: string
}

type HealthRow = CustomerProfile & { custom_fields?: HealthFields }

export default function HealthRecords() {
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HealthRow | null>(null)
  const [detail, setDetail] = useState<HealthRow | null>(null)
  const [form] = Form.useForm()
  const profilesQuery = useGetCustomerProfiles()
  const staffsQuery = useGetUsers({ currentPage: '1', pageSize: '200', IsAdmin: 'true' })
  const treatmentsQuery = useGetCustomerTreatments()
  const packagesQuery = useGetTreatmentPackages()
  const summaryMutation = usePutCustomerProfilesId()
  const rows = (((profilesQuery.data?.responseData ?? (profilesQuery.data as any)?.data ?? []) as HealthRow[]))
  const staffs = (((staffsQuery.data?.responseData ?? {}) as { rows?: { id: string; zalo_name?: string; email?: string }[] }).rows ?? [])
  const allTreatments = (((treatmentsQuery.data?.responseData ?? (treatmentsQuery.data as any)?.data ?? []) as CustomerTreatment[]))
  const detailTreatments = detail ? allTreatments.filter((treatment) => treatment.customer_profile_id === detail.id) : []
  const packageRows = (((packagesQuery.data?.responseData ?? (packagesQuery.data as any)?.data ?? []) as { id: string; name: string }[]))
  const packageNames = Object.fromEntries(packageRows.map((pkg) => [pkg.id, pkg.name]))
  const loading = profilesQuery.isLoading

  const openDetail = (row: HealthRow) => {
    setDetail(row)
  }

  const list = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.full_name?.toLowerCase().includes(keyword.toLowerCase()) ||
          (r.custom_fields?.condition ?? '').toLowerCase().includes(keyword.toLowerCase()),
      ),
    [rows, keyword],
  )

  const openModal = (r?: HealthRow) => {
    setEditing(r ?? null)
    const cf = r?.custom_fields ?? {}
    form.setFieldsValue(
      r
        ? {
          skin_type: cf.skin_type ?? SKIN_TYPES[0],
          condition: cf.condition ?? '',
          allergies: cf.allergies ?? 'Không',
          checked_by: cf.checked_by,
          checked_date: cf.checked_date ? dayjs(cf.checked_date) : dayjs(),
        }
        : { skin_type: SKIN_TYPES[0], condition: '', allergies: 'Không', checked_date: dayjs() },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (!editing) {
      message.warning('Chọn khách hàng từ bảng để cập nhật sổ sức khỏe')
      return
    }
    const custom_fields: HealthFields = {
      ...(editing.custom_fields ?? {}),
      skin_type: values.skin_type,
      condition: values.condition,
      allergies: values.allergies,
      checked_by: values.checked_by,
      checked_date: values.checked_date?.format?.('YYYY-MM-DD'),
    }
    try {
      await summaryMutation.mutateAsync({ id: editing.id, data: { custom_fields: custom_fields as Record<string, unknown> } })
      message.success('Đã cập nhật sổ sức khỏe')
      setOpen(false)
      await profilesQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể cập nhật sổ sức khỏe')
    }
  }

  return (
    <>
      <PageTitle
        extra={
          <Space className="max-sm:flex! max-sm:w-full!">
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#A9ADB2' }} />}
              placeholder="Tìm theo khách, tình trạng da..."
              className="max-sm:w-full!"
              style={{ width: 260, maxWidth: '100%' }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </Space>
        }
      >
        Sổ sức khỏe
      </PageTitle>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        onRow={(row) => ({ onClick: () => openDetail(row), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Khách hàng',
            render: (_, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{row.full_name}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.phone}</div>
              </div>
            ),
          },
          {
            title: 'Loại da',
            width: 130,
            render: (_, row) =>
              row.custom_fields?.skin_type ? <Tag color="purple">{row.custom_fields.skin_type}</Tag> : '—',
          },
          {
            title: 'Tình trạng da',
            render: (_, row) => row.custom_fields?.condition || '—',
          },
          {
            title: 'Dị ứng',
            width: 140,
            render: (_, row) =>
              !row.custom_fields?.allergies || row.custom_fields.allergies === 'Không' ? (
                <Typography.Text type="secondary">Không</Typography.Text>
              ) : (
                <Tag color="red">{row.custom_fields.allergies}</Tag>
              ),
          },
          {
            title: 'Khám bởi',
            width: 120,
            render: (_, row) => row.custom_fields?.checked_by || '—',
          },
          {
            title: 'Ngày khám',
            width: 110,
            render: (_, row) =>
              row.custom_fields?.checked_date ? dayjs(row.custom_fields.checked_date).format('DD/MM/YYYY') : '—',
          },
          {
            title: '',
            width: 140,
            render: (_, row) => (
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  openModal(row)
                }}
              >
                {row.custom_fields?.condition ? 'Sửa' : 'Ghi nhận'}
              </Button>
            ),
          },
        ]}
      />

      <Drawer
        title={null}
        closable={false}
        width={490}
        open={!!detail}
        onClose={() => setDetail(null)}
        styles={{
          body: {
            padding: 0,
            background: 'linear-gradient(180deg, #E9F5EF 0%, #F7FBF9 45%, #FFFFFF 100%)',
          },
        }}
      >
        {detail && (
          <div style={{ position: 'relative', padding: '20px 24px 40px', overflow: 'hidden', minHeight: '100%' }}>
            {/* Nút đóng custom */}
            <div
              onClick={() => setDetail(null)}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#6B8577',
                fontSize: 13,
                marginBottom: 14,
                boxShadow: '0 2px 8px rgba(23, 107, 75, 0.08)',
              }}
            >
              <CloseOutlined />
            </div>
            {/* Trang trí: chữ thập y tế + sóng đáy */}
            <div style={{ position: 'absolute', top: 28, right: 20, pointerEvents: 'none' }}>
              <Cross size={58} color="#C4E7D4" style={{ position: 'absolute', top: 0, right: 0, opacity: 0.9 }} />
              <Cross size={30} color="#D9F0E3" style={{ position: 'absolute', top: 52, right: 66, opacity: 0.8 }} />
              <Cross size={22} color="#E4F5EC" style={{ position: 'absolute', top: 8, right: 84, opacity: 0.8 }} />
            </div>
            <svg
              viewBox="0 0 490 120"
              preserveAspectRatio="none"
              style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 110, pointerEvents: 'none' }}
            >
              <path d="M0,70 C130,20 300,120 490,40 L490,120 L0,120 Z" fill="#DCEFE4" opacity="0.55" />
              <path d="M0,95 C160,50 320,110 490,70 L490,120 L0,120 Z" fill="#CBE7D8" opacity="0.45" />
            </svg>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, position: 'relative' }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  flexShrink: 0,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, var(--brand-dark), var(--brand-primary))',
                  color: '#fff',
                  fontSize: 20,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(23, 107, 75, 0.25)',
                }}
              >
                {detail.full_name?.charAt(0)?.toUpperCase() ?? 'K'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={eyebrowStyle}>Hồ sơ lâm sàng</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: '#25332C', lineHeight: 1.35 }}>{detail.full_name}</div>
                <div style={{ fontSize: 13, color: '#8A938E' }}>{detail.phone}</div>
              </div>
            </div>

            {/* Tổng quan sức khỏe */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={iconBadge('#E7F6EE', '#2FA36B')}>
                  <ProfileOutlined />
                </div>
                <span style={cardHeaderStyle}>TỔNG QUAN SỨC KHỎE</span>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {OVERVIEW_ROWS(detail.custom_fields).map((r) => (
                  <div
                    key={r.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: '#F7FAF8',
                      borderRadius: 16,
                      padding: '11px 14px',
                    }}
                  >
                    <div style={iconBadge(r.bg, r.color)}>{r.icon}</div>
                    <span style={{ flex: 1, fontSize: 14, color: '#3A453F' }}>{r.label}</span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: r.value ? '#25332C' : '#C0C9C3',
                        maxWidth: 150,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.value || '—'}
                    </span>
                    <RightOutlined style={{ fontSize: 11, color: '#C6CDC8' }} />
                  </div>
                ))}
              </div>
              <div
                onClick={() => {
                  setDetail(null)
                  openModal(detail)
                }}
                style={{
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#E7F5EC',
                  borderRadius: 16,
                  padding: '11px 14px',
                  cursor: 'pointer',
                }}
              >
                <div style={iconBadge('#D3EBDD', '#1B7A4E')}>
                  <SyncOutlined />
                </div>
                <span style={{ flex: 1, fontWeight: 700, color: '#1B7A4E', fontSize: 14 }}>Cập nhật số sức khỏe</span>
                <RightOutlined style={{ fontSize: 12, color: '#1B7A4E' }} />
              </div>
            </div>

            {/* Lịch sử khám và điều trị */}
            <div style={{ ...cardStyle, marginTop: 16, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={iconBadge('#EAF1FD', '#4A7DE0')}>
                  <FileTextOutlined />
                </div>
                <span style={cardHeaderStyle}>LỊCH SỬ KHÁM VÀ ĐIỀU TRỊ</span>
              </div>
              {detailTreatments.length === 0 ? (
                <div style={{ padding: '18px 0 12px' }}>
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div>
                        <div style={{ fontWeight: 700, color: '#374151', fontSize: 14 }}>Chưa có liệu trình</div>
                        <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                          Thông tin lịch sử khám và điều trị sẽ được hiển thị tại đây.
                        </div>
                      </div>
                    }
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {detailTreatments.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: '#F7FAF8',
                        borderRadius: 16,
                        padding: '11px 14px',
                      }}
                    >
                      <div style={iconBadge('#EAF1FD', '#4A7DE0')}>
                        <MedicineBoxOutlined />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 14,
                            color: '#25332C',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.package_id ? packageNames[t.package_id] ?? 'Gói liệu trình' : 'Gói liệu trình'}
                        </div>
                        <div style={{ fontSize: 12, color: '#8A938E' }}>
                          {t.quota_type === 'SESSIONS'
                            ? `${t.sessions_used ?? 0}/${t.sessions_total ?? '?'} buổi`
                            : 'Không giới hạn buổi'}
                          {(t as any).updated_at
                            ? ` · Cập nhật ${dayjs((t as any).updated_at).format('DD/MM/YYYY')}`
                            : ''}
                        </div>
                      </div>
                      <Tag
                        style={{ marginInlineEnd: 0, borderRadius: 999 }}
                        color={t.status === 'ACTIVE' ? 'green' : t.status === 'FINISHED' ? 'blue' : 'red'}
                      >
                        {t.status === 'ACTIVE' ? 'Đang dùng' : t.status === 'FINISHED' ? 'Hoàn tất' : 'Đã hủy'}
                      </Tag>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={600}
        centered
        style={{ borderRadius: 24, overflow: 'hidden' }}
        styles={{
          body: { padding: 0 },
          close: {
            top: 22,
            insetInlineEnd: 22,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 2px 8px rgba(23, 107, 75, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        }}
      >
        {editing && (
          <div>
            {/* Header band xanh y tế */}
            <div
              style={{
                position: 'relative',
                padding: '26px 32px 22px',
                background: 'linear-gradient(160deg, #DFF0E7 0%, #EDF7F1 55%, #F7FBF9 100%)',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 16, right: 66, pointerEvents: 'none' }}>
                <Cross size={34} color="#C9E8D6" style={{ position: 'absolute', top: 0, right: 0, opacity: 0.85 }} />
                <Cross size={18} color="#DDF1E5" style={{ position: 'absolute', top: 30, right: 40, opacity: 0.8 }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  position: 'relative',
                  paddingRight: 40,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    flexShrink: 0,
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, var(--brand-dark), var(--brand-primary))',
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 20px rgba(23, 107, 75, 0.25)',
                  }}
                >
                  {editing.full_name?.charAt(0)?.toUpperCase() ?? 'K'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...eyebrowStyle, color: '#4E8B6C' }}>Hồ sơ lâm sàng</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-dark)', lineHeight: 1.3 }}>
                    {editing.full_name}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#7A9486' }}>
                    {editing.phone} · {editing.customer_code}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '24px 36px 28px' }}>
              <Form form={form} layout="vertical" requiredMark={false}>
                <div style={{ ...eyebrowStyle, marginBottom: 12 }}>Khám da</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 20px' }}>
                  <Form.Item name="skin_type" label={<span style={labelStyle}>Loại da</span>}>
                    <Select variant="filled" style={{ borderRadius: 14 }} options={SKIN_TYPES.map((t) => ({ value: t, label: t }))} />
                  </Form.Item>
                  <Form.Item name="checked_by" label={<span style={labelStyle}>Khám bởi</span>}>
                    <Select
                      variant="filled"
                      allowClear
                      style={{ borderRadius: 14 }}
                      placeholder="Chọn chuyên viên"
                      options={staffs.map((s) => ({
                        value: s.zalo_name || s.email || s.id.slice(0, 8),
                        label: s.zalo_name || s.email || s.id.slice(0, 8),
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="allergies" label={<span style={labelStyle}>Dị ứng</span>}>
                    <Input variant="filled" style={{ borderRadius: 14 }} placeholder="VD: Cồn khô / Không" />
                  </Form.Item>
                  <Form.Item name="checked_date" label={<span style={labelStyle}>Ngày khám</span>}>
                    <DatePicker variant="filled" style={{ width: '100%', borderRadius: 14 }} format="DD/MM/YYYY" />
                  </Form.Item>
                </div>

                <div style={{ ...eyebrowStyle, margin: '20px 0 12px' }}>Ghi chú lâm sàng</div>
                <Form.Item
                  name="condition"
                  rules={[{ required: true, message: 'Nhập tình trạng da' }]}
                >
                  <Input.TextArea
                    rows={4}
                    variant="filled"
                    style={{ borderRadius: 14, resize: 'none' }}
                    placeholder="VD: Mụn viêm vùng cằm, thâm nhẹ..."
                  />
                </Form.Item>
              </Form>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 8,
                  paddingTop: 20,
                  borderTop: '1px solid var(--brand-border-soft)',
                }}
              >
                <Button shape="round" style={{ paddingInline: 24, height: 42 }} onClick={() => setOpen(false)}>
                  Hủy
                </Button>
                <Button
                  type="primary"
                  shape="round"
                  onClick={submit}
                  style={{ paddingInline: 30, height: 42, fontWeight: 600 }}
                >
                  Lưu hồ sơ
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
