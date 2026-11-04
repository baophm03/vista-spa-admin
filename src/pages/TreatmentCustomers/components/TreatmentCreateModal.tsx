import { DatePicker, Form, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { TreatmentPackage } from '@/api/models/treatmentPackage'
import type { ProfileRow } from './constants'
import { QUOTA_LABEL } from './constants'

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
  onPackageChange: (id: string) => void
  onCancel: () => void
  onOk: () => void
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
  onPackageChange,
  onCancel,
  onOk,
}: TreatmentCreateModalProps) {
  return (
      <Modal
        title="Thêm khách vào liệu trình"
        open={open}
        onCancel={onCancel}
        onOk={onOk}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer_profile_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
            <Select
              showSearch
              filterOption={false}
              placeholder="Gõ tên hoặc SĐT để tìm khách"
              onSearch={onSearch}
              options={customerOptions.map((c) => ({ value: c.id, label: `${c.full_name} — ${c.phone}` }))}
            />
          </Form.Item>
          <Form.Item name="package_id" label="Liệu trình" rules={[{ required: true, message: 'Chọn liệu trình' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn liệu trình"
              loading={packagesLoading}
              onChange={onPackageChange}
              options={packages.filter((p) => p.is_active).map((p) => ({
                value: p.id,
                label: `${p.name} (${QUOTA_LABEL[p.quota_type ?? ''] ?? p.quota_type})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="total_amount"
            label="Số tiền"
            extra={selectedSalePackage?.quota_type === 'VALUE' ? 'Định mức sử dụng của gói này sẽ tự bằng số tiền bán.' : undefined}
            rules={[{ required: true, message: 'Nhập số tiền' }]}
          >
            <InputNumber min={0} step={100000} suffix={currencySymbol} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sessions_bonus" label="Buổi tặng" extra="Cộng thêm vào số buổi của gói — để trống nếu không tặng">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expires_at" label="Hạn sử dụng" extra="Để trống nếu gói không giới hạn thời gian">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <CustomFieldFormItems definitions={customFieldDefs} />
        </Form>
      </Modal>
  )
}

