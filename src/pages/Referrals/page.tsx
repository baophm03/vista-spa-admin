import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { ClockCircleOutlined, EditOutlined, PayCircleOutlined, PlusOutlined, ReloadOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import type { PostReferralsBody, PutReferralsIdBody } from '@/api/models'
import {
  getGetReferralsQueryKey,
  useGetReferrals,
  usePostReferrals,
  usePutReferralsId,
} from '@/api/endpoints/membership'
import { useGetCollaborators } from '@/api/endpoints/admin'
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useGetDiscountRules } from '@/api/endpoints/settings'
import type { DiscountRule } from '@/api/models'
import ReferralModal from './components/ReferralModal'
import {
  REFERRER_TYPE_META,
  STATUS_META,
  formatVnd,
  type CustomerOption,
  type ReferralRow,
} from './components/constants'

export default function Referrals() {
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'REFERRAL')
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ReferralRow | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const listQuery = useGetReferrals()
  const rows = useMemo(() => {
    const raw = pickData<unknown>(listQuery.data)
    return (Array.isArray(raw) ? raw : (raw as { rows?: ReferralRow[] } | null)?.rows ?? []) as ReferralRow[]
  }, [listQuery.data])

  // Map tên CTV để hiển thị "người giới thiệu" khi referrer_type = COLLABORATOR
  const collaboratorsQuery = useGetCollaborators({ is_active: true })
  const collaboratorNameById = useMemo(() => {
    const raw = pickData<unknown>(collaboratorsQuery.data)
    const list = (Array.isArray(raw) ? raw : (raw as { rows?: { id: string; name: string }[] } | null)?.rows ?? []) as { id: string; name: string }[]
    return new Map(list.map((c) => [c.id, c.name]))
  }, [collaboratorsQuery.data])

  // Danh sách khách hàng — dùng cho "khách được giới thiệu" và referrer CUSTOMER
  const customersQuery = useGetCustomerProfiles({ page: 1, limit: 200 })
  const customers = useMemo(() => {
    const raw = pickData<unknown>(customersQuery.data)
    const list = (Array.isArray(raw) ? raw : (raw as { rows?: CustomerOption[] } | null)?.rows ?? []) as CustomerOption[]
    return list
  }, [customersQuery.data])
  const discountRulesQuery = useGetDiscountRules({ is_active: true, audience: 'NEW_BY_REFERRAL' })
  const discountRules = useMemo(() => pickData<DiscountRule[]>(discountRulesQuery.data) ?? [], [discountRulesQuery.data])

  const referrerTypeValue = Form.useWatch('referrer_type', form) as string | undefined

  // Tập hợp các customer_profile_id đã được giới thiệu (loại trừ khi tạo mới để tránh trùng)
  const alreadyReferredIds = useMemo(() => new Set(rows.map((r) => r.referred_profile_id)), [rows])

  const createMutation = usePostReferrals({
    mutation: {
      onSuccess: () => {
        message.success('Đã ghi nhận lượt giới thiệu')
        setOpen(false)
        form.resetFields()
        void queryClient.invalidateQueries({ queryKey: getGetReferralsQueryKey() })
      },
      onError: (err) => message.error(errorMessage(err)),
    },
  })

  const updateMutation = usePutReferralsId({
    mutation: {
      onSuccess: () => {
        message.success('Đã cập nhật lượt giới thiệu')
        setOpen(false)
        setEditing(null)
        form.resetFields()
        void queryClient.invalidateQueries({ queryKey: getGetReferralsQueryKey() })
      },
      onError: (err) => message.error(errorMessage(err)),
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ referrer_type: 'COLLABORATOR' })
    setOpen(true)
  }

  const openEdit = (row: ReferralRow) => {
    setEditing(row)
    form.setFieldsValue({
      status: row.status,
      discount_rule_id: row.discount_rule_id,
      note: row.note,
    })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (editing) {
      const data: PutReferralsIdBody = {
        status: values.status,
        discount_rule_id: values.discount_rule_id,
        note: values.note,
      }
      await updateMutation.mutateAsync({ id: editing.id, data })
    } else {
      const data: PostReferralsBody = {
        referrer_type: values.referrer_type,
        referrer_id: values.referrer_id,
        referred_profile_id: values.referred_profile_id,
        discount_rule_id: values.discount_rule_id,
        note: values.note,
      }
      await createMutation.mutateAsync({ data })
    }
  }

  const referrerLabel = (row: ReferralRow): string => {
    if (row.referrer_type === 'COLLABORATOR') {
      return collaboratorNameById.get(row.referrer_id) ?? row.referrer_id
    }
    const customer = customers.find((c) => c.id === row.referrer_id)
    return customer?.full_name || customer?.phone || row.referrer_id
  }

  // Thống kê đầu trang — tính từ danh sách referrals hiện tại (client-side, do endpoint không phân trang server)
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng lượt giới thiệu', value: rows.length.toLocaleString('vi-VN'), icon: <ShareAltOutlined />, tone: 'primary' },
    { key: 'pending', label: 'Chờ duyệt', value: rows.filter((r) => r.status === 'PENDING').length.toLocaleString('vi-VN'), icon: <ClockCircleOutlined />, tone: 'tertiary' },
    { key: 'paid', label: 'Đã chi trả', value: rows.filter((r) => r.status === 'PAID').length.toLocaleString('vi-VN'), icon: <PayCircleOutlined />, tone: 'secondary' },
  ]

  const columns: TableColumnsType<ReferralRow> = [
    {
      title: 'Khách được giới thiệu', key: 'referred',
      render: (_v, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.referred_profile?.full_name || row.referred_profile_id}</div>
          {row.referred_profile?.phone && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.referred_profile.phone}</Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: 'Người giới thiệu', key: 'referrer',
      render: (_v, row) => {
        const typeMeta = REFERRER_TYPE_META[row.referrer_type]
        return (
          <Space size={6} wrap>
            <Tag color={typeMeta?.color}>{typeMeta?.label ?? row.referrer_type}</Tag>
            <span>{referrerLabel(row)}</span>
          </Space>
        )
      },
    },
    {
      title: 'Gói mua từ giới thiệu', key: 'packages', width: 220,
      render: (_v, row) => {
        const list = row.packages ?? []
        if (list.length === 0) return <Typography.Text type="secondary">Chưa mua gói</Typography.Text>
        return (
          <Space direction="vertical" size={2}>
            {list.map((pkg) => (
              <div key={pkg.id} style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{pkg.name}</span>
                <span style={{ color: '#888', marginLeft: 6 }}>({formatVnd(pkg.total_amount)})</span>
              </div>
            ))}
          </Space>
        )
      },
    },
    {
      title: 'Hoa hồng', key: 'commission', width: 140,
      render: (_v, row) => {
        const total = row.commission_total ?? 0
        const status = row.commission_status
        if (total === 0) return <Typography.Text type="secondary">—</Typography.Text>
        return (
          <Space direction="vertical" size={0}>
            <span style={{ fontWeight: 600, color: '#389e0d' }}>{formatVnd(total)}</span>
            {status && (
              <Tag color={status === 'PAID' ? 'green' : status === 'APPROVED' ? 'blue' : 'default'} style={{ margin: 0 }}>
                {status === 'PAID' ? 'Đã chi trả' : status === 'APPROVED' ? 'Đã duyệt' : status}
              </Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Ưu đãi nhận được', key: 'discount_rule', width: 180,
      render: (_v, row) =>
        row.discount_rule
          ? <Tag color="cyan">{row.discount_rule.code} — {row.discount_rule.name}</Tag>
          : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 120,
      render: (v: string) => {
        const meta = STATUS_META[v]
        return <Tag color={meta?.color}>{meta?.label ?? v}</Tag>
      },
    },
    {
      title: 'Hành động', key: 'actions', align: 'center', width: 90, fixed: 'right',
      render: (_v, row) => (
        <RowActionsMenu
          items={[{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }]}
          onSelect={(key) => {
            if (key === 'edit') openEdit(row)
          }}
        />
      ),
    },
  ]

  return (
    <Can I="READ" a="REFERRAL" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <StatCards items={statItems} />
            <PageTitle
              subtitle="Lịch sử giới thiệu khách hàng từ CTV hoặc khách hàng khác"
              extra={
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>Tải lại</Button>
                  <Can I="CREATE" a="REFERRAL">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Ghi nhận giới thiệu</Button>
                  </Can>
                </Space>
              }
            >
              Lịch sử giới thiệu
            </PageTitle>
            {listQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                title="Không tải được lịch sử giới thiệu"
                description={errorMessage(listQuery.error)}
                action={<Button size="small" onClick={() => void listQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <Table<ReferralRow>
              rowKey="id" loading={listQuery.isLoading} dataSource={paginateRows(rows, page, 10)}
              scroll={{ x: 'max-content' }}
              columns={columns.filter((column) => column.key !== 'actions' || canUpdate)}
              pagination={false}
            />
            <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="lượt giới thiệu" />

            <ReferralModal
              open={open}
              editing={editing}
              onCancel={() => setOpen(false)}
              onSubmit={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              form={form}
              discountRulesQueryLoading={discountRulesQuery.isLoading}
              discountRules={discountRules}
              referrerTypeValue={referrerTypeValue}
              customers={customers}
              collaboratorsQueryLoading={collaboratorsQuery.isLoading}
              collaboratorNameById={collaboratorNameById}
              customersQueryLoading={customersQuery.isLoading}
              alreadyReferredIds={alreadyReferredIds}
            />
          </>
        ) : (
          <>
            <PageTitle subtitle="Theo dõi lượt giới thiệu và hoa hồng giới thiệu">Lịch sử giới thiệu</PageTitle>
            <Alert type="warning" showIcon title="Bạn không có quyền xem lịch sử giới thiệu (cần quyền referral.read)" />
          </>
        )
      }
    </Can>
  )
}
