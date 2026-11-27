import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PictureOutlined, PlusOutlined, ShoppingOutlined } from '@ant-design/icons'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { errorMessage, pickData } from '@/api/helpers'
import { fileSrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { Branch } from '@/api/models/branch'
import { getGetTreatmentPackagesAdminQueryKey, useDeleteTreatmentPackagesIdAdmin, useGetTreatmentPackagesAdmin, usePostTreatmentPackagesAdmin, usePutTreatmentPackagesIdAdmin } from '@/api/endpoints/treatment-packages'
import { useGetPackageTypesAdmin } from '@/api/endpoints/package-types'
import { useGetServiceAdmin } from '@/api/endpoints/services'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { useBrandCurrency } from '@/themeRuntime'

import TreatmentPackageModal from './TreatmentPackageModal'
import TreatmentPackageDetailModal from './TreatmentPackageDetailModal'
import {
  PACKAGE_TYPE_CODES,
  SINGLE_SESSION_TYPE_CODE,
  VALIDITY_LABEL,
  packageTypeLabel,
  priceLabel,
  type PackageKind,
  type PackageTypeRow,
  type ServiceOption,
  type TreatmentPackageRow,
} from './constants'
import '../treatments.css'

/** Danh sách + CRUD gói: kind=PACKAGE (trang Gói liệu trình, 3 loại) · kind=SINGLE (trang Dịch vụ lẻ /standalone-services). */
export default function TreatmentPackageList({ kind }: { kind: PackageKind }) {
  const isSingle = kind === 'SINGLE'
  const noun = isSingle ? 'dịch vụ lẻ' : 'gói liệu trình'
  const { format: formatMoney, symbol: currencySymbol } = useBrandCurrency()
  const queryClient = useQueryClient()
  // Trang quản trị liệu trình: chỉ admin hệ thống (vai trò Admin) được quản lý (giữ behavior cũ)
  const canManage = useCustomerProfileAccess().isAdmin
  const { isAdmin, isReceptionist, isTechnician } = useCustomerProfileAccess()
  const hideSummaryForTechnician = isTechnician && !isAdmin && !isReceptionist

  const [packageOpen, setPackageOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<TreatmentPackageRow | null>(null)
  const [packageForm] = Form.useForm()
  const packageCustomFields = useCustomFieldDefinitions('PACKAGE')
  const [packageSaving, setPackageSaving] = useState(false)

  const [packageSearchInput, setPackageSearchInput] = useState('')
  const [packageSearch, setPackageSearch] = useState('')
  const [packagePage, setPackagePage] = useState(1)
  const [packageLimit] = useState(10)

  const packagesQuery = useGetTreatmentPackagesAdmin({
    page: packagePage,
    limit: packageLimit,
    kind,
    ...(packageSearch.trim() ? { q: packageSearch.trim() } : {}),
  } as never)
  const packageTypesQuery = useGetPackageTypesAdmin({ limit: 200 })
  const servicesQuery = useGetServiceAdmin({ page: 1, limit: 200 })
  const branchesQuery = useGetBranchesAdmin()

  const rows = (pickData<TreatmentPackageRow[]>(packagesQuery.data) ?? []) as TreatmentPackageRow[]
  const total = (packagesQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? rows.length
  const statsMeta = (packagesQuery.data as unknown as { meta?: { stats?: { total: number; active: number; hidden: number } } })?.meta?.stats
  const [detailRow, setDetailRow] = useState<TreatmentPackageRow | null>(null)

  const applyPackageSearch = (nextKeyword: string) => {
    setPackageSearchInput(nextKeyword)
    setPackageSearch(nextKeyword.trim())
    setPackagePage(1)
  }

  const statItems: StatItem[] = hideSummaryForTechnician
    ? []
    : [
      { key: 'total', label: isSingle ? 'Tổng dịch vụ lẻ' : 'Tổng gói liệu trình', value: (statsMeta?.total ?? 0).toLocaleString('vi-VN'), icon: <ShoppingOutlined />, tone: 'primary' },
      { key: 'active', label: 'Đang bán', value: (statsMeta?.active ?? 0).toLocaleString('vi-VN'), icon: <EyeOutlined />, tone: 'secondary' },
      { key: 'hidden', label: 'Ngưng sử dụng', value: (statsMeta?.hidden ?? 0).toLocaleString('vi-VN'), icon: <EyeInvisibleOutlined />, tone: 'neutral' },
    ]
  const packageTypeData = pickData<PackageTypeRow[] | { rows?: PackageTypeRow[] }>(packageTypesQuery.data)
  const packageTypes = (Array.isArray(packageTypeData) ? packageTypeData : packageTypeData?.rows ?? []) as PackageTypeRow[]
  const packageTypeById = new Map(packageTypes.map((type) => [String(type.id), type]))
  // kind=PACKAGE: Gói lẻ / Gói buổi / Trọn đời · kind=SINGLE: chỉ Dịch vụ lẻ (COMBO đã ngưng)
  const allowedTypeCodes = isSingle ? [SINGLE_SESSION_TYPE_CODE] : PACKAGE_TYPE_CODES
  const selectablePackageTypes = packageTypes
    .filter((type) => allowedTypeCodes.includes(String(type.code).toUpperCase()) && type.is_active !== false)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
  const services = (pickData<{ services?: ServiceOption[] }>(servicesQuery.data)?.services ?? []) as ServiceOption[]
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const catalogLoading = packageTypesQuery.isLoading || servicesQuery.isLoading || branchesQuery.isLoading
  const urlMap = useFileUrlMap()

  const createPackageMutation = usePostTreatmentPackagesAdmin()
  const updatePackageMutation = usePutTreatmentPackagesIdAdmin()
  const deletePackageMutation = useDeleteTreatmentPackagesIdAdmin()

  const reloadPackages = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getGetTreatmentPackagesAdminQueryKey() })
  }, [queryClient])

  const openPackageModal = (row?: TreatmentPackageRow) => {
    if (catalogLoading) return
    setEditingPackage(row ?? null)
    packageForm.resetFields()
    const defaultTypeId = selectablePackageTypes.find((type) => String(type.code).toUpperCase() === (isSingle ? SINGLE_SESSION_TYPE_CODE : 'FIXED_PACKAGE'))?.id
    packageForm.setFieldsValue(row ? {
      ...row,
      package_type_id: row.package_type_id ?? row.package_type?.id,
      service_id: row.service_id ?? undefined,
      has_warranty: !!row.warranty_text,
      list_price: row.list_price ?? 0,
      custom_fields: row.custom_fields ?? {},
    } : {
      name: '',
      package_type_id: defaultTypeId,
      service_id: undefined,
      total_sessions: isSingle ? 1 : 5,
      has_warranty: false,
      list_price: 0,
      bonus_sessions_default: 0,
      custom_fields: {},
      is_active: true,
    })
    setPackageOpen(true)
  }

  const submitPackage = async () => {
    const values = await packageForm.validateFields()
    setPackageSaving(true)
    try {
      const warrantyText = values.warranty_text?.trim() || null
      // quota_type do BE suy ra từ loại gói — FE chỉ gửi package_type_id (+ total_sessions với Gói buổi)
      const dto = {
        ...values,
        name: String(values.name).trim(),
        is_active: values.is_active !== false,
        branch_id: values.branch_id || null,
        package_type_id: values.package_type_id,
        service_id: values.service_id,
        total_sessions: values.total_sessions != null ? Number(values.total_sessions) : null,
        has_warranty: undefined,
        warranty_text: values.has_warranty ? warrantyText : null,
        terms: values.terms?.trim() || null,
        description: values.description?.trim() || null,
        validity_value: values.validity_value ? Number(values.validity_value) : null,
        validity_unit: values.validity_value ? values.validity_unit : null,
        bonus_sessions_default: values.bonus_sessions_default != null ? Number(values.bonus_sessions_default) : null,
        list_price: Number(values.list_price ?? 0),
        list_price_max: values.list_price_max == null ? null : Number(values.list_price_max),
        custom_fields: normalizeCustomFieldValues(packageCustomFields, values.custom_fields ?? {}, editingPackage?.custom_fields ?? {}),
      }
      if (editingPackage) {
        await updatePackageMutation.mutateAsync({ id: editingPackage.id, data: dto as never })
        message.success(`Đã cập nhật ${noun}`)
      } else {
        await createPackageMutation.mutateAsync({ data: dto as never })
        message.success(`Đã tạo ${noun}`)
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
      message.success(`Đã xóa ${noun}`)
      await reloadPackages()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const branchLabel = (id?: string | null) =>
    id ? branches.find((branch) => branch.id === id)?.name ?? '—' : 'Tất cả cơ sở'
  const serviceLabel = (row: TreatmentPackageRow) =>
    row.service?.title ?? <Tag color="orange">Chưa chọn</Tag>
  const validityLabel = (row: TreatmentPackageRow) => row.validity_value && row.validity_unit
    ? `${row.validity_value} ${VALIDITY_LABEL[row.validity_unit] ?? row.validity_unit}`
    : 'Không thời hạn'
  const packageImage = (row: TreatmentPackageRow) =>
    fileSrc(row.image_file) ?? resolveFileSrc(urlMap, row.image_file_id)
  const confirmDelete = (row: TreatmentPackageRow) => Modal.confirm({
    title: `Xóa ${noun} này?`,
    content: 'Gói đã bán cho khách không thể xóa.',
    okText: 'Xóa',
    okButtonProps: { danger: true },
    cancelText: 'Hủy',
    onOk: () => deletePackage(row),
  })
  const renderActions = (row: TreatmentPackageRow, dropdownOnly = false) => (
    <RowActionsMenu
      dropdownOnly={dropdownOnly}
      items={[
        { key: 'edit', icon: <EditOutlined />, label: 'Sửa', disabled: catalogLoading },
        { key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' },
      ]}
      onSelect={(key) => {
        if (key === 'edit') openPackageModal(row)
        else if (key === 'delete') confirmDelete(row)
      }}
    />
  )

  const packageColumns: TableColumnsType<TreatmentPackageRow> = [
    {
      title: isSingle ? 'Dịch vụ lẻ' : 'Gói liệu trình',
      key: 'name',
      dataIndex: 'name',
      width: '20%',
      render: (name, row) => (
        <div>
          <Typography.Text strong>{name}</Typography.Text>
          {row.description && <div style={{ color: '#777', fontSize: 12 }}>{row.description}</div>}
        </div>
      ),
    },
    { title: 'Cơ sở', key: 'branch', dataIndex: 'branch_id', width: '8%', render: branchLabel },
    ...(isSingle ? [] : [{
      title: 'Loại gói',
      key: 'type',
      dataIndex: 'package_type_id',
      width: '10%',
      render: (_value: unknown, row: TreatmentPackageRow) => <Tag color="purple">{packageTypeLabel(row, packageTypeById)}</Tag>,
    }]),
    {
      title: 'Dịch vụ áp dụng',
      key: 'services',
      // không set width — cột tự động chiếm phần còn lại của bảng (các width khác phải tổng < 100%)
      render: (_value, row) => serviceLabel(row),
    },
    { title: 'Giá niêm yết', key: 'price', width: '12%', render: (_value, row) => priceLabel(row, formatMoney) },
    ...(isSingle ? [] : [{
      title: 'Thời hạn',
      key: 'validity',
      width: '9%',
      render: (_value: unknown, row: TreatmentPackageRow) => validityLabel(row),
    }]),
    { title: 'Trạng thái', key: 'status', dataIndex: 'is_active', width: '10%', render: (active) => active ? <Tag color="green">Đang sử dụng</Tag> : <Tag>Ngưng sử dụng</Tag> },
  ]

  const packagesContent = (
    <>
      <div className={`treatment-list-toolbar${isSingle ? ' single-service-toolbar' : ''}`}>
        <Input.Search
          allowClear
          aria-label={isSingle ? 'Tìm theo tên hoặc mô tả dịch vụ lẻ' : 'Tìm theo tên hoặc mô tả gói'}
          placeholder={isSingle ? 'Tìm theo tên hoặc mô tả dịch vụ lẻ' : 'Tìm theo tên hoặc mô tả gói'}
          className="treatment-list-search"
          value={packageSearchInput}
          onChange={(event) => { setPackageSearchInput(event.target.value); if (!event.target.value) applyPackageSearch('') }}
          onSearch={applyPackageSearch}
        />
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} disabled={catalogLoading} onClick={() => openPackageModal()}>
            {isSingle ? 'Thêm dịch vụ lẻ' : 'Thêm gói'}
          </Button>
        )}
      </div>
      {packagesQuery.isError ? (
        <Alert
          className="treatment-list-error"
          type="error"
          showIcon
          title={`Không tải được danh sách ${noun}`}
          description={errorMessage(packagesQuery.error)}
          action={<Button onClick={() => void packagesQuery.refetch()} loading={packagesQuery.isFetching}>Thử lại</Button>}
        />
      ) : (
        <>
          <Table<TreatmentPackageRow>
            className="desktop-only treatment-package-table [&_.ant-table-cell]:px-2! [&_.ant-table-tbody_.ant-table-cell]:[overflow-wrap:anywhere] [&_.ant-table-thead_th]:whitespace-nowrap! [&_.ant-tag]:whitespace-normal [&_.ant-tag]:me-0!"
            rowKey="id"
            loading={packagesQuery.isLoading}
            dataSource={rows}
            tableLayout="fixed"
            pagination={false}
            locale={{ emptyText: packageSearch ? 'Không có kết quả' : 'Chưa có dữ liệu' }}
            onRow={(row) => ({
              onClick: () => setDetailRow(row),
              style: { cursor: 'pointer' },
            })}
            columns={[
              ...packageColumns,
              ...(canManage ? [{
                title: 'Thao tác', align: 'center' as const,
                key: 'actions',
                width: 88,
                render: (_value: unknown, row: TreatmentPackageRow) => renderActions(row),
              }] : []),
            ]}
          />
          <MobileCards
            className={`treatment-package-cards${packagesQuery.isLoading ? ' is-loading' : ''}`}
            rows={rows}
            rowKey={(row) => row.id}
            loading={packagesQuery.isLoading}
            emptyText={packageSearch ? 'Không có kết quả' : 'Chưa có dữ liệu'}
            emptyDescription={packageSearch ? 'Thử đổi từ khóa hoặc xóa bộ lọc' : undefined}
            onCardClick={setDetailRow}
            renderCard={(row) => {
              const image = packageImage(row)
              return (
                <>
                  <div className="mobile-card-head">
                    <button type="button" className="treatment-card-link" onClick={(event) => {
                      event.stopPropagation()
                      setDetailRow(row)
                    }}>
                      <span className="treatment-card-image" aria-hidden>
                        {image ? <img src={image} alt="" loading="lazy" /> : <PictureOutlined />}
                      </span>
                      <span className="min-w-0">
                        <span className="mobile-card-title block">{row.name}</span>
                        {row.description && <span className="mobile-card-sub block">{row.description}</span>}
                      </span>
                    </button>
                    {row.is_active ? <Tag color="green">Đang sử dụng</Tag> : <Tag>Ngưng sử dụng</Tag>}
                  </div>
                  <div className="mobile-card-rows">
                    <MobileCardRow label="Cơ sở" value={branchLabel(row.branch_id)} />
                    {!isSingle && <MobileCardRow label="Loại gói" value={packageTypeLabel(row, packageTypeById)} />}
                    <MobileCardRow label="Dịch vụ áp dụng" value={serviceLabel(row)} />
                    <MobileCardRow label="Giá niêm yết" value={priceLabel(row, formatMoney)} />
                    {!isSingle && <MobileCardRow label="Thời hạn" value={validityLabel(row)} />}
                  </div>
                  {canManage && (
                    <div className="mobile-card-actions">
                      <div className="treatment-package-action-menu">{renderActions(row, true)}</div>
                      <div className="treatment-package-tablet-actions">
                        <Button icon={<EditOutlined />} disabled={catalogLoading} onClick={() => openPackageModal(row)}>Sửa</Button>
                        <Button danger icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>Xóa</Button>
                      </div>
                    </div>
                  )}
                </>
              )
            }}
          />
          <ListPagination page={packagePage} limit={packageLimit} total={total} onChange={setPackagePage} noun={noun} />
        </>
      )}
    </>
  )

  return (
    <>
      {statItems.length > 0 && (
        <div className={isSingle ? 'single-service-stats' : 'treatment-package-stats'}>
          <StatCards items={statItems} />
        </div>
      )}
      {packagesContent}

      <TreatmentPackageModal
        form={packageForm}
        open={packageOpen}
        editing={editingPackage}
        kind={kind}
        services={services}
        packageTypes={selectablePackageTypes}
        branches={branches}
        packageCustomFields={packageCustomFields}
        currencySymbol={currencySymbol}
        saving={packageSaving}
        onCancel={() => setPackageOpen(false)}
        onOk={submitPackage}
      />

      <TreatmentPackageDetailModal
        row={detailRow}
        image={detailRow ? packageImage(detailRow) : undefined}
        branches={branches}
        packageTypeById={packageTypeById}
        packageFields={packageCustomFields}
        formatMoney={formatMoney}
        onClose={() => setDetailRow(null)}
        onEdit={(row) => { setDetailRow(null); openPackageModal(row) }}
      />
    </>
  )
}
