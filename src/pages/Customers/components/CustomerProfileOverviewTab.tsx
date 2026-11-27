import CustomerRankCard from './CustomerRankCard'
import { useMemo, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Select, Skeleton, message } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { DetailCard, DetailChip, DetailField, DetailHero, DetailNote } from '@/components/base/DetailModal'
import { customerAccountLabel, customerRankName } from './customerAccount'
import dayjs from 'dayjs'
import type { Customer } from '@/api/models/customer'
import type { CardRank } from '@/api/models/cardRank'
import { Can } from '@casl/react'
import { useGetCardRanksAdmin } from '@/api/endpoints/card-ranks'
import { usePostMembershipsUserIdPointsAdjustAdmin, usePostMembershipsUserIdRankOverrideAdmin, usePostMembershipsUserIdRecalculateAdmin } from '@/api/endpoints/memberships'
import type { CustomFieldDefWithOptions } from './CustomerProfileCustomFields'
import { useBrandCurrency } from '@/themeRuntime'
import { errorMessage } from '@/api/helpers'

/** Hồ sơ khách hàng kèm dữ liệu user được include từ backend. */
export interface CustomerProfileRow extends Customer {
  /** Ảnh hệ thống (users.photo_file_id) — BE include kèm list/detail */
  photo_file_id?: string | null
  photo_file?: { id?: string; path?: string | null } | null
  /** Ảnh Zalo lưu khi khách cấp quyền trên Mini App */
  zalo_avatar?: string | null
  /** Có zalo_id = khách đã liên kết tài khoản Zalo (đăng nhập Mini App) */
  zalo_id?: string | null
  zalo_name?: string | null
  /** Hạng thành viên — BE include trực tiếp trên hồ sơ */
  membership?: { card_rank?: { name?: string } | null } | null
  user?: {
    id?: string
    email?: string | null
    zalo_name?: string | null
    zalo_avatar?: string | null
    phone?: string | null
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
  fieldDefinitions: CustomFieldDefWithOptions[]
  onMembershipUpdated?: () => Promise<void> | void
  onEdit?: (profile: CustomerProfileRow) => void
}

export default function CustomerProfileOverviewTab({ profile, summary, fieldDefinitions, onMembershipUpdated, onEdit }: Props) {
  const { format: money } = useBrandCurrency()
  const labels = useMemo(() => new Map(fieldDefinitions.map((definition) => [definition.key, definition.label])), [fieldDefinitions])
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [rankOpen, setRankOpen] = useState(false)
  const [adjustForm] = Form.useForm()
  const [rankForm] = Form.useForm()
  const ranksQuery = useGetCardRanksAdmin()
  const adjustMutation = usePostMembershipsUserIdPointsAdjustAdmin()
  const overrideMutation = usePostMembershipsUserIdRankOverrideAdmin()
  const recalculateMutation = usePostMembershipsUserIdRecalculateAdmin()
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
      message.error(errorMessage(error, 'Không thể điều chỉnh điểm'))
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
      message.error(errorMessage(error, 'Không thể gán hạng'))
    }
  }

  const recalculate = async () => {
    try {
      await recalculateMutation.mutateAsync({ userId: profile.id })
      message.success('Đã tính lại hạng theo chi tiêu')
      await onMembershipUpdated?.()
    } catch (error) {
      message.error(errorMessage(error, 'Không thể tính lại hạng'))
    }
  }

  const rankName = membership?.card_rank?.name || summary?.rank?.name || customerRankName(profile)

  const debt = Number(summary?.debt_amount ?? 0)
  const points = Number(membership?.lifetime_points ?? summary?.points ?? 0)
  const customFields = Object.entries(profile.custom_fields ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== '')

  return (
    <div className="dm-stack">
      <DetailHero
        caption="Tình trạng sử dụng"
        title={summary ? `${summary.treatments.length} gói đang dùng` : '—'}
        sub={summary ? (debt > 0 ? `Còn công nợ ${money(debt)}` : 'Không có công nợ') : 'Đang tải tổng hợp…'}
        stats={[
          {
            label: 'Buổi còn lại',
            value: !summary ? '–' : summary.remaining_sessions === null ? 'Không giới hạn' : Number(summary.remaining_sessions ?? 0).toLocaleString('vi-VN'),
          },
          { label: 'Giá trị còn lại', value: summary ? money(summary.remaining_value) : '–' },
          { label: 'Công nợ', value: summary ? money(debt) : '–', tone: debt > 0 ? 'pending' : undefined },
        ]}
      />

      <div className="dm-overview">
        <DetailCard
          title="Thông tin khách hàng"
          extra={onEdit && (
            <button type="button" className="dm-link" onClick={() => onEdit(profile)}>
              <EditOutlined /> Chỉnh sửa
            </button>
          )}
        >
          <div className="dm-grid">
            <DetailField label="Điện thoại" value={profile.phone && <a href={`tel:${profile.phone}`}>{profile.phone}</a>} emptyText="—" />
            <DetailField label="Email" value={profile.email || profile.user?.email} emptyText="—" />
            <DetailField label="Ngày sinh" value={profile.birthday ? dayjs(profile.birthday).format('DD/MM/YYYY') : undefined} emptyText="—" />
            <DetailField label="Tài khoản Zalo" value={customerAccountLabel(profile)} />
            {customFields.map(([key, value]) => (
              <DetailField
                key={key}
                label={labels.get(key) || (key === 'nghe_nghiep' ? 'Nghề nghiệp' : key)}
                value={Array.isArray(value) ? value.join(', ') : String(value)}
              />
            ))}
            <DetailField wide label="Địa chỉ" value={profile.address} emptyText="—" />
          </div>
          {profile.note && <DetailNote title="Ghi chú">{profile.note}</DetailNote>}
        </DetailCard>

        <DetailCard title="Hội viên" extra={<DetailChip tone="primary">{rankName || 'Chưa có hạng'}</DetailChip>}>
          {!summary ? <Skeleton active paragraph={{ rows: 4 }} /> : (
            <>
              <div className="dm-media">
                <CustomerRankCard
                  rankName={rankName}
                  imageFile={(rankRows.find((rank) => rank.id === membership?.card_rank_id) as any)?.image_file ?? null}
                  achievedAt={membership?.rank_achieved_at}
                  expiresAt={membership?.rank_expires_at}
                />
              </div>
              <div className="dm-grid">
                <DetailField label="Ngày đạt hạng" value={membership?.rank_achieved_at ? dayjs(membership.rank_achieved_at).format('DD/MM/YYYY') : undefined} emptyText="—" />
                <DetailField
                  label="Hiệu lực"
                  value={membership?.card_rank?.validity === 'PERMANENT' ? 'Vĩnh viễn' : membership?.rank_expires_at ? `Đến ${dayjs(membership.rank_expires_at).format('DD/MM/YYYY')}` : undefined}
                  emptyText="—"
                />
                <DetailField label="Chi tiêu trong năm" value={<span className="dm-amount">{money(membership?.year_spent ?? 0)}</span>} />
                <DetailField label="Điểm khả dụng" value={<span className="dm-amount">{points.toLocaleString('vi-VN')}</span>} />
              </div>
              {membership?.card_rank?.benefits && <DetailNote title="Quyền lợi">{membership.card_rank.benefits}</DetailNote>}
            </>
          )}
          <div className="dm-card-actions">
            <Can I="RECALCULATE" a="MEMBERSHIP">
              <Button type="text" loading={recalculateMutation.isPending} onClick={() => void recalculate()}>Tính lại hạng</Button>
            </Can>
            <Can I="RANK_OVERRIDE" a="MEMBERSHIP">
              <Button type="text" onClick={() => { rankForm.resetFields(); setRankOpen(true) }}>Gán hạng</Button>
            </Can>
            <Can I="POINTS_ADJUST" a="MEMBERSHIP">
              <Button type="primary" onClick={() => { adjustForm.resetFields(); adjustForm.setFieldsValue({ reason: '' }); setAdjustOpen(true) }}>Điều chỉnh điểm</Button>
            </Can>
          </div>
        </DetailCard>
      </div>

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

      <Modal title="Gán hạng" open={rankOpen} confirmLoading={overrideMutation.isPending} onCancel={() => setRankOpen(false)} onOk={() => void saveRank()} okText="Gán hạng" cancelText="Hủy">
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
