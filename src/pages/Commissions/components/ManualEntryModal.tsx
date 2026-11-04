import { useMemo, useState } from 'react'
import {
  Alert,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  message,
} from 'antd'
import { errorMessage, pickData } from '@/api/helpers'
import { usePostCommissions } from '@/api/endpoints/commissions'
import { useGetCollaborators } from '@/api/endpoints/admin'
import { useGetReferrals } from '@/api/endpoints/membership'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetUsers } from '@/api/endpoints/users'
import { useGetCustomerTreatments, useGetCustomerTreatmentsIdSessions } from '@/api/endpoints/customer-treatments'
import type {
  Branch,
  Collaborator,
  CustomerTreatment,
  PostCommissionsBody,
  TreatmentSession,
  User,
} from '@/api/models'
import { PAYEE_LABEL, type PayeeType } from './constants'

type ReferralOption = {
  referrer_type: string
  referrer_id: string
  referred_profile_id: string
  status?: string
  referred_profile?: { full_name?: string; phone?: string } | null
}
type TreatmentOption = CustomerTreatment & {
  customer_profile?: { full_name?: string; phone?: string } | null
  package_type?: { name?: string } | null
}

export default function ManualEntryModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm()
  const [payeeType, setPayeeType] = useState<PayeeType>('STAFF')
  const createMutation = usePostCommissions()
  const collaboratorsQuery = useGetCollaborators({})
  const branchesQuery = useGetBranches()
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const treatmentsQuery = useGetCustomerTreatments({ page: 1, limit: 100 })
  const collaborators = useMemo(() => pickData<(Collaborator & { commission_percent?: number })[]>(collaboratorsQuery.data) ?? [], [collaboratorsQuery.data])
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? []) as User[]
  const treatments = (pickData<TreatmentOption[] | undefined>(treatmentsQuery.data) ?? []) as TreatmentOption[]
  const referralsQuery = useGetReferrals()
  const referrals = useMemo(() => pickData<ReferralOption[]>(referralsQuery.data) ?? [], [referralsQuery.data])
  const selectedCollaboratorId = Form.useWatch('collaborator_id', form)
  const selectedTreatmentId = Form.useWatch('customer_treatment_id', form) as string | undefined
  const sessionsQuery = useGetCustomerTreatmentsIdSessions(selectedTreatmentId ?? '', { query: { enabled: !!selectedTreatmentId } })
  const sessions = (pickData<TreatmentSession[] | undefined>(sessionsQuery.data) ?? []) as TreatmentSession[]
  const collaboratorReferrals = useMemo(
    () => referrals.filter((row) => row.referrer_type === 'COLLABORATOR' && row.referrer_id === selectedCollaboratorId && ['APPROVED', 'PAID'].includes(row.status ?? '')),
    [referrals, selectedCollaboratorId],
  )

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const data: PostCommissionsBody = {
        payee_type: payeeType,
        reason: values.reason,
        base_amount: values.base_amount ?? undefined,
        percent: values.percent ?? undefined,
        period_date: values.period_date?.format('YYYY-MM-DD'),
        staff_id: payeeType === 'STAFF' ? values.staff_id || undefined : undefined,
        collaborator_id: payeeType === 'COLLABORATOR' ? values.collaborator_id || undefined : undefined,
        referrer_profile_id: payeeType === 'CUSTOMER_REFERRER' ? values.referrer_profile_id || undefined : undefined,
        customer_profile_id: payeeType === 'COLLABORATOR' ? values.customer_profile_id || undefined : undefined,
        customer_treatment_id: values.customer_treatment_id || undefined,
        session_id: values.session_id || undefined,
        branch_id: values.branch_id || undefined,
        amount: values.amount ?? Math.round(Number(values.base_amount) * Number(values.percent) / 100),
      }
      await createMutation.mutateAsync({ data })
      message.success('ÄÃ£ nháº­p bÃºt toÃ¡n hoa há»“ng')
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
      title="Nháº­p hoa há»“ng tay"
      open={open}
      onCancel={onClose}
      onOk={() => void submit()}
      confirmLoading={createMutation.isPending}
      okText="LÆ°u" cancelText="Há»§y"
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 12 }}
        onValuesChange={(changed) => {
          if (Object.prototype.hasOwnProperty.call(changed, 'customer_treatment_id')) {
            const treatment = treatments.find((row) => row.id === changed.customer_treatment_id)
            form.setFieldValue('branch_id', treatment?.branch_id)
            form.setFieldValue('session_id', undefined)
          }
          if (Object.prototype.hasOwnProperty.call(changed, 'collaborator_id')) {
            const collaborator = collaborators.find((row) => row.id === changed.collaborator_id)
            form.setFieldValue('percent', collaborator?.commission_percent ?? undefined)
            form.setFieldValue('customer_profile_id', undefined)
          }
        }}
      >
        <Form.Item label="NgÆ°á»i nháº­n" required>
          <Select
            value={payeeType}
            onChange={(v) => setPayeeType(v)}
            options={Object.entries(PAYEE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Form.Item>
        {payeeType === 'STAFF' && (
          <Form.Item name="staff_id" label="KTV" rules={[{ required: true, message: 'Chá»n nhÃ¢n viÃªn' }]}>
            <Select showSearch optionFilterProp="label" loading={usersQuery.isLoading} placeholder="Chá»n KTV"
              options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))} />
          </Form.Item>
        )}
        {payeeType === 'COLLABORATOR' && (
          <>
            <Form.Item name="collaborator_id" label="Cá»™ng tÃ¡c viÃªn" rules={[{ required: true, message: 'Chá»n cá»™ng tÃ¡c viÃªn' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                loading={collaboratorsQuery.isLoading}
                placeholder="Chá»n cá»™ng tÃ¡c viÃªn"
                options={collaborators.map((row) => ({
                  value: row.id,
                  label: `${row.name} Â· ${row.referral_code}${row.commission_percent != null ? ` Â· ${row.commission_percent}% tham kháº£o` : ''}`,
                }))}
              />
            </Form.Item>
            <Alert type="info" showIcon style={{ marginBottom: 16 }} title="% hoa há»“ng cá»§a CTV chá»‰ lÃ  má»©c tham kháº£o khi nháº­p tay; sá»‘ tiá»n váº«n do báº¡n nháº­p." />
            <Form.Item name="customer_profile_id" label="KhÃ¡ch Ä‘Æ°á»£c giá»›i thiá»‡u (náº¿u cÃ³)" extra="Gáº¯n bÃºt toÃ¡n vá»›i khÃ¡ch Ä‘á»ƒ hiá»‡n trong lá»‹ch sá»­ giá»›i thiá»‡u.">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={!selectedCollaboratorId}
                loading={referralsQuery.isLoading}
                placeholder="Chá»n khÃ¡ch Ä‘Æ°á»£c CTV nÃ y giá»›i thiá»‡u"
                options={collaboratorReferrals.map((row) => ({
                  value: row.referred_profile_id,
                  label: [row.referred_profile?.full_name, row.referred_profile?.phone].filter(Boolean).join(' Â· ') || row.referred_profile_id,
                }))}
              />
            </Form.Item>
          </>
        )}
        {payeeType === 'CUSTOMER_REFERRER' && (
          <Form.Item name="referrer_profile_id" label="ID há»“ sÆ¡ khÃ¡ch giá»›i thiá»‡u" rules={[{ required: true, message: 'Nháº­p ID há»“ sÆ¡ khÃ¡ch' }]}>
            <Input placeholder="UUID cá»§a há»“ sÆ¡ khÃ¡ch" />
          </Form.Item>
        )}
        <Form.Item name="customer_treatment_id" label="HÃ³a Ä‘Æ¡n / gÃ³i Ä‘iá»u trá»‹ liÃªn quan">
          <Select allowClear showSearch optionFilterProp="label" loading={treatmentsQuery.isLoading} placeholder="TÃ¹y chá»n: chá»n gÃ³i Ä‘á»ƒ liÃªn káº¿t bÃºt toÃ¡n"
            options={treatments.map((treatment) => ({
              value: treatment.id,
              label: [treatment.customer_profile?.full_name, treatment.customer_profile?.phone, treatment.package_type?.name || (treatment.package_snapshot as Record<string, unknown> | undefined)?.name]
                .filter(Boolean).join(' Â· ') || treatment.id,
            }))} />
          </Form.Item>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="branch_id" label="Chi nhÃ¡nh" style={{ flex: 1 }}>
            <Select allowClear showSearch optionFilterProp="label" loading={branchesQuery.isLoading} placeholder="Tá»± láº¥y theo buá»•i/gÃ³i náº¿u cÃ³"
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
          </Form.Item>
          <Form.Item name="session_id" label="Buá»•i liÃªn quan" style={{ flex: 1 }}>
            <Select allowClear showSearch optionFilterProp="label" disabled={!selectedTreatmentId} loading={sessionsQuery.isLoading}
              placeholder={selectedTreatmentId ? 'Chá»n buá»•i Ä‘iá»u trá»‹' : 'Chá»n gÃ³i Ä‘iá»u trá»‹ trÆ°á»›c'}
              options={sessions.map((session) => ({ value: session.id, label: `Buá»•i ${session.session_no} Â· ${session.status ?? 'â€”'}` }))} />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item
            name="amount" label="Sá»‘ tiá»n hoa há»“ng (â‚«)" style={{ flex: 1 }}
            rules={[{
              validator: (_rule, value) => {
                const base = form.getFieldValue('base_amount')
                const percent = form.getFieldValue('percent')
                if ((value != null && Number(value) > 0) || (base != null && percent != null && Number(base) >= 0 && Number(percent) > 0)) return Promise.resolve()
                return Promise.reject(new Error('Nháº­p sá»‘ tiá»n hoáº·c Ä‘á»§ doanh sá»‘ vÃ  tá»· lá»‡ %'))
              },
            }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="period_date" label="Ká»³" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="base_amount" label="Doanh sá»‘ tham chiáº¿u (â‚«)" style={{ flex: 1 }}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="percent" label="Tá»· lá»‡ (%)" style={{ flex: 1 }}>
            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item name="reason" label="LÃ½ do / ghi chÃº" rules={[{ required: true, message: 'Nháº­p lÃ½ do' }]}>
          <Input.TextArea rows={2} placeholder="VD: Hoa há»“ng bÃ¡n gÃ³i thÃ¢n thiáº¿t thÃ¡ng 10" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
