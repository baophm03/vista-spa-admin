import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, TagsOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { errorMessage } from '@/api/helpers'
import {
  getGetDiscountRulesQueryKey,
  useDeleteDiscountRulesId,
  useGetDiscountRules,
  usePostDiscountRules,
  usePutDiscountRulesId,
} from '@/api/endpoints/settings'
import { useGetCardRanks } from '@/api/endpoints/membership'
import { useGetService } from '@/api/endpoints/services'
import type {
  DiscountRule,
  DiscountRuleAppliesTo,
  DiscountRuleAudience,
  PostDiscountRulesBody,
  PutDiscountRulesIdBody,
} from '@/api/models'
import DiscountDetailModal from './components/DiscountDetailModal'
import DiscountRuleModal from './components/DiscountRuleModal'
import { AUDIENCE_META } from './components/constants'

type DiscountColumnKey = 'name' | 'audience' | 'percent' | 'max_total_percent' | 'stack' | 'show_in_app' | 'validity' | 'is_active'

const DISCOUNT_COLUMN_OPTIONS: { label: string; value: DiscountColumnKey }[] = [
  { label: 'Tên', value: 'name' },
  { label: 'Đối tượng', value: 'audience' },
  { label: 'Khoảng %', value: 'percent' },
  { label: 'Trần tổng', value: 'max_total_percent' },
  { label: 'Xếp chồng', value: 'stack' },
  { label: 'Trên app', value: 'show_in_app' },
  { label: 'Hạn', value: 'validity' },
  { label: 'Trạng thái', value: 'is_active' },
]

const DEFAULT_VISIBLE_COLUMNS = DISCOUNT_COLUMN_OPTIONS.map((column) => column.value)

export default function DiscountRules() {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DiscountRule | null>(null)
  const [detailRuleId, setDetailRuleId] = useState<string>()
  const [visibleColumns, setVisibleColumns] = useState<DiscountColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<DiscountColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'DISCOUNT')
  const canDelete = ability.can('DELETE', 'DISCOUNT')

  const rulesQuery = useGetDiscountRules()
  const ranksQuery = useGetCardRanks(undefined, { query: { enabled: open } })
  const servicesQuery = useGetService({ page: 1, limit: 200, is_active: true }, { query: { enabled: open || !!detailRuleId } })
  const rules = useMemo(() => rulesQuery.data?.responseData ?? [], [rulesQuery.data])
  const ranks = useMemo(() => ranksQuery.data?.responseData ?? [], [ranksQuery.data])
  const services = useMemo(() => {
    const data = servicesQuery.data?.responseData as unknown
    if (Array.isArray(data)) return data as { id: string; title: string }[]
    return ((data as { services?: { id: string; title: string }[] } | undefined)?.services ?? [])
  }, [servicesQuery.data])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetDiscountRulesQueryKey() })
  }

  // Thống kê đầu trang — rules là danh sách đầy đủ client-side (query không có bộ lọc server)
  const activeRuleCount = rules.filter((row) => row.is_active !== false).length
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng quy tắc', value: rules.length.toLocaleString('vi-VN'), icon: <TagsOutlined />, tone: 'primary' },
    { key: 'active', label: 'Đang áp dụng', value: activeRuleCount.toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
  ]

  const createMutation = usePostDiscountRules({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutDiscountRulesId({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteDiscountRulesId({ mutation: { onSuccess: invalidate } })

  const openEditor = (row?: DiscountRule) => {
    setEditing(row ?? null)
    form.setFieldsValue(
      row
        ? {
          code: row.code,
          name: row.name,
          audience: row.audience,
          applies_to: row.applies_to ?? 'ALL',
          requires_rank_id: row.requires_rank_id ?? undefined,
          percent_min: row.percent_min ?? 0,
          percent_max: row.percent_max ?? 0,
          max_total_percent: row.max_total_percent ?? undefined,
          stackable: row.stackable ?? true,
          once_per_customer: row.once_per_customer ?? false,
          show_in_app: row.show_in_app ?? true,
          valid_range: row.start_date && row.end_date ? [row.start_date, row.end_date] : undefined,
          service_ids: row.service_ids ?? [],
          is_active: row.is_active ?? true,
        }
        : { audience: 'RANK', applies_to: 'ALL', percent_min: 10, percent_max: 30, stackable: true, once_per_customer: false, show_in_app: true, is_active: true },
    )
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto = {
        code: values.code,
        name: values.name,
        audience: values.audience as DiscountRuleAudience,
        applies_to: values.applies_to as DiscountRuleAppliesTo,
        percent_min: values.percent_min ?? 0,
        percent_max: values.percent_max ?? 0,
        stackable: !!values.stackable,
        once_per_customer: !!values.once_per_customer,
        show_in_app: !!values.show_in_app,
        service_ids: values.applies_to === 'SERVICE' ? (values.service_ids ?? []) : undefined,
      }
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          data: {
            ...dto,
            requires_rank_id: values.audience === 'RANK' ? values.requires_rank_id : null,
            max_total_percent: values.max_total_percent ?? null,
            start_date: values.valid_range?.[0] ?? null,
            end_date: values.valid_range?.[1] ?? null,
            is_active: !!values.is_active,
          } satisfies PutDiscountRulesIdBody,
        })
        message.success('Đã cập nhật quy tắc giảm giá')
      } else {
        await createMutation.mutateAsync({
          data: {
            ...dto,
            requires_rank_id: values.audience === 'RANK' ? values.requires_rank_id : undefined,
            max_total_percent: values.max_total_percent ?? undefined,
            start_date: values.valid_range?.[0] ?? undefined,
            end_date: values.valid_range?.[1] ?? undefined,
          } satisfies PostDiscountRulesBody,
        })
        message.success('Đã tạo quy tắc giảm giá')
      }
      setOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const remove = async (row: DiscountRule) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id })
      message.success(`Đã xóa quy tắc "${row.name}"`)
    } catch (err) {
      message.error(errorMessage(err, 'Không xóa được quy tắc'))
    }
  }

  const columns: TableColumnsType<DiscountRule> = ([
    {
      key: 'name',
      title: 'Tên', dataIndex: 'name',
      render: (v: string, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          {row.code && <Typography.Text code style={{ fontSize: 12 }}>{row.code}</Typography.Text>}
        </div>
      ),
    },
    {
      key: 'audience',
      title: 'Đối tượng', dataIndex: 'audience', width: 180,
      render: (v: DiscountRuleAudience, row) => {
        const meta = AUDIENCE_META[v]
        return (
          <Space size={4}>
            {meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v}</Tag>}
            {v === 'RANK' && row.requires_rank?.name
              ? <Typography.Text code style={{ fontSize: 12 }}>{String(row.requires_rank.name)}</Typography.Text>
              : null}
          </Space>
        )
      },
    },
    { key: 'percent', title: 'Khoảng %', width: 110, align: 'right', render: (_v, row) => `${row.percent_min ?? 0}–${row.percent_max ?? 0}%` },
    { key: 'max_total_percent', title: 'Trần tổng', dataIndex: 'max_total_percent', width: 110, align: 'right', render: (v?: number | null) => (v != null ? `${v}%` : '—') },
    {
      key: 'stack',
      title: 'Xếp chồng', width: 130, align: 'center',
      render: (_v, row) => <Space size={4}>{row.stackable !== false && <Tag color="cyan">Xếp chồng</Tag>}{row.once_per_customer && <Tag color="volcano">1 lần/khách</Tag>}</Space>,
    },
    {
      key: 'show_in_app',
      title: 'Trên app', dataIndex: 'show_in_app', width: 90, align: 'center',
      render: (v?: boolean) => (v !== false ? <Tag color="green">Hiện</Tag> : <Tag>Ẩn</Tag>),
    },
    {
      key: 'validity',
      title: 'Hạn', width: 130, align: 'center' as const,
      render: (_v, row) => (row.start_date || row.end_date ? (
        <Typography.Text style={{ whiteSpace: 'pre-line' }}>
          {`${row.start_date ?? '...'}\n→\n${row.end_date ?? '...'}`}
        </Typography.Text>
      ) : 'Không giới hạn'),
    },
    {
      key: 'is_active',
      title: 'Trạng thái', dataIndex: 'is_active', width: 100, align: 'center' as const,
      render: (v?: boolean) => (v !== false ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã xóa</Tag>),
    },
    {
      key: 'actions',
      title: 'Hành động', align: 'center' as const, width: 120, fixed: 'right',
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
                title: 'Xóa quy tắc này?',
                content: 'Xóa mềm (is_active=false).',
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
  ] as TableColumnsType<DiscountRule>).filter((column) =>
    column.key === 'actions' || visibleColumns.includes(column.key as DiscountColumnKey),
  )

  return (
    <Can I="READ" a="DISCOUNT" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <StatCards items={statItems} />
            <PageTitle
              subtitle="Quyết định giảm giá và ưu đãi theo hạng thẻ"
              left={
                <>
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
                    columnOptions={DISCOUNT_COLUMN_OPTIONS}
                    draftVisibleColumns={draftVisibleColumns}
                    onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as DiscountColumnKey[])}
                  />
                </>
              }
              right={
                <Can I="CREATE" a="DISCOUNT">
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm quy tắc</Button>
                </Can>
              }
            >
              Giảm giá & Ưu đãi
            </PageTitle>
            {rulesQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                title="Không tải được quy tắc giảm giá"
                description={errorMessage(rulesQuery.error)}
                action={<Button size="small" onClick={() => void rulesQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              title="Nhân viên chỉ được chọn mức giảm trong khoảng của quy tắc. Nếu cần áp dụng ngoài khoảng này, hãy liên hệ quản trị viên để được cấp quyền duyệt ngoại lệ. Khi kết hợp nhiều ưu đãi, gồm ưu đãi theo hạng thẻ, tổng mức giảm không được vượt giới hạn của quy tắc."
            />
            <Table<DiscountRule>
              rowKey="id" loading={rulesQuery.isLoading} dataSource={paginateRows(rules, page, 10)} columns={columns}
              scroll={{ x: 1150 }}
              pagination={false}
              onRow={(row) => ({
                onClick: () => setDetailRuleId(row.id),
                style: { cursor: 'pointer' },
              })}
            />
            <ListPagination page={page} limit={10} total={rules.length} onChange={setPage} noun="quyết định giảm giá" />
            <DiscountDetailModal
              ruleId={detailRuleId}
              services={services}
              onClose={() => setDetailRuleId(undefined)}
            />
            <DiscountRuleModal
              open={open}
              editing={editing}
              form={form}
              saving={createMutation.isPending || updateMutation.isPending}
              ranks={ranks}
              services={services}
              servicesLoading={servicesQuery.isLoading}
              onCancel={() => setOpen(false)}
              onSubmit={() => void submit()}
            />
          </>
        ) : (
          <>
            <PageTitle subtitle="Quyết định giảm giá và ưu đãi theo hạng thẻ">Giảm giá & Ưu đãi</PageTitle>
            <Alert type="warning" showIcon title="Tài khoản của bạn chưa được cấp quyền xem quy tắc giảm giá. Vui lòng liên hệ quản trị viên." />
          </>
        )
      }
    </Can>
  )
}
