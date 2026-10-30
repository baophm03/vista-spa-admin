import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckCircleOutlined, EditOutlined, PauseCircleOutlined, PercentageOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Can, useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import {
  getGetCommissionRulesQueryKey,
  useDeleteCommissionRulesId,
  useGetCommissionRules,
  usePostCommissionRules,
  usePutCommissionRulesId,
} from '@/api/endpoints/commissions'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetService } from '@/api/endpoints/services'
import { useGetUsers } from '@/api/endpoints/users'
import type { Branch, CommissionRule, CommissionRulePayeeType, PostCommissionRulesBody, Service, User } from '@/api/models'

type PayeeType = CommissionRulePayeeType

const PAYEE_META: Record<PayeeType, { label: string; color: string }> = {
  STAFF: { label: 'KTV', color: 'blue' },
  COLLABORATOR: { label: 'Cộng tác viên', color: 'purple' },
  CUSTOMER_REFERRER: { label: 'Khách giới thiệu', color: 'geekblue' },
}

const BASE_OPTIONS = [
  { value: 'PAYMENT', label: 'Trên thanh toán' },
  { value: 'SESSION_VALUE', label: 'Trên giá trị buổi' },
]

type CommissionColumnKey = 'name' | 'payee_type' | 'base' | 'percent' | 'scope' | 'priority' | 'validity' | 'is_active'

const COMMISSION_COLUMN_OPTIONS: { label: string; value: CommissionColumnKey }[] = [
  { label: 'Tên quy tắc', value: 'name' },
  { label: 'Người nhận', value: 'payee_type' },
  { label: 'Căn tính', value: 'base' },
  { label: '% hoa hồng', value: 'percent' },
  { label: 'Phạm vi', value: 'scope' },
  { label: 'Ưu tiên', value: 'priority' },
  { label: 'Hạn', value: 'validity' },
  { label: 'Trạng thái', value: 'is_active' },
]

const DEFAULT_VISIBLE_COLUMNS = COMMISSION_COLUMN_OPTIONS.map((column) => column.value)

export default function CommissionRules() {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CommissionRule | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<CommissionColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<CommissionColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const ability = useAbility()
  const canManage = ability.can('RULE_MANAGE', 'COMMISSION')

  const rulesQuery = useGetCommissionRules()
  const branchesQuery = useGetBranches({ status: 'active' })
  const servicesQuery = useGetService({ page: 1, limit: 200, is_active: true })
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const rules = useMemo(() => {
    const raw = pickData<CommissionRule[]>(rulesQuery.data)
    return Array.isArray(raw) ? raw : []
  }, [rulesQuery.data])
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const services = (pickData<{ services?: Service[] } | undefined>(servicesQuery.data)?.services ?? []) as Service[]
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? []) as User[]
  const payeeType = Form.useWatch('payee_type', form) as PayeeType | undefined
  const branchNameById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches])
  const serviceNameById = useMemo(() => new Map(services.map((service) => [service.id, service.title])), [services])
  const userNameById = useMemo(() => new Map(users.map((user) => [user.id, user.zalo_name || user.email || user.id])), [users])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCommissionRulesQueryKey() })
  }

  // Thống kê đầu trang — rules là danh sách đầy đủ client-side (query không có bộ lọc server)
  const activeRuleCount = rules.filter((row) => row.is_active !== false).length
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng quy tắc', value: rules.length.toLocaleString('vi-VN'), icon: <PercentageOutlined />, tone: 'primary' },
    { key: 'active', label: 'Đang áp dụng', value: activeRuleCount.toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
  ]

  const createMutation = usePostCommissionRules({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutCommissionRulesId({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteCommissionRulesId({ mutation: { onSuccess: invalidate } })

  const openEditor = (row?: CommissionRule) => {
    setEditing(row ?? null)
    form.setFieldsValue(
      row
        ? {
            name: row.name,
            payee_type: row.payee_type,
            base: row.base ?? (row.payee_type === 'STAFF' ? 'SESSION_VALUE' : 'PAYMENT'),
            percent: row.percent ?? undefined,
            priority: row.priority ?? 0,
            service_id: row.service_id ?? undefined,
            staff_id: row.staff_id ?? undefined,
            branch_id: row.branch_id ?? undefined,
            valid_range: row.valid_from || row.valid_to
              ? [row.valid_from ? dayjs(row.valid_from) : null, row.valid_to ? dayjs(row.valid_to) : null]
              : undefined,
            is_active: row.is_active ?? true,
          }
        : { name: '', payee_type: 'STAFF', base: 'SESSION_VALUE', percent: undefined, priority: 0, is_active: true },
    )
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto: PostCommissionRulesBody = {
        name: values.name,
        payee_type: values.payee_type,
        base: values.base,
        percent: values.percent ?? null,
        priority: values.priority ?? 0,
        is_active: !!values.is_active,
        valid_from: values.valid_range?.[0]?.format('YYYY-MM-DD') ?? undefined,
        valid_to: values.valid_range?.[1]?.format('YYYY-MM-DD') ?? undefined,
        service_id: values.service_id || undefined,
        staff_id: values.staff_id || undefined,
        branch_id: values.branch_id || undefined,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id!, data: dto })
        message.success('Đã cập nhật quy tắc hoa hồng')
      } else {
        await createMutation.mutateAsync({ data: dto })
        message.success('Đã tạo quy tắc hoa hồng')
      }
      setOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const remove = async (row: CommissionRule) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id! })
      message.success(`Đã ngừng quy tắc "${row.name}"`)
    } catch (err) {
      message.error(errorMessage(err, 'Không ngừng được quy tắc'))
    }
  }

  const columns: TableColumnsType<CommissionRule> = ([
    {
      key: 'name',
      title: 'Tên quy tắc', dataIndex: 'name', width: 200, ellipsis: true,
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      key: 'payee_type',
      title: 'Người nhận', dataIndex: 'payee_type', width: 150,
      render: (v: PayeeType) => {
        const meta = PAYEE_META[v]
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    { key: 'base', title: 'Căn tính', dataIndex: 'base', width: 150, render: (v?: string) => BASE_OPTIONS.find((o) => o.value === v)?.label ?? '—' },
    { key: 'percent', title: '% hoa hồng', dataIndex: 'percent', width: 100, align: 'right', render: (v?: number) => (v != null ? `${v}%` : '—') },
    {
      key: 'scope',
      title: 'Phạm vi', width: 170,
      render: (_v, row) => {
        const parts: string[] = []
        if (row.service_id) parts.push(serviceNameById.get(row.service_id) ?? 'Theo dịch vụ')
        if (row.staff_id) parts.push(userNameById.get(row.staff_id) ?? 'Theo KTV')
        if (row.branch_id) parts.push(branchNameById.get(row.branch_id) ?? 'Theo cơ sở')
        return parts.length ? parts.join(', ') : <Tag>Toàn hệ thống</Tag>
      },
    },
    { key: 'priority', title: 'Ưu tiên', dataIndex: 'priority', width: 80, align: 'center', render: (v?: number) => v ?? 0 },
    {
      key: 'validity',
      title: 'Hạn', width: 160,
      render: (_v, row) => (row.valid_from || row.valid_to ? `${row.valid_from ?? '...'} → ${row.valid_to ?? '...'}` : 'Không giới hạn'),
    },
    {
      key: 'is_active',
      title: 'Trạng thái', dataIndex: 'is_active', width: 110,
      render: (v?: boolean) => (v !== false ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã ngừng</Tag>),
    },
    {
      key: 'actions',
      title: 'Hành động', width: 190, fixed: 'right',
      render: (_v, row) => (
        <RowActionsMenu
          items={[
            { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
            { key: 'deactivate', icon: <PauseCircleOutlined />, danger: true, label: 'Ngừng' },
          ]}
          onSelect={(key) => {
            if (key === 'edit') openEditor(row)
            else if (key === 'deactivate') {
              Modal.confirm({
                title: 'Ngừng quy tắc này?',
                content: 'Quy tắc sẽ không áp dụng cho giao dịch mới; bút toán đã sinh không đổi.',
                okText: 'Ngừng',
                okButtonProps: { danger: true },
                cancelText: 'Hủy',
                onOk: () => remove(row),
              })
            }
          }}
        />
      ),
    },
  ] as TableColumnsType<CommissionRule>).filter((column) =>
    (column.key !== 'actions' || canManage) &&
    (column.key === 'actions' || visibleColumns.includes(column.key as CommissionColumnKey)),
  )

  return (
    <Can I="RULE_MANAGE" a="COMMISSION" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <StatCards items={statItems} />
            <PageTitle
            subtitle="Quy tắc tính hoa hồng cho nhân viên và cộng tác viên"
              extra={
                <Space wrap>
                  <Button icon={<ReloadOutlined />} onClick={() => void rulesQuery.refetch()}>Tải lại</Button>
                  <ListFilterPopover
                    open={filterOpen}
                    onOpenChange={setFilterOpen}
                    activeFilterCount={0}
                    onApply={() => {
                      if (draftVisibleColumns.length === 0) {
                        message.error('Hãy giữ lại ít nhất một cột hiển thị')
                        return
                      }
                      setVisibleColumns(draftVisibleColumns)
                      setFilterOpen(false)
                    }}
                    onClear={() => {
                      setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
                      setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
                    }}
                    columnOptions={COMMISSION_COLUMN_OPTIONS}
                    draftVisibleColumns={draftVisibleColumns}
                    onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as CommissionColumnKey[])}
                  />
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm quy tắc</Button>
                </Space>
              }
            >
              Quy tắc hoa hồng
            </PageTitle>
            {rulesQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                message="Không tải được quy tắc hoa hồng"
                description={errorMessage(rulesQuery.error)}
                action={<Button size="small" onClick={() => void rulesQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              message="Hoa hồng tự động chỉ chạy khi bật cấu hình commission.auto_enabled. Rule cụ thể hơn (theo dịch vụ/KTV/cơ sở) được ưu tiên, rồi đến mức ưu tiên."
            />
            <Table<CommissionRule>
              rowKey="id" loading={rulesQuery.isLoading} dataSource={paginateRows(rules, page, 10)} columns={columns}
              scroll={{ x: 1310 }}
              pagination={false}
            />
            <ListPagination page={page} limit={10} total={rules.length} onChange={setPage} noun="quy tắc hoa hồng" />
            <Modal
              title={editing ? `Sửa quy tắc: ${editing.name}` : 'Thêm quy tắc hoa hồng'}
              open={open}
              onCancel={() => setOpen(false)}
              onOk={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              okText="Lưu" cancelText="Hủy"
              width={680}
            >
              <Form
                form={form}
                layout="vertical"
                style={{ marginTop: 12 }}
                onValuesChange={(changed) => {
                  if (changed.payee_type) {
                    form.setFieldValue('base', changed.payee_type === 'STAFF' ? 'SESSION_VALUE' : 'PAYMENT')
                    if (changed.payee_type !== 'STAFF') form.setFieldValue('staff_id', undefined)
                  }
                }}
              >
                <Form.Item name="name" label="Tên quy tắc" rules={[{ required: true, message: 'Nhập tên quy tắc' }]}>
                  <Input maxLength={150} placeholder="VD: Hoa hồng KTV dịch vụ mặt" />
                </Form.Item>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="payee_type" label="Người nhận" rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Select options={Object.entries(PAYEE_META).map(([value, meta]) => ({ value, label: meta.label }))} />
                  </Form.Item>
                  <Form.Item name="base" label="Căn tính" rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Select
                      options={BASE_OPTIONS.filter((option) => option.value === (payeeType === 'STAFF' ? 'SESSION_VALUE' : 'PAYMENT'))}
                    />
                  </Form.Item>
                  <Form.Item name="percent" label="% hoa hồng" extra="Để trống nếu chưa có tỷ lệ cố định." style={{ flex: 1 }}>
                    <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} placeholder="Không tự động tính" />
                  </Form.Item>
                </Space>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="service_id" label="Dịch vụ (không bắt buộc)" style={{ flex: 1 }}>
                    <Select allowClear showSearch optionFilterProp="label" loading={servicesQuery.isLoading} placeholder="Tất cả dịch vụ"
                      options={services.map((service) => ({ value: service.id, label: service.title }))} />
                  </Form.Item>
                  {payeeType === 'STAFF' && (
                    <Form.Item name="staff_id" label="KTV (không bắt buộc)" style={{ flex: 1 }}>
                      <Select allowClear showSearch optionFilterProp="label" loading={usersQuery.isLoading} placeholder="Tất cả KTV"
                        options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))} />
                    </Form.Item>
                  )}
                  <Form.Item name="branch_id" label="Cơ sở (không bắt buộc)" style={{ flex: 1 }}>
                    <Select allowClear showSearch optionFilterProp="label" loading={branchesQuery.isLoading} placeholder="Toàn hệ thống"
                      options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
                  </Form.Item>
                </Space>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="priority" label="Mức ưu tiên" style={{ flex: 1 }} extra="Số càng cao càng ưu tiên khi nhiều rule khớp">
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="valid_range" label="Hạn áp dụng" style={{ flex: 2 }}>
                    <DatePicker.RangePicker allowEmpty={[true, true]} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
                <Form.Item name="is_active" label="Đang dùng" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Form>
            </Modal>
          </>
        ) : (
          <>
            <PageTitle subtitle="Quy tắc tính hoa hồng cho nhân viên và cộng tác viên">Quy tắc hoa hồng</PageTitle>
            <Alert type="warning" showIcon message="Bạn không có quyền quản lý quy tắc hoa hồng (cần quyền commission.rule_manage)" />
          </>
        )
      }
    </Can>
  )
}
