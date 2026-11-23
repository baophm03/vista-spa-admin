import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Image, Form, Input, Modal, Table, Tag, Typography, message } from 'antd'
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
import type { Service } from '@/api/models/service'
import { getGetTreatmentPackagesAdminQueryKey, useDeleteTreatmentPackagesIdAdmin, useGetTreatmentPackagesAdmin, usePostTreatmentPackagesAdmin, usePutTreatmentPackagesIdAdmin } from '@/api/endpoints/treatment-packages'
import { useGetPackageTypesAdmin } from '@/api/endpoints/package-types'
import { useGetServiceAdmin } from '@/api/endpoints/services'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { useBrandCurrency } from '@/themeRuntime'

import TreatmentPackageModal from './components/TreatmentPackageModal'
import TreatmentPackageDetailModal from './components/TreatmentPackageDetailModal'
import {
  FIXED_PACKAGE_TYPE_CODES,
  SINGLE_SESSION_TYPE_CODE,
  COMBO_TYPE_CODE,
  FIXED_PACKAGE_TYPE_CODE,
  VALUE_QUOTA_TYPE_CODE,
  UNLIMITED_PACKAGE_TYPE_CODE,
  VALIDITY_LABEL,

  calcLabel,
  priceLabel,
  type PackageTypeRow,
  type QuotaType,
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
      { key: 'total', label: 'Tổng gói liệu trình', value: (statsMeta?.total ?? 0).toLocaleString('vi-VN'), icon: <ShoppingOutlined />, tone: 'primary' },
      { key: 'active', label: 'Đang bán', value: (statsMeta?.active ?? 0).toLocaleString('vi-VN'), icon: <EyeOutlined />, tone: 'secondary' },
      { key: 'hidden', label: 'Ngưng sử dụng', value: (statsMeta?.hidden ?? 0).toLocaleString('vi-VN'), icon: <EyeInvisibleOutlined />, tone: 'neutral' },
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
    const packageTypeId = row?.package_type_id ?? row?.package_type?.id
    const type = packageTypeId ? packageTypeById.get(String(packageTypeId)) : undefined
    const typeCode = String(type?.code ?? '').toUpperCase()
    const isComboRow = typeCode === COMBO_TYPE_CODE
    packageForm.setFieldsValue(row ? {
      ...row,
      package_kind: isComboRow ? 'COMBO' : 'LE',
      combo_services: isComboRow ? (row.services ?? []) : undefined,
      quota_type: row.quota_type ?? (type && String(type.code).toUpperCase() === UNLIMITED_PACKAGE_TYPE_CODE ? 'UNLIMITED' : 'SESSIONS'),
      has_warranty: !!row.warranty_text,
      list_price: row.list_price ?? 0,
      service_id: row.service_id ?? undefined,
      custom_fields: row.custom_fields ?? {},
    } : {
      name: '',
      package_kind: 'LE',
      quota_type: 'SESSIONS',
      total_sessions: 5,
      has_warranty: false,
      list_price: 0,
      bonus_sessions_default: 0,
      service_id: undefined,
      combo_services: [],
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
      const isCombo = values.package_kind === 'COMBO'
      // package_type_id: combo → loại COMBO; gói lẻ suy ra từ "Cách tính" + số buổi (4 loại cố định trong DB):
      // SESSIONS + 1 buổi → SINGLE_SESSION (dịch vụ lẻ); SESSIONS + >= 2 → FIXED_PACKAGE; VALUE → VALUE_QUOTA; UNLIMITED → UNLIMITED_PACKAGE
      const derivePackageTypeId = (quota: QuotaType, sessions?: number | null) => {
        const code = quota === 'SESSIONS'
          ? (Number(sessions) === 1 ? SINGLE_SESSION_TYPE_CODE : FIXED_PACKAGE_TYPE_CODE)
          : quota === 'VALUE' ? VALUE_QUOTA_TYPE_CODE : UNLIMITED_PACKAGE_TYPE_CODE
        return packageTypeByCode.get(code)?.id
      }
      const editingTypeId = editingPackage ? String(editingPackage.package_type_id ?? editingPackage.package_type?.id ?? '') : ''
      const editingTypeCode = (editingTypeId ? packageTypeById.get(editingTypeId)?.code : '')?.toUpperCase() ?? ''
      const packageTypeId = isCombo
        ? packageTypeByCode.get(COMBO_TYPE_CODE)?.id
        : editingTypeId && !FIXED_PACKAGE_TYPE_CODES.includes(editingTypeCode) && editingTypeCode !== COMBO_TYPE_CODE
          ? editingTypeId // gói dữ liệu cũ thuộc loại khác 4 loại cố định — giữ nguyên loại của nó
          : derivePackageTypeId(values.quota_type as QuotaType, values.total_sessions)

      if (isCombo) {
        const entries: { service_id: string; qty: number }[] = (values.combo_services ?? [])
          .filter((entry: { service_id?: string; qty?: number }) => entry?.service_id)
          .map((entry: { service_id?: string; qty?: number }) => ({ service_id: String(entry.service_id), qty: Number(entry.qty ?? 1) }))
        if (entries.length < 2) {
          message.error('Gói combo phải gồm từ 2 dịch vụ trở lên')
          setPackageSaving(false)
          return
        }
        const ids = new Set(entries.map((entry) => entry.service_id))
        if (ids.size !== entries.length) {
          message.error('Gói combo không được trùng dịch vụ')
          setPackageSaving(false)
          return
        }
        if (entries.some((entry) => !Number.isInteger(entry.qty) || entry.qty <= 0)) {
          message.error('Số buổi (qty) của mỗi dịch vụ phải là số nguyên dương')
          setPackageSaving(false)
          return
        }
        const dto = {
          ...values,
          name: String(values.name).trim(),
          is_active: values.is_active !== false,
          branch_id: values.branch_id || null,
          package_type_id: packageTypeId,
          quota_type: 'SESSIONS',
          services: entries,
          service_id: null,
          service_ids: undefined,
          total_sessions: undefined,
          total_value: null,
          has_warranty: undefined,
          warranty_text: values.has_warranty ? warrantyText : null,
          convertible_note: values.convertible_note?.trim() || null,
          terms: values.terms?.trim() || null,
          description: values.description?.trim() || null,
          validity_value: values.validity_value ? Number(values.validity_value) : null,
          validity_unit: values.validity_value ? values.validity_unit : null,
          bonus_sessions_default: values.bonus_sessions_default != null ? Number(values.bonus_sessions_default) : null,
          list_price: Number(values.list_price ?? 0),
          list_price_max: values.list_price_max == null ? null : Number(values.list_price_max),
          custom_fields: normalizeCustomFieldValues(packageCustomFields, values.custom_fields ?? {}, editingPackage?.custom_fields ?? {}),
          package_kind: undefined,
          combo_services: undefined,
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
        return
      }

      const quotaType = values.quota_type as QuotaType
      const dto = {
        ...values,
        name: String(values.name).trim(),
        is_active: values.is_active !== false,
        branch_id: values.branch_id || null,
        package_type_id: packageTypeId,
        quota_type: quotaType,
        total_sessions: quotaType === 'SESSIONS' ? Number(values.total_sessions) : null,
        total_value: quotaType === 'VALUE' ? Number(values.list_price) : null,
        service_id: values.service_id || null,
        service_ids: [],
        services: undefined,
        combo_services: undefined,
        package_kind: undefined,
        has_warranty: undefined,
        warranty_text: values.has_warranty ? warrantyText : null,
        convertible_note: values.convertible_note?.trim() || null,
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

  const branchLabel = (id?: string | null) =>
    id ? branches.find((branch) => branch.id === id)?.name ?? '—' : 'Tất cả cơ sở'
  const servicesLabel = (row: TreatmentPackageRow) => {
    if (row.services?.length) {
      return row.services.map(({ service_id, qty = 1 }) => {
        const title = (service_id && serviceById.get(service_id)) || 'Dịch vụ'
        return qty > 1 ? `${title} (${qty} buổi)` : title
      }).join(', ')
    }
    const ids = row.service_ids?.length ? row.service_ids : row.service_id ? [row.service_id] : []
    return ids.length ? ids.map((id) => serviceById.get(id) ?? 'Dịch vụ').join(', ') : '—'
  }
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
          title: 'Xóa gói dịch vụ này?',
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
      key: 'package_kind',
      dataIndex: 'package_type_id',
      width: '8%',
      render: (_value, row) => {
        // Loại gói theo cấu trúc: COMBO = Gói Combo, còn lại (4 loại cố định + dữ liệu cũ) đều là Gói lẻ
        const type = row.package_type && typeof row.package_type === 'object'
          ? row.package_type
          : packageTypeById.get(String(row.package_type_id))
        return <Tag color="geekblue">{String(type?.code ?? '').toUpperCase() === 'COMBO' ? 'Gói Combo' : 'Gói lẻ'}</Tag>
      },
    },
    {
      title: 'Cách tính',
      key: 'type',
      dataIndex: 'package_type_id',
      width: '11%',
      render: (_value, row) => <Tag color="purple">{calcLabel(row, packageTypeById)}</Tag>,
    },
    {
      title: 'Dịch vụ',
      key: 'services',
      // không set width — cột tự động chiếm phần còn lại của bảng (các width khác phải tổng < 100%)
      render: (_value, row) => servicesLabel(row),
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
                    <MobileCardRow label="Loại gói" value={calcLabel(row, packageTypeById)} />
                    <MobileCardRow label="Dịch vụ" value={servicesLabel(row)} />
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
      <PageTitle subtitle="Danh sách các gói liệu trình đang có trong hệ thống.">
        Liệu trình
      </PageTitle>
      <StatCards items={statItems} />
      {packagesContent}

      <TreatmentPackageModal
        form={packageForm}
        open={packageOpen}
        editing={editingPackage}
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
    </div>
  )
}
