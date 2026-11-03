import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { BarChartOutlined, CheckCircleOutlined, DeleteOutlined, EditOutlined, EyeInvisibleOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import type { Collaborator } from '@/api/models/collaborator'
import {
  getGetCollaboratorsQueryKey,
  useDeleteCollaboratorsId,
  useGetCollaborators,
  useGetCollaboratorsIdSummary,
  usePostCollaborators,
  usePutCollaboratorsId,
} from '@/api/endpoints/admin'
import type { PostCollaboratorsBody } from '@/api/models'
import type { GetCollaboratorsParams } from '@/api/models/getCollaboratorsParams'

const COLLABORATOR_TYPES = ['STAFF', 'CUSTOMER', 'EXTERNAL']

const TYPE_META: Record<string, { label: string; color: string }> = {
  STAFF: { label: 'Nhân viên', color: 'blue' },
  CUSTOMER: { label: 'Khách hàng', color: 'green' },
  EXTERNAL: { label: 'Bên ngoài', color: 'orange' },
}

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

type CollaboratorRow = Collaborator & { referral_count?: number; referral_use_count?: number; commission_percent?: number }

type CollaboratorColumnKey = 'referral_code' | 'name' | 'phone' | 'type' | 'referral_count' | 'commission_percent' | 'note' | 'is_active'

const COLLABORATOR_COLUMN_OPTIONS: { label: string; value: CollaboratorColumnKey }[] = [
  { label: 'Mã giới thiệu', value: 'referral_code' },
  { label: 'Tên', value: 'name' },
  { label: 'SĐT', value: 'phone' },
  { label: 'Loại', value: 'type' },
  { label: 'Khách giới thiệu', value: 'referral_count' },
  { label: '% hoa hồng tham khảo', value: 'commission_percent' },
  { label: 'Ghi chú', value: 'note' },
  { label: 'Trạng thái', value: 'is_active' },
]

const DEFAULT_VISIBLE_COLUMNS = COLLABORATOR_COLUMN_OPTIONS.map((column) => column.value)

function CollaboratorReportDrawer({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const summaryQuery = useGetCollaboratorsIdSummary(id, { query: { enabled: open && !!id } })
  const summary = pickData<{ referral_count?: number; total_package_value?: number; total_commission?: number }>(
    summaryQuery.data,
  )

  return (
    <Drawer title="Báo cáo cộng tác viên" width={420} open={open} onClose={onClose}>
      {summaryQuery.isLoading ? (
        <Spin />
      ) : summaryQuery.isError ? (
        <Alert
          type="error" showIcon
          title="Không tải được báo cáo"
          description={errorMessage(summaryQuery.error)}
          action={<Button size="small" onClick={() => void summaryQuery.refetch()}>Thử lại</Button>}
        />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert type="info" showIcon title="Số liệu tổng hợp theo toàn bộ lịch sử giới thiệu của CTV." />
          <div>
            <Typography.Text type="secondary">Số khách được giới thiệu</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{(summary?.referral_count ?? 0).toLocaleString('vi-VN')}</div>
          </div>
          <div>
            <Typography.Text type="secondary">Tổng giá trị gói điều trị</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{formatVnd(summary?.total_package_value)}</div>
          </div>
          <div>
            <Typography.Text type="secondary">Tổng hoa hồng (đang ACTIVE)</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#389e0d' }}>{formatVnd(summary?.total_commission)}</div>
          </div>
        </Space>
      )}
    </Drawer>
  )
}

export default function Collaborators() {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CollaboratorRow | null>(null)
  const [reportRow, setReportRow] = useState<CollaboratorRow | null>(null)
  const [listFilters, setListFilters] = useState<GetCollaboratorsParams>({})
  const [searchText, setSearchText] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<CollaboratorColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<CollaboratorColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()
  const queryClient = useQueryClient()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'COLLABORATOR')
  const canDelete = ability.can('DELETE', 'COLLABORATOR')

  const listQuery = useGetCollaborators(listFilters)
  const rows = useMemo(() => {
    const raw = pickData<unknown>(listQuery.data)
    const list = (Array.isArray(raw) ? raw : (raw as { rows?: CollaboratorRow[] } | null)?.rows ?? []) as CollaboratorRow[]
    return list
  }, [listQuery.data])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCollaboratorsQueryKey() })
  }

  const createMutation = usePostCollaborators({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutCollaboratorsId({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteCollaboratorsId({ mutation: { onSuccess: invalidate } })

  const openEditor = (row?: CollaboratorRow) => {
    setEditing(row ?? null)
    form.setFieldsValue(
      row
        ? {
            name: row.name,
            phone: row.phone ?? '',
            referral_code: row.referral_code,
            type: row.type ?? undefined,
            commission_percent: row.commission_percent ?? undefined,
            note: row.note ?? '',
            is_active: row.is_active !== false,
          }
        : { name: '', phone: '', referral_code: '', type: undefined, commission_percent: undefined, note: '', is_active: true },
    )
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto: PostCollaboratorsBody = {
        name: values.name,
        phone: values.phone || undefined,
        referral_code: values.referral_code,
        type: values.type || undefined,
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
      message.success(`Đã ngừng hoạt động CTV "${row.name}"`)
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setListFilters((current) => ({ ...current, q: nextKeyword.trim() || undefined }))
    setPage(1)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    setListFilters((current) => ({ ...current, type: typeof values.type === 'string' && values.type ? values.type : undefined }))
    setVisibleColumns(draftVisibleColumns)
    setFilterOpen(false)
    setPage(1)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setSearchText('')
    setListFilters((current) => ({ ...current, type: undefined, q: undefined }))
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({ type: listFilters.type })
    setSearchText(listFilters.q ?? '')
    setDraftVisibleColumns(visibleColumns)
  }

  const activeFilterCount = (listFilters.type ? 1 : 0) + (listFilters.q ? 1 : 0)

  // Thống kê đầu trang — chỉ đáng tin khi không lọc q/type phía server (khi đó rows là danh sách đầy đủ)
  const statItems = useMemo<StatItem[]>(() => {
    if (listFilters.q || listFilters.type) return []
    const activeCount = rows.filter((row) => row.is_active !== false).length
    const referralTotal = rows.reduce((sum, row) => sum + Number(row.referral_count ?? 0), 0)
    return [
      { key: 'total', label: 'Tổng cộng tác viên', value: rows.length.toLocaleString('vi-VN'), icon: <TeamOutlined />, tone: 'primary' },
      { key: 'active', label: 'Đang hoạt động', value: activeCount.toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
      { key: 'hidden', label: 'Đã ẩn', value: (rows.length - activeCount).toLocaleString('vi-VN'), icon: <EyeInvisibleOutlined />, tone: 'neutral' },
      { key: 'referrals', label: 'Khách đã giới thiệu', value: referralTotal.toLocaleString('vi-VN'), icon: <UserAddOutlined />, tone: 'tertiary' },
    ]
  }, [rows, listFilters])

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
      title: 'Hành động', width: 90, fixed: 'right',
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
                title: 'Ngừng hoạt động CTV này?',
                content: 'Xóa mềm (đặt is_active = false).',
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
  ] as TableColumnsType<CollaboratorRow>).filter((column) =>
    column.key === 'actions' || visibleColumns.includes(column.key as CollaboratorColumnKey),
  )

  return (
    <Can I="READ" a="COLLABORATOR" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <StatCards items={statItems} />
            <PageTitle
            subtitle="Quản lý cộng tác viên giới thiệu dịch vụ"
              extra={
                <Space wrap>
                  <Input
                    allowClear
                    prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
                    placeholder="Tìm tên, SĐT, mã giới thiệu"
                    style={{ width: 260 }}
                    value={searchText}
                    onChange={(event) => {
                      setSearchText(event.target.value)
                      if (!event.target.value) applySearch('')
                    }}
                    onPressEnter={() => applySearch(searchText)}
                  />
                  <ListFilterPopover
                    open={filterOpen}
                    onOpenChange={openFilters}
                    activeFilterCount={activeFilterCount}
                    form={filterForm}
                    onApply={applyFilters}
                    onClear={clearFilters}
                    columnOptions={COLLABORATOR_COLUMN_OPTIONS}
                    draftVisibleColumns={draftVisibleColumns}
                    onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as CollaboratorColumnKey[])}
                    filterItems={(
                      <Form.Item name="type" label="Loại CTV" style={{ marginBottom: 0 }}>
                        <Select
                          allowClear
                          placeholder="Tất cả"
                          options={COLLABORATOR_TYPES.map((type) => ({ value: type, label: TYPE_META[type].label }))}
                        />
                      </Form.Item>
                    )}
                  />
                  <Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>Tải lại</Button>
                  <Can I="CREATE" a="COLLABORATOR">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm CTV</Button>
                  </Can>
                </Space>
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
              rowKey="id" loading={listQuery.isLoading} dataSource={paginateRows(rows, page, 10)} columns={columns}
              scroll={{ x: 'max-content' }}
              pagination={false}
            />
            <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="cộng tác viên" />
            <Modal
              title={editing ? `Sửa CTV: ${editing.name}` : 'Thêm cộng tác viên'}
              open={open}
              onCancel={() => setOpen(false)}
              onOk={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              okText="Lưu" cancelText="Hủy"
            >
              <Form form={form} layout="vertical">
                <Form.Item
                  name="referral_code" label="Mã giới thiệu"
                  rules={[{ required: true, message: 'Nhập mã giới thiệu' }]}
                  extra={editing ? 'Không thể đổi mã nếu mã này đã được dùng trong lịch sử giới thiệu' : undefined}
                >
                  <Input maxLength={50} placeholder="VD: CTV001" disabled={!!editing && Number(editing.referral_use_count ?? editing.referral_count ?? 0) > 0} />
                </Form.Item>
                <Form.Item name="name" label="Tên CTV" rules={[{ required: true, message: 'Nhập tên CTV' }]}>
                  <Input maxLength={255} />
                </Form.Item>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="phone" label="SĐT" style={{ flex: 1 }}>
                    <Input maxLength={20} />
                  </Form.Item>
                  <Form.Item name="type" label="Loại" style={{ flex: 1 }}>
                    <Select allowClear placeholder="Chọn loại" options={COLLABORATOR_TYPES.map((t) => ({ value: t, label: TYPE_META[t]?.label ?? t }))} />
                  </Form.Item>
                </Space>
                <Form.Item name="commission_percent" label="% hoa hồng tham khảo" extra="Chỉ gợi ý khi nhập tay trong module Hoa hồng; không tự động tính.">
                  <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="note" label="Ghi chú">
                  <Input.TextArea rows={3} maxLength={2000} />
                </Form.Item>
                {editing && (
                  <Form.Item name="is_active" label="Trạng thái" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: true, label: 'Đang hoạt động' },
                        { value: false, label: 'Đã ẩn' },
                      ]}
                    />
                  </Form.Item>
                )}
              </Form>
            </Modal>
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
            <Alert type="warning" showIcon title="Bạn không có quyền xem danh sách cộng tác viên (cần quyền collaborator.read)" />
          </>
        )
      }
    </Can>
  )
}
