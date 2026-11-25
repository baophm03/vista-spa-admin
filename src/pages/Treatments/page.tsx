import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Image, Form, Input, Modal, Table, Tabs, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PictureOutlined, PlusOutlined, ShoppingOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
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
import type { PackageService } from '@/api/models/packageService'
import { getGetTreatmentPackagesAdminQueryKey, useDeleteTreatmentPackagesIdAdmin, useGetTreatmentPackagesAdmin, usePostTreatmentPackagesAdmin, usePutTreatmentPackagesIdAdmin } from '@/api/endpoints/treatment-packages'
import { useGetPackageTypesAdmin } from '@/api/endpoints/package-types'
import { useGetPackageServicesAdmin } from '@/api/endpoints/package-services'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { useBrandCurrency } from '@/themeRuntime'

import TreatmentPackageModal from './components/TreatmentPackageModal'
import TreatmentPackageDetailModal from './components/TreatmentPackageDetailModal'
import PackageServices from './PackageServices'
import {
  PACKAGE_TYPE_CODES,
  VALIDITY_LABEL,
  packageTypeLabel,
  priceLabel,
  type PackageTypeRow,
  type TreatmentPackageRow,
} from './components/constants'
import './treatments.css'

export default function Treatments() {
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
    ...(packageSearch.trim() ? { q: packageSearch.trim() } : {}),
  } as never)
  const packageTypesQuery = useGetPackageTypesAdmin({ limit: 200 })
  const packageServicesQuery = useGetPackageServicesAdmin({ page: 1, limit: 500 })
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
      { key: 'total', label: 'Tổng gói liệu trình', value: (statsMeta?.total ?? 0).toLocaleString('vi-VN'), icon: <ShoppingOutlined />, tone: 'primary' },
      { key: 'active', label: 'Đang bán', value: (statsMeta?.active ?? 0).toLocaleString('vi-VN'), icon: <EyeOutlined />, tone: 'secondary' },
      { key: 'hidden', label: 'Ngưng sử dụng', value: (statsMeta?.hidden ?? 0).toLocaleString('vi-VN'), icon: <EyeInvisibleOutlined />, tone: 'neutral' },
    ]
  const packageTypeData = pickData<PackageTypeRow[] | { rows?: PackageTypeRow[] }>(packageTypesQuery.data)
  const packageTypes = (Array.isArray(packageTypeData) ? packageTypeData : packageTypeData?.rows ?? []) as PackageTypeRow[]
  const packageTypeById = new Map(packageTypes.map((type) => [String(type.id), type]))
  // Loại gói cố định: Gói lẻ / Gói buổi / Trọn đời (SINGLE_SESSION, COMBO đã ngưng)
  const selectablePackageTypes = packageTypes
    .filter((type) => PACKAGE_TYPE_CODES.includes(String(type.code).toUpperCase()) && type.is_active !== false)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
  const packageServices = (pickData<PackageService[]>(packageServicesQuery.data) ?? []) as PackageService[]
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const catalogLoading = packageTypesQuery.isLoading || packageServicesQuery.isLoading || branchesQuery.isLoading
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
    const defaultTypeId = selectablePackageTypes.find((type) => String(type.code).toUpperCase() === 'FIXED_PACKAGE')?.id
    packageForm.setFieldsValue(row ? {
      ...row,
      package_type_id: row.package_type_id ?? row.package_type?.id,
      package_service_id: row.package_service_id ?? undefined,
      has_warranty: !!row.warranty_text,
      list_price: row.list_price ?? 0,
      custom_fields: row.custom_fields ?? {},
    } : {
      name: '',
      package_type_id: defaultTypeId,
      package_service_id: undefined,
      total_sessions: 5,
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
        package_service_id: values.package_service_id,
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
        message.success('Đã cập nhật gói liệu trình')
      } else {
        await createPackageMutation.mutateAsync({ data: dto as never })
        message.success('Đã tạo gói liệu trình')
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
      message.success('Đã xóa gói liệu trình')
      await reloadPackages()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const branchLabel = (id?: string | null) =>
    id ? branches.find((branch) => branch.id === id)?.name ?? '—' : 'Tất cả cơ sở'
  const serviceLabel = (row: TreatmentPackageRow) =>
    row.package_service?.title ?? <Tag color="orange">Chưa chọn</Tag>
  const validityLabel = (row: TreatmentPackageRow) => row.validity_value && row.validity_unit
    ? `${row.validity_value} ${VALIDITY_LABEL[row.validity_unit] ?? row.validity_unit}`
    : 'Không thời hạn'
  const packageImage = (row: TreatmentPackageRow) =>
    fileSrc(row.image_file) ?? resolveFileSrc(urlMap, row.image_file_id)
  const renderActions = (row: TreatmentPackageRow, dropdownOnly = false) => (
    <RowActionsMenu
      dropdownOnly={dropdownOnly}
      items={[
        { key: 'edit', icon: <EditOutlined />, label: 'Sửa', disabled: catalogLoading },
        { key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' },
      ]}
      onSelect={(key) => {
        if (key === 'edit') openPackageModal(row)
        else if (key === 'delete') Modal.confirm({
          title: 'Xóa gói liệu trình này?',
          content: 'Gói đã được sử dụng không thể xóa.',
          okText: 'Xóa',
          okButtonProps: { danger: true },
          cancelText: 'Hủy',
          onOk: () => deletePackage(row),
        })
      }}
    />
  )

  const packageColumns: TableColumnsType<TreatmentPackageRow> = [
    {
      title: 'Ảnh',
      key: 'image',
      width: 54,
      render: (_, row) => {
        const src = packageImage(row)
        return src
          ? <Image src={src} width={36} height={36} style={{ objectFit: 'cover', borderRadius: 8 }} />
          : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--brand-bg)', display: 'grid', placeItems: 'center', color: '#B9BDC2' }}><PictureOutlined /></div>
      },
    },
    {
      title: 'Gói liệu trình',
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
    {
      title: 'Loại gói',
      key: 'type',
      dataIndex: 'package_type_id',
      width: '10%',
      render: (_value, row) => <Tag color="purple">{packageTypeLabel(row, packageTypeById)}</Tag>,
    },
    {
      title: 'Dịch vụ áp dụng',
      key: 'services',
      // không set width — cột tự động chiếm phần còn lại của bảng (các width khác phải tổng < 100%)
      render: (_value, row) => serviceLabel(row),
    },
    { title: 'Giá niêm yết', key: 'price', width: '12%', render: (_value, row) => priceLabel(row, formatMoney) },
    {
      title: 'Thời hạn',
      key: 'validity',
      width: '9%',
      render: (_value, row) => validityLabel(row),
    },
    { title: 'Trạng thái', key: 'status', dataIndex: 'is_active', width: '10%', render: (active) => active ? <Tag color="green">Đang sử dụng</Tag> : <Tag>Ngưng sử dụng</Tag> },
  ]

  const packagesContent = (
    <>
      <div className="treatment-list-toolbar">
        <Input.Search
          allowClear
          aria-label="Tìm theo tên hoặc mô tả gói"
          placeholder="Tìm theo tên hoặc mô tả gói"
          className="treatment-list-search"
          value={packageSearchInput}
          onChange={(event) => { setPackageSearchInput(event.target.value); if (!event.target.value) applyPackageSearch('') }}
          onSearch={applyPackageSearch}
        />
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} disabled={catalogLoading} onClick={() => openPackageModal()}>
            Thêm gói
          </Button>
        )}
      </div>
      {packagesQuery.isError ? (
        <Alert
          className="treatment-list-error"
          type="error"
          showIcon
          title="Không tải được danh sách gói liệu trình"
          description={errorMessage(packagesQuery.error)}
          action={<Button onClick={() => void packagesQuery.refetch()} loading={packagesQuery.isFetching}>Thử lại</Button>}
        />
      ) : (
        <>
          <Table<TreatmentPackageRow>
            className="desktop-only [&_.ant-table-cell]:px-2! [&_.ant-table-tbody_.ant-table-cell]:[overflow-wrap:anywhere] [&_.ant-table-thead_th]:whitespace-nowrap! [&_.ant-tag]:whitespace-normal [&_.ant-tag]:me-0!"
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
                    <MobileCardRow label="Loại gói" value={packageTypeLabel(row, packageTypeById)} />
                    <MobileCardRow label="Dịch vụ áp dụng" value={serviceLabel(row)} />
                    <MobileCardRow label="Giá niêm yết" value={priceLabel(row, formatMoney)} />
                    <MobileCardRow label="Thời hạn" value={validityLabel(row)} />
                  </div>
                  {canManage && (
                    <div className="mobile-card-actions">{renderActions(row, true)}</div>
                  )}
                </>
              )
            }}
          />
          <ListPagination page={packagePage} limit={packageLimit} total={total} onChange={setPackagePage} noun="gói liệu trình" />
        </>
      )}
    </>
  )

  return (
    <div className="treatments-page">
      <PageTitle subtitle="Gói liệu trình và danh mục gói dịch vụ áp dụng cho gói.">
        Gói liệu trình
      </PageTitle>
      <StatCards items={statItems} />
      <Tabs
        items={[
          { key: 'packages', label: 'Gói liệu trình', children: packagesContent },
          { key: 'package-services', label: 'Gói dịch vụ', children: <PackageServices branches={branches} canManage={canManage} /> },
        ]}
      />

      <TreatmentPackageModal
        form={packageForm}
        open={packageOpen}
        editing={editingPackage}
        packageServices={packageServices}
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
        branches={branches}
        packageTypeById={packageTypeById}
        packageFields={packageCustomFields}
        formatMoney={formatMoney}
        onClose={() => setDetailRow(null)}
        onEdit={(row) => { setDetailRow(null); openPackageModal(row) }}
      />
    </div>
  )
}
