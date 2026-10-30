import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
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
import type { PostReferralsBody, PutReferralsIdBody, Referral } from '@/api/models'
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

const REFERRER_TYPES = ['COLLABORATOR', 'CUSTOMER'] as const

const REFERRER_TYPE_META: Record<string, { label: string; color: string }> = {
  COLLABORATOR: { label: 'Cộng tác viên', color: 'blue' },
  CUSTOMER: { label: 'Khách hàng', color: 'green' },
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ duyệt', color: 'gold' },
  APPROVED: { label: 'Đã duyệt', color: 'blue' },
  REJECTED: { label: 'Từ chối', color: 'red' },
  PAID: { label: 'Đã chi trả', color: 'green' },
}

const STATUS_KEYS = Object.keys(STATUS_META)

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

/** Hàng trả về có thêm `referred_profile` (include ở BE) — model gen chưa khai báo. */
type ReferralRow = Referral & {
  referred_profile?: { id?: string; full_name?: string; phone?: string; customer_code?: string } | null
  discount_rule?: { id?: string; code?: string; name?: string } | null
  packages?: { id: string; name: string; total_amount: number; status?: string }[]
  commission_entries?: { id: string; amount: number; status?: string; mode?: string; period_date?: string }[]
  commission_total?: number
  commission_status?: string
}

type CustomerOption = { id: string; full_name?: string; phone?: string; customer_code?: string }

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
  const discountRules = useMemo(() => discountRulesQuery.data?.responseData ?? [], [discountRulesQuery.data])
  const alreadyReferredIds = useMemo(() => new Set(rows.map((row) => row.referred_profile_id)), [rows])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetReferralsQueryKey() })
  }

  // Thống kê đầu trang — rows là danh sách đầy đủ client-side (query không có bộ lọc server)
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng lượt giới thiệu', value: rows.length.toLocaleString('vi-VN'), icon: <ShareAltOutlined />, tone: 'primary' },
    { key: 'pending', label: 'Chờ duyệt', value: rows.filter((row) => row.status === 'PENDING').length.toLocaleString('vi-VN'), icon: <ClockCircleOutlined />, tone: 'tertiary' },
    { key: 'paid', label: 'Đã chi trả hoa hồng', value: rows.filter((row) => row.status === 'PAID').length.toLocaleString('vi-VN'), icon: <PayCircleOutlined />, tone: 'secondary' },
  ]

  const createMutation = usePostReferrals({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutReferralsId({ mutation: { onSuccess: invalidate } })

  const referrerLabel = (row: ReferralRow): string => {
    if (row.referrer_type === 'COLLABORATOR') {
      return collaboratorNameById.get(row.referrer_id) ?? row.referrer_id
    }
    const customer = customers.find((c) => c.id === row.referrer_id)
    return customer?.full_name ?? row.referrer_id
  }

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({
      referrer_type: 'COLLABORATOR',
      referrer_id: undefined,
      referred_profile_id: undefined,
      discount_rule_id: undefined,
      note: '',
    })
    setOpen(true)
  }

  const openEdit = (row: ReferralRow) => {
    setEditing(row)
    form.setFieldsValue({
      status: row.status ?? 'PENDING',
      discount_rule_id: row.discount_rule_id ?? undefined,
      note: row.note ?? '',
    })
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          data: {
            status: values.status,
            discount_rule_id: values.discount_rule_id ?? null,
            note: values.note || undefined,
          } satisfies PutReferralsIdBody,
        })
        message.success('Đã cập nhật giới thiệu')
      } else {
        if (!values.referrer_id) {
          message.error('Chọn người giới thiệu')
          return
        }
        await createMutation.mutateAsync({
          data: {
            referrer_type: values.referrer_type,
            referrer_id: values.referrer_id,
            referred_profile_id: values.referred_profile_id,
            discount_rule_id: values.discount_rule_id || undefined,
            note: values.note || undefined,
          } satisfies PostReferralsBody,
        })
        message.success('Đã ghi nhận giới thiệu')
      }
      setOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const columns: TableColumnsType<ReferralRow> = [
    {
      title: 'Người giới thiệu', key: 'referrer',
      render: (_v, row) => <span style={{ fontWeight: 500 }}>{referrerLabel(row)}</span>,
    },
    {
      title: 'Loại', dataIndex: 'referrer_type', width: 130,
      render: (v?: string) => {
        const meta = v ? REFERRER_TYPE_META[v] : undefined
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v || '—'}</Tag>
      },
    },
    {
      title: 'Khách được giới thiệu', key: 'referred',
      render: (_v, row) => {
        const p = row.referred_profile
        if (!p?.full_name) return <Typography.Text type="secondary">{row.referred_profile_id}</Typography.Text>
        return (
          <Space size={4}>
            <span>{p.full_name}</span>
            {p.phone && <Typography.Text type="secondary">({p.phone})</Typography.Text>}
          </Space>
        )
      },
    },
    {
      title: 'Ngày', dataIndex: 'created_at', width: 120,
      render: (v?: string) => (v ? new Date(v).toLocaleDateString('vi-VN') : '—'),
    },
    {
      title: 'Ưu đãi', key: 'discount_rule', width: 180,
      render: (_v, row) => row.discount_rule?.name ?? discountRules.find((rule: DiscountRule) => rule.id === row.discount_rule_id)?.name ?? '—',
    },
    {
      title: 'Gói đã mua', key: 'packages', width: 220,
      render: (_v, row) => row.packages?.length
        ? <Space direction="vertical" size={0}>{row.packages.map((pkg) => <span key={pkg.id}>{pkg.name} · {formatVnd(pkg.total_amount)}</span>)}</Space>
        : <Typography.Text type="secondary">Chưa mua gói</Typography.Text>,
    },
    {
      title: 'Trạng thái giới thiệu', dataIndex: 'status', width: 140,
      render: (v?: string) => {
        const meta = v ? STATUS_META[v] : undefined
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v || '—'}</Tag>
      },
    },
    {
      title: 'Hoa hồng đã ghi nhận', key: 'commission_total', width: 160, align: 'right',
      render: (_v, row) => formatVnd(row.commission_total),
    },
    {
      title: 'Trạng thái hoa hồng', dataIndex: 'commission_status', width: 145,
      render: (v?: string) => {
        if (v === 'ACTIVE') return <Tag color="green">Đã ghi nhận</Tag>
        if (v === 'VOID') return <Tag color="red">Đã hủy</Tag>
        if (v === 'CANCELLED') return <Tag>Đã hủy</Tag>
        return <Tag>Chưa ghi nhận</Tag>
      },
    },
    {
      title: 'Ghi chú', dataIndex: 'note', ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      key: 'actions', title: 'Hành động', width: 140, fixed: 'right' as const,
      render: (_v, row) => (
        <RowActionsMenu
          items={canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []}
          onSelect={(key) => {
            if (key === 'edit') openEdit(row)
          }}
        />
      ),
    },
  ]

  const referrerTypeValue = Form.useWatch('referrer_type', form)

  return (
    <Can I="READ" a="REFERRAL" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <StatCards items={statItems} />
            <PageTitle
            subtitle="Theo dõi lượt giới thiệu và hoa hồng giới thiệu"
              extra={
                <Space wrap>
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
              columns={columns.filter((column) => column.key !== 'actions' || canUpdate)}
              pagination={false}
            />
            <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="lượt giới thiệu" />
            <Modal
              title={editing ? 'Sửa giới thiệu' : 'Ghi nhận giới thiệu'}
              open={open}
              onCancel={() => setOpen(false)}
              onOk={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              okText="Lưu" cancelText="Hủy"
            >
              <Form form={form} layout="vertical">
                {editing ? (
                  <>
                    <Form.Item name="status" label="Trạng thái" rules={[{ required: true, message: 'Chọn trạng thái' }]}>
                      <Select options={STATUS_KEYS.map((s) => ({ value: s, label: STATUS_META[s].label }))} />
                    </Form.Item>
                    <Form.Item name="discount_rule_id" label="Ưu đãi khách được giới thiệu">
                      <Select allowClear placeholder="Chọn ưu đãi (không bắt buộc)" loading={discountRulesQuery.isLoading}
                        options={discountRules.map((rule: DiscountRule) => ({ value: rule.id, label: `${rule.code} — ${rule.name}` }))} />
                    </Form.Item>
                    <Form.Item name="note" label="Ghi chú">
                      <Input.TextArea rows={3} maxLength={2000} />
                    </Form.Item>
                  </>
                ) : (
                  <>
                    <Form.Item name="referrer_type" label="Loại người giới thiệu" rules={[{ required: true, message: 'Chọn loại' }]}>
                      <Select
                        options={REFERRER_TYPES.map((t) => ({ value: t, label: REFERRER_TYPE_META[t].label }))}
                        onChange={() => form.setFieldValue('referrer_id', undefined)}
                      />
                    </Form.Item>
                    <Form.Item
                      name="referrer_id" label={referrerTypeValue === 'CUSTOMER' ? 'Khách giới thiệu' : 'Cộng tác viên giới thiệu'}
                      rules={[{ required: true, message: 'Chọn người giới thiệu' }]}
                    >
                      {referrerTypeValue === 'CUSTOMER' ? (
                        <Select
                          showSearch optionFilterProp="label" placeholder="Chọn khách hàng"
                          options={customers.map((c) => ({
                            value: c.id,
                            label: [c.full_name, c.phone].filter(Boolean).join(' — ') || c.id,
                          }))}
                        />
                      ) : (
                        <Select
                          showSearch optionFilterProp="label" placeholder="Chọn cộng tác viên"
                          loading={collaboratorsQuery.isLoading}
                          options={[...collaboratorNameById.entries()].map(([value, label]) => ({ value, label }))}
                        />
                      )}
                    </Form.Item>
                    <Form.Item
                      name="referred_profile_id" label="Khách được giới thiệu"
                      rules={[{ required: true, message: 'Chọn khách được giới thiệu' }]}
                      extra="Mỗi khách chỉ được ghi nhận 1 lượt giới thiệu"
                    >
                      <Select
                        showSearch optionFilterProp="label" placeholder="Chọn khách hàng"
                        loading={customersQuery.isLoading}
                        options={customers.filter((c) => !alreadyReferredIds.has(c.id)).map((c) => ({
                          value: c.id,
                          label: [c.full_name, c.phone].filter(Boolean).join(' — ') || c.id,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item name="discount_rule_id" label="Ưu đãi khách được giới thiệu">
                      <Select allowClear placeholder="Chọn ưu đãi (không bắt buộc)" loading={discountRulesQuery.isLoading}
                        options={discountRules.map((rule: DiscountRule) => ({ value: rule.id, label: `${rule.code} — ${rule.name}` }))} />
                    </Form.Item>
                    <Form.Item name="note" label="Ghi chú">
                      <Input.TextArea rows={3} maxLength={2000} />
                    </Form.Item>
                  </>
                )}
              </Form>
            </Modal>
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
