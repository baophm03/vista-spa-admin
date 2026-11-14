import { Alert, Col, Collapse, Form, Input, InputNumber, Modal, Row, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import ServiceImageField from '@/components/ServiceImageField'
import type { Branch } from '@/api/models/branch'
import type { Service } from '@/api/models/service'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import {
  FIXED_PACKAGE_TYPE_CODE,
  FIXED_PACKAGE_TYPE_CODES,
  FIXED_PACKAGE_TYPE_LABEL,
  SINGLE_SESSION_TYPE_CODE,
  UNLIMITED_PACKAGE_TYPE_CODE,
  VALUE_QUOTA_TYPE_CODE,
} from './constants'
import type { PackageTypeRow, TreatmentPackageRow } from './constants'

interface TreatmentPackageModalProps {
  form: FormInstance
  open: boolean
  editing: TreatmentPackageRow | null
  packageTypes: PackageTypeRow[]
  packageTypeById: Map<string, PackageTypeRow>
  services: Service[]
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
  packageTypes,
  packageTypeById,
  services,
  branches,
  packageCustomFields,
  currencySymbol,
  saving,
  onCancel,
  onOk,
}: TreatmentPackageModalProps) {
  const selectedTypeId = Form.useWatch('package_type_id', form)
  const hasWarrantyWatch = Form.useWatch('has_warranty', form)
  const selectedType = packageTypeById.get(String(selectedTypeId))
  const selectedCode = String(selectedType?.code || '').toUpperCase()
  const isSingleService = selectedCode === SINGLE_SESSION_TYPE_CODE
  const isTreatmentPackage = selectedCode === FIXED_PACKAGE_TYPE_CODE
  const isValueQuota = selectedCode === VALUE_QUOTA_TYPE_CODE
  const isLifetime = selectedCode === UNLIMITED_PACKAGE_TYPE_CODE

  /** 4 loại cố định; gói dữ liệu cũ thuộc loại khác vẫn hiển thị đúng loại của nó khi sửa. */
  const typeOptions = [
    ...FIXED_PACKAGE_TYPE_CODES
      .map((code) => packageTypes.find((type) => String(type.code).toUpperCase() === code))
      .filter((type): type is PackageTypeRow => !!type)
      .map((type) => ({ value: String(type.id), label: FIXED_PACKAGE_TYPE_LABEL[String(type.code).toUpperCase()] })),
    ...(editing && selectedType && !FIXED_PACKAGE_TYPE_CODES.includes(selectedCode)
      ? [{ value: String(selectedType.id), label: selectedType.name }]
      : []),
  ]

  const handleTypeChange = (typeId: string) => {
    const type = packageTypeById.get(String(typeId))
    if (!type) return
    const code = String(type.code || '').toUpperCase()
    form.setFieldsValue({
      quota_type:
        code === UNLIMITED_PACKAGE_TYPE_CODE ? 'UNLIMITED'
          : code === VALUE_QUOTA_TYPE_CODE ? 'VALUE'
            : 'SESSIONS',
      total_sessions: code === SINGLE_SESSION_TYPE_CODE ? 1 : undefined,
      total_value: undefined,
      service_id: undefined,
      convertible_note: undefined,
    })
  }

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
      {typeOptions.length === 0 && (
        <Alert type="warning" showIcon message="Chưa tải được danh mục loại gói cố định." style={{ marginBottom: 16 }} />
      )}
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        {/* quota_type luôn suy ra từ loại gói cố định — giữ ẩn trong form để submit đầy đủ */}
        <Form.Item name="quota_type" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="name" label="Tên gói" rules={[{ required: true, whitespace: true, message: 'Nhập tên gói' }]}>
          <Input placeholder="VD: Peel Acne chuyên sâu" />
        </Form.Item>
        <Form.Item name="image_file_id" label="Ảnh bìa">
          <ServiceImageField />
        </Form.Item>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="package_type_id" label="Loại gói" rules={[{ required: true, message: 'Chọn loại gói' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn loại gói"
                options={typeOptions}
                onChange={handleTypeChange}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            {isSingleService && (
              <Form.Item label="Số buổi" extra="Dịch vụ lẻ: 1 gói = đúng 1 buổi.">
                <InputNumber value={1} disabled style={{ width: '100%' }} />
              </Form.Item>
            )}
            {isTreatmentPackage && (
              <Form.Item
                name="total_sessions"
                label="Số buổi"
                rules={[{ required: true, message: 'Nhập số buổi' }]}
                extra="Nhập số buổi mong muốn."
              >
                <InputNumber min={2} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            )}
            {(isValueQuota || isLifetime) && (
              <Form.Item
                label="Số buổi"
                extra={isLifetime ? 'Gói trọn đời không giới hạn số buổi.' : 'Không giới hạn số buổi — mỗi buổi trừ vào định mức tiền.'}
              >
                <Input value="Không giới hạn" disabled style={{ width: '100%' }} />
              </Form.Item>
            )}
          </Col>
          <Col span={8}>
            <Form.Item name="branch_id" label="Cơ sở">
              <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
            </Form.Item>
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
                  : Promise.reject(new Error('Giá đến phải lớn hơn hoặc bằng giá từ'))
              })]}
            >
              <InputNumber min={0} precision={0} step={100000} suffix={currencySymbol} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        {isLifetime && (
          <Alert type="info" showIcon message="Gói trọn đời không giới hạn số buổi." style={{ marginBottom: 16 }} />
        )}
        {isValueQuota && (
          <Alert
            type="info"
            showIcon
            message="Gói theo định mức tiền: không giới hạn số buổi. Mỗi buổi khách tham gia sẽ trừ số tiền của buổi đó vào định mức (= giá bán), trừ hết định mức thì gói kết thúc."
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item
          name="service_id"
          label="Dịch vụ áp dụng"
          rules={[{ required: true, message: 'Gói liệu trình phải có dịch vụ' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn dịch vụ"
            options={services.map((service) => ({ value: service.id, label: service.title }))}
          />
        </Form.Item>
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
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="validity_value"
                      label="Thời hạn (tùy chọn)"
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
