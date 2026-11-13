import { Alert, Col, Collapse, Form, Input, InputNumber, Modal, Row, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { Branch } from '@/api/models/branch'
import type { Service } from '@/api/models/service'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { PackageTypeRow, QuotaType, TreatmentPackageRow } from './constants'

interface TreatmentPackageModalProps {
  form: FormInstance
  open: boolean
  editing: TreatmentPackageRow | null
  packageTypes: PackageTypeRow[]
  packageTypeById: Map<string, PackageTypeRow>
  services: Service[]
  branches: Branch[]
  packageQuotaOptions: { value: string; label: string }[]
  selectedQuotaType: QuotaType | undefined
  selectedPackageType: PackageTypeRow | undefined
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
  packageQuotaOptions,
  selectedQuotaType,
  selectedPackageType,
  packageCustomFields,
  currencySymbol,
  saving,
  onCancel,
  onOk,
}: TreatmentPackageModalProps) {
  const totalSessionsWatch = Form.useWatch('total_sessions', form)
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
      {!packageTypes.some((type) => type.is_active !== false) && (
        <Alert type="warning" showIcon message="Hãy tạo hoặc kích hoạt loại gói trước khi tạo gói dịch vụ." style={{ marginBottom: 16 }} />
      )}
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
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
                  .filter((type) => type.is_active !== false || String(type.id) === String(editing?.package_type_id ?? editing?.package_type?.id))
                  .map((type) => ({ value: String(type.id), label: type.name + (type.is_active === false ? ' (đã ẩn)' : '') }))}
                onChange={(typeId) => {
                  const type = packageTypeById.get(String(typeId))
                  if (!type) return
                  form.setFieldsValue({
                    quota_type: type.default_quota_type,
                    total_sessions: type.default_quota_type === 'SESSIONS' ? 5 : undefined,
                    total_value: undefined,
                    service_id: undefined,
                    warranty_text: undefined,
                  })
                }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="quota_type"
              label="Chế độ bán"
              rules={[{ required: true, message: 'Chọn chế độ bán' }]}
              extra="Theo buổi: 1 buổi = dịch vụ lẻ, từ 2 buổi = bán theo buổi. Theo giá tiền: mỗi buổi có giá, tổng không vượt định mức. Unlimited: không giới hạn số buổi."
            >
              <Select options={packageQuotaOptions} onChange={(value: QuotaType) => {
                  if (value !== 'SESSIONS') form.setFieldValue('total_sessions', undefined)
                  if (value !== 'VALUE') form.setFieldValue('total_value', undefined)
                  if (value !== 'UNLIMITED') form.setFieldValue('warranty_text', undefined)
                }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            {selectedQuotaType === 'SESSIONS' && (
                <Form.Item
                  name="total_sessions"
                  label="Số buổi"
                  rules={[{ required: true, message: 'Nhập số buổi' }]}
                  extra={totalSessionsWatch === 1 ? '1 buổi — chế độ dịch vụ lẻ.' : 'Từ 2 buổi — chế độ bán theo buổi.'}
                >
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            )}
            {selectedQuotaType === 'VALUE' && (
                <Form.Item name="total_value" label="Định mức tiền" extra="Tự khớp với giá bán; khi gán khách, định mức lấy theo số tiền bán thực tế.">
                <InputNumber min={0} precision={0} suffix={currencySymbol} style={{ width: '100%' }} disabled />
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
                    : Promise.reject(new Error('Giá đến phải lớn hơn hoặc bằng giá từ'))
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
        {String(selectedPackageType?.code || '').toUpperCase() === 'COMBO' && (
          <Alert
            type="warning"
            showIcon
            message="Loại gói COMBO không còn hỗ trợ (nghiệp vụ mới: mỗi gói tương đương đúng 1 dịch vụ). Hãy chọn loại gói khác."
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item
          name="service_id"
          label="Dịch vụ áp dụng"
          rules={[{ required: true, message: 'Gói liệu trình phải gắn đúng 1 dịch vụ' }]}
          extra="Nghiệp vụ mới: mỗi gói liệu trình tương đương đúng 1 dịch vụ."
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn 1 dịch vụ"
            options={services.map((service) => ({ value: service.id, label: service.title }))}
          />
        </Form.Item>
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
                  {selectedPackageType?.has_warranty && (
                    <Form.Item name="warranty_text" label="Nội dung bảo hành">
                      <Input.TextArea rows={3} />
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
