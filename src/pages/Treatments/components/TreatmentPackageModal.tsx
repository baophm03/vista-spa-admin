import { Alert, Col, Collapse, Form, Input, InputNumber, Modal, Row, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import ServiceImageField from '@/components/ServiceImageField'
import type { Branch } from '@/api/models/branch'
import type { PackageService } from '@/api/models/packageService'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import {
  PACKAGE_TYPE_HINT,
  PACKAGE_TYPE_LABEL,
  PACKAGE_TYPE_QUOTA,
  type PackageTypeRow,
  type TreatmentPackageRow,
} from './constants'

interface TreatmentPackageModalProps {
  form: FormInstance
  open: boolean
  editing: TreatmentPackageRow | null
  packageServices: PackageService[]
  packageTypes: PackageTypeRow[]
  branches: Branch[]
  packageCustomFields: CustomFieldDefWithOptions[]
  currencySymbol: string
  saving: boolean
  onCancel: () => void
  onOk: () => void
}

export default function TreatmentPackageModal({
  form,
  open,
  editing,
  packageServices,
  packageTypes,
  branches,
  packageCustomFields,
  currencySymbol,
  saving,
  onCancel,
  onOk,
}: TreatmentPackageModalProps) {
  const hasWarrantyWatch = Form.useWatch('has_warranty', form)
  const packageTypeIdWatch = Form.useWatch('package_type_id', form) as string | undefined
  const branchIdWatch = Form.useWatch('branch_id', form) as string | undefined
  const typeCode = String(packageTypes.find((type) => type.id === packageTypeIdWatch)?.code ?? '').toUpperCase()
  const quotaType = PACKAGE_TYPE_QUOTA[typeCode]

  // Gói dịch vụ đang chọn phải luôn hiển thị (kể cả đã ẩn / khác cơ sở) để không mất giá trị khi sửa
  const currentServiceId = editing?.package_service_id ?? undefined
  const packageServiceOptions = packageServices
    .filter((item) => item.id === currentServiceId || (item.is_active !== false && (!branchIdWatch || !item.branch_id || item.branch_id === branchIdWatch)))
    .map((item) => ({ value: item.id, label: `${item.title}${item.is_active === false ? ' (đã ẩn)' : ''}` }))

  return (
    <Modal
      title={editing ? 'Sửa gói liệu trình' : 'Thêm gói liệu trình'}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={saving}
      okText="Lưu"
      cancelText="Hủy"
      width="min(960px, calc(100vw - 24px))"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Tên gói" rules={[{ required: true, whitespace: true, message: 'Nhập tên gói' }]}>
          <Input placeholder="VD: Peel Acne chuyên sâu" />
        </Form.Item>
        <Form.Item name="image_file_id" label="Ảnh bìa">
          <ServiceImageField />
        </Form.Item>
        <Row gutter={{ xs: 12, md: 16 }}>
          <Col xs={24} md={12}>
            {/* Loại gói quyết định cách tính: Gói lẻ = theo số tiền, Gói buổi = theo số buổi, Trọn đời = không giới hạn buổi */}
            <Form.Item name="package_type_id" label="Loại gói" rules={[{ required: true, message: 'Chọn loại gói' }]}>
              <Select
                placeholder="Chọn loại gói"
                options={packageTypes.map((type) => {
                  const code = String(type.code).toUpperCase()
                  return { value: type.id, label: `${PACKAGE_TYPE_LABEL[code] ?? type.name} — ${PACKAGE_TYPE_HINT[code] ?? ''}` }
                })}
                onChange={() => form.setFieldsValue({ total_sessions: undefined })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="branch_id" label="Cơ sở">
              <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="package_service_id"
          label="Dịch vụ áp dụng"
          rules={[{ required: true, message: 'Chọn gói dịch vụ áp dụng' }]}
          extra="Danh mục ở tab “Gói dịch vụ” (tách riêng khỏi dịch vụ lẻ)."
        >
          <Select showSearch optionFilterProp="label" placeholder="Chọn gói dịch vụ" options={packageServiceOptions} />
        </Form.Item>
        <Row gutter={{ xs: 12, md: 16 }}>
          <Col xs={12} md={8}>
            {quotaType === 'SESSIONS' ? (
              <Form.Item name="total_sessions" label="Số buổi" rules={[{ required: true, message: 'Nhập số buổi' }]}>
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            ) : (
              <Form.Item label="Số buổi">
                <Input value={quotaType ? 'Không giới hạn' : '—'} disabled style={{ width: '100%' }} />
              </Form.Item>
            )}
          </Col>
          <Col xs={12} md={8}>
            <Form.Item name="bonus_sessions_default" label="Buổi tặng">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        {quotaType === 'UNLIMITED' && (
          <Alert type="info" showIcon message="Gói trọn đời không giới hạn số buổi." style={{ marginBottom: 16 }} />
        )}
        {quotaType === 'VALUE' && (
          <Alert
            type="info"
            showIcon
            message="Gói lẻ tính theo số tiền: không giới hạn số buổi. Mỗi buổi khách tham gia sẽ trừ số tiền của buổi đó vào định mức (= giá bán), trừ hết định mức thì gói kết thúc."
            style={{ marginBottom: 16 }}
          />
        )}
        <Row gutter={{ xs: 12, md: 16 }}>
          <Col xs={12} md={8}>
            <Form.Item name="list_price" label="Giá từ" rules={[{ required: true, message: 'Nhập giá niêm yết' }]}>
              <InputNumber min={0} precision={0} step={100000} suffix={currencySymbol} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item
              name="list_price_max"
              label="Giá đến"
              dependencies={['list_price']}
              rules={[({ getFieldValue }) => ({
                validator: (_rule, value) => value == null || Number(value) >= Number(getFieldValue('list_price') ?? 0)
                  ? Promise.resolve()
                  : Promise.reject(new Error('Giá đến phải lớn hơn hoặc bằng giá từ'))
              })]}
            >
              <InputNumber min={0} precision={0} step={100000} suffix={currencySymbol} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Collapse
          ghost
          items={[{
            key: 'advanced',
            label: 'Tùy chọn nâng cao (mô tả, thời hạn, bảo hành, điều khoản)',
            forceRender: true,
            children: (
              <>
                <Form.Item name="description" label="Mô tả">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Row gutter={{ xs: 12, md: 16 }}>
                  <Col xs={12} md={8}>
                    <Form.Item
                      name="validity_value"
                      label="Thời hạn"
                      dependencies={['validity_unit']}
                      rules={[({ getFieldValue }) => ({
                        validator: (_rule, value) => (value == null) === (getFieldValue('validity_unit') == null)
                          ? Promise.resolve()
                          : Promise.reject(new Error('Cần nhập cả thời hạn và đơn vị'))
                      })]}
                    >
                      <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={8}>
                    <Form.Item name="validity_unit" label="Đơn vị">
                      <Select allowClear options={[
                        { value: 'DAY', label: 'Ngày' },
                        { value: 'WEEK', label: 'Tuần' },
                        { value: 'MONTH', label: 'Tháng' },
                      ]} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="has_warranty" label="Có bảo hành" valuePropName="checked">
                  <Switch />
                </Form.Item>
                {hasWarrantyWatch && (
                  <Form.Item
                    name="warranty_text"
                    label="Nội dung bảo hành"
                    extra="Nhập tự do, ví dụ: bảo hành 6 tháng kể từ ngày bắt đầu liệu trình."
                  >
                    <Input.TextArea rows={2} placeholder="VD: Bảo hành 6 tháng" />
                  </Form.Item>
                )}
                <Form.Item name="terms" label="Điều khoản">
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item name="is_active" label="Đang sử dụng" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </>
            ),
          }]}
        />
        <CustomFieldFormItems definitions={packageCustomFields} />
      </Form>
    </Modal>
  )
}
