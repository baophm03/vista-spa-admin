import ResponsiveTable from '@/components/base/ResponsiveTable'
import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Form, Modal, Select, Tag, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { isTechnicianUser, type UserWithRoleAssignments } from '@/utils/userRoles'
import { errorMessage, pickData } from '@/api/helpers'
import { getGetCommissionRulesAdminQueryKey, useDeleteCommissionRulesIdAdmin, useGetCommissionRulesAdmin, usePostCommissionRulesAdmin, usePutCommissionRulesIdAdmin } from '@/api/endpoints/commissions'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import { useGetUsersCustomersAdmin } from '@/api/endpoints/customers'
import type { Branch, CommissionRule, User } from '@/api/models'
import CommissionRuleModal, { type RateType } from './components/CommissionRuleModal'
import { PAYEE_META, ruleTypeMeta } from './components/constants'

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

export default function CommissionRulesPanel() {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CommissionRule | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const ability = useAbility()
  const canManage = ability.can('RULE_MANAGE', 'COMMISSION')

  const branchesQuery = useGetBranchesAdmin({ status: 'active' })
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const [selectedBranchId, setSelectedBranchId] = useState<string>()

  // Mặc định chọn cơ sở đầu tiên khi tải xong
  useEffect(() => {
    if (!selectedBranchId && branches.length) setSelectedBranchId(branches[0]!.id)
  }, [branches, selectedBranchId])

  const rulesQuery = useGetCommissionRulesAdmin(
    selectedBranchId ? { branch_id: selectedBranchId } : undefined,
    { query: { enabled: !!selectedBranchId } },
  )
  const usersQuery = useGetUsersAdmin({ currentPage: 1, pageSize: 200, has_role: true })
  const customersQuery = useGetUsersCustomersAdmin({ page: 1, limit: 500 } as never)
  const rules = useMemo(() => {
    const raw = pickData<CommissionRule[]>(rulesQuery.data)
    return Array.isArray(raw) ? raw : []
  }, [rulesQuery.data])
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? []) as (User & UserWithRoleAssignments)[]
  const technicians = useMemo(() => users.filter(isTechnicianUser), [users])
  const customers = ((pickData<User[]>(customersQuery.data) ?? []) as User[]) as (User & UserWithRoleAssignments)[]

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCommissionRulesAdminQueryKey() })
  }

  const updateMutation = usePutCommissionRulesIdAdmin({ mutation: { onSuccess: invalidate } })
  const createMutation = usePostCommissionRulesAdmin({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteCommissionRulesIdAdmin({ mutation: { onSuccess: invalidate } })

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({
      name: '',
      type: undefined,
      rate_type: 'PERCENT' as RateType,
      percent: 10,
      fixed_amount: undefined,
      staff_id: undefined,
      is_active: true,
    })
    setOpen(true)
  }

  const openEditor = (row: CommissionRule) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      type: row.type ?? undefined,
      rate_type: (row.fixed_amount != null ? 'AMOUNT' : 'PERCENT') as RateType,
      percent: row.fixed_amount != null ? undefined : row.percent ?? undefined,
      fixed_amount: row.fixed_amount ?? undefined,
      staff_id: row.staff_id ?? undefined,
      is_active: row.is_active ?? true,
    })
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const rateType: RateType = values.rate_type ?? 'PERCENT'
      if (editing) {
        // Sửa: tên + giá trị + thu hẹp theo dịch vụ/người + bật/ngắt (type cố định)
        const dto = {
          name: values.name.trim(),
          percent: rateType === 'PERCENT' ? values.percent ?? null : null,
          fixed_amount: rateType === 'AMOUNT' ? values.fixed_amount ?? null : null,
          staff_id: values.staff_id || null,
          is_active: !!values.is_active,
        }
        await updateMutation.mutateAsync({ id: editing.id!, data: dto as never })
        message.success('Đã cập nhật quy tắc hoa hồng')
      } else {
        await createMutation.mutateAsync({
          data: {
            name: values.name.trim(),
            type: values.type,
            branch_id: selectedBranchId!,
            percent: rateType === 'PERCENT' ? values.percent ?? null : null,
            fixed_amount: rateType === 'AMOUNT' ? values.fixed_amount ?? null : null,
            staff_id: values.staff_id || null,
            is_active: !!values.is_active,
          } as never,
        })
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
      message.success(`Đã xóa quy tắc "${row.name}"`)
    } catch (err) {
      message.error(errorMessage(err, 'Không xóa được quy tắc'))
    }
  }

  const askDelete = (row: CommissionRule) => {
    Modal.confirm({
      title: 'Xóa quy tắc này?',
      content: `Quy tắc "${row.name}" của cơ sở đang chọn sẽ bị xóa hẳn.`,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: () => remove(row),
    })
  }

  const allColumns: TableColumnsType<CommissionRule> = [
    {
      key: 'name',
      title: 'Tên quy tắc', dataIndex: 'name', width: 220, ellipsis: true,
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      key: 'payee_role',
      title: 'Người nhận', width: 160,
      render: (_v, row) => {
        const code = String(row.payee_role?.code ?? '').toLowerCase()
        const meta = PAYEE_META[code]
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{row.payee_role?.role_name || code || '—'}</Tag>
      },
    },
    {
      key: 'type',
      title: 'Kích hoạt khi', dataIndex: 'type', width: 190,
      render: (v?: string) => {
        const meta = ruleTypeMeta(v)
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v ?? '—'}</Tag>
      },
    },
    {
      key: 'rate', title: 'Hoa hồng nhận được', width: 150, align: 'right',
      render: (_v, row) => {
        if (row.fixed_amount != null) return `${formatVnd(row.fixed_amount)}/lần`
        return row.percent != null ? `${row.percent}%` : '—'
      },
    },
    {
      key: 'is_active',
      title: 'Trạng thái', dataIndex: 'is_active', width: 110,
      render: (v?: boolean) => (v !== false ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã ngừng</Tag>),
    },
    {
      key: 'actions',
      title: 'Thao tác', align: 'center' as const, width: 144, fixed: 'right',
      render: (_v, row) => (
        <RowActionsMenu
          dropdownOnly
          items={[
            { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
            { key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' },
          ]}
          onSelect={(key) => {
            if (key === 'edit') openEditor(row)
            else if (key === 'delete') askDelete(row)
          }}
        />
      ),
    },
  ]
  const columns = allColumns.filter((column) => column.key !== 'actions' || canManage)

  return (
    <Can I="RULE_MANAGE" a="COMMISSION" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <div className="mb-4 flex items-center justify-end gap-2">
              <Select
                showSearch optionFilterProp="label"
                className="min-w-0 flex-1 md:w-[240px] md:flex-none"
                aria-label="Chọn cơ sở"
                placeholder="Chọn cơ sở"
                loading={branchesQuery.isLoading}
                value={selectedBranchId}
                onChange={(v) => { setSelectedBranchId(v); setPage(1) }}
                options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
              />
              <Can I="RULE_MANAGE" a="COMMISSION">
                <Button type="primary" className="shrink-0 px-2! md:px-4!" icon={<PlusOutlined />} onClick={openCreate}>Thêm quy tắc</Button>
              </Can>
            </div>
            {rulesQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                message="Không tải được quy tắc hoa hồng"
                description={errorMessage(rulesQuery.error)}
                action={<Button size="small" onClick={() => void rulesQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <div className="commission-list">
              <ResponsiveTable<CommissionRule>
                rowKey="id" loading={rulesQuery.isLoading} dataSource={paginateRows(rules, page, 10)} columns={columns}
                scroll={{ x: 800 }}
                pagination={false}
              />
            </div>
            <ListPagination page={page} limit={10} total={rules.length} onChange={setPage} noun="quy tắc hoa hồng" />
            <CommissionRuleModal
              open={open}
              editing={editing}
              form={form}
              saving={createMutation.isPending || updateMutation.isPending}
              users={technicians}
              usersLoading={usersQuery.isLoading}
              customers={customers}
              customersLoading={customersQuery.isLoading}
              onCancel={() => setOpen(false)}
              onSubmit={() => void submit()}
            />
          </>
        ) : (
          <Alert type="warning" showIcon message="Tài khoản của bạn chưa được cấp quyền quản lý quy tắc hoa hồng. Vui lòng liên hệ quản trị viên." />
        )
      }
    </Can>
  )
}
