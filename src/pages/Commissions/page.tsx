import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType, TabsProps } from 'antd'
import { DollarOutlined, EditOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Can, useAbility } from '@casl/react'
import CommissionRulesPanel from '@/pages/CommissionRules/page'
import EditCommissionModal from './components/EditCommissionModal'
import VoidCommissionModal from './components/VoidCommissionModal'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ManualEntryModal, { type ManualEntryPrefill } from './components/ManualEntryModal'
import ReferralModal from '@/pages/Referrals/components/ReferralModal'
import ReferralsPanel from '@/pages/Referrals/page'
import {
  REFERRER_TYPE_META,
  type CustomerOption,
  type ReferralRow,
} from '@/pages/Referrals/components/constants'
import { markCommissionPayouts } from '@/api/commissionPayouts'
import { PAYEE_LABEL } from './components/constants'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { isTechnicianUser, type UserWithRoleAssignments } from '@/utils/userRoles'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import {
  getGetCommissionsQueryKey,
  getGetCommissionsSummaryQueryKey,
  useGetCommissions,
  useGetCommissionsSummary,
  usePostCommissionsIdVoid,
  usePutCommissionsId,
} from '@/api/endpoints/commissions'
import {
  getGetReferralsQueryKey,
  useGetReferrals,
  usePostReferrals,
  usePutReferralsId,
} from '@/api/endpoints/membership'
import { useGetCollaborators } from '@/api/endpoints/admin'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetUsers } from '@/api/endpoints/users'
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useGetDiscountRules } from '@/api/endpoints/settings'
import type {
  Branch,
  CommissionEntry,
  CommissionSummaryRow,
  Collaborator,
  DiscountRule,
  GetCommissionsParams,
  GetCommissionsSummaryParams,
  PostReferralsBody,
  PutReferralsIdBody,
  User,
} from '@/api/models'

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Đang hiệu lực', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
  VOID: { label: 'Đã hủy', color: 'red' },
}

const PAYOUT_STATUS_META: Record<string, { label: string; color: string }> = {
  UNPAID: { label: 'Chưa chi', color: 'gold' },
  PAID: { label: 'Đã chi', color: 'green' },
  RECONCILE: { label: 'Cần đối soát', color: 'orange' },
}

const SOURCE_LABEL: Record<string, string> = {
  PAYMENT: 'Thanh toán',
  SESSION: 'Buổi điều trị',
  MANUAL: 'Nhập tay',
}

type CommissionColumnKey =
  | 'period_date' | 'payee' | 'customer_profile' | 'source_type' | 'branch_id' | 'mode'
  | 'base' | 'percent' | 'amount' | 'reason' | 'status' | 'payout_status'

const COMMISSION_COLUMN_OPTIONS: { label: string; value: CommissionColumnKey }[] = [
  { label: 'Ngày', value: 'period_date' },
  { label: 'Người nhận', value: 'payee' },
  { label: 'Khách liên quan', value: 'customer_profile' },
  { label: 'Nguồn', value: 'source_type' },
  { label: 'Chi nhánh', value: 'branch_id' },
  { label: 'Chế độ', value: 'mode' },
  { label: 'Căn tính', value: 'base' },
  { label: '% hoa hồng', value: 'percent' },
  { label: 'Số tiền', value: 'amount' },
  { label: 'Lý do', value: 'reason' },
  { label: 'Trạng thái', value: 'status' },
  { label: 'Chi trả', value: 'payout_status' },
]

const DEFAULT_VISIBLE_COLUMNS: CommissionColumnKey[] = [
  'period_date', 'payee', 'customer_profile', 'source_type', 'amount', 'reason', 'status', 'payout_status',
]

type ManagementRow = {
  id: string
  kind: 'COMMISSION' | 'REFERRAL'
  commission?: CommissionEntryWithRelations
  referral?: ReferralRow
}

type CommissionEntryWithRelations = CommissionEntry & {
  payee_user?: Pick<User, 'zalo_name' | 'email'> | null
  collaborator?: Pick<Collaborator, 'name'> | null
  customer_profile?: { full_name?: string; phone?: string } | null
  referrer_profile?: { full_name?: string; phone?: string } | null
}

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

export default function Commissions() {
  const ability = useAbility()
  const canReadCommission = ability.can('READ', 'COMMISSION')
  const canReadReferral = ability.can('READ', 'REFERRAL')
  const canManageRules = ability.can('RULE_MANAGE', 'COMMISSION')
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') ?? ''

  const tabItems: TabsProps['items'] = [
    ...(canReadReferral ? [{ key: 'referrals', label: 'Giới thiệu', children: <ReferralsPanel /> }] : []),
    ...(canReadCommission ? [{ key: 'ledger', label: 'Sổ hoa hồng', children: <LedgerTab canReadReferral={false} canReadCommission={canReadCommission} /> }] : []),
    ...(canReadCommission ? [{ key: 'summary', label: 'Tổng hợp', children: <SummaryTab /> }] : []),
    ...(canManageRules ? [{ key: 'rules', label: 'Quy tắc', children: <CommissionRulesPanel /> }] : []),
  ]

  if (tabItems.length === 0) {
    return (
      <>
        <PageTitle>Giới thiệu & Hoa hồng</PageTitle>
        <Alert type="warning" showIcon title="Tài khoản của bạn chưa được cấp quyền xem khu vực này. Vui lòng liên hệ quản trị viên." />
      </>
    )
  }

  const normalizedRequestedTab = requestedTab === 'management' ? (canReadReferral ? 'referrals' : 'ledger') : requestedTab
  const defaultTab = tabItems.some((tab) => tab.key === normalizedRequestedTab) ? normalizedRequestedTab : tabItems[0]?.key ?? 'referrals'

  return (
    <>
      <PageTitle subtitle="Ghi nhận lượt giới thiệu, quy tắc tính và các khoản hoa hồng">Giới thiệu & Hoa hồng</PageTitle>
      <Tabs defaultActiveKey={defaultTab} items={tabItems} />
    </>
  )
}

function LedgerTab({ canReadReferral, canReadCommission }: { canReadReferral: boolean; canReadCommission: boolean }) {
  const ability = useAbility()
  const canEdit = ability.can('UPDATE', 'COMMISSION')
  const canVoid = ability.can('VOID', 'COMMISSION')
  const canUpdateReferral = ability.can('UPDATE', 'REFERRAL')
  const [filters, setFilters] = useState<GetCommissionsParams>({})
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<CommissionColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<CommissionColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualPrefill, setManualPrefill] = useState<ManualEntryPrefill | null>(null)
  const [referralOpen, setReferralOpen] = useState(false)
  const [editingReferral, setEditingReferral] = useState<ReferralRow | null>(null)
  const [editTarget, setEditTarget] = useState<CommissionEntry | null>(null)
  const [editForm] = Form.useForm()
  const [voidTarget, setVoidTarget] = useState<CommissionEntry | null>(null)
  const [voidForm] = Form.useForm()
  const [referralForm] = Form.useForm()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  const queryClient = useQueryClient()
  const referralTypeValue = Form.useWatch('referrer_type', referralForm) as string | undefined
  const branchesQuery = useGetBranches()
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const branchNameById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches])
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const collaboratorsQuery = useGetCollaborators({ is_active: true })
  const customersQuery = useGetCustomerProfiles({ page: 1, limit: 200 })
  const discountRulesQuery = useGetDiscountRules(
    { is_active: true, audience: 'NEW_BY_REFERRAL' },
    { query: { enabled: canReadReferral } },
  )

  const listQuery = useGetCommissions({ ...filters, page: 1, limit: 200 }, { query: { enabled: canReadCommission } })
  const referralQuery = useGetReferrals(undefined, { query: { enabled: canReadReferral } })
  const commissionRows = useMemo(() => pickData<CommissionEntryWithRelations[]>(listQuery.data) ?? [], [listQuery.data])
  const meta = pickMeta(listQuery.data)
  const referrals = useMemo(() => {
    const raw = pickData<unknown>(referralQuery.data)
    return (Array.isArray(raw) ? raw : (raw as { rows?: ReferralRow[] } | null)?.rows ?? []) as ReferralRow[]
  }, [referralQuery.data])
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? []) as User[]
  const collaborators = (pickData<Collaborator[] | undefined>(collaboratorsQuery.data) ?? []) as Collaborator[]
  const customers = (pickData<{ items?: Array<{ id?: string; full_name?: string }> } | undefined>(customersQuery.data)?.items
    ?? (pickData<Array<{ id?: string; full_name?: string }> | undefined>(customersQuery.data) ?? [])) as Array<{ id?: string; full_name?: string }>
  const discountRules = pickData<DiscountRule[]>(discountRulesQuery.data) ?? []
  const customerOptions = customers as CustomerOption[]
  const collaboratorNameById = useMemo(() => new Map(collaborators.map((row) => [row.id, row.name])), [collaborators])
  const alreadyReferredIds = useMemo(() => new Set(referrals.map((row) => row.referred_profile_id)), [referrals])
  const payeeName = useMemo(() => {
    const staffById = new Map(users.map((user) => [user.id, user.zalo_name || user.email || undefined]))
    const collaboratorById = new Map(collaborators.map((row) => [row.id, row.name]))
    const customerById = new Map(customers.map((row) => [row.id, row.full_name]))
    return (row: CommissionEntryWithRelations): string => {
      if (row.payee_type === 'STAFF') {
        return row.payee_user?.zalo_name || row.payee_user?.email || staffById.get(row.payee_user_id ?? row.staff_id ?? '') || '—'
      }
      if (row.payee_type === 'COLLABORATOR') {
        return row.collaborator?.name || collaboratorById.get(row.collaborator_id ?? '') || '—'
      }
      if (row.payee_type === 'CUSTOMER_REFERRER') {
        return row.referrer_profile?.full_name || row.referrer_profile?.phone || customerById.get(row.referrer_profile_id ?? '') || '—'
      }
      return '—'
    }
  }, [users, collaborators, customers])
  const referralPayeeName = (referral: ReferralRow): string => {
    if (referral.referrer_type === 'COLLABORATOR') return collaboratorNameById.get(referral.referrer_id) ?? '—'
    return referral.referrer_profile?.full_name || referral.referrer_profile?.phone || '—'
  }
  const userNameById = useMemo(() => new Map(users.map((user) => [user.id, user.zalo_name || user.email || 'Admin'])), [users])

  const referralByCommissionId = useMemo(() => {
    const result = new Map<string, ReferralRow>()
    if (!canReadReferral) return result
    for (const referral of referrals) {
      for (const entry of referral.commission_entries ?? []) result.set(entry.id, referral)
    }
    return result
  }, [canReadReferral, referrals])
  const hasCommissionSpecificFilter = Boolean(
    filters.mode || filters.status || filters.payout_status || filters.branch_id || filters.date_from || filters.date_to ||
    filters.staff_id || filters.collaborator_id || filters.customer_profile_id,
  )
  const referralOnlyRows = canReadReferral && !hasCommissionSpecificFilter
    ? referrals.filter((referral) => {
      const hasVisibleLedgerHistory = (referral.commission_entries ?? []).some((entry) => entry.status !== 'VOID')
      const matchesPayee = !filters.payee_type
        || (filters.payee_type === 'COLLABORATOR' && referral.referrer_type === 'COLLABORATOR')
        || (filters.payee_type === 'CUSTOMER_REFERRER' && referral.referrer_type === 'CUSTOMER')
      return (!canReadCommission || !hasVisibleLedgerHistory) && matchesPayee
    })
    : []
  const managementRows = useMemo<ManagementRow[]>(() => {
    const commissionItems: ManagementRow[] = commissionRows.map((commission) => ({
      id: `commission:${commission.id}`,
      kind: 'COMMISSION',
      commission,
      referral: referralByCommissionId.get(commission.id),
    }))
    const referralItems: ManagementRow[] = referralOnlyRows.map((referral) => ({
      id: `referral:${referral.id}`,
      kind: 'REFERRAL',
      referral,
    }))
    return [...commissionItems, ...referralItems].sort((a, b) => {
      const dateFor = (row: ManagementRow) => row.commission?.period_date || row.referral?.created_at || ''
      return new Date(dateFor(b)).getTime() - new Date(dateFor(a)).getTime()
    })
  }, [commissionRows, referralOnlyRows, referralByCommissionId])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCommissionsQueryKey() })
    await queryClient.invalidateQueries({ queryKey: getGetCommissionsSummaryQueryKey() })
    await queryClient.invalidateQueries({ queryKey: getGetReferralsQueryKey() })
  }

  const updateMutation = usePutCommissionsId({ mutation: { onSuccess: invalidate } })
  const voidMutation = usePostCommissionsIdVoid({ mutation: { onSuccess: invalidate } })

  const createReferralMutation = usePostReferrals({
    mutation: {
      onSuccess: () => {
        message.success('Đã ghi nhận lượt giới thiệu')
        setReferralOpen(false)
        referralForm.resetFields()
        void invalidate()
      },
      onError: (err) => message.error(errorMessage(err)),
    },
  })
  const updateReferralMutation = usePutReferralsId({
    mutation: {
      onSuccess: () => {
        message.success('Đã cập nhật lượt giới thiệu')
        setReferralOpen(false)
        setEditingReferral(null)
        referralForm.resetFields()
        void invalidate()
      },
      onError: (err) => message.error(errorMessage(err)),
    },
  })

  const openCreateReferral = () => {
    setEditingReferral(null)
    referralForm.resetFields()
    referralForm.setFieldsValue({ referrer_type: 'COLLABORATOR' })
    setReferralOpen(true)
  }

  const openEditReferral = (referral: ReferralRow) => {
    setEditingReferral(referral)
    referralForm.setFieldsValue({
      status: referral.status === 'PAID' ? undefined : referral.status,
      discount_rule_id: referral.discount_rule_id,
      note: referral.note,
    })
    setReferralOpen(true)
  }

  const submitReferral = async () => {
    try {
      const values = await referralForm.validateFields()
      if (editingReferral) {
        const data: PutReferralsIdBody = {
          status: values.status,
          discount_rule_id: values.discount_rule_id,
          note: values.note,
        }
        await updateReferralMutation.mutateAsync({ id: editingReferral.id, data })
      } else {
        const data: PostReferralsBody = {
          referrer_type: values.referrer_type,
          referrer_id: values.referrer_id,
          referred_profile_id: values.referred_profile_id,
          discount_rule_id: values.discount_rule_id,
          note: values.note,
        }
        await createReferralMutation.mutateAsync({ data })
      }
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({
      payee_type: filters.payee_type,
      mode: filters.mode,
      status: filters.status,
      payout_status: filters.payout_status,
      branch_id: filters.branch_id,
      date_range: filters.date_from || filters.date_to
        ? [filters.date_from ? dayjs(filters.date_from) : null, filters.date_to ? dayjs(filters.date_to) : null]
        : undefined,
    })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    const range = values.date_range as [Dayjs | null, Dayjs | null] | null | undefined
    const next: GetCommissionsParams = {}
    if (values.payee_type) next.payee_type = values.payee_type as GetCommissionsParams['payee_type']
    if (values.mode) next.mode = values.mode as GetCommissionsParams['mode']
    if (values.status) next.status = values.status as GetCommissionsParams['status']
    if (values.payout_status) next.payout_status = values.payout_status as GetCommissionsParams['payout_status']
    if (values.branch_id) next.branch_id = values.branch_id as string
    if (range?.[0]) next.date_from = range[0].format('YYYY-MM-DD')
    if (range?.[1]) next.date_to = range[1].format('YYYY-MM-DD')
    setFilters(next)
    setSelectedIds([])
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setFilters({})
    setSelectedIds([])
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

  const submitEdit = async () => {
    if (!editTarget) return
    try {
      const values = await editForm.validateFields()
      await updateMutation.mutateAsync({
        id: editTarget.id,
        data: { amount: values.amount ?? undefined, percent: values.percent ?? undefined, reason: values.reason },
      })
      message.success('Đã cập nhật khoản hoa hồng')
      setEditTarget(null)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const submitVoid = async () => {
    if (!voidTarget) return
    try {
      const values = await voidForm.validateFields()
      await voidMutation.mutateAsync({ id: voidTarget.id, data: { void_reason: values.void_reason } })
      message.success('Đã hủy khoản hoa hồng')
      setVoidTarget(null)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const openPayout = (ids: string[]) => {
    setSelectedIds(ids)
    payoutForm.setFieldsValue({ paid_at: dayjs(), payout_note: undefined })
    setPayoutOpen(true)
  }

  const closePayout = () => {
    setPayoutOpen(false)
    payoutForm.resetFields()
  }

  const submitPayout = async () => {
    try {
      const values = await payoutForm.validateFields()
      setPayoutLoading(true)
      await markCommissionPayouts({
        commission_entry_ids: selectedIds,
        paid_at: (values.paid_at as Dayjs).format('YYYY-MM-DD'),
        payout_note: values.payout_note,
      })
      message.success(`Đã ghi nhận chi trả ${selectedIds.length} khoản hoa hồng`)
      setSelectedIds([])
      closePayout()
      await invalidate()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      setPayoutLoading(false)
    }
  }

  const selectedRows = commissionRows.filter((row) => selectedIds.includes(row.id))
  const selectedReconcileCount = selectedRows.filter((row) => row.payout_status === 'RECONCILE').length
  const selectedPayeeKey = selectedRows[0]
    ? `${selectedRows[0].payee_type}:${selectedRows[0].payee_user_id || selectedRows[0].staff_id || selectedRows[0].collaborator_id || selectedRows[0].referrer_profile_id || ''}`
    : ''

  const columns: TableColumnsType<ManagementRow> = [
    {
      key: 'period_date', title: 'Ngày', width: 120,
      render: (_v, row) => {
        const date = row.commission?.period_date || row.referral?.created_at
        return date ? dayjs(date).format('DD/MM/YYYY') : '—'
      },
    },
    {
      key: 'payee', title: 'Người nhận', width: 190,
      render: (_v, row) => row.commission ? (
        <Space size={4}>
          {row.commission.payee_type && <Tag>{PAYEE_LABEL[row.commission.payee_type] ?? row.commission.payee_type}</Tag>}
          <span>
            {row.commission.payee_type === 'CUSTOMER_REFERRER' && row.referral
              ? referralPayeeName(row.referral)
              : payeeName(row.commission)}
          </span>
        </Space>
      ) : row.referral ? (
        <Space size={4}>
          <Tag color={REFERRER_TYPE_META[row.referral.referrer_type]?.color}>
            {REFERRER_TYPE_META[row.referral.referrer_type]?.label ?? row.referral.referrer_type}
          </Tag>
          <span>{referralPayeeName(row.referral)}</span>
        </Space>
      ) : '—',
    },
    {
      key: 'customer_profile', title: 'Khách liên quan', width: 190,
      render: (_v, row) => {
        const name = row.referral?.referred_profile?.full_name
          || row.commission?.customer_profile?.full_name
          || customers.find((customer) => customer.id === (row.commission?.customer_profile_id ?? row.referral?.referred_profile_id))?.full_name
        const phone = row.referral?.referred_profile?.phone || row.commission?.customer_profile?.phone
        return name ? (
          <Space direction="vertical" size={0}>
            <span>{name}</span>
            {phone && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{phone}</Typography.Text>}
          </Space>
        ) : '—'
      },
    },
    {
      key: 'source_type', title: 'Nguồn', width: 110,
      render: (_v, row) => {
        if (row.referral && !row.commission) return 'Giới thiệu'
        const sourceType = row.commission?.source_type ?? ''
        return (SOURCE_LABEL[sourceType] ?? sourceType) || '—'
      },
    },
    { key: 'branch_id', title: 'Chi nhánh', width: 120, render: (_v, row) => (row.commission?.branch_id ? branchNameById.get(row.commission.branch_id) ?? row.commission.branch_id : '—') },
    {
      key: 'mode', title: 'Chế độ', width: 90,
      render: (_v, row) => row.commission?.mode
        ? <Tag color={row.commission.mode === 'AUTO' ? 'blue' : 'orange'}>{row.commission.mode === 'AUTO' ? 'Tự động' : 'Nhập tay'}</Tag>
        : '—',
    },
    {
      key: 'base', title: 'Căn tính', width: 120, align: 'right',
      render: (_v, row) => row.commission?.base_amount != null ? formatVnd(row.commission.base_amount) : '—',
    },
    { key: 'percent', title: '%', width: 70, align: 'right', render: (_v, row) => row.commission?.percent != null ? `${row.commission.percent}%` : '—' },
    { key: 'amount', title: 'Số tiền', width: 120, align: 'right', render: (_v, row) => row.commission ? <span style={{ fontWeight: 500 }}>{formatVnd(row.commission.amount)}</span> : '—' },
    {
      key: 'reason', title: 'Lý do / ghi chú', width: 200,
      render: (_v, row) => {
        const commission = row.commission
        if (!commission) return row.referral?.note || '—'
        if (commission.status === 'VOID') {
          return (
            <Space direction="vertical" size={0}>
              {commission.reason && <span>{commission.reason}</span>}
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                Lý do hủy: {commission.void_reason || 'Chưa có lý do'}
              </Typography.Text>
            </Space>
          )
        }
        return commission.reason || '—'
      },
    },
    {
      key: 'status', title: 'Trạng thái khoản', width: 130,
      render: (_v, row) => {
        if (!row.commission) return '—'
        const meta = STATUS_META[row.commission.status ?? 'ACTIVE']
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{row.commission.status}</Tag>
      },
    },
    {
      key: 'payout_status', title: 'Chi trả', width: 190,
      render: (_v, row) => {
        const commission = row.commission
        if (!commission) return '—'
        if (commission.status === 'VOID') return <Tag color="red">Không chi · đã hủy</Tag>
        const status = commission.payout_status || 'UNPAID'
        const meta = PAYOUT_STATUS_META[status] || PAYOUT_STATUS_META.UNPAID
        return (
          <Space direction="vertical" size={0}>
            <Tag color={meta.color}>{meta.label}</Tag>
            {status === 'PAID' && commission.paid_at && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(commission.paid_at).format('DD/MM/YYYY')} · {commission.paid_by ? userNameById.get(commission.paid_by) ?? 'Admin' : 'Admin'}
              </Typography.Text>
            )}
            {status === 'PAID' && commission.payout_note && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{commission.payout_note}</Typography.Text>
            )}
          </Space>
        )
      },
    },
    {
      key: 'actions', title: 'Hành động', align: 'center' as const, width: 100,
      render: (_v, row) => {
        if (row.referral && !row.commission) {
          const items = [
            ...(ability.can('UPDATE', 'REFERRAL') ? [{ key: 'edit_referral', icon: <EditOutlined />, label: 'Sửa lượt giới thiệu' }] : []),
            ...(ability.can('CREATE', 'COMMISSION') && ['APPROVED', 'PAID'].includes(row.referral.status ?? '')
              ? [{ key: 'create_commission', icon: <DollarOutlined />, label: 'Tạo khoản hoa hồng' }]
              : []),
          ]
          if (!items.length) return null
          return <RowActionsMenu items={items} onSelect={(key) => {
            if (key === 'edit_referral') openEditReferral(row.referral!)
            if (key === 'create_commission') {
              setManualPrefill({
                referral_id: row.referral!.id,
                reason: row.referral!.referred_profile?.full_name ? `Thưởng giới thiệu khách ${row.referral!.referred_profile.full_name}` : undefined,
              })
              setManualOpen(true)
            }
          }} />
        }
        if (!row.commission) return null
        const commission = row.commission
        const items = [
          ...(row.referral && canUpdateReferral ? [{ key: 'edit_referral', icon: <EditOutlined />, label: 'Sửa lượt giới thiệu' }] : []),
          ...(canEdit && commission.payout_status !== 'PAID' ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa khoản hoa hồng' }] : []),
          ...(canEdit && commission.status === 'ACTIVE' && commission.payout_status !== 'PAID'
            ? [{ key: 'pay', icon: <DollarOutlined />, label: commission.payout_status === 'RECONCILE' ? 'Đối soát khoản đã chi' : 'Xác nhận đã chi' }]
            : []),
          ...(canVoid && commission.payout_status !== 'PAID' ? [{ key: 'void', icon: <StopOutlined />, label: 'Hủy khoản hoa hồng', danger: true }] : []),
          ...(commission.payout_status === 'PAID' && (canEdit || canVoid)
            ? [{ key: 'paid_info', label: 'Khoản đã chi, không thể sửa hoặc hủy', disabled: true }]
            : []),
        ]
        if (commission.status === 'VOID' || items.length === 0) return null
        return <RowActionsMenu items={items} onSelect={(key) => {
          if (key === 'edit_referral' && row.referral) {
            openEditReferral(row.referral)
          } else if (key === 'edit') {
            setEditTarget(commission)
            editForm.setFieldsValue({ amount: commission.amount, percent: commission.percent ?? undefined })
          } else if (key === 'void') {
            setVoidTarget(commission)
            voidForm.resetFields()
          } else if (key === 'pay') {
            openPayout([commission.id])
          }
        }} />
      },
    },
  ]

  return (
    <>
      <Space className="mb-4! w-full! justify-end" wrap>
        {canReadReferral && (
          <Can I="CREATE" a="REFERRAL">
            <Button icon={<PlusOutlined />} onClick={openCreateReferral}>Ghi nhận giới thiệu</Button>
          </Can>
        )}
        <ListFilterPopover
          open={filterOpen}
          onOpenChange={openFilters}
          activeFilterCount={[
            filters.payee_type,
            filters.mode,
            filters.status,
            filters.payout_status,
            filters.branch_id,
            filters.date_from,
            filters.date_to,
          ].filter(Boolean).length}
          form={filterForm}
          onApply={applyFilters}
          onClear={clearFilters}
          columnOptions={COMMISSION_COLUMN_OPTIONS}
          draftVisibleColumns={draftVisibleColumns}
          onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as CommissionColumnKey[])}
          filterItems={(
            <>
              <Form.Item name="payee_type" label="Người nhận" className="mb-2.5!">
                <Select allowClear placeholder="Tất cả" options={Object.entries(PAYEE_LABEL).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
              <Form.Item name="mode" label="Chế độ" className="mb-2.5!">
                <Select allowClear placeholder="Tất cả" options={[{ value: 'AUTO', label: 'Tự động' }, { value: 'MANUAL', label: 'Nhập tay' }]} />
              </Form.Item>
              <Form.Item name="status" label="Trạng thái" className="mb-2.5!">
                <Select allowClear placeholder="Tất cả" options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))} />
              </Form.Item>
              <Form.Item name="payout_status" label="Chi trả" className="mb-2.5!">
                <Select allowClear placeholder="Tất cả" options={Object.entries(PAYOUT_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))} />
              </Form.Item>
              <Form.Item name="branch_id" label="Chi nhánh" className="mb-2.5!">
                <Select
                  allowClear showSearch optionFilterProp="label" loading={branchesQuery.isLoading}
                  placeholder="Tất cả"
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </Form.Item>
              <Form.Item name="date_range" label="Khoảng thời gian" className="mb-0!">
                <DatePicker.RangePicker className="w-full!" placeholder={['Từ ngày', 'Đến ngày']} />
              </Form.Item>
            </>
          )}
        />
        <Can I="CREATE" a="COMMISSION">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setManualPrefill(null); setManualOpen(true) }}>Nhập hoa hồng tay</Button>
        </Can>
        {canEdit && canReadCommission && (
          <Button
            icon={<DollarOutlined />}
            disabled={selectedIds.length === 0}
            onClick={() => openPayout(selectedIds)}
          >
            Xác nhận chi ({selectedIds.length})
          </Button>
        )}
      </Space>
      {canReadCommission && listQuery.isError && (
        <Alert
          className="mb-4" type="error" showIcon
          title="Không tải được sổ hoa hồng"
          description={errorMessage(listQuery.error)}
          action={<Button size="small" onClick={() => void listQuery.refetch()}>Thử lại</Button>}
        />
      )}
      {canReadReferral && referralQuery.isError && (
        <Alert
          className="mb-4" type="error" showIcon
          title="Không tải được lượt giới thiệu"
          description={errorMessage(referralQuery.error)}
          action={<Button size="small" onClick={() => void referralQuery.refetch()}>Thử lại</Button>}
        />
      )}
      {canReadCommission && (meta?.total ?? 0) > commissionRows.length && (
        <Alert
          className="mb-4"
          type="info"
          showIcon
          title={`Đang tải ${commissionRows.length} trên ${meta?.total} khoản hoa hồng`}
          description="Hãy lọc theo người nhận hoặc thời gian để xem nhóm khoản cần xử lý."
        />
      )}
      <Table<ManagementRow>
        rowKey="id"
        scroll={{ x: 'max-content' }}
        loading={(canReadCommission && listQuery.isLoading) || (canReadReferral && referralQuery.isLoading)}
        dataSource={paginateRows(managementRows, page, 20)}
        rowSelection={canEdit && canReadCommission ? {
          selectedRowKeys: selectedIds.map((id) => `commission:${id}`),
          onChange: (keys) => setSelectedIds(keys.map(String).filter((key) => key.startsWith('commission:')).map((key) => key.slice('commission:'.length))),
          getCheckboxProps: (row) => {
            const commission = row.commission
            if (!commission) return { disabled: true }
            const payeeKey = `${commission.payee_type}:${commission.payee_user_id || commission.staff_id || commission.collaborator_id || commission.referrer_profile_id || ''}`
            return {
              disabled: commission.status !== 'ACTIVE'
                || commission.payout_status === 'PAID'
                || (!!selectedPayeeKey && selectedPayeeKey !== payeeKey),
            }
          },
        } : undefined}
        columns={columns.filter((column) =>
          (column.key !== 'actions' || canEdit || canVoid || canUpdateReferral || ability.can('CREATE', 'COMMISSION')) &&
          (column.key === 'actions' || visibleColumns.includes(column.key as CommissionColumnKey)),
        )}
        pagination={false}
      />
      <ListPagination page={page} limit={20} total={managementRows.length} onChange={(nextPage) => { setSelectedIds([]); setPage(nextPage) }} noun="dòng" />
      <ManualEntryModal
        open={manualOpen}
        prefill={manualPrefill}
        onClose={() => { setManualOpen(false); setManualPrefill(null) }}
        onDone={() => { setManualPrefill(null); void invalidate() }}
      />
      <ReferralModal
        open={referralOpen}
        editing={editingReferral}
        onCancel={() => { setReferralOpen(false); setEditingReferral(null) }}
        onSubmit={() => void submitReferral()}
        confirmLoading={createReferralMutation.isPending || updateReferralMutation.isPending}
        form={referralForm}
        discountRulesQueryLoading={discountRulesQuery.isLoading}
        discountRules={discountRules}
        referrerTypeValue={referralTypeValue}
        customers={customerOptions}
        collaboratorsQueryLoading={collaboratorsQuery.isLoading}
        collaboratorNameById={collaboratorNameById}
        customersQueryLoading={customersQuery.isLoading}
        alreadyReferredIds={alreadyReferredIds}
      />
      <EditCommissionModal
        open={!!editTarget}
        targetMode={editTarget?.mode}
        form={editForm}
        loading={updateMutation.isPending}
        onClose={() => setEditTarget(null)}
        onSubmit={() => void submitEdit()}
      />
      <VoidCommissionModal
        open={!!voidTarget}
        form={voidForm}
        loading={voidMutation.isPending}
        onClose={() => setVoidTarget(null)}
        onSubmit={() => void submitVoid()}
      />
      <Modal
        title="Xác nhận chi trả hoa hồng"
        open={payoutOpen}
        onCancel={closePayout}
        onOk={() => void submitPayout()}
        confirmLoading={payoutLoading}
        okText="Ghi nhận đã chi"
        cancelText="Hủy"
      >
        {selectedReconcileCount > 0 && (
          <Alert
            className="mb-4"
            type="warning"
            showIcon
            title="Có khoản hoa hồng cũ cần đối soát"
            description="Trước khi xác nhận, hãy kiểm tra chứng từ hoặc lịch sử chi trả. Trạng thái cũ trên lượt giới thiệu không lưu chính xác khoản nào đã được trả."
          />
        )}
        <Typography.Paragraph>
          Đang xác nhận {selectedIds.length} khoản, tổng cộng {formatVnd(selectedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0))}.
        </Typography.Paragraph>
        <Form form={payoutForm} layout="vertical">
          <Form.Item name="paid_at" label="Ngày chi" rules={[{ required: true, message: 'Chọn ngày chi' }]}>
            <DatePicker className="w-full!" format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="payout_note" label="Ghi chú / mã chứng từ">
            <Input.TextArea rows={3} maxLength={255} showCount placeholder="VD: Chuyển khoản ngày 16/11, mã giao dịch…" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function SummaryTab() {
  const [filters, setFilters] = useState<GetCommissionsSummaryParams>({ group_by: 'month' })
  const [page, setPage] = useState(1)
  const summaryQuery = useGetCommissionsSummary(filters)
  const rawRows = useMemo(() => pickData<CommissionSummaryRow[]>(summaryQuery.data) ?? [], [summaryQuery.data])
  const rows = rawRows as Array<CommissionSummaryRow & { payee_id?: string }>
  const branchesQuery = useGetBranches()
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const collaboratorsQuery = useGetCollaborators({})
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? []) as (User & UserWithRoleAssignments)[]
  const technicians = users.filter(isTechnicianUser)
  const collaborators = useMemo(() => pickData<(Collaborator & { commission_percent?: number })[]>(collaboratorsQuery.data) ?? [], [collaboratorsQuery.data])
  const staffNameById = useMemo(() => new Map(users.map((user) => [user.id, user.zalo_name || user.email || user.id])), [users])
  const collaboratorNameById = useMemo(() => new Map(collaborators.map((collaborator) => [collaborator.id, collaborator.name])), [collaborators])
  const groupBy = filters.group_by ?? 'month'

  const columns: TableColumnsType<CommissionSummaryRow & { payee_id?: string }> = [
    {
      title: 'Kỳ', dataIndex: 'period', width: 240,
      render: (v: string) => {
        const start = new Date(v)
        if (groupBy === 'day') return start.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
        if (groupBy === 'week') {
          const end = new Date(start)
          end.setDate(end.getDate() + 6)
          const dayMonth = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' })
          return `Tuần ${dayMonth.format(start)} – ${dayMonth.format(end)} ${end.getFullYear()}`
        }
        return start.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' })
      },
    },
    {
      title: 'Người nhận', key: 'payee', width: 240,
      render: (_v, row) => {
        const id = row.payee_id
        const name = row.payee_type === 'STAFF' ? staffNameById.get(id ?? '')
          : row.payee_type === 'COLLABORATOR' ? collaboratorNameById.get(id ?? '')
            : undefined
        return <Space><Tag>{row.payee_type ? PAYEE_LABEL[row.payee_type] : '—'}</Tag><span>{name || id || '—'}</span></Space>
      },
    },
    { title: 'Số khoản', dataIndex: 'entries', width: 120, align: 'right', render: (v: string | number) => Number(v).toLocaleString('vi-VN') },
    {
      title: 'Tổng hoa hồng', dataIndex: 'total_amount', width: 180, align: 'right',
      render: (v: string | number) => <span style={{ fontWeight: 500 }}>{formatVnd(Number(v))}</span>,
    },
  ]

  return (
    <>
      <Space className="mb-4! w-full!" wrap>
        <Select
          value={groupBy} className="w-[140px]!"
          options={[{ value: 'day', label: 'Theo ngày' }, { value: 'week', label: 'Theo tuần' }, { value: 'month', label: 'Theo tháng' }]}
          onChange={(v) => { setFilters((current) => ({ ...current, group_by: v })); setPage(1) }}
        />
        <Select
          allowClear placeholder="Người nhận" className="w-[170px]!"
          options={Object.entries(PAYEE_LABEL).map(([value, label]) => ({ value, label }))}
          value={filters.payee_type}
          onChange={(v) => { setFilters((current) => ({ ...current, payee_type: v, staff_id: undefined, collaborator_id: undefined })); setPage(1) }}
        />
        {filters.payee_type === 'STAFF' && (
          <Select allowClear showSearch optionFilterProp="label" placeholder="KTV" className="w-[210px]!" loading={usersQuery.isLoading}
            value={filters.staff_id} options={technicians.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))}
            onChange={(v) => { setFilters((current) => ({ ...current, staff_id: v })); setPage(1) }} />
        )}
        {filters.payee_type === 'COLLABORATOR' && (
          <Select allowClear showSearch optionFilterProp="label" placeholder="Cộng tác viên" className="w-[210px]!" loading={collaboratorsQuery.isLoading}
            value={filters.collaborator_id} options={collaborators.map((row) => ({ value: row.id, label: row.name }))}
            onChange={(v) => { setFilters((current) => ({ ...current, collaborator_id: v })); setPage(1) }} />
        )}
        <Select allowClear showSearch optionFilterProp="label" placeholder="Chi nhánh" className="w-[180px]!" loading={branchesQuery.isLoading}
          value={filters.branch_id} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          onChange={(v) => { setFilters((current) => ({ ...current, branch_id: v })); setPage(1) }} />
        <DatePicker.RangePicker onChange={(dates) => {
          setFilters((current) => ({
            ...current,
            date_from: dates?.[0]?.format('YYYY-MM-DD'),
            date_to: dates?.[1]?.format('YYYY-MM-DD'),
          })); setPage(1)
        }} />
      </Space>
      <Table<CommissionSummaryRow & { payee_id?: string }>
        rowKey={(r) => `${r.period}-${r.payee_type}-${r.payee_id ?? 'unknown'}`}
        loading={summaryQuery.isLoading} dataSource={paginateRows(rows, page, 15)} columns={columns}
        pagination={false}
      />
      <ListPagination page={page} limit={15} total={rows.length} onChange={setPage} noun="nhóm hoa hồng" />
    </>
  )
}
