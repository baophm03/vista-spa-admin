import { useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { BarChartOutlined, CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { errorMessage, pickData } from '@/api/helpers'
import type { Collaborator } from '@/api/models/collaborator'
import { getGetCollaboratorsAdminQueryKey, useDeleteCollaboratorsIdAdmin, useGetCollaboratorsAdmin, usePostCollaboratorsAdmin, usePutCollaboratorsIdAdmin } from '@/api/endpoints/collaborators'
import type { PostCollaboratorsAdminBody } from '@/api/models'
import type { GetCollaboratorsAdminParams } from '@/api/models/getCollaboratorsAdminParams'
import CollaboratorModal from './components/CollaboratorModal'
import CollaboratorReportDrawer from './components/CollaboratorReportDrawer'

const COLLABORATOR_TYPES = ['STAFF', 'CUSTOMER', 'EXTERNAL']

const TYPE_META: Record<string, { label: string; color: string }> = {
  STAFF: { label: 'Nhân viên', color: 'blue' },
  CUSTOMER: { label: 'Khách hàng', color: 'green' },
  EXTERNAL: { label: 'Bên ngoài', color: 'orange' },
}

type CollaboratorRow = Collaborator & { referral_count?: number; referral_use_count?: number; commission_percent?: number }

export default function Collaborators() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CollaboratorRow | null>(null)
  const [reportRow, setReportRow] = useState<CollaboratorRow | null>(null)
  const [listFilters, setListFilters] = useState<GetCollaboratorsAdminParams>({})
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'COLLABORATOR')
  const canDelete = ability.can('DELETE', 'COLLABORATOR')

  const listQuery = useGetCollaboratorsAdmin({ ...listFilters, page, limit } as never)
  const rows = (pickData<CollaboratorRow[] | undefined>(listQuery.data) ?? []) as CollaboratorRow[]
  const total = (listQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? rows.length
  const statsMeta = (listQuery.data as unknown as { meta?: { stats?: { total?: number; active?: number; referral_count_sum?: number } } })?.meta?.stats

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCollaboratorsAdminQueryKey() })
  }

  const createMutation = usePostCollaboratorsAdmin({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutCollaboratorsIdAdmin({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteCollaboratorsIdAdmin({ mutation: { onSuccess: invalidate } })

  const openEditor = (row?: CollaboratorRow) => {
    setEditing(row ?? null)
    form.setFieldsValue(
      row
        ? {
            name: row.name,
            phone: row.phone ?? '',
            referral_code: row.referral_code,
            type: row.type ?? undefined,
            user_id: row.user_id ?? undefined,
            customer_profile_id: row.customer_profile_id ?? undefined,
            commission_percent: row.commission_percent ?? undefined,
            note: row.note ?? '',
            is_active: row.is_active !== false,
          }
        : { name: '', phone: '', referral_code: '', type: undefined, user_id: undefined, customer_profile_id: undefined, commission_percent: undefined, note: '', is_active: true },
    )
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto: PostCollaboratorsAdminBody = {
        name: values.name,
        phone: values.phone || undefined,
        referral_code: values.referral_code,
        type: values.type || undefined,
        user_id: values.user_id || undefined,
        customer_profile_id: values.customer_profile_id || undefined,
        commission_percent: values.commission_percent ?? null,
        note: values.note || undefined,
        is_active: values.is_active !== false,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: dto })
        message.success('Đã cập nhật cộng tác viên')
      } else {
        await createMutation.mutateAsync({ data: dto })
        message.success('Đã tạo cộng tác viên')
      }
      setOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const remove = async (row: CollaboratorRow) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id })
      message.success(`Đã xóa CTV "${row.name}"`)
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setListFilters((current) => ({ ...current, q: nextKeyword.trim() || undefined }))
    setPage(1)
  }

  const applyTypeFilter = (value: string | undefined) => {
    setListFilters((current) => ({ ...current, type: value || undefined }))
    setPage(1)
  }

  // Thống kê đầu trang — lấy từ meta.stats phía server
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng cộng tác viên', value: (statsMeta?.total ?? total).toLocaleString('vi-VN'), icon: <TeamOutlined />, tone: 'primary' },
    { key: 'active', label: 'Đang hoạt động', value: (statsMeta?.active ?? 0).toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
    { key: 'referrals', label: 'Khách đã giới thiệu', value: (statsMeta?.referral_count_sum ?? 0).toLocaleString('vi-VN'), icon: <UserAddOutlined />, tone: 'tertiary' },
  ]

  const columns: TableColumnsType<CollaboratorRow> = ([
    {
      key: 'referral_code',
      title: 'Mã giới thiệu', dataIndex: 'referral_code', width: 120,
      render: (v: string) => <Typography.Text code style={{ fontSize: 12 }}>{v}</Typography.Text>,
    },
    {
      key: 'name',
      title: 'Tên', dataIndex: 'name', width: 160, ellipsis: true,
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    { key: 'phone', title: 'SĐT', dataIndex: 'phone', width: 135, render: (v?: string) => v || '—' },
    {
      key: 'type',
      title: 'Loại', dataIndex: 'type', width: 90,
      render: (v?: string) => {
        const meta = v ? TYPE_META[v] : undefined
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v || '—'}</Tag>
      },
    },
    { key: 'referral_count', title: 'Khách GT', dataIndex: 'referral_count', width: 100, align: 'right', render: (v?: number) => Number(v ?? 0).toLocaleString('vi-VN') },
    { key: 'commission_percent', title: '% hoa hồng', dataIndex: 'commission_percent', width: 100, align: 'right', render: (v?: number | null) => v != null ? `${Number(v)}%` : '—' },
    {
      key: 'note',
      title: 'Ghi chú', dataIndex: 'note', width: 180, ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      key: 'is_active',
      title: 'Trạng thái', dataIndex: 'is_active', width: 125,
      render: (v?: boolean) => (v !== false ? <Tag color="green">Đang hoạt động</Tag> : <Tag>Đã ẩn</Tag>),
    },
    {
      key: 'actions',
      title: 'Hành động', align: 'center' as const, width: 90, fixed: 'right',
      render: (_v, row) => (
        <RowActionsMenu
          items={[
            { key: 'report', icon: <BarChartOutlined />, label: 'Báo cáo' },
            ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
            ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
          ]}
          onSelect={(key) => {
            if (key === 'report') setReportRow(row)
            else if (key === 'edit') openEditor(row)
            else if (key === 'delete') {
              Modal.confirm({
                title: `Xóa CTV "${row.name}"?`,
                content: 'Xóa mềm (is_deleted). Không xóa được CTV đã phát sinh hoa hồng; ngừng hợp tác hãy dùng "Sửa" và tắt Trạng thái.',
                okText: 'Xóa',
                okButtonProps: { danger: true },
                cancelText: 'Hủy',
                onOk: () => remove(row),
              })
            }
          }}
        />
      ),
    },
  ] as TableColumnsType<CollaboratorRow>)

  return (
    <Can I="READ" a="COLLABORATOR" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <StatCards items={statItems} />
            <PageTitle
              subtitle="Quản lý cộng tác viên giới thiệu dịch vụ"
              left={
                <>
                  <Input.Search
                    allowClear
                    placeholder="Tìm tên, SĐT, mã giới thiệu"
                    className="w-[260px]! max-w-[min(260px,46vw)] min-w-[140px]"
                    value={searchText}
                    onChange={(e) => { setSearchText(e.target.value); if (!e.target.value) applySearch('') }}
                    onSearch={(v) => applySearch(v)}
                  />
                  <Select
                    allowClear
                    placeholder="Loại CTV"
                    style={{ width: 160 }}
                    value={listFilters.type}
                    onChange={applyTypeFilter}
                    options={COLLABORATOR_TYPES.map((type) => ({ value: type, label: TYPE_META[type].label }))}
                  />
                </>
              }
              right={
                <Can I="CREATE" a="COLLABORATOR">
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm CTV</Button>
                </Can>
              }
            >
              Cộng tác viên
            </PageTitle>
            {listQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                title="Không tải được danh sách cộng tác viên"
                description={errorMessage(listQuery.error)}
                action={<Button size="small" onClick={() => void listQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <Table<CollaboratorRow>
              rowKey="id" loading={listQuery.isLoading} dataSource={rows} columns={columns}
              scroll={{ x: 'max-content' }}
              pagination={false}
            />
            <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="cộng tác viên" />
            <CollaboratorModal
              editing={editing}
              open={open}
              onClose={() => setOpen(false)}
              onSubmit={() => void submit()}
              loading={createMutation.isPending || updateMutation.isPending}
              form={form}
              collaboratorTypes={COLLABORATOR_TYPES}
              typeMeta={TYPE_META}
            />
            {reportRow && (
              <CollaboratorReportDrawer
                id={reportRow.id}
                open={!!reportRow}
                onClose={() => setReportRow(null)}
              />
            )}
          </>
        ) : (
          <>
            <PageTitle subtitle="Quản lý cộng tác viên giới thiệu dịch vụ">Cộng tác viên</PageTitle>
            <Alert type="warning" showIcon title="Tài khoản của bạn chưa được cấp quyền xem danh sách cộng tác viên. Vui lòng liên hệ quản trị viên." />
          </>
        )
      }
    </Can>
  )
}
