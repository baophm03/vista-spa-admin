import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Image, Form, Grid, Input, Modal, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PictureOutlined, PlusOutlined, SearchOutlined, ShoppingOutlined } from '@ant-design/icons'
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
import { fileSrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { Branch } from '@/api/models/branch'
import type { Service } from '@/api/models/service'
import {
  getGetTreatmentPackagesQueryKey,
  useDeleteTreatmentPackagesId,
  useGetPackageTypes,
  useGetService,
  useGetTreatmentPackages,
  usePostTreatmentPackages,
  usePutTreatmentPackagesId,
} from '@/api/endpoints/services'
import { useGetBranches } from '@/api/endpoints/branches'
import { useBrandCurrency } from '@/themeRuntime'

import TreatmentPackageModal from './components/TreatmentPackageModal'
import TreatmentPackageDetailModal from './components/TreatmentPackageDetailModal'
import {
  FIXED_PACKAGE_TYPE_CODE,
  UNLIMITED_PACKAGE_TYPE_CODE,
  VALIDITY_LABEL,

  priceLabel,
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
  // Mobile (dưới breakpoint md): search thu về nút icon, bấm mới mở ô tìm kiếm
  const isMobile = !Grid.useBreakpoint().md
  const [searchOpen, setSearchOpen] = useState(false)

  const [packageOpen, setPackageOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<TreatmentPackageRow | null>(null)
  const [packageForm] = Form.useForm()
  const packageCustomFields = useCustomFieldDefinitions('PACKAGE')
  const [packageSaving, setPackageSaving] = useState(false)

  const packagesQuery = useGetTreatmentPackages({ page: 1, limit: 200 })
  const packageTypesQuery = useGetPackageTypes({ limit: 200 })
  const servicesQuery = useGetService({ page: 1, limit: 200 })
  const branchesQuery = useGetBranches()

  const rows = (pickData<TreatmentPackageRow[]>(packagesQuery.data) ?? []) as TreatmentPackageRow[]
  const [packageSearch, setPackageSearch] = useState('')
  const [packagePage, setPackagePage] = useState(1)
  const [detailRow, setDetailRow] = useState<TreatmentPackageRow | null>(null)
  const visibleRows = useMemo(() => {
    const keyword = packageSearch.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) =>
      String(row.name || '').toLowerCase().includes(keyword)
      || String(row.description || '').toLowerCase().includes(keyword))
  }, [rows, packageSearch])
  const pagedRows = paginateRows(visibleRows, packagePage, 10)

  const activePackageCount = rows.filter((row) => !!row.is_active).length
  const statItems: StatItem[] = hideSummaryForTechnician
    ? []
    : [
      { key: 'total', label: 'Tổng gói liệu trình', value: rows.length.toLocaleString('vi-VN'), icon: <ShoppingOutlined />, tone: 'primary' },
      { key: 'active', label: 'Đang bán', value: activePackageCount.toLocaleString('vi-VN'), icon: <EyeOutlined />, tone: 'secondary' },
      { key: 'hidden', label: 'Ngưng sử dụng', value: (rows.length - activePackageCount).toLocaleString('vi-VN'), icon: <EyeInvisibleOutlined />, tone: 'neutral' },
    ]
  const packageTypeData = pickData<PackageTypeRow[] | { rows?: PackageTypeRow[] }>(packageTypesQuery.data)
  const packageTypes = (Array.isArray(packageTypeData) ? packageTypeData : packageTypeData?.rows ?? []) as PackageTypeRow[]
  const packageTypeByCode = new Map(packageTypes.map((type) => [String(type.code).toUpperCase(), type]))
  const packageTypeById = new Map(packageTypes.map((type) => [String(type.id), type]))
  // GET /service trả { services, total, ... } trong responseData
  const services = (pickData<{ services?: Service[] }>(servicesQuery.data)?.services ?? []) as Service[]
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const catalogLoading = packageTypesQuery.isLoading || servicesQuery.isLoading || branchesQuery.isLoading
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service.title])), [services])
  const urlMap = useFileUrlMap()

  const createPackageMutation = usePostTreatmentPackages()
  const updatePackageMutation = usePutTreatmentPackagesId()
  const deletePackageMutation = useDeleteTreatmentPackagesId()

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
      quota_type: row.quota_type ?? (type && String(type.code).toUpperCase() === UNLIMITED_PACKAGE_TYPE_CODE ? 'UNLIMITED' : 'SESSIONS'),
      has_warranty: !!row.warranty_text,
      list_price: row.list_price ?? 0,
      service_id: row.service_id ?? undefined,
      custom_fields: row.custom_fields ?? {},
    } : {
      name: '',
      package_type_id: packageTypeByCode.get(FIXED_PACKAGE_TYPE_CODE)?.id,
      quota_type: 'SESSIONS',
      total_sessions: 5,
      has_warranty: false,
      list_price: 0,
      service_id: undefined,
      custom_fields: {},
      is_active: true,
    })
    setPackageOpen(true)
  }

  const submitPackage = async () => {
    const values = await packageForm.validateFields()
    setPackageSaving(true)
    try {
      const quotaType = values.quota_type as QuotaType
      const warrantyText = values.warranty_text?.trim() || null
      const dto = {
        ...values,
        name: String(values.name).trim(),
        is_active: values.is_active !== false,
        branch_id: values.branch_id || null,
        package_type_id: values.package_type_id,
        quota_type: quotaType,
        total_sessions: quotaType === 'SESSIONS' ? Number(values.total_sessions) : null,
        total_value: quotaType === 'VALUE' ? Number(values.list_price) : null,
        service_id: values.service_id || null,
        service_ids: [],
        has_warranty: undefined,
        warranty_text: values.has_warranty ? warrantyText : null,
        convertible_note: values.convertible_note?.trim() || null,
        terms: values.terms?.trim() || null,
        description: values.description?.trim() || null,
        validity_value: values.validity_value ? Number(values.validity_value) : null,
        validity_unit: values.validity_value ? values.validity_unit : null,
        bonus_sessions_default: undefined,
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

  const deletePackage = async (row: TreatmentPackageRow) => {
    try {
      await deletePackageMutation.mutateAsync({ id: row.id })
      message.success('Đã xóa gói dịch vụ')
      await reloadPackages()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const packageColumns: TableColumnsType<TreatmentPackageRow> = [
    {
      title: 'Ảnh',
      key: 'image',
      width: 76,
      render: (_, row) => {
        const src = fileSrc((row as any).image_file) ?? resolveFileSrc(urlMap, row.image_file_id)
        return src
          ? <Image src={src} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 8 }} />
          : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--brand-bg)', display: 'grid', placeItems: 'center', color: '#B9BDC2' }}><PictureOutlined /></div>
      },
    },
    {
      title: 'Gói liệu trình',
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
    { title: 'Trạng thái', key: 'status', dataIndex: 'is_active', width: 140, render: (active) => active ? <Tag color="green">Đang sử dụng</Tag> : <Tag>Ngưng sử dụng</Tag> },
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
        onRow={(row) => ({
          onClick: () => setDetailRow(row),
          style: { cursor: 'pointer' },
        })}
        columns={[
          ...packageColumns,
          ...(canManage ? [{
            title: 'Hành động', align: 'center' as const,
            key: 'actions',
            width: 140,
            fixed: 'right' as const,
            render: (_value: unknown, row: TreatmentPackageRow) => (
              <div onClick={(e) => e.stopPropagation()}>
                <RowActionsMenu
                  items={[
                    { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
                    { key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' },
                  ]}
                  onSelect={(key) => {
                    if (key === 'edit') openPackageModal(row)
                    else if (key === 'delete') Modal.confirm({ title: 'Xóa gói dịch vụ này?', content: 'Gói đã được sử dụng không thể xóa.', okText: 'Xóa', okButtonProps: { danger: true }, cancelText: 'Hủy', onOk: () => deletePackage(row) })
                  }}
                />
              </div>
            ),
          }] : []),
        ]}
      />
      <MobileCards
        rows={pagedRows}
        rowKey={(row) => row.id}
        loading={packagesQuery.isLoading}
        emptyText="Chưa có gói dịch vụ nào"
        onCardClick={(row) => setDetailRow(row)}
        renderCard={(row) => (
          <>
            <div className="mobile-card-head">
              <div className="mobile-card-title">{row.name}</div>
              {row.is_active ? <Tag color="green">Đang sử dụng</Tag> : <Tag>Ngưng sử dụng</Tag>}
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Giá niêm yết" value={priceLabel(row, formatMoney)} />
            </div>
            {canManage && (
              <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openPackageModal(row)}>Sửa</Button>
                <Button size="small" danger icon={<DeleteOutlined />} aria-label="Xóa gói" title="Xóa gói" onClick={() => Modal.confirm({ title: 'Xóa gói dịch vụ này?', content: 'Gói đã được sử dụng không thể xóa.', okText: 'Xóa', okButtonProps: { danger: true }, cancelText: 'Hủy', onOk: () => deletePackage(row) })} />
              </div>
            )}
          </>
        )}
      />
      <ListPagination page={packagePage} limit={10} total={visibleRows.length} onChange={setPackagePage} noun="gói dịch vụ" />
    </>
  )

  return (
    <>
      <PageTitle subtitle="Danh mục gói liệu trình — 4 loại cố định: Dịch vụ lẻ, Theo số buổi, Theo định mức tiền, Trọn đời">
        Liệu trình
      </PageTitle>
      <StatCards items={statItems} />
      {packagesContent}

      <TreatmentPackageModal
        form={packageForm}
        open={packageOpen}
        editing={editingPackage}
        packageTypes={packageTypes}
        packageTypeById={packageTypeById}
        services={services}
        branches={branches}
        packageCustomFields={packageCustomFields}
        currencySymbol={currencySymbol}
        saving={packageSaving}
        onCancel={() => setPackageOpen(false)}
        onOk={submitPackage}
      />

      <TreatmentPackageDetailModal
        row={detailRow}
        branches={branches}
        services={services}
        packageTypeById={packageTypeById}
        packageFields={packageCustomFields}
        formatMoney={formatMoney}
        onClose={() => setDetailRow(null)}
        onEdit={(row) => { setDetailRow(null); openPackageModal(row) }}
      />
    </>
  )
}
