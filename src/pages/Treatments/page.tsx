import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Grid, Input, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined, SearchOutlined, ShoppingOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { paginateRows } from '@/utils/listTable'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { Service } from '@/api/models/service'
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
import { useBrandCurrency } from '@/themeRuntime'

import TreatmentPackageModal from './components/TreatmentPackageModal'
import TreatmentTypeModal from './components/TreatmentTypeModal'
import {
  VALIDITY_LABEL,
  PACKAGE_TYPE_QUOTA_OPTIONS,
  QUOTA_LABEL,
  quotaLabel,
  priceLabel,
  type PackageTypeForm,
  type PackageTypeRow,
  type QuotaType,
  type TreatmentPackageRow,
} from './components/constants'

export default function Treatments() {
  const { format: formatMoney, symbol: currencySymbol } = useBrandCurrency()
  const queryClient = useQueryClient()
  // Trang quản trị liệu trình: chỉ admin hệ thống (vai trò Admin) được quản lý (giữ behavior cũ)
  const canManage = useCustomerProfileAccess().isAdmin
  const { isAdmin, isReceptionist, isTechnician } = useCustomerProfileAccess()
  const hideSummaryForTechnician = isTechnician && !isAdmin && !isReceptionist
  const [activeTab, setActiveTab] = useState('packages')
  // Mobile (dưới breakpoint md): chuyển vùng nội dung bằng Select thay vì Tabs
  const isMobile = !Grid.useBreakpoint().md
  // Mobile: search thu về nút icon, bấm mới mở ô tìm kiếm
  const [searchOpen, setSearchOpen] = useState(false)

  const [packageOpen, setPackageOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<TreatmentPackageRow | null>(null)
  const [packageForm] = Form.useForm()
  const packageCustomFields = useCustomFieldDefinitions('PACKAGE')
  const [packageSaving, setPackageSaving] = useState(false)

  const [typeOpen, setTypeOpen] = useState(false)
  const [editingType, setEditingType] = useState<PackageTypeRow | null>(null)
  const [typeForm] = Form.useForm<PackageTypeForm>()
  const [typeSaving, setTypeSaving] = useState(false)

  const packagesQuery = useGetTreatmentPackages({ page: 1, limit: 200 })
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


  const activePackageCount = rows.filter((row) => !!row.is_active).length
  const statItems: StatItem[] = hideSummaryForTechnician
    ? []
    : [
      { key: 'total', label: 'Tổng gói liệu trình', value: rows.length.toLocaleString('vi-VN'), icon: <ShoppingOutlined />, tone: 'primary' },
      { key: 'active', label: 'Đang bán', value: activePackageCount.toLocaleString('vi-VN'), icon: <EyeOutlined />, tone: 'secondary' },
      { key: 'hidden', label: 'Đã ẩn', value: (rows.length - activePackageCount).toLocaleString('vi-VN'), icon: <EyeInvisibleOutlined />, tone: 'neutral' },
    ]
  const packageTypeData = pickData<PackageTypeRow[] | { rows?: PackageTypeRow[] }>(packageTypesQuery.data)
  const packageTypes = (Array.isArray(packageTypeData) ? packageTypeData : packageTypeData?.rows ?? []) as PackageTypeRow[]
  // Tìm kiếm loại gói (client-side) + phân trang tab loại
  const [typeSearch, setTypeSearch] = useState('')
  const filteredPackageTypes = useMemo(() => {
    const keyword = typeSearch.trim().toLocaleLowerCase('vi-VN')
    if (!keyword) return packageTypes
    return packageTypes.filter((row) => [row.name, row.code].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(keyword))
  }, [packageTypes, typeSearch])
  const packageTypeById = new Map(packageTypes.map((type) => [String(type.id), type]))
  // GET /service trả { services, total, ... } trong responseData
  const services = (pickData<{ services?: Service[] }>(servicesQuery.data)?.services ?? []) as Service[]
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const catalogLoading = packageTypesQuery.isLoading || servicesQuery.isLoading || branchesQuery.isLoading

  const selectedPackageTypeId = Form.useWatch('package_type_id', packageForm)
  const selectedQuotaType = Form.useWatch('quota_type', packageForm) as QuotaType | undefined
  const selectedPackageListPrice = Form.useWatch('list_price', packageForm)
  const selectedPackageType = packageTypeById.get(String(selectedPackageTypeId))
  const packageQuotaOptions = PACKAGE_TYPE_QUOTA_OPTIONS.filter((option) =>
    option.value !== 'UNLIMITED' || selectedPackageType?.allow_unlimited,
  )
  const selectedTypeDefaultQuota = Form.useWatch('default_quota_type', typeForm)
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service.title])), [services])

  useEffect(() => {
    if (selectedQuotaType === 'VALUE') {
      packageForm.setFieldValue('total_value', Number(selectedPackageListPrice ?? 0))
    }
  }, [packageForm, selectedPackageListPrice, selectedQuotaType])

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
    const packageTypeId = row?.package_type_id ?? row?.package_type?.id
    const type = packageTypeId ? packageTypeById.get(String(packageTypeId)) : undefined
    packageForm.setFieldsValue(row ? {
      ...row,
      package_type_id: packageTypeId ? String(packageTypeId) : undefined,
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
        total_value: quotaType === 'VALUE' ? Number(values.list_price) : null,
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
        const type = row.package_type && typeof row.package_type === 'object'
          ? row.package_type
          : packageTypeById.get(String(row.package_type_id))
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

  const visiblePackageColumns = packageColumns

  const packageTypeColumns: TableColumnsType<PackageTypeRow> = [
    { title: 'Tên loại gói', dataIndex: 'name', render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Mã loại', dataIndex: 'code', render: (value) => <Tag>{value}</Tag> },
    { title: 'Hạn mức mặc định', dataIndex: 'default_quota_type', render: (value: QuotaType) => QUOTA_LABEL[value] ?? value },
    { title: 'Bảo hành', dataIndex: 'has_warranty', render: (value) => value ? 'Có' : 'Không' },
    { title: 'Cho phép trọn gói', dataIndex: 'allow_unlimited', render: (value) => value ? 'Có' : 'Không' },
    { title: 'Trạng thái', dataIndex: 'is_active', render: (value) => value ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã ẩn</Tag> },
    ...(canManage ? [{
      title: 'Thao tác', align: 'center' as const,
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

  const packagesContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          {/* Mobile: gọn toolbar — search thu về nút icon, bấm mới mở */}
          {isMobile && !searchOpen && (
            <Button icon={<SearchOutlined />} aria-label="Tìm kiếm" title="Tìm kiếm" onClick={() => setSearchOpen(true)} />
          )}
          {(searchOpen || !isMobile) && (
            <Input
              allowClear
              prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
              placeholder="Tìm theo tên gói"
              className={isMobile && searchOpen ? 'min-w-0 flex-1' : 'w-[260px]!'}
              value={packageSearch}
              onChange={(event) => {
                setPackageSearch(event.target.value)
                setPackagePage(1)
              }}
              onBlur={() => { if (isMobile && !packageSearch) setSearchOpen(false) }}
            />
          )}
        </div>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openPackageModal()}>
            Thêm gói
          </Button>
        )}
      </div>
      {packagesQuery.isError && <Alert type="error" showIcon message="Không tải được danh mục gói" description={errorMessage(packagesQuery.error)} style={{ margin: '12px 0' }} />}
      <Table<TreatmentPackageRow>
        className="desktop-only"
        rowKey="id"
        loading={packagesQuery.isLoading}
        dataSource={pagedRows}
        scroll={{ x: 1100 }}
        pagination={false}
        columns={[
          ...visiblePackageColumns,
          ...(canManage ? [{
            title: 'Hành động', align: 'center' as const,
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
      <MobileCards
        rows={pagedRows}
        rowKey={(row) => row.id}
        loading={packagesQuery.isLoading}
        emptyText="Chưa có gói dịch vụ nào"
        renderCard={(row) => (
          <>
            <div className="mobile-card-head">
              <div className="mobile-card-title">{row.name}</div>
              {row.is_active ? <Tag color="green">Đang bán</Tag> : <Tag>Đã ẩn</Tag>}
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Hạn mức" value={quotaLabel(row, formatMoney)} />
              <MobileCardRow label="Giá niêm yết" value={priceLabel(row, formatMoney)} />
            </div>
            {canManage && (
              <div className="mobile-card-actions">
                <Button size="small" icon={<EditOutlined />} onClick={() => openPackageModal(row)}>Sửa</Button>
                {row.is_active
                  ? <Button size="small" danger onClick={() => Modal.confirm({ title: 'Ẩn gói dịch vụ này?', okText: 'Ẩn', okButtonProps: { danger: true }, cancelText: 'Hủy', onOk: () => hidePackage(row) })}>Ẩn</Button>
                  : <Button size="small" onClick={() => void restorePackage(row)}>Bật lại</Button>}
              </div>
            )}
          </>
        )}
      />
      <ListPagination page={packagePage} limit={10} total={visibleRows.length} onChange={setPackagePage} noun="gói dịch vụ" />
    </>
  )

  const typesContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
          placeholder="Tìm theo tên hoặc mã loại gói"
          style={{ width: 260 }}
          value={typeSearch}
          onChange={(event) => setTypeSearch(event.target.value)}
        />
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openTypeModal()}>
            Thêm loại gói
          </Button>
        )}
      </div>
      <Table<PackageTypeRow>
        className="desktop-only"
        rowKey="id"
        loading={packageTypesQuery.isLoading}
        dataSource={filteredPackageTypes}
        columns={packageTypeColumns}
        pagination={false}
      />
      <MobileCards
        rows={filteredPackageTypes}
        rowKey={(row) => row.id}
        loading={packageTypesQuery.isLoading}
        emptyText="Chưa có loại gói nào"
        renderCard={(row) => (
          <>
            <div className="mobile-card-head">
              <div className="mobile-card-title">{row.name}</div>
              {row.is_active ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã ẩn</Tag>}
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Mã loại" value={row.code || '—'} />
              <MobileCardRow label="Hạn mức mặc định" value={row.default_quota_type ? (QUOTA_LABEL[row.default_quota_type] ?? row.default_quota_type) : '—'} />
              <MobileCardRow label="Bảo hành" value={row.has_warranty ? 'Có' : 'Không'} />
              <MobileCardRow label="Cho phép trọn gói" value={row.allow_unlimited ? 'Có' : 'Không'} />
            </div>
            {canManage && (
              <div className="mobile-card-actions">
                <Button size="small" onClick={() => openTypeModal(row)}>Sửa</Button>
                {row.is_active && (
                  <Popconfirm title="Ẩn loại gói này?" okText="Ẩn" cancelText="Hủy" onConfirm={() => hideType(row)}>
                    <Button size="small" danger>Ẩn</Button>
                  </Popconfirm>
                )}
              </div>
            )}
          </>
        )}
      />
    </>
  )

  return (
    <>
      <PageTitle subtitle="Danh mục gói liệu trình và loại gói dịch vụ">
        Liệu trình
      </PageTitle>
      <StatCards items={statItems} />

      {isMobile && (
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'packages', label: 'Danh mục gói' },
            { value: 'types', label: 'Loại gói' },
          ]}
        />
      )}
      {!isMobile ? (
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          { key: 'packages', label: 'Danh mục gói', children: packagesContent },
          { key: 'types', label: 'Loại gói', children: typesContent },
        ]} />
      ) : (
        activeTab === 'packages' ? packagesContent : typesContent
      )}

      <TreatmentPackageModal
        form={packageForm}
        open={packageOpen}
        editing={editingPackage}
        packageTypes={packageTypes}
        packageTypeById={packageTypeById}
        services={services}
        branches={branches}
        packageQuotaOptions={packageQuotaOptions}
        selectedQuotaType={selectedQuotaType}
        selectedPackageType={selectedPackageType}
        packageCustomFields={packageCustomFields}
        currencySymbol={currencySymbol}
        saving={packageSaving}
        onCancel={() => setPackageOpen(false)}
        onOk={submitPackage}
      />

      <TreatmentTypeModal
        form={typeForm}
        open={typeOpen}
        editing={editingType}
        selectedDefaultQuota={selectedTypeDefaultQuota}
        saving={typeSaving}
        onCancel={() => setTypeOpen(false)}
        onOk={submitType}
      />
    </>
  )
}
