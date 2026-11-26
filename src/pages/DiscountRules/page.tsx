import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Alert, Button, Form, Modal, Space, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, FilterOutlined, PlusOutlined, TagsOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import InfoBanner from '@/components/base/InfoBanner'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import MobileCards from '@/components/base/MobileCards'
import './discount-rules.css'
import ListPagination from '@/components/base/ListPagination'
import { errorMessage } from '@/api/helpers'
import { getGetDiscountRulesAdminQueryKey, useDeleteDiscountRulesIdAdmin, useGetDiscountRulesAdmin, usePostDiscountRulesAdmin, usePutDiscountRulesIdAdmin } from '@/api/endpoints/discount-rules'
import { useGetCardRanksAdmin } from '@/api/endpoints/card-ranks'
import type {
  DiscountRule,
  DiscountRuleAppliesTo,
  DiscountRuleAudience,
  PostDiscountRulesAdminBody,
  PutDiscountRulesIdAdminBody,
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

  const rulesQuery = useGetDiscountRulesAdmin({ page, limit: 10 } as never)
  const ranksQuery = useGetCardRanksAdmin(undefined, { query: { enabled: open } })
  const rules = useMemo(() => rulesQuery.data?.responseData ?? [], [rulesQuery.data])
  const ranks = useMemo(() => ranksQuery.data?.responseData ?? [], [ranksQuery.data])
  const rulesStatsMeta = (rulesQuery.data as unknown as { meta?: { stats?: { total: number; active: number; hidden: number } } })?.meta?.stats

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetDiscountRulesAdminQueryKey() })
  }

  // Thống kê đầu trang — từ meta.stats của BE
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng quy tắc', value: (rulesStatsMeta?.total ?? 0).toLocaleString('vi-VN'), icon: <TagsOutlined />, tone: 'primary' },
    { key: 'active', label: 'Đang áp dụng', value: (rulesStatsMeta?.active ?? 0).toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
  ]

  const createMutation = usePostDiscountRulesAdmin({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutDiscountRulesIdAdmin({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteDiscountRulesIdAdmin({ mutation: { onSuccess: invalidate } })

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
          } satisfies PutDiscountRulesIdAdminBody,
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
          } satisfies PostDiscountRulesAdminBody,
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

  const renderActions = (row: DiscountRule, mobile = false) => (
    <RowActionsMenu
      dropdownOnly={mobile}
      items={[
        ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
        ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
      ]}
      onSelect={(key) => {
        if (key === 'edit') openEditor(row)
        else if (key === 'delete') {
          Modal.confirm({
            title: 'Xóa quy tắc này?',
            content: 'Xóa mềm (is_deleted). Chỉ xóa được quy tắc chưa gắn dịch vụ áp dụng; ngừng áp dụng hãy dùng "Sửa" và tắt "Đang dùng".',
            okText: 'Xóa',
            okButtonProps: { danger: true },
            cancelText: 'Hủy',
            onOk: () => remove(row),
          })
        }
      }}
    />
  )

  const show = (key: DiscountColumnKey) => visibleColumns.includes(key)
  const renderMobileCard = (row: DiscountRule) => {
    const audience = row.audience && AUDIENCE_META[row.audience]?.label
    const rank = row.audience === 'RANK' ? row.requires_rank?.name : undefined
    const minPercent = row.percent_min ?? 0
    const maxPercent = row.percent_max ?? 0
    const discount = minPercent === maxPercent ? `${maxPercent}%` : `${minPercent}–${maxPercent}%`
    const start = row.start_date && dayjs(row.start_date).format('DD/MM/YYYY')
    const end = row.end_date && dayjs(row.end_date).format('DD/MM/YYYY')
    const validity = start && end ? `${start} – ${end}` : start ? `Từ ${start}` : end ? `Đến ${end}` : 'Không giới hạn'
    const conditions = [
      show('stack') && (row.stackable === false ? 'Không cộng dồn' : 'Được cộng dồn'),
      show('stack') && row.once_per_customer && '1 lần/khách',
      show('show_in_app') && (row.show_in_app === false ? 'Ẩn trên app' : 'Hiện trên app'),
    ].filter(Boolean).join(' · ')

    return (
      <div className="grid min-w-0 gap-2.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="grid min-w-0 gap-0.5">
            <button type="button" className="mobile-card-title cursor-pointer border-0 bg-transparent p-0 text-left" onClick={() => setDetailRuleId(row.id)}>
              {show('name') ? row.name : 'Xem quy tắc'}
            </button>
            {show('name') && row.code && <span className="mobile-card-sub">{row.code}</span>}
          </div>
          {show('is_active') && <Tag className="m-0! shrink-0" color={row.is_active !== false ? 'green' : undefined}>{row.is_active !== false ? 'Đang dùng' : 'Đã ngừng'}</Tag>}
        </div>
        {(show('percent') || show('max_total_percent')) && (
          <dl className="m-0 grid auto-cols-fr grid-flow-col gap-3 rounded-lg bg-[var(--brand-bg)] px-3 py-2">
            {show('percent') && (
              <div className="grid gap-0.5">
                <dt className="mobile-card-sub">Mức giảm</dt>
                <dd className="m-0 text-base leading-tight font-semibold text-[var(--brand-primary)]">{discount}</dd>
              </div>
            )}
            {show('max_total_percent') && (
              <div className="grid gap-0.5">
                <dt className="mobile-card-sub">Trần giảm tổng</dt>
                <dd className="m-0 text-sm font-medium">{row.max_total_percent == null ? 'Mặc định 50%' : `${row.max_total_percent}%`}</dd>
              </div>
            )}
          </dl>
        )}
        {(show('audience') || show('validity')) && (
          <dl className="m-0 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
            {show('audience') && <>
              <dt className="mobile-card-sub">Đối tượng</dt>
              <dd className="m-0 self-center font-medium wrap-anywhere">{rank ? `Hạng ${rank}` : (audience ?? '—')}</dd>
            </>}
            {show('validity') && <>
              <dt className="mobile-card-sub">Thời hạn</dt>
              <dd className="m-0 self-center font-medium">{validity}</dd>
            </>}
          </dl>
        )}
        {(conditions || canUpdate || canDelete) && (
          <div className="flex items-center gap-2 border-t border-[var(--brand-border-soft)] pt-2">
            {conditions && <span className="mobile-card-sub min-w-0">{conditions}</span>}
            {(canUpdate || canDelete) && <div className="mobile-card-actions ml-auto! mt-0! shrink-0 border-0! p-0!">{renderActions(row, true)}</div>}
          </div>
        )}
      </div>
    )
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
      title: 'Thao tác', align: 'center' as const, width: 120, fixed: 'right',
      render: (_v, row) => renderActions(row),
    },
  ] as TableColumnsType<DiscountRule>).filter((column) =>
    column.key === 'actions' || visibleColumns.includes(column.key as DiscountColumnKey),
  )

  return (
    <Can I="READ" a="DISCOUNT" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <PageTitle
              summary={<StatCards items={statItems} />}
              subtitle="Quyết định giảm giá và ưu đãi theo hạng thẻ"
              left={
                <>
                  <ListFilterPopover
                    trigger={<Button icon={<FilterOutlined />} className="keep-label">Bộ lọc</Button>}
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
                    tableBreakpoint="xl"
                    draftVisibleColumns={draftVisibleColumns}
                    onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as DiscountColumnKey[])}
                  />
                </>
              }
              right={
                <Can I="CREATE" a="DISCOUNT">
                  <Button type="primary" icon={<PlusOutlined />} className="keep-label" onClick={() => openEditor()}>Thêm quy tắc</Button>
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
            <InfoBanner
              className="mb-4"
              title="Nhân viên chỉ được chọn mức giảm trong khoảng của quy tắc. Nếu cần áp dụng ngoài khoảng này, hãy liên hệ quản trị viên để được cấp quyền duyệt ngoại lệ. Khi kết hợp nhiều ưu đãi, gồm ưu đãi theo hạng thẻ, tổng mức giảm không được vượt giới hạn của quy tắc."
            />
            <Table<DiscountRule>
              className="desktop-only discount-rules-table"
              rowKey="id" loading={rulesQuery.isLoading} dataSource={rules} columns={columns}
              scroll={{ x: 1150 }}
              pagination={false}
              onRow={(row) => ({
                onClick: () => setDetailRuleId(row.id),
                style: { cursor: 'pointer' },
              })}
            />
            <MobileCards
              className="discount-rules-cards"
              rows={rules}
              rowKey={(row) => row.id}
              loading={rulesQuery.isLoading}
              onCardClick={(row) => setDetailRuleId(row.id)}
              renderCard={renderMobileCard}
            />
            <ListPagination page={page} limit={10} total={(rulesQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? rules.length} onChange={setPage} noun="quyết định giảm giá" />
            <DiscountDetailModal
              ruleId={detailRuleId}
              onClose={() => setDetailRuleId(undefined)}
            />
            <DiscountRuleModal
              open={open}
              editing={editing}
              form={form}
              saving={createMutation.isPending || updateMutation.isPending}
              ranks={ranks}
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
