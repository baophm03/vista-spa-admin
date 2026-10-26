import { useMemo } from 'react'
import { Descriptions, Space, Tag } from 'antd'
import dayjs from 'dayjs'
import type { CustomerProfile } from '@/api/models/customerProfile'
import type { CustomFieldDefWithOptions } from '@/components/CustomerProfileCustomFields'

/** Hồ sơ khách hàng kèm dữ liệu user được include từ backend. */
export interface CustomerProfileRow extends CustomerProfile {
  user?: {
    id?: string
    email?: string | null
    zalo_name?: string | null
    zalo_avatar?: string | null
    phone_number?: string | null
    membership?: { card_rank?: { name?: string } | null } | null
  } | null
}

export interface CustomerProfileSummaryTreatment {
  id?: string
  quota_type?: string
  sessions_total?: number | null
  sessions_used?: number | null
  remaining_sessions?: number | null
  remaining_value?: number | null
}

/** Tổng hợp hồ sơ trả về từ GET /customerProfiles/{id}/summary (responseData). */
export interface CustomerProfileSummary {
  profile?: { id: string; customer_code: string; full_name: string; phone: string; birthday?: string | null }
  rank?: { id: string; name: string } | null
  points: number
  treatments: CustomerProfileSummaryTreatment[]
  remaining_sessions: number | null
  remaining_value: number
  debt_amount: number
  latest_photos?: unknown[]
}

interface Props {
  profile: CustomerProfileRow
  summary: CustomerProfileSummary | null
  branchName: (id?: string) => string
  fieldDefinitions: CustomFieldDefWithOptions[]
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString('vi-VN') + ' ₫'
}

export default function CustomerProfileOverviewTab({ profile, summary, branchName, fieldDefinitions }: Props) {
  const labels = useMemo(() => new Map(fieldDefinitions.map((definition) => [definition.key, definition.label])), [fieldDefinitions])
  return (
    <div className="grid gap-[18px] pt-2">
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="Mã khách">{profile.customer_code}</Descriptions.Item>
        <Descriptions.Item label="Hạng">{summary?.rank?.name || profile.user?.membership?.card_rank?.name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Điểm">{summary ? summary.points.toLocaleString('vi-VN') : '—'}</Descriptions.Item>
        <Descriptions.Item label="Điện thoại">{profile.phone || '—'}</Descriptions.Item>
        <Descriptions.Item label="Email">{profile.email || profile.user?.email || '—'}</Descriptions.Item>
        <Descriptions.Item label="Ngày sinh">{profile.birthday ? dayjs(profile.birthday).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
        <Descriptions.Item label="Cơ sở">{branchName(profile.branch_id)}</Descriptions.Item>
        <Descriptions.Item label="Tài khoản">{profile.user?.zalo_name || profile.user?.phone_number || (profile.user_id ? 'Đã liên kết' : 'Chưa liên kết')}</Descriptions.Item>
        <Descriptions.Item label="Địa chỉ">{profile.address || '—'}</Descriptions.Item>
        <Descriptions.Item label="Ghi chú">{profile.note || '—'}</Descriptions.Item>
        {Object.entries(profile.custom_fields ?? {}).map(([key, value]) => (
          <Descriptions.Item key={key} label={labels.get(key) || (key === 'nghe_nghiep' ? 'Nghề nghiệp' : key)}>
            {Array.isArray(value) ? value.join(', ') : String(value ?? '—')}
          </Descriptions.Item>
        ))}
      </Descriptions>
      <Space wrap>
        <Tag color="blue">{summary ? summary.treatments.length + ' gói đang dùng' : 'Đang tải tổng hợp…'}</Tag>
        <Tag color="green">{summary ? summary.remaining_sessions === null ? 'Buổi còn lại: không giới hạn' : 'Buổi còn lại: ' + Number(summary.remaining_sessions ?? 0).toLocaleString('vi-VN') : 'Buổi còn lại: —'}</Tag>
        <Tag>Giá trị còn lại: {summary ? money(summary.remaining_value) : '—'}</Tag>
        <Tag color={Number(summary?.debt_amount ?? 0) > 0 ? 'red' : 'default'}>Công nợ: {summary ? money(summary.debt_amount) : '—'}</Tag>
      </Space>
    </div>
  )
}
