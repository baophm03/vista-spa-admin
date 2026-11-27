import { useEffect, useRef, useState } from 'react'
import { Button, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { AppstoreOutlined, DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import ServiceModal from './ServiceModal'
import ServiceDetailModal from './ServiceDetailModal'
import ServiceListState from './ServiceListState'
import { errorMessage, pickData } from '@/api/helpers'
import { deleteServiceIdAdmin, postServiceAdmin, putServiceIdAdmin, useGetServiceAdmin } from '@/api/endpoints/services'
import type { ServiceCreate } from '@/api/models/serviceCreate'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { formatCurrency, useBrandCurrency } from '@/themeRuntime'
import { fileSrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { Branch } from '@/api/models'
import { formatServicePrice, type ServiceCategoryRow, type ServiceRow } from './serviceTypes'

const DEFAULT_COLUMNS = ['service', 'branch', 'price', 'duration', 'points', 'status']

interface ServiceTableProps {
  /** uuid danh mục, hoặc 'none' = dịch vụ chưa có danh mục */
  categoryId: string
  categories: ServiceCategoryRow[]
  branches: Branch[]
  /** Gọi sau khi thêm / sửa / ẩn / xoá dịch vụ (cập nhật tóm tắt danh mục, thống kê) */
  onChanged?: () => void
  /** Mở sẵn form thêm dịch vụ (từ nút "Thêm dịch vụ" trên thẻ danh mục rỗng) */
  autoOpenCreate?: boolean
}

/** Danh sách dịch vụ của 1 danh mục + thêm / sửa / xem / ẩn / xoá — dùng ở trang chi tiết danh mục. */
export default function ServiceTable({ categoryId, categories, branches, onChanged, autoOpenCreate }: ServiceTableProps) {
  const { currency, symbol: currencySymbol } = useBrandCurrency()
  const urlMap = useFileUrlMap()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'SERVICE')
  const canDelete = ability.can('DELETE', 'SERVICE')
  const customFields = useCustomFieldDefinitions('SERVICE')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceRow | null>(null)
  const [detailService, setDetailService] = useState<ServiceRow | null>(null)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [keyword, setKeyword] = useState('')
  const [form] = Form.useForm()

  const listQuery = useGetServiceAdmin({ category_id: categoryId, page, limit, ...(keyword ? { q: keyword } : {}) })
  const listData = pickData<{ services?: ServiceRow[]; total?: number }>(listQuery.data)
  const rows = listData?.services ?? []
  const total = listData?.total ?? 0

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setKeyword(nextKeyword.trim())
    setPage(1)
  }

  const createMutation = useMutation({ mutationFn: async (dto: ServiceCreate) => postServiceAdmin(dto) })
  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<ServiceCreate> }) => putServiceIdAdmin(id, dto as ServiceCreate),
  })
  const deleteMutation = useMutation({ mutationFn: async (id: string) => deleteServiceIdAdmin(id) })

  const afterChange = async () => {
    await listQuery.refetch()
    onChanged?.()
  }

  const openEditor = (row?: ServiceRow) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(
      row
        ? {
            ...row,
            image_file_id: row.image_file?.id ?? row.image_file_id ?? undefined,
            price: row.price == null ? null : Number(row.price),
            price_max: row.price_max == null ? null : Number(row.price_max),
            gallery_file_ids: (row.service_galleries ?? []).map((gallery) => gallery.file?.id ?? gallery.file_id),
            custom_fields: row.custom_fields ?? {},
            duration_minutes: row.duration_minutes ?? null,
          }
        : {
            title: '',
            // Thêm trong trang chi tiết danh mục: điền sẵn danh mục đang xem
            category_id: categoryId === 'none' ? undefined : categoryId,
            required_points: 0,
            price_unit: 'SESSION',
            duration_minutes: null,
            gallery_file_ids: [],
            custom_fields: {},
          },
    )
    setOpen(true)
  }

  const autoOpened = useRef(false)
  useEffect(() => {
    if (!autoOpenCreate || autoOpened.current) return
    autoOpened.current = true
    openEditor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreate])

  const submit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const dto = {
        ...values,
        custom_fields: normalizeCustomFieldValues(customFields, values.custom_fields ?? {}, editing?.custom_fields ?? {}),
      }
      if (editing) await updateMutation.mutateAsync({ id: editing.id, dto })
      else await createMutation.mutateAsync(dto)
      setOpen(false)
      message.success(editing ? 'Đã cập nhật dịch vụ' : 'Đã thêm dịch vụ')
      await afterChange()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (action: () => Promise<unknown>, successText: string) => {
    try {
      await action()
      message.success(successText)
      await afterChange()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const renderActions = (row: ServiceRow, dropdownOnly = false) => (
    <RowActionsMenu
      dropdownOnly={dropdownOnly}
      items={[
        ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
        ...(canUpdate && row.is_active === false ? [{ key: 'restore', icon: <EyeOutlined />, label: 'Bật lại' }] : []),
        ...(canUpdate && row.is_active !== false ? [{ key: 'hide', icon: <EyeInvisibleOutlined />, label: 'Ẩn' }] : []),
        ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
      ]}
      onSelect={(key) => {
        if (key === 'edit') openEditor(row)
        else if (key === 'restore') void runAction(() => updateMutation.mutateAsync({ id: row.id, dto: { is_active: true } }), 'Đã bật lại dịch vụ')
        else if (key === 'hide') {
          Modal.confirm({
            title: 'Ẩn dịch vụ này?',
            content: 'Dịch vụ sẽ bị ẩn khỏi app nhưng vẫn còn trong danh sách quản trị.',
            okText: 'Ẩn',
            cancelText: 'Hủy',
            onOk: () => runAction(() => updateMutation.mutateAsync({ id: row.id, dto: { is_active: false } }), 'Đã ẩn dịch vụ; dữ liệu cũ vẫn được giữ'),
          })
        } else if (key === 'delete') {
          Modal.confirm({
            title: 'Xóa dịch vụ này?',
            content: 'Xóa mềm: chỉ thực hiện được khi dịch vụ không còn lịch sử/hóa đơn tham chiếu.',
            okText: 'Xóa',
            okButtonProps: { danger: true },
            cancelText: 'Hủy',
            onOk: () => runAction(() => deleteMutation.mutateAsync(row.id), 'Đã xóa dịch vụ'),
          })
        }
      }}
    />
  )

  const branchName = (id?: string | null) =>
    id ? branches.find((branch) => branch.id === id)?.name ?? '—' : 'Tất cả cơ sở'
  const priceLabel = (row: ServiceRow) => formatServicePrice(row.price, row.price_max, currency)
  const coverSrc = (row: ServiceRow) => fileSrc(row.image_file) ?? resolveFileSrc(urlMap, row.image_file_id)

  const dataColumns: Record<string, NonNullable<TableColumnsType<ServiceRow>[number]>> = {
    service: {
      key: 'service',
      title: 'Dịch vụ',
      dataIndex: 'title',
      render: (value: string, row) => {
        const image = coverSrc(row)
        return (
          <Space align="start">
            {image && <img src={image} alt="" width={44} height={44} style={{ objectFit: 'cover', borderRadius: 6 }} />}
            <div>
              <div style={{ fontWeight: 500 }}>{value}</div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.description}
              </Typography.Text>
            </div>
          </Space>
        )
      },
    },
    branch: { key: 'branch', title: 'Cơ sở', dataIndex: 'branch_id', width: 140, render: branchName },
    price: { key: 'price', title: 'Giá niêm yết', render: (_value, row) => priceLabel(row) },
    duration: { key: 'duration', title: 'Thời lượng', dataIndex: 'duration_minutes', render: (value?: number | null) => (value ? `${value} phút` : 'Theo cấu hình') },
    points: { key: 'points', title: 'Điểm đổi', dataIndex: 'required_points', render: (value?: number | null) => (value ? Number(value).toLocaleString('vi-VN') : '—') },
    status: {
      key: 'status',
      title: 'Trạng thái',
      dataIndex: 'is_active',
      render: (value?: boolean) => <Tag color={value === false ? 'default' : 'green'}>{value === false ? 'Đã ẩn' : 'Đang hiển thị'}</Tag>,
    },
  }
  const columns: TableColumnsType<ServiceRow> = [
    ...DEFAULT_COLUMNS.map((key) => dataColumns[key]),
    {
      key: 'actions',
      title: 'Thao tác', align: 'center' as const,
      width: 90,
      fixed: 'right',
      render: (_value, row) => renderActions(row),
    },
  ]

  const hasServices = !listQuery.isLoading && !listQuery.isError && rows.length > 0

  return (
    <>
      <div className="service-list-toolbar service-detail-toolbar">
        <Input.Search
          allowClear
          aria-label="Tìm tên hoặc mô tả dịch vụ"
          placeholder="Tìm tên hoặc mô tả dịch vụ"
          className="service-list-search"
          value={searchText}
          onChange={(event) => { setSearchText(event.target.value); if (!event.target.value) applySearch('') }}
          onSearch={(v) => applySearch(v)}
        />
        <Can I="CREATE" a="SERVICE">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
            Thêm dịch vụ
          </Button>
        </Can>
      </div>
      {listQuery.isError ? (
        <ServiceListState message="Không tải được danh sách dịch vụ" onRetry={() => void listQuery.refetch()} />
      ) : (
        <>
          <Table<ServiceRow>
            className="desktop-only service-detail-table"
            rowKey="id"
            loading={listQuery.isLoading}
            dataSource={rows}
            columns={columns}
            scroll={{ x: 900 }}
            pagination={false}
            locale={{ emptyText: keyword ? 'Không có kết quả' : 'Chưa có dịch vụ trong danh mục' }}
            onRow={(row) => ({
              onClick: () => setDetailService(row),
              style: { cursor: 'pointer' },
            })}
          />
          <MobileCards
            className="service-detail-cards"
            rows={rows}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            emptyText={keyword ? 'Không có kết quả' : 'Chưa có dịch vụ trong danh mục'}
            emptyDescription={keyword ? 'Thử đổi từ khóa hoặc xóa bộ lọc' : undefined}
            onCardClick={setDetailService}
            renderCard={(row) => {
              const galleryImage = row.service_galleries?.[0]
              const image = coverSrc(row) ?? fileSrc(galleryImage?.file) ?? resolveFileSrc(urlMap, galleryImage?.file_id)
              return (
                <>
                  <div className="mobile-card-head">
                    <button type="button" className="mobile-card-title service-card-link" onClick={(event) => {
                      event.stopPropagation()
                      setDetailService(row)
                    }}>
                      {image
                        ? <img className="service-card-image" src={image} alt="" loading="lazy" />
                        : <AppstoreOutlined aria-hidden />}
                      <span className="min-w-0">{row.title || 'Dịch vụ'}</span>
                    </button>
                    {row.is_active === false ? <Tag>Đã ẩn</Tag> : <Tag color="green">Đang dùng</Tag>}
                    {renderActions(row, true)}
                  </div>
                  <div className="mobile-card-rows">
                    <MobileCardRow label="Cơ sở" value={branchName(row.branch_id)} />
                    <MobileCardRow label="Giá niêm yết" value={priceLabel(row)} />
                    <MobileCardRow label="Thời lượng" value={row.duration_minutes ? `${row.duration_minutes} phút` : 'Theo cấu hình'} />
                    <MobileCardRow label="Điểm đổi" value={row.required_points ? Number(row.required_points).toLocaleString('vi-VN') : '—'} />
                  </div>
                </>
              )
            }}
          />
        </>
      )}
      {hasServices && <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="dịch vụ" />}
      <ServiceModal
        open={open}
        editing={editing}
        form={form}
        categories={categories}
        customFields={customFields}
        currencySymbol={currencySymbol}
        saving={saving}
        onCancel={() => setOpen(false)}
        onSubmit={() => void submit()}
        branches={branches}
      />
      <ServiceDetailModal
        service={detailService}
        onClose={() => setDetailService(null)}
        categories={categories}
        branches={branches}
        urlMap={urlMap}
        currency={currency}
        formatCurrency={formatCurrency}
      />
    </>
  )
}
