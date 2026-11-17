import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  message,
} from 'antd'
import { errorMessage, pickData } from '@/api/helpers'
import { usePostCommissions } from '@/api/endpoints/commissions'
import { useGetCollaborators } from '@/api/endpoints/admin'
import { useGetReferrals } from '@/api/endpoints/membership'
import { useGetUsers } from '@/api/endpoints/users'
import type { Collaborator, PostCommissionsBody, User } from '@/api/models'
import { isTechnicianUser, type UserWithRoleAssignments } from '@/utils/userRoles'

type ReferralOption = {
  id: string
  referrer_type: string
  referrer_id: string
  referred_profile_id: string
  status?: string
  referred_profile?: { full_name?: string; phone?: string } | null
  referrer_profile?: { full_name?: string; phone?: string } | null
}

/** Điền sẵn từ một lượt giới thiệu — chi trả hoa hồng không phải khai lại quan hệ. */
export type ManualEntryPrefill = {
  referral_id: string
  reason?: string
}

/**
 * Nhập tay theo đặc tả 5.27: người nhận + số tiền + lý do (bắt buộc), kỳ tùy chọn.
 * Chi nhánh/buổi/hóa đơn không nằm trong form: BE tự suy từ ngữ cảnh, hoa hồng theo
 * buổi là việc của đường tự động.
 */
export default function ManualEntryModal({ open, onClose, onDone, prefill }: { open: boolean; onClose: () => void; onDone: () => void; prefill?: ManualEntryPrefill | null }) {
  const [form] = Form.useForm()
  // Hoa hồng giới thiệu thì chọn thẳng lượt giới thiệu đã duyệt — quan hệ tự đi theo,
  // không khai lại; riêng thưởng KTV thì chọn nhân viên.
  const [payeeMode, setPayeeMode] = useState<'STAFF' | 'REFERRAL'>('STAFF')
  const createMutation = usePostCommissions()
  const collaboratorsQuery = useGetCollaborators({})
  const collaborators = useMemo(() => pickData<(Collaborator & { commission_percent?: number })[]>(collaboratorsQuery.data) ?? [], [collaboratorsQuery.data])
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true }, { query: { enabled: open } })
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? pickData<User[]>(usersQuery.data) ?? []) as (User & UserWithRoleAssignments)[]
  const technicians = useMemo(() => users.filter(isTechnicianUser), [users])
  const referralsQuery = useGetReferrals()
  const referrals = useMemo(() => pickData<ReferralOption[]>(referralsQuery.data) ?? [], [referralsQuery.data])

  // Lượt giới thiệu đã duyệt — nguồn duy nhất để gắn khoản hoa hồng giới thiệu
  const activeReferrals = useMemo(
    () => referrals.filter((row) => ['APPROVED', 'PAID'].includes(row.status ?? '')),
    [referrals],
  )
  const referrerLabelFor = (row: ReferralOption): string => {
    if (row.referrer_type === 'COLLABORATOR') {
      return collaborators.find((item) => item.id === row.referrer_id)?.name || row.referrer_id
    }
    return row.referrer_profile?.full_name || row.referrer_profile?.phone || row.referrer_id
  }
  const referralOptions = useMemo(() => activeReferrals.map((row) => ({
    value: row.id,
    label: [
      row.referred_profile?.full_name || row.referred_profile?.phone || row.referred_profile_id,
      `← ${referrerLabelFor(row)}`,
      row.referrer_type === 'COLLABORATOR' ? '· CTV' : '· Khách giới thiệu',
    ].join(' '),
  })), [activeReferrals, collaborators])
  const selectedReferralId = Form.useWatch('referral_id', form) as string | undefined
  const selectedReferral = useMemo(
    () => activeReferrals.find((row) => row.id === selectedReferralId),
    [activeReferrals, selectedReferralId],
  )

  // Mỗi lần mở form: dữ liệu cũ phải sạch; có prefill thì chọn sẵn lượt giới thiệu.
  useEffect(() => {
    if (!open) return
    form.resetFields()
    setPayeeMode(prefill ? 'REFERRAL' : 'STAFF')
    if (prefill) form.setFieldsValue({ referral_id: prefill.referral_id, reason: prefill.reason })
  }, [open, prefill, form])

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const common = {
        reason: values.reason,
        period_date: values.period_date?.format('YYYY-MM-DD'),
        amount: values.amount,
      }
      let data: PostCommissionsBody
      if (payeeMode === 'STAFF') {
        data = { ...common, payee_type: 'STAFF', staff_id: values.staff_id || undefined }
      } else {
        const ref = activeReferrals.find((row) => row.id === values.referral_id)
        if (!ref) {
          message.error('Chọn một lượt giới thiệu đã duyệt')
          return
        }
        const payee_type = ref.referrer_type === 'CUSTOMER' ? 'CUSTOMER_REFERRER' : 'COLLABORATOR'
        data = {
          ...common,
          payee_type,
          collaborator_id: payee_type === 'COLLABORATOR' ? ref.referrer_id : undefined,
          referrer_profile_id: payee_type === 'CUSTOMER_REFERRER' ? ref.referrer_id : undefined,
          customer_profile_id: ref.referred_profile_id,
        }
      }
      await createMutation.mutateAsync({ data })
      message.success('Đã nhập khoản hoa hồng')
      form.resetFields()
      onDone()
      onClose()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  return (
    <Modal
      title="Nhập hoa hồng tay"
      open={open}
      onCancel={onClose}
      onOk={() => void submit()}
      confirmLoading={createMutation.isPending}
      okText="Lưu" cancelText="Hủy"
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 12 }}
      >
        <Form.Item label="Người nhận" required>
          <Select
            value={payeeMode}
            onChange={(v) => setPayeeMode(v)}
            options={[
              { value: 'STAFF', label: 'KTV — thưởng riêng, ngoài giới thiệu' },
              { value: 'REFERRAL', label: 'Hoa hồng giới thiệu (CTV / khách)' },
            ]}
          />
        </Form.Item>
        {payeeMode === 'STAFF' && (
          <Form.Item name="staff_id" label="KTV" rules={[{ required: true, message: 'Chọn nhân viên' }]}>
            <Select showSearch optionFilterProp="label" loading={usersQuery.isLoading} placeholder="Chọn KTV"
              options={technicians.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))} />
          </Form.Item>
        )}
        {payeeMode === 'REFERRAL' && (
          <>
            <Form.Item
              name="referral_id" label="Lượt giới thiệu"
              rules={[{ required: true, message: 'Chọn lượt giới thiệu đã duyệt' }]}
              extra="Chọn thẳng một lượt trong danh sách giới thiệu — người nhận và khách được giới thiệu tự đi theo, không khai lại."
            >
              <Select
                showSearch optionFilterProp="label" loading={referralsQuery.isLoading}
                placeholder="Chọn lượt giới thiệu (đã duyệt)" options={referralOptions}
              />
            </Form.Item>
            {selectedReferral && (
              <Alert
                type="success" showIcon style={{ marginBottom: 16 }}
                title={`Người nhận: ${referrerLabelFor(selectedReferral)} — khách được giới thiệu: ${selectedReferral.referred_profile?.full_name || selectedReferral.referred_profile_id}`}
              />
            )}
          </>
        )}
        <Form.Item
          name="amount" label="Số tiền hoa hồng (₫)"
          rules={[{ required: true, message: 'Nhập số tiền hoa hồng' }]}
        >
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="period_date" label="Kỳ" extra="Bỏ trống thì tính là hôm nay — đặt lại nếu ghi nhận thưởng của kỳ trước.">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="reason" label="Lý do / ghi chú" rules={[{ required: true, message: 'Nhập lý do' }]}>
          <Input.TextArea rows={2} placeholder="VD: Thưởng giới thiệu khách Lan Ngọc theo thỏa thuận 100.000đ" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
