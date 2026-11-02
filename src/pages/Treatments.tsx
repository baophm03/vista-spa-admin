import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined, SearchOutlined, ShoppingOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import CustomFieldFormItems, { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { Service } from '@/api/models/service'
import type { TreatmentPackage } from '@/api/models/treatmentPackage'
import {
  getGetPackageTypesQueryKey,
  getGetTreatmentPackagesQueryKey,
  useDeletePackageTypesId,
  useDeleteTreatmentPackagesId,
  useGetPackageTypes,
  useGetService,
  useGetTreatmentPackages,
  usePostPackageTypes,
  usePostTreatmentPackages,
  usePutPackageTypesId,
  usePutTreatmentPackagesId,
} from '@/api/endpoints/services'
import { useGetBranches } from '@/api/endpoints/branches'
import { useProfileStore } from '@/stores/profile-store'
import { useBrandCurrency } from '@/themeRuntime'

type QuotaType = TreatmentPackage['quota_type']
type ValidityUnit = NonNullable<TreatmentPackage['validity_unit']>

interface PackageTypeRow {
  id: string
  code: string
  name: string
  default_quota_type: QuotaType
  has_warranty?: boolean
  allow_unlimited?: boolean
  sort_order?: number
  is_active?: boolean
}

interface TreatmentPackageRow extends TreatmentPackage {
  service_ids?: string[]
  package_type?: { id?: string; name?: string; code?: string } | null
}

type PackageColumnKey = 'name' | 'branch' | 'type' | 'quota' | 'services' | 'price' | 'validity' | 'bonus' | 'status'
type PackageFiltersForm = { package_type_id?: string; branch_id?: string; is_active?: 'true' | 'false' }
type PackageTypeForm = {
  code: string
  name: string
  default_quota_type: QuotaType
  has_warranty: boolean
  allow_unlimited: boolean
  sort_order: number
  is_active: boolean
}

const QUOTA_LABEL: Record<QuotaType, string> = {
  SESSIONS: 'Theo số buổi',
  VALUE: 'Theo định mức tiền',
  UNLIMITED: 'Trọn gói',
}
const VALIDITY_LABEL: Record<ValidityUnit, string> = {
  DAY: 'ngày',
  WEEK: 'tuần',
  MONTH: 'tháng',
}
const COLUMN_OPTIONS: { label: string; value: PackageColumnKey }[] = [
  { label: 'Tên gói', value: 'name' },
  { label: 'Cơ sở', value: 'branch' },
  { label: 'Loại gói', value: 'type' },
  { label: 'Hạn mức', value: 'quota' },
  { label: 'Dịch vụ', value: 'services' },
  { label: 'Giá niêm yết', value: 'price' },
  { label: 'Thời hạn', value: 'validity' },
  { label: 'Buổi tặng', value: 'bonus' },
  { label: 'Trạng thái', value: 'status' },
]
const DEFAULT_COLUMNS: PackageColumnKey[] = ['name', 'branch', 'type', 'quota', 'price', 'status']
const PACKAGE_TYPE_QUOTA_OPTIONS = Object.entries(QUOTA_LABEL).map(([value, label]) => ({ value, label }))
const PACKAGE_STATUS_OPTIONS = [
  { value: 'true', label: 'Đang bán' },
  { value: 'false', label: 'Đã ẩn' },
]

function quotaLabel(row: TreatmentPackage, formatMoney: (value: unknown) => string) {
  if (row.quota_type === 'SESSIONS') return String(row.total_sessions ?? '—') + ' buổi'
  if (row.quota_type === 'VALUE') return formatMoney(row.total_value)
  return 'Không giới hạn'
}

function priceLabel(row: TreatmentPackage, formatMoney: (value: unknown) => string) {
  const minimum = formatMoney(row.list_price)
  return row.list_price_max != null
    ? minimum + ' – ' + formatMoney(row.list_price_max)
    : minimum
}

export default function Treatments() {
  const { format: formatMoney, symbol: currencySymbol } = useBrandCurrency()
  const queryClient = useQueryClient()
  // Trang quản trị liệu trình: chỉ platform admin được quản lý (giữ behavior cũ)
  const canManage = !!useProfileStore((s) => s.profile)?.is_admin
  const { isAdmin, isReceptionist, isTechnician } = useCustomerProfileAccess()
  const hideSummaryForTechnician = isTechnician && !isAdmin && !isReceptionist
  const [activeTab, setActiveTab] = useState('packages')

  const [packageOpen, setPackageOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<TreatmentPackageRow | null>(null)
  const [packageForm] = Form.useForm()
  const packageCustomFields = useCustomFieldDefinitions('PACKAGE')
  const [packageSaving, setPackageSaving] = useState(false)

  const [typeOpen, setTypeOpen] = useState(false)
  const [editingType, setEditingType] = useState<PackageTypeRow | null>(null)
  const [typeForm] = Form.useForm<PackageTypeForm>()
  const [typeSaving, setTypeSaving] = useState(false)

  const [filterOpen, setFilterOpen] = useState(false)
  const [filterForm] = Form.useForm<PackageFiltersForm>()
  const [visibleColumns, setVisibleColumns] = useState<PackageColumnKey[]>(DEFAULT_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<PackageColumnKey[]>(DEFAULT_COLUMNS)
  const [filters, setFilters] = useState<{ package_type_id?: string; branch_id?: string; is_active?: boolean }>({})

  const packagesQuery = useGetTreatmentPackages({ ...filters, page: 1, limit: 200 })
  const packageTypesQuery = useGetPackageTypes({ limit: 200 })
  const servicesQuery = useGetService({ page: 1, limit: 200 })
  const branchesQuery = useGetBranches()

  const rows = (pickData<TreatmentPackageRow[]>(packagesQuery.data) ?? []) as TreatmentPackageRow[]
  const [packageSearch, setPackageSearch] = useState('')
  const [packagePage, setPackagePage] = useState(1)
  const visibleRows = useMemo(() => {
    const keyword = packageSearch.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) =>
      String(row.name || '').toLowerCase().includes(keyword)
      || String(row.description || '').toLowerCase().includes(keyword))
  }, [rows, packageSearch])
  const pagedRows = paginateRows(visibleRows, packagePage, 10)
  // Thống kê đầu tab gói — đếm trên TẤT CẢ gói (rows) trước khi phân trang;
  // chỉ đáng tin khi không có bộ lọc server (loại gói/cơ sở/trạng thái)
  const hasServerFilters = !!(filters.package_type_id || filters.branch_id || filters.is_active !== undefined)
  const activePackageCount = rows.filter((row) => !!row.is_active).length
  const statItems: StatItem[] = hasServerFilters || hideSummaryForTechnician
    ? []
    : [
        { key: 'total', label: 'Tổng gói liệu trình', value: rows.length.toLocaleString('vi-VN'), icon: <ShoppingOutlined />, tone: 'primary' },
        { key: 'active', label: 'Đang bán', value: activePackageCount.toLocaleString('vi-VN'), icon: <EyeOutlined />, tone: 'secondary' },
        { key: 'hidden', label: 'Đã ẩn', value: (rows.length - activePackageCount).toLocaleString('vi-VN'), icon: <EyeInvisibleOutlined />, tone: 'neutral' },
      ]
  const packageTypes = (pickData<PackageTypeRow[]>(packageTypesQuery.data) ?? []) as PackageTypeRow[]
  // GET /service trả { services, total, ... } trong responseData
  const services = (pickData<{ services?: Service[] }>(servicesQuery.data)?.services ?? []) as Service[]
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const catalogLoading = packageTypesQuery.isLoading || servicesQuery.isLoading || branchesQuery.isLoading

  const selectedPackageTypeId = Form.useWatch('package_type_id', packageForm)
  const selectedQuotaType = Form.useWatch('quota_type', packageForm) as QuotaType | undefined
  const selectedPackageType = packageTypes.find((type) => type.id === selectedPackageTypeId)
  const packageQuotaOptions = PACKAGE_TYPE_QUOTA_OPTIONS.filter((option) =>
    option.value !== 'UNLIMITED' || selectedPackageType?.allow_unlimited,
  )
  const selectedTypeDefaultQuota = Form.useWatch('default_quota_type', typeForm)
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service.title])), [services])

  const createPackageMutation = usePostTreatmentPackages()
  const updatePackageMutation = usePutTreatmentPackagesId()
  const deletePackageMutation = useDeleteTreatmentPackagesId()
  const createTypeMutation = usePostPackageTypes()
  const updateTypeMutation = usePutPackageTypesId()
  const deleteTypeMutation = useDeletePackageTypesId()

  const reloadPackageTypes = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getGetPackageTypesQueryKey() })
  }, [queryClient])

  const reloadPackages = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getGetTreatmentPackagesQueryKey() })
  }, [queryClient])

  const openPackageModal = (row?: TreatmentPackageRow) => {
    if (catalogLoading) return
    setEditingPackage(row ?? null)
    packageForm.resetFields()
    const type = row?.package_type_id ? packageTypes.find((item) => item.id === row.package_type_id) : undefined
    packageForm.setFieldsValue(row ? {
      ...row,
      quota_type: row.quota_type ?? type?.default_quota_type ?? 'SESSIONS',
      list_price: row.list_price ?? 0,
      bonus_sessions_default: row.bonus_sessions_default ?? 0,
      service_ids: row.service_ids ?? [],
      custom_fields: row.custom_fields ?? {},
    } : {
      name: '',
      quota_type: 'SESSIONS',
      total_sessions: 5,
      list_price: 0,
      bonus_sessions_default: 0,
      service_ids: [],
      custom_fields: {},
      is_active: true,
    })
    setPackageOpen(true)
  }

  const submitPackage = async () => {
    const values = await packageForm.validateFields()
    setPackageSaving(true)
    try {
      const isCombo = String(selectedPackageType?.code || '').toUpperCase() === 'COMBO'
      const quotaType = values.quota_type as QuotaType
      const dto = {
        ...values,
        name: String(values.name).trim(),
        branch_id: values.branch_id || null,
        package_type_id: values.package_type_id,
        quota_type: quotaType,
        total_sessions: quotaType === 'SESSIONS' ? Number(values.total_sessions) : null,
        total_value: quotaType === 'VALUE' ? Number(values.total_value) : null,
        service_id: isCombo ? null : (values.service_id || null),
        service_ids: isCombo ? values.service_ids : [],
        warranty_text: selectedPackageType?.has_warranty ? (values.warranty_text?.trim() || null) : null,
        convertible_note: values.convertible_note?.trim() || null,
        terms: values.terms?.trim() || null,
        description: values.description?.trim() || null,
        validity_value: values.validity_value ? Number(values.validity_value) : null,
        validity_unit: values.validity_value ? values.validity_unit : null,
        bonus_sessions_default: Number(values.bonus_sessions_default ?? 0),
        list_price: Number(values.list_price ?? 0),
        list_price_max: values.list_price_max == null ? null : Number(values.list_price_max),
        custom_fields: normalizeCustomFieldValues(packageCustomFields, values.custom_fields ?? {}, editingPackage?.custom_fields ?? {}),
      }
      if (editingPackage) {
        await updatePackageMutation.mutateAsync({ id: editingPackage.id, data: dto as never })
        message.success('Đã cập nhật gói dịch vụ')
      } else {
        await createPackageMutation.mutateAsync({ data: dto as never })
        message.success('Đã tạo gói dịch vụ')
      }
      setPackageOpen(false)
      await reloadPackages()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(errorMessage(err))
    } finally {
      setPackageSaving(false)
    }
  }

  const hidePackage = async (row: TreatmentPackageRow) => {
    try {
      await deletePackageMutation.mutateAsync({ id: row.id })
      message.success('Đã ẩn gói dịch vụ')
      await reloadPackages()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const restorePackage = async (row: TreatmentPackageRow) => {
    try {
      await updatePackageMutation.mutateAsync({ id: row.id, data: { is_active: true } as never })
      message.success('Đã bật lại gói dịch vụ')
      await reloadPackages()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openTypeModal = (row?: PackageTypeRow) => {
    setEditingType(row ?? null)
    typeForm.resetFields()
    typeForm.setFieldsValue(row ? {
      code: row.code,
      name: row.name,
      default_quota_type: row.default_quota_type,
      has_warranty: !!row.has_warranty,
      allow_unlimited: !!row.allow_unlimited,
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active ?? true,
    } : {
      code: '',
      name: '',
      default_quota_type: 'SESSIONS',
      has_warranty: false,
      allow_unlimited: false,
      sort_order: 0,
      is_active: true,
    })
    setTypeOpen(true)
  }

  const submitType = async () => {
    const values = await typeForm.validateFields()
    setTypeSaving(true)
    try {
      const dto = {
        ...values,
        code: String(values.code).trim().toUpperCase(),
        name: String(values.name).trim(),
        has_warranty: values.default_quota_type === 'UNLIMITED' || !!values.has_warranty,
        allow_unlimited: values.default_quota_type === 'UNLIMITED' || !!values.allow_unlimited,
      }
      if (editingType) {
        await updateTypeMutation.mutateAsync({ id: editingType.id, data: dto as never })
        message.success('Đã cập nhật loại gói')
      } else {
        await createTypeMutation.mutateAsync({ data: dto as never })
        message.success('Đã tạo loại gói')
      }
      setTypeOpen(false)
      await reloadPackageTypes()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(errorMessage(err))
    } finally {
      setTypeSaving(false)
    }
  }

  const hideType = async (row: PackageTypeRow) => {
    try {
      await deleteTypeMutation.mutateAsync({ id: row.id })
      message.success('Đã ẩn loại gói')
      await reloadPackageTypes()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (!draftVisibleColumns.length) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    const next: { package_type_id?: string; branch_id?: string; is_active?: boolean } = {}
    if (typeof values.package_type_id === 'string' && values.package_type_id) next.package_type_id = values.package_type_id
    if (typeof values.branch_id === 'string' && values.branch_id) next.branch_id = values.branch_id
    if (values.is_active === 'true' || values.is_active === 'false') next.is_active = values.is_active === 'true'
    setFilters(next)
    setVisibleColumns(draftVisibleColumns)
    setPackagePage(1)
    setFilterOpen(false)
  }

  const openFilters = (open: boolean) => {
    if (open) {
      setDraftVisibleColumns(visibleColumns)
      filterForm.setFieldsValue({
        package_type_id: filters.package_type_id,
        branch_id: filters.branch_id,
        is_active: filters.is_active === undefined ? undefined : String(filters.is_active) as 'true' | 'false',
      })
    }
    setFilterOpen(open)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setPackageSearch('')
    setPackagePage(1)
    setFilters({})
    setVisibleColumns(DEFAULT_COLUMNS)
    setDraftVisibleColumns(DEFAULT_COLUMNS)
  }

  const activeFilterCount = Object.values(filters).filter((value) => value !== undefined && value !== '').length + (packageSearch.trim() ? 1 : 0)

  const packageColumns: TableColumnsType<TreatmentPackageRow> = [
    {
      title: 'Gói dịch vụ',
      key: 'name',
      dataIndex: 'name',
      width: 250,
      render: (name, row) => (
        <div>
          <Typography.Text strong>{name}</Typography.Text>
          {row.description && <div style={{ color: '#777', fontSize: 12 }}>{row.description}</div>}
        </div>
      ),
    },
    { title: 'Cơ sở', key: 'branch', dataIndex: 'branch_id', width: 140, render: (id) => id ? branches.find((branch) => branch.id === id)?.name ?? '—' : 'Tất cả cơ sở' },
    {
      title: 'Loại gói',
      key: 'type',
      dataIndex: 'package_type_id',
      width: 190,
      render: (_value, row) => {
        const type = row.package_type ?? packageTypes.find((item) => item.id === row.package_type_id)
        return <Tag color="purple">{type?.name ?? type?.code ?? 'Chưa phân loại'}</Tag>
      },
    },
    {
      title: 'Hạn mức',
      key: 'quota',
      width: 170,
      render: (_value, row) => <Tag>{quotaLabel(row, formatMoney)}</Tag>,
    },
    {
      title: 'Dịch vụ',
      key: 'services',
      width: 220,
      render: (_value, row) => {
        const ids = row.service_ids?.length ? row.service_ids : row.service_id ? [row.service_id] : []
        return ids.length ? ids.map((id) => serviceById.get(id) ?? 'Dịch vụ').join(', ') : '—'
      },
    },
    { title: 'Giá niêm yết', key: 'price', width: 170, render: (_value, row) => priceLabel(row, formatMoney) },
    {
      title: 'Thời hạn',
      key: 'validity',
      width: 130,
      render: (_value, row) => row.validity_value && row.validity_unit
        ? String(row.validity_value) + ' ' + (VALIDITY_LABEL[row.validity_unit] ?? row.validity_unit)
        : 'Không thời hạn',
    },
    { title: 'Buổi tặng', key: 'bonus', dataIndex: 'bonus_sessions_default', width: 100, render: (value) => Number(value ?? 0) },
    { title: 'Trạng thái', key: 'status', dataIndex: 'is_active', width: 110, render: (active) => active ? <Tag color="green">Đang bán</Tag> : <Tag>Đã ẩn</Tag> },
  ]

  const visiblePackageColumns = packageColumns.filter((column) => visibleColumns.includes(column.key as PackageColumnKey))

  const packageTypeColumns: TableColumnsType<PackageTypeRow> = [
    { title: 'Tên loại gói', dataIndex: 'name', render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Mã loại', dataIndex: 'code', render: (value) => <Tag>{value}</Tag> },
    { title: 'Hạn mức mặc định', dataIndex: 'default_quota_type', render: (value: QuotaType) => QUOTA_LABEL[value] ?? value },
    { title: 'Bảo hành', dataIndex: 'has_warranty', render: (value) => value ? 'Có' : 'Không' },
    { title: 'Cho phép trọn gói', dataIndex: 'allow_unlimited', render: (value) => value ? 'Có' : 'Không' },
    { title: 'Trạng thái', dataIndex: 'is_active', render: (value) => value ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã ẩn</Tag> },
    ...(canManage ? [{
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      render: (_value: unknown, row: PackageTypeRow) => (
        <Space>
          <Button size="small" onClick={() => openTypeModal(row)}>Sửa</Button>
          {row.is_active && (
            <Popconfirm title="Ẩn loại gói này?" okText="Ẩn" cancelText="Hủy" onConfirm={() => hideType(row)}>
              <Button size="small" danger>Ẩn</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ]

  return (
    <>
      <PageTitle subtitle="Danh mục gói liệu trình và loại gói dịch vụ">
        Liệu trình
      </PageTitle>
      <StatCards items={statItems} />

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'packages',
            label: 'Danh mục gói',
            children: (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <Typography.Title level={5} style={{ margin: 0, color: 'var(--brand-secondary-ink)' }}>
                      Danh mục gói
                    </Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      Các gói liệu trình hiện có, trạng thái bán và giá niêm yết
                    </Typography.Text>
                  </div>
                  <Space wrap>
                    <Input
                      allowClear
                      prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
                      placeholder="Tìm theo tên gói"
                      style={{ width: 260 }}
                      value={packageSearch}
                      onChange={(event) => {
                        setPackageSearch(event.target.value)
                        setPackagePage(1)
                      }}
                    />
                    <ListFilterPopover
                      open={filterOpen}
                      onOpenChange={openFilters}
                      activeFilterCount={activeFilterCount}
                      form={filterForm}
                      onApply={applyFilters}
                      onClear={clearFilters}
                      columnOptions={COLUMN_OPTIONS}
                      draftVisibleColumns={draftVisibleColumns}
                      onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as PackageColumnKey[])}
                      filterItems={(
                        <>
                          <Form.Item name="package_type_id" label="Loại gói" style={{ marginBottom: 10 }}>
                            <Select allowClear placeholder="Tất cả loại gói" options={packageTypes.map((type) => ({ value: type.id, label: type.name }))} />
                          </Form.Item>
                          <Form.Item name="branch_id" label="Cơ sở" style={{ marginBottom: 10 }}>
                            <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
                          </Form.Item>
                          <Form.Item name="is_active" label="Trạng thái" style={{ marginBottom: 0 }}>
                            <Select allowClear placeholder="Tất cả trạng thái" options={PACKAGE_STATUS_OPTIONS} />
                          </Form.Item>
                        </>
                      )}
                    />
                    {canManage && (
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openPackageModal()}>
                        Thêm gói
                      </Button>
                    )}
                  </Space>
                </div>
                {packagesQuery.isError && <Alert type="error" showIcon message="Không tải được danh mục gói" description={errorMessage(packagesQuery.error)} style={{ margin: '12px 0' }} />}
                <Table<TreatmentPackageRow>
                  rowKey="id"
                  loading={packagesQuery.isLoading}
                  dataSource={pagedRows}
                  scroll={{ x: 1100 }}
                  pagination={false}
                columns={[
                  ...visiblePackageColumns,
                  ...(canManage ? [{
                    title: 'Hành động',
                    key: 'actions',
                    width: 140,
                    fixed: 'right' as const,
                    render: (_value: unknown, row: TreatmentPackageRow) => (
                      <RowActionsMenu
                        items={[
                          { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
                          ...(row.is_active
                            ? [{ key: 'hide', icon: <EyeInvisibleOutlined />, danger: true, label: 'Ẩn' }]
                            : [{ key: 'restore', icon: <EyeOutlined />, label: 'Bật lại' }]),
                        ]}
                        onSelect={(key) => {
                          if (key === 'edit') openPackageModal(row)
                          else if (key === 'hide') {
                            Modal.confirm({
                              title: 'Ẩn gói dịch vụ này?',
                              okText: 'Ẩn',
                              okButtonProps: { danger: true },
                              cancelText: 'Hủy',
                              onOk: () => hidePackage(row),
                            })
                          } else if (key === 'restore') void restorePackage(row)
                        }}
                      />
                    ),
                  }] : []),
                ]}
              />
              <ListPagination page={packagePage} limit={10} total={visibleRows.length} onChange={setPackagePage} noun="gói dịch vụ" />
            </>
          ),
        },
        {
          key: 'types',
          label: 'Loại gói',
          children: (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <Typography.Title level={5} style={{ margin: 0, color: 'var(--brand-secondary-ink)' }}>
                    Loại gói
                  </Typography.Title>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    Phân nhóm gói liệu trình theo loại
                  </Typography.Text>
                </div>
                {canManage && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openTypeModal()}>
                    Thêm loại gói
                  </Button>
                )}
              </div>
              <Table<PackageTypeRow>
                rowKey="id"
                loading={packageTypesQuery.isLoading}
                dataSource={packageTypes}
                columns={packageTypeColumns}
                pagination={false}
              />
            </>
          ),
        },
      ]} />

      <Modal
        title={editingPackage ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}
        open={packageOpen}
        onCancel={() => setPackageOpen(false)}
        onOk={submitPackage}
        confirmLoading={packageSaving}
        okText="Lưu"
        cancelText="Hủy"
        width="min(960px, calc(100vw - 24px))"
      >
        {!packageTypes.some((type) => type.is_active !== false) && (
          <Alert type="warning" showIcon message="Hãy tạo hoặc kích hoạt loại gói trước khi tạo gói dịch vụ." style={{ marginBottom: 16 }} />
        )}
        <Form form={packageForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên gói" rules={[{ required: true, whitespace: true, message: 'Nhập tên gói' }]}>
            <Input placeholder="VD: Peel Acne chuyên sâu" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="package_type_id" label="Loại gói" rules={[{ required: true, message: 'Chọn loại gói' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn loại gói"
                  options={packageTypes
                    .filter((type) => type.is_active !== false || type.id === editingPackage?.package_type_id)
                    .map((type) => ({ value: type.id, label: type.name + (type.is_active === false ? ' (đã ẩn)' : '') }))}
                  onChange={(typeId) => {
                    const type = packageTypes.find((item) => item.id === typeId)
                    if (!type) return
                    packageForm.setFieldsValue({
                      quota_type: type.default_quota_type,
                      total_sessions: type.default_quota_type === 'SESSIONS' ? 5 : undefined,
                      total_value: undefined,
                      service_id: undefined,
                      service_ids: [],
                      warranty_text: undefined,
                    })
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="quota_type" label="Cách tính hạn mức" rules={[{ required: true, message: 'Chọn cách tính hạn mức' }]}>
                <Select options={packageQuotaOptions} onChange={(value: QuotaType) => {
                  if (value !== 'SESSIONS') packageForm.setFieldValue('total_sessions', undefined)
                  if (value !== 'VALUE') packageForm.setFieldValue('total_value', undefined)
                  if (value !== 'UNLIMITED') packageForm.setFieldValue('warranty_text', undefined)
                }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              {selectedQuotaType === 'SESSIONS' && (
                <Form.Item name="total_sessions" label="Số buổi" rules={[{ required: true, message: 'Nhập số buổi' }]}>
                  <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              )}
              {selectedQuotaType === 'VALUE' && (
                <Form.Item name="total_value" label="Định mức tiền" rules={[{ required: true, message: 'Nhập định mức tiền' }]}>
                  <InputNumber min={1} precision={0} step={1000000} suffix={currencySymbol} style={{ width: '100%' }} />
                </Form.Item>
              )}
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="list_price" label="Giá từ" rules={[{ required: true, message: 'Nhập giá niêm yết' }]}>
                <InputNumber min={0} precision={0} step={100000} suffix={currencySymbol} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="list_price_max"
                label="Giá đến (tùy chọn)"
                dependencies={['list_price']}
                rules={[({ getFieldValue }) => ({
                  validator: (_rule, value) => value == null || Number(value) >= Number(getFieldValue('list_price') ?? 0)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Giá đến phải lớn hơn hoặc bằng giá từ')),
                })]}
              >
                <InputNumber min={0} precision={0} step={100000} suffix={currencySymbol} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="branch_id" label="Cơ sở">
                <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
              </Form.Item>
            </Col>
          </Row>
          {selectedQuotaType === 'UNLIMITED' && (
            <Alert type="info" showIcon message="Gói trọn gói không giới hạn số buổi." style={{ marginBottom: 16 }} />
          )}
          {String(selectedPackageType?.code || '').toUpperCase() === 'COMBO' ? (
            <Form.Item
              name="service_ids"
              label="Dịch vụ trong combo"
              rules={[{
                validator: (_rule, value: string[] | undefined) => value && value.length >= 2
                  ? Promise.resolve()
                  : Promise.reject(new Error('Combo cần chọn ít nhất 2 dịch vụ')),
              }]}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder="Chọn từ 2 dịch vụ"
                options={services.map((service) => ({ value: service.id, label: service.title }))}
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="service_id"
              label="Dịch vụ áp dụng"
              rules={String(selectedPackageType?.code || '').toUpperCase() === 'SINGLE_SESSION' ? [{ required: true, message: 'Gói lẻ cần chọn một dịch vụ' }] : []}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Chọn dịch vụ (không bắt buộc)"
                options={services.map((service) => ({ value: service.id, label: service.title }))}
              />
            </Form.Item>
          )}
          <Collapse
            ghost
            items={[{
              key: 'advanced',
              label: 'Tùy chọn nâng cao (mô tả, buổi tặng, thời hạn, bảo hành, điều khoản)',
              forceRender: true,
              children: (
                <>
                  <Form.Item name="description" label="Mô tả">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="bonus_sessions_default" label="Buổi tặng mặc định">
                        <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="validity_value"
                        label="Thời hạn (tùy chọn)"
                        dependencies={['validity_unit']}
                        rules={[({ getFieldValue }) => ({
                          validator: (_rule, value) => (value == null) === (getFieldValue('validity_unit') == null)
                            ? Promise.resolve()
                            : Promise.reject(new Error('Cần nhập cả thời hạn và đơn vị')),
                        })]}
                      >
                        <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="validity_unit" label="Đơn vị">
                        <Select allowClear options={[
                          { value: 'DAY', label: 'Ngày' },
                          { value: 'WEEK', label: 'Tuần' },
                          { value: 'MONTH', label: 'Tháng' },
                        ]} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="convertible_note" label="Điều kiện đổi buổi tặng">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  {selectedPackageType?.has_warranty && (
                    <Form.Item name="warranty_text" label="Nội dung bảo hành">
                      <Input.TextArea rows={3} />
                    </Form.Item>
                  )}
                  <Form.Item name="terms" label="Điều khoản">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                  <Form.Item name="is_active" label="Đang bán" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </>
              ),
            }]}
          />
          <CustomFieldFormItems definitions={packageCustomFields} />
        </Form>
      </Modal>

      <Modal
        title={editingType ? 'Sửa loại gói' : 'Thêm loại gói'}
        open={typeOpen}
        onCancel={() => setTypeOpen(false)}
        onOk={submitType}
        confirmLoading={typeSaving}
        okText="Lưu"
        cancelText="Hủy"
        width="min(760px, calc(100vw - 24px))"
      >
        <Form form={typeForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Mã loại"
                rules={[
                  { required: true, whitespace: true, message: 'Nhập mã loại' },
                  { pattern: /^[A-Z][A-Z0-9_]{0,49}$/, message: 'Dùng chữ in hoa, số hoặc dấu gạch dưới; ví dụ COMBO' },
                ]}
              >
                <Input disabled={!!editingType} placeholder="VD: COMBO" onChange={(event) => typeForm.setFieldValue('code', event.target.value.toUpperCase())} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="Tên loại" rules={[{ required: true, whitespace: true, message: 'Nhập tên loại' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="default_quota_type" label="Hạn mức mặc định" rules={[{ required: true }]}>
                <Select
                  options={PACKAGE_TYPE_QUOTA_OPTIONS}
                  onChange={(value: QuotaType) => {
                    if (value === 'UNLIMITED') typeForm.setFieldsValue({ has_warranty: true, allow_unlimited: true })
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sort_order" label="Thứ tự hiển thị">
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          {selectedTypeDefaultQuota === 'UNLIMITED' && <Alert type="info" showIcon message="Loại trọn gói cần bật bảo hành và cho phép không giới hạn." style={{ marginBottom: 12 }} />}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="has_warranty" label="Có bảo hành" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="allow_unlimited" label="Cho phép trọn gói" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            {editingType && (
              <Col span={8}>
                <Form.Item name="is_active" label="Đang sử dụng" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
      </Modal>
    </>
  )
}
