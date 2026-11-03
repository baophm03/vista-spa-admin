import { useMemo, useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import {
  Alert,
  Button,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, CrownOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { errorMessage } from '@/api/helpers'
import type { CardRank } from '@/api/models/cardRank'
import type { PostCardRanksBody } from '@/api/models/postCardRanksBody'
import type { PutCardRanksIdBody } from '@/api/models/putCardRanksIdBody'
import {
  getGetCardRanksQueryKey,
  useDeleteCardRanksId,
  useGetCardRanks,
  usePostCardRanks,
  usePutCardRanksId,
} from '@/api/endpoints/membership'

const VALIDITY_META: Record<string, { label: string; color: string }> = {
  ONE_YEAR: { label: '1 năm', color: 'blue' },
  PERMANENT: { label: 'Vĩnh viễn', color: 'green' },
}

const RANK_HINT = 'Sửa ngưỡng/% chỉ ảnh hưởng lần xét hạng sau; không tự đổi hạng khách hiện có.'

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

/** Hàng có thể kèm số khách giữ hạng nếu BE trả về (model gen chưa khai báo). */
type CardRankRow = CardRank & {
  customer_count?: number
  holder_count?: number
  holders_count?: number
  total_customers?: number
}

function holderCount(row: CardRankRow): number | undefined {
  return row.customer_count ?? row.holder_count ?? row.holders_count ?? row.total_customers
}

type CardRankColumnKey = 'code' | 'color' | 'name' | 'sort_order' | 'spent' | 'discount_percent' | 'validity' | 'auto_assign' | 'holders' | 'is_active'

const CARD_RANK_COLUMN_OPTIONS: { label: string; value: CardRankColumnKey }[] = [
  { label: 'Mã', value: 'code' },
  { label: 'Tên hạng', value: 'name' },
  { label: 'Màu thẻ', value: 'color' },
  { label: 'Thứ tự', value: 'sort_order' },
  { label: 'Ngưỡng chi tiêu', value: 'spent' },
  { label: 'Giảm giá (%)', value: 'discount_percent' },
  { label: 'Hiệu lực', value: 'validity' },
  { label: 'Tự gán hạng', value: 'auto_assign' },
  { label: 'Khách đang giữ', value: 'holders' },
  { label: 'Trạng thái', value: 'is_active' },
]

const DEFAULT_VISIBLE_COLUMNS = CARD_RANK_COLUMN_OPTIONS.map((column) => column.value)

export default function CardRanks() {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CardRankRow | null>(null)
  const [draggedRankId, setDraggedRankId] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<CardRankColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<CardRankColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const ability = useAbility()
  const { isAdmin, isReceptionist, isTechnician } = useCustomerProfileAccess()
  const hideSummaryForTechnician = isTechnician && !isAdmin && !isReceptionist
  const canUpdate = ability.can('UPDATE', 'CARD_RANK')
  const canDelete = ability.can('DELETE', 'CARD_RANK')
  const canReorder = canUpdate

  const ranksQuery = useGetCardRanks()
  const ranks = useMemo<CardRankRow[]>(() => {
    const list = ranksQuery.data?.responseData ?? []
    return [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }, [ranksQuery.data])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCardRanksQueryKey() })
  }

  const createMutation = usePostCardRanks({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutCardRanksId({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteCardRanksId({ mutation: { onSuccess: invalidate } })

  const moveRank = async (sourceId: string, targetId?: string) => {
    if (!targetId || !canReorder || isReordering || sourceId === targetId) return
    const reordered = [...ranks]
    const sourceIndex = reordered.findIndex((rank) => rank.id === sourceId)
    const targetIndex = reordered.findIndex((rank) => rank.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setIsReordering(true)
    try {
      await Promise.all(
        reordered.map((rank, index) => {
          const sort_order = index + 1
          if (rank.sort_order === sort_order) return Promise.resolve()
          return updateMutation.mutateAsync({
            id: rank.id,
            data: { sort_order } as PutCardRanksIdBody,
          })
        }),
      )
      await invalidate()
      message.success('Đã cập nhật thứ tự hạng thẻ')
    } catch (err) {
      message.error(errorMessage(err, 'Không cập nhật được thứ tự hạng thẻ'))
    } finally {
      setDraggedRankId(null)
      setIsReordering(false)
    }
  }

  const openEditor = (row?: CardRankRow) => {
    setEditing(row ?? null)
    form.setFieldsValue(
      row
        ? {
            code: row.code,
            name: row.name,
            color: row.color ?? undefined,
            sort_order: row.sort_order ?? 0,
            min_spent: row.min_spent ?? 0,
            max_spent: row.max_spent ?? undefined,
            discount_percent: row.discount_percent ?? undefined,
            validity: row.validity ?? 'PERMANENT',
            auto_assign: row.auto_assign ?? false,
            benefits: row.benefits ?? '',
          }
        : { code: '', name: '', color: undefined, sort_order: (ranks.length ? Math.max(...ranks.map((r) => r.sort_order ?? 0)) : 0) + 1, min_spent: 0, max_spent: undefined, discount_percent: undefined, validity: 'PERMANENT', auto_assign: false, benefits: '' },
    )
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto = {
        name: values.name,
        color: values.color || null,
        sort_order: values.sort_order ?? 0,
        min_spent: values.min_spent ?? 0,
        max_spent: values.max_spent ?? undefined,
        discount_percent: values.discount_percent ?? undefined,
        validity: values.validity,
        auto_assign: !!values.auto_assign,
        benefits: values.benefits || undefined,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: dto as PutCardRanksIdBody })
        message.success('Đã cập nhật hạng thẻ')
      } else {
        await createMutation.mutateAsync({ data: { ...dto, code: values.code } as PostCardRanksBody })
        message.success('Đã tạo hạng thẻ')
      }
      setOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const remove = async (row: CardRankRow) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id })
      message.success(`Đã xóa hạng "${row.name}"`)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409 || status === 422) {
        message.error(
          errorMessage(err, 'Không thể xóa: khách hàng hoặc ưu đãi đang sử dụng hạng này'),
        )
      } else {
        message.error(errorMessage(err))
      }
    }
  }

  const showHolders = ranks.some((r) => holderCount(r) != null)

  // Thống kê đầu trang — chỉ hiện khi BE trả về số khách giữ hạng, nếu không thì bỏ qua
  const statItems: StatItem[] = showHolders && !hideSummaryForTechnician
    ? [
        { key: 'total', label: 'Tổng hạng thẻ', value: ranks.length.toLocaleString('vi-VN'), icon: <CrownOutlined />, tone: 'primary' },
        { key: 'holders', label: 'Khách đang giữ hạng', value: ranks.reduce((sum, row) => sum + (holderCount(row) ?? 0), 0).toLocaleString('vi-VN'), icon: <TeamOutlined />, tone: 'tertiary' },
      ]
    : []

  const columns: TableColumnsType<CardRankRow> = ([
    {
      key: 'code',
      title: 'Mã', dataIndex: 'code', width: 130,
      render: (v: string) => <Typography.Text code style={{ fontSize: 12 }}>{v}</Typography.Text>,
    },
    { key: 'name', title: 'Tên hạng', dataIndex: 'name', width: 150, ellipsis: true, render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    {
      key: 'color',
      title: 'Màu', dataIndex: 'color', width: 70, align: 'center',
      render: (v?: string | null) => v
        ? <span title={v} style={{ display: 'inline-block', width: 22, height: 22, borderRadius: 6, background: v, border: '1px solid rgba(0, 0, 0, 0.12)' }} />
        : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      key: 'sort_order',
      title: 'Thứ tự', dataIndex: 'sort_order', width: 110, align: 'center',
      render: (v: number | undefined, row) => {
        const rankIndex = ranks.findIndex((rank) => rank.id === row.id)
        return (
          <Space size={2}>
            <Typography.Text>{v ?? '—'}</Typography.Text>
            {canReorder && (
              <>
                <Button
                  type="text" size="small" icon={<ArrowUpOutlined />}
                  aria-label={`Đưa hạng ${row.name} lên`}
                  title={`Đưa hạng ${row.name} lên`}
                  disabled={rankIndex <= 0 || isReordering}
                  onClick={() => void moveRank(row.id, ranks[rankIndex - 1]?.id)}
                />
                <Button
                  type="text" size="small" icon={<ArrowDownOutlined />}
                  aria-label={`Đưa hạng ${row.name} xuống`}
                  title={`Đưa hạng ${row.name} xuống`}
                  disabled={rankIndex < 0 || rankIndex === ranks.length - 1 || isReordering}
                  onClick={() => void moveRank(row.id, ranks[rankIndex + 1]?.id)}
                />
              </>
            )}
          </Space>
        )
      },
    },
    {
      key: 'spent',
      title: 'Ngưỡng chi tiêu', width: 200,
      render: (_v, row) =>
        row.max_spent != null
          ? `${formatVnd(row.min_spent)} → ${formatVnd(row.max_spent)}`
          : `${formatVnd(row.min_spent)} trở lên`,
    },
    {
      key: 'discount_percent',
      title: 'Giảm giá', dataIndex: 'discount_percent', width: 90, align: 'center',
      render: (v?: number | null) => v == null ? '—' : `${v}%`,
    },
    {
      key: 'validity',
      title: 'Hiệu lực', dataIndex: 'validity', width: 100,
      render: (v?: string) => {
        const meta = v ? VALIDITY_META[v] : undefined
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v ?? '—'}</Tag>
      },
    },
    {
      key: 'auto_assign',
      title: 'Tự gán', dataIndex: 'auto_assign', width: 80, align: 'center',
      render: (v?: boolean) => <Switch size="small" checked={!!v} disabled />,
    },
    ...(showHolders
      ? [{
          key: 'holders',
          title: 'Đang giữ', width: 90, align: 'center' as const,
          render: (_v: unknown, row: CardRankRow) => holderCount(row)?.toLocaleString('vi-VN') ?? '—',
        } satisfies TableColumnsType<CardRankRow>[number]]
      : []),
    {
      key: 'is_active',
      title: 'Trạng thái', dataIndex: 'is_active', width: 100,
      render: (v?: boolean) => (v !== false ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã xóa</Tag>),
    },
    {
      key: 'actions',
      title: 'Hành động', align: 'center' as const, width: 90, fixed: 'right',
      render: (_v, row) => (
        <RowActionsMenu
          items={[
            ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
            ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
          ]}
          onSelect={(key) => {
            if (key === 'edit') openEditor(row)
            else if (key === 'delete') {
              Modal.confirm({
                title: 'Xóa hạng thẻ này?',
                content: 'Xóa mềm. Không xóa được nếu còn khách giữ hạng hoặc có ưu đãi đang áp dụng.',
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
  ] as TableColumnsType<CardRankRow>).filter((column) =>
    (column.key !== 'actions' || canUpdate || canDelete) &&
    (column.key === 'actions' || visibleColumns.includes(column.key as CardRankColumnKey)),
  )

  return (
    <Can I="READ" a="CARD_RANK" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <StatCards items={statItems} />
            <PageTitle
            subtitle="Định nghĩa hạng thẻ, ngưỡng chi tiêu và quyền lợi"
              extra={
                <Space wrap>
                  <Button icon={<ReloadOutlined />} onClick={() => void ranksQuery.refetch()}>Tải lại</Button>
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
                    columnOptions={CARD_RANK_COLUMN_OPTIONS}
                    draftVisibleColumns={draftVisibleColumns}
                    onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as CardRankColumnKey[])}
                  />
                  <Can I="CREATE" a="CARD_RANK">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm hạng</Button>
                  </Can>
                </Space>
              }
            >
              Hạng thẻ thành viên
            </PageTitle>
            {ranksQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                message="Không tải được danh mục hạng thẻ"
                description={errorMessage(ranksQuery.error)}
                action={<Button size="small" onClick={() => void ranksQuery.refetch()}>Thử lại</Button>}
              />
            )}
            {canReorder && (
              <Typography.Text type="secondary" className="mb-2 block">
                Kéo thả hàng để sắp xếp; có thể dùng các nút mũi tên trong cột Thứ tự bằng bàn phím.
              </Typography.Text>
            )}
            <Table<CardRankRow>
              rowKey="id" loading={ranksQuery.isLoading} dataSource={paginateRows(ranks, page, 10)} columns={columns}
              scroll={{ x: 1210 }}
              pagination={false}
              onRow={(row) => ({
                draggable: canReorder && !isReordering,
                onDragStart: (event: ReactDragEvent<HTMLTableRowElement>) => {
                  if (!canReorder || isReordering) {
                    event.preventDefault()
                    return
                  }
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', row.id)
                  setDraggedRankId(row.id)
                },
                onDragOver: (event: ReactDragEvent<HTMLTableRowElement>) => {
                  if (!canReorder || isReordering) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                },
                onDrop: (event: ReactDragEvent<HTMLTableRowElement>) => {
                  if (!canReorder || isReordering) return
                  event.preventDefault()
                  const sourceId = event.dataTransfer.getData('text/plain') || draggedRankId
                  if (sourceId) void moveRank(sourceId, row.id)
                },
                onDragEnd: () => setDraggedRankId(null),
                style: {
                  cursor: canReorder ? (isReordering ? 'wait' : 'grab') : undefined,
                  opacity: draggedRankId === row.id ? 0.55 : 1,
                },
              })}
            />
            <ListPagination page={page} limit={10} total={ranks.length} onChange={setPage} noun="hạng thẻ" />
            <Modal
              title={editing ? `Sửa hạng: ${editing.name}` : 'Thêm hạng thẻ'}
              open={open}
              onCancel={() => setOpen(false)}
              onOk={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              okText="Lưu" cancelText="Hủy"
              width="min(880px, calc(100vw - 24px))"
            >
              <Alert
                type="info" showIcon style={{ marginTop: 12, marginBottom: 12 }}
                message={RANK_HINT}
              />
              <Form form={form} layout="vertical">
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item
                    name="code" label="Mã hạng" style={{ flex: 1 }}
                    rules={editing ? undefined : [{ required: true, message: 'Nhập mã hạng' }]}
                    extra={editing ? 'Mã hạng không thể thay đổi' : undefined}
                  >
                    <Input maxLength={50} placeholder="VD: SILVER" disabled={!!editing} />
                  </Form.Item>
                  <Form.Item name="sort_order" label="Thứ tự sắp xếp" rules={[{ required: true, message: 'Nhập thứ tự' }]} style={{ flex: 1 }}>
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
                <Form.Item name="name" label="Tên hạng" rules={[{ required: true, message: 'Nhập tên hạng' }]}>
                  <Input maxLength={255} placeholder="VD: Bạc" />
                </Form.Item>
                <Form.Item
                  name="color"
                  label="Màu thẻ"
                  extra="Hiển thị trên thẻ hạng ở trang Điểm & Hạng thành viên"
                  getValueFromEvent={(_color: unknown, hex: string) => hex || undefined}
                >
                  <ColorPicker
                    format="hex"
                    showText
                    allowClear
                    disabledAlpha
                    presets={[{ label: 'Gợi ý', colors: ['#8A6A1F', '#1E6FD0', '#C07A10', '#2B77C9', '#A11E42'] }]}
                  />
                </Form.Item>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="min_spent" label="Chi tiêu tối thiểu (₫)" rules={[{ required: true, message: 'Nhập ngưỡng tối thiểu' }]} style={{ flex: 1 }}>
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="VD: 5000000" />
                  </Form.Item>
                  <Form.Item name="max_spent" label="Chi tiêu tối đa (₫)" style={{ flex: 1 }} extra="Bỏ trống nếu không giới hạn trên">
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
                  </Form.Item>
                  <Form.Item name="discount_percent" label='% giảm giá của hạng (%)' style={{ flex: 1 }} extra='Tính vào trần xếp chồng ưu đãi'>
                    <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} placeholder="VD: 10" />
                  </Form.Item>
                </Space>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="validity" label="Hiệu lực thẻ" rules={[{ required: true, message: 'Chọn hiệu lực' }]} style={{ flex: 1 }}>
                    <Select options={Object.entries(VALIDITY_META).map(([value, meta]) => ({ value, label: meta.label }))} />
                  </Form.Item>
                  <Form.Item name="auto_assign" label="Tự gán hạng" valuePropName="checked" style={{ flex: 1 }} extra="Tự động xét hạng khi khách đạt ngưỡng chi tiêu">
                    <Switch />
                  </Form.Item>
                </Space>
                <Form.Item name="benefits" label="Quyền lợi">
                  <Input.TextArea rows={3} maxLength={2000} placeholder="Mô tả quyền lợi của hạng thẻ" />
                </Form.Item>
              </Form>
            </Modal>
          </>
        ) : (
          <>
            <PageTitle subtitle="Định nghĩa hạng thẻ, ngưỡng chi tiêu và quyền lợi">Hạng thẻ thành viên</PageTitle>
            <Alert type="warning" showIcon message="Bạn không có quyền xem danh mục hạng thẻ (cần quyền card_rank.read)" />
          </>
        )
      }
    </Can>
  )
}
