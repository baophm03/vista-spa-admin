import { useMemo, useState } from 'react'
import { Button, Card, Descriptions, Form, Input, InputNumber, Modal, Select, Space, Tag, message } from 'antd'
import dayjs from 'dayjs'
import type { CustomerProfile } from '@/api/models/customerProfile'
import type { CardRank } from '@/api/models/cardRank'
import { Can } from '@casl/react'
import {
  useGetCardRanks,
  usePostMembershipsUserIdPointsAdjust,
  usePostMembershipsUserIdRankOverride,
  usePostMembershipsUserIdRecalculate,
} from '@/api/endpoints/membership'
import type { CustomFieldDefWithOptions } from '@/components/CustomerProfileCustomFields'
import { useBrandCurrency } from '@/themeRuntime'

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
  membership?: {
    id: string
    card_rank_id?: string | null
    card_rank?: { id: string; code: string; name: string; discount_percent?: number | null; validity?: string; benefits?: string | null } | null
    year_spent: number
    lifetime_points: number
    rank_achieved_at?: string | null
    rank_expires_at?: string | null
  } | null
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
  onMembershipUpdated?: () => Promise<void> | void
}

export default function CustomerProfileOverviewTab({ profile, summary, branchName, fieldDefinitions, onMembershipUpdated }: Props) {
  const { format: money } = useBrandCurrency()
  const labels = useMemo(() => new Map(fieldDefinitions.map((definition) => [definition.key, definition.label])), [fieldDefinitions])
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [rankOpen, setRankOpen] = useState(false)
  const [adjustForm] = Form.useForm()
  const [rankForm] = Form.useForm()
  const ranksQuery = useGetCardRanks()
  const adjustMutation = usePostMembershipsUserIdPointsAdjust()
  const overrideMutation = usePostMembershipsUserIdRankOverride()
  const recalculateMutation = usePostMembershipsUserIdRecalculate()
  const membership = summary?.membership
  const rankRows = (ranksQuery.data?.responseData ?? (ranksQuery.data as any)?.data ?? []) as CardRank[]
  const activeRanks = Array.isArray(rankRows) ? rankRows.filter((rank) => rank.is_active !== false).sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)) : []

  const savePoints = async () => {
    try {
      const values = await adjustForm.validateFields()
      await adjustMutation.mutateAsync({ userId: profile.id, data: { delta: values.delta, reason: values.reason.trim() } })
      message.success('Đã điều chỉnh điểm')
      setAdjustOpen(false)
      adjustForm.resetFields()
      await onMembershipUpdated?.()
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      message.error(error instanceof Error ? error.message : 'Không thể điều chỉnh điểm')
    }
  }

  const saveRank = async () => {
    try {
      const values = await rankForm.validateFields()
      await overrideMutation.mutateAsync({ userId: profile.id, data: { rank_id: values.rank_id, reason: values.reason.trim() } })
      message.success('Đã gán hạng mới')
      setRankOpen(false)
      rankForm.resetFields()
      await onMembershipUpdated?.()
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      message.error(error instanceof Error ? error.message : 'Không thể gán hạng')
    }
  }

  const recalculate = async () => {
    try {
      await recalculateMutation.mutateAsync({ userId: profile.id })
      message.success('Đã tính lại hạng theo chi tiêu')
      await onMembershipUpdated?.()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể tính lại hạng')
    }
  }

  return (
    <div className="grid gap-[18px] pt-2">
      <Card
        title="Hội viên & thẻ hạng"
        extra={<Tag color="purple">{membership?.card_rank?.name || summary?.rank?.name || 'Chưa có hạng'}</Tag>}
        loading={!summary}
      >
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label="Chi tiêu trong năm">{money(membership?.year_spent ?? 0)}</Descriptions.Item>
          <Descriptions.Item label="Điểm khả dụng">{Number(membership?.lifetime_points ?? summary?.points ?? 0).toLocaleString('vi-VN')}</Descriptions.Item>
          <Descriptions.Item label="Ngày đạt hạng">{membership?.rank_achieved_at ? dayjs(membership.rank_achieved_at).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Hiệu lực">{membership?.card_rank?.validity === 'PERMANENT' ? 'Vĩnh viễn' : membership?.rank_expires_at ? `Đến ${dayjs(membership.rank_expires_at).format('DD/MM/YYYY')}` : '—'}</Descriptions.Item>
        </Descriptions>
        {membership?.card_rank?.benefits && <div className="mb-3 text-sm text-gray-600">{membership.card_rank.benefits}</div>}
        <Space wrap>
          <Can I="POINTS_ADJUST" a="MEMBERSHIP">
            <Button onClick={() => { adjustForm.resetFields(); adjustForm.setFieldsValue({ reason: '' }); setAdjustOpen(true) }}>Điều chỉnh điểm</Button>
          </Can>
          <Can I="RANK_OVERRIDE" a="MEMBERSHIP">
            <Button onClick={() => { rankForm.resetFields(); setRankOpen(true) }}>Gán hạng thủ công</Button>
          </Can>
          <Can I="RECALCULATE" a="MEMBERSHIP">
            <Button loading={recalculateMutation.isPending} onClick={() => void recalculate()}>Tính lại hạng</Button>
          </Can>
        </Space>
      </Card>

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

      <Modal title="Điều chỉnh điểm hội viên" open={adjustOpen} confirmLoading={adjustMutation.isPending} onCancel={() => setAdjustOpen(false)} onOk={() => void savePoints()} okText="Lưu" cancelText="Hủy">
        <Form form={adjustForm} layout="vertical" className="mt-3">
          <Form.Item
            name="delta"
            label="Điểm thay đổi (+ cộng, − trừ)"
            help={Number(membership?.lifetime_points ?? summary?.points ?? 0) > 0
              ? `Hiện có ${Number(membership?.lifetime_points ?? summary?.points ?? 0).toLocaleString('vi-VN')} điểm. Nhập -${Number(membership?.lifetime_points ?? summary?.points ?? 0).toLocaleString('vi-VN')} để đưa số dư về 0.`
              : 'Nhập số dương để cộng hoặc số âm để trừ.'}
            rules={[{ required: true, message: 'Nhập số điểm' }, { validator: async (_, value) => Number.isInteger(Number(value)) ? Promise.resolve() : Promise.reject(new Error('Số điểm phải là số nguyên')) }]}
          >
            <InputNumber precision={0} step={1} className="w-full" />
          </Form.Item>
          <Form.Item name="reason" label="Lý do điều chỉnh" rules={[{ validator: async (_, value) => String(value ?? '').trim() ? Promise.resolve() : Promise.reject(new Error('Nhập lý do')) }]}>
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Gán hạng thủ công" open={rankOpen} confirmLoading={overrideMutation.isPending} onCancel={() => setRankOpen(false)} onOk={() => void saveRank()} okText="Gán hạng" cancelText="Hủy">
        <Form form={rankForm} layout="vertical" className="mt-3">
          <Form.Item name="rank_id" label="Hạng thẻ" rules={[{ required: true, message: 'Chọn hạng thẻ' }]}>
            <Select options={activeRanks.map((rank) => ({ value: rank.id, label: rank.name }))} placeholder="Chọn hạng" />
          </Form.Item>
          <Form.Item name="reason" label="Lý do gán hạng" rules={[{ validator: async (_, value) => String(value ?? '').trim() ? Promise.resolve() : Promise.reject(new Error('Nhập lý do')) }]}>
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
