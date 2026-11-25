import { useEffect, useMemo, useRef, useState } from 'react'
import { displayName } from '@/utils/displayName'
import { DatePicker, Form, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { TreatmentPackage } from '@/api/models/treatmentPackage'
import type { ProfileRow } from './constants'
import { QUOTA_LABEL } from './constants'
import { errorMessage, pickData } from '@/api/helpers'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import type { Branch, User } from '@/api/models'

interface TreatmentCreateModalProps {
  form: FormInstance
  open: boolean
  customerOptions: ProfileRow[]
  onSearch: (q: string) => void
  packages: TreatmentPackage[]
  packagesLoading: boolean
  selectedSalePackage: TreatmentPackage | undefined
  currencySymbol: string
  customFieldDefs: CustomFieldDefWithOptions[]
  submitting: boolean
  branches: Branch[]
  onPackageChange: (id: string) => void
  onCancel: () => void
  onOk: () => void
  /** SINGLE = bán Dịch vụ lẻ (1 buổi, không buổi tặng / hạn) */
  isSingle?: boolean
}

export default function TreatmentCreateModal({
  form,
  open,
  customerOptions,
  onSearch,
  packages,
  packagesLoading,
  selectedSalePackage,
  currencySymbol,
  customFieldDefs,
  submitting,
  branches,
  onPackageChange,
  onCancel,
  onOk,
  isSingle = false,
}: TreatmentCreateModalProps) {
  const itemLabel = isSingle ? 'Dịch vụ lẻ' : 'Liệu trình'
  // Người giới thiệu — nhận hoa hồng "Khi phát sinh thanh toán". Search server-side
  // theo tên / SĐT / email / mã giới thiệu (debounce 300ms).
  const [referrerQuery, setReferrerQuery] = useState('')
  const referrerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleReferrerSearch = (keyword: string) => {
    if (referrerTimer.current) clearTimeout(referrerTimer.current)
    referrerTimer.current = setTimeout(() => setReferrerQuery(keyword.trim()), 300)
  }

  const referrersQuery = useGetUsersAdmin(
    {
      currentPage: 1,
      pageSize: 50,
      scope: 'customers',
      status: 'active',
      ...(referrerQuery ? { q: referrerQuery } : {}),
    },
    { query: { enabled: open } },
  )

  const referrerOptions = useMemo(
    () =>
      (pickData<{ rows?: User[] } | undefined>(referrersQuery.data)?.rows ?? []).map((user) => ({
        value: user.id,
        label: [
          user.full_name || user.zalo_name || 'Khách',
          user.phone || user.email || '',
          user.ref_code || '',
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    [referrersQuery.data],
  )

  useEffect(() => () => {
    if (referrerTimer.current) clearTimeout(referrerTimer.current)
  }, [])

  return (
    <Modal
      title={isSingle ? 'Thêm khách dịch vụ lẻ' : 'Thêm khách vào liệu trình'}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={submitting}
    >
      <Form form={form} layout="vertical" className="mt-3">
        <Form.Item name="user_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
          <Select
            showSearch
            filterOption={false}
            placeholder="Gõ tên hoặc SĐT để tìm khách"
            onSearch={onSearch}
            options={customerOptions.map((c) => ({ value: c.id, label: `${displayName(c)} — ${c.phone}` }))}
          />
        </Form.Item>
        <Form.Item name="package_id" label={itemLabel} rules={[{ required: true, message: `Chọn ${itemLabel.toLowerCase()}` }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={`Chọn ${itemLabel.toLowerCase()}`}
            loading={packagesLoading}
            notFoundContent={isSingle ? 'Chưa có dịch vụ lẻ — tạo ở trang “Dịch vụ lẻ” (Kinh doanh)' : undefined}
            onChange={onPackageChange}
            options={packages.filter((p) => p.is_active).map((p) => ({
              value: p.id,
              // (Loại gói · Dịch vụ) — loại gói suy từ quota_type (Gói lẻ = theo tiền, Gói buổi, Trọn đời)
              label: isSingle
                ? `${p.name}${p.service?.title ? ` · ${p.service.title}` : ''}`
                : `${p.name} (${QUOTA_LABEL[p.quota_type ?? ''] ?? p.quota_type}${p.service?.title ? ` · ${p.service.title}` : ''})`,
            }))}
          />
        </Form.Item>
        <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn cơ sở"
            notFoundContent="Chưa có cơ sở"
            options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          />
        </Form.Item>
        <Form.Item
          name="referrer_id"
          label="Người giới thiệu"
          extra="Tùy chọn — khách này sẽ nhận hoa hồng khi liệu trình phát sinh thanh toán (theo quy tắc 'Khi phát sinh thanh toán')"
        >
          <Select
            allowClear
            showSearch
            filterOption={false}
            loading={referrersQuery.isFetching}
            placeholder="Tìm theo tên, SĐT, email hoặc mã giới thiệu"
            onSearch={handleReferrerSearch}
            notFoundContent={referrersQuery.isFetching ? 'Đang tìm...' : errorMessage(referrersQuery.error) || 'Không tìm thấy khách phù hợp'}
            options={referrerOptions}
          />
        </Form.Item>
        <Form.Item
          name="total_amount"
          label="Số tiền"
          extra={(() => {
            const listMin = Number(selectedSalePackage?.list_price ?? 0)
            const listMax = Math.max(listMin, Number(selectedSalePackage?.list_price_max ?? listMin))
            const listNote = !selectedSalePackage
              ? `Chọn ${itemLabel.toLowerCase()} để xem giá niêm yết.`
              : listMin > 0
                ? `Giá niêm yết gói: ${listMin.toLocaleString('vi-VN')}${listMax > listMin ? `–${listMax.toLocaleString('vi-VN')}` : ''} ₫`
                : 'Gói này chưa có giá niêm yết — nhập số tiền bán.'
            const valueNote = selectedSalePackage?.quota_type === 'VALUE' ? 'Định mức sử dụng của gói này sẽ tự bằng số tiền bán.' : undefined
            return [listNote, valueNote].filter(Boolean).join(' · ') || undefined
          })()}
          rules={[{ required: true, message: 'Nhập số tiền' }]}
        >
          <InputNumber min={0} step={100000} suffix={currencySymbol} className="w-full!" />
        </Form.Item>
        {!isSingle && (
          <>
            {/* Buổi tặng chỉ áp dụng cho Gói buổi (SESSIONS) */}
            {selectedSalePackage?.quota_type === 'SESSIONS' && (
              <Form.Item name="sessions_bonus" label="Buổi tặng" extra="Bỏ trống để sử dụng cấu hình mặc định">
                <InputNumber min={0} precision={0} className="w-full!" />
              </Form.Item>
            )}
            <Form.Item name="expires_at" label="Hạn sử dụng" extra="Để trống nếu gói không giới hạn thời gian">
              <DatePicker className="w-full!" />
            </Form.Item>
          </>
        )}
        <CustomFieldFormItems definitions={customFieldDefs} />
      </Form>
    </Modal>
  )
}

