import { Alert, Button, Col, Collapse, Form, Input, InputNumber, Modal, Row, Segmented, Select, Switch } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import ServiceImageField from '@/components/ServiceImageField'
import type { Branch } from '@/api/models/branch'
import type { Service } from '@/api/models/service'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import { CALC_OPTIONS, type QuotaType, type TreatmentPackageRow } from './constants'

interface TreatmentPackageModalProps {
  form: FormInstance
  open: boolean
  editing: TreatmentPackageRow | null
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
  services,
  branches,
  packageCustomFields,
  currencySymbol,
  saving,
  onCancel,
  onOk,
}: TreatmentPackageModalProps) {
  const quotaTypeWatch = Form.useWatch('quota_type', form) as QuotaType | undefined
  const hasWarrantyWatch = Form.useWatch('has_warranty', form)
  const kindWatch = Form.useWatch('package_kind', form)
  const comboServicesWatch = Form.useWatch('combo_services', form) as { service_id?: string; qty?: number }[] | undefined
  const isCombo = kindWatch === 'COMBO'
  const isSessions = quotaTypeWatch === 'SESSIONS'
  const isValueQuota = quotaTypeWatch === 'VALUE'
  const isLifetime = quotaTypeWatch === 'UNLIMITED'
  const comboTotal = (comboServicesWatch ?? []).reduce((sum, entry) => sum + (Number(entry?.qty) || 0), 0)

  const handleCalcChange = () => {
    form.setFieldsValue({
      total_sessions: undefined,
      total_value: undefined,
      convertible_note: undefined,
    })
  }

  const handleKindChange = (next: string | number) => {
    if (next === 'COMBO') {
      form.setFieldsValue({
        quota_type: 'SESSIONS',
        service_id: undefined,
        total_sessions: undefined,
        combo_services: (form.getFieldValue('combo_services') ?? []).length ? form.getFieldValue('combo_services') : [{}, {}],
      })
    } else {
      form.setFieldsValue({
        quota_type: 'SESSIONS',
        service_id: undefined,
        total_sessions: undefined,
        combo_services: [],
      })
    }
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
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Tên gói" rules={[{ required: true, whitespace: true, message: 'Nhập tên gói' }]}>
          <Input placeholder="VD: Peel Acne chuyên sâu" />
        </Form.Item>
        <Form.Item name="image_file_id" label="Ảnh bìa">
          <ServiceImageField />
        </Form.Item>
        {/* Loại gói: Gói lẻ (1 dịch vụ) | Gói Combo (>= 2 dịch vụ, quota riêng theo qty) */}
        <Form.Item name="package_kind" label="Loại gói" required initialValue="LE">
          <Segmented
            options={[
              { label: 'Gói lẻ', value: 'LE' },
              { label: 'Gói Combo', value: 'COMBO' },
            ]}
            onChange={handleKindChange}
          />
        </Form.Item>
        {!isCombo && (
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
        )}
        {isCombo && (
          <>
            <Form.Item label="Dịch vụ & số buổi" required style={{ marginBottom: 4 }} extra="Mỗi dịch vụ có quota riêng theo số buổi nhập ở đây; tổng số buổi gói = tổng của từng dịch vụ." />
            <Form.List
              name="combo_services"
              rules={[{
                validator: async (_rule, rows) => {
                  if (!rows || rows.length < 2) throw new Error('Gói combo phải gồm từ 2 dịch vụ trở lên')
                  const ids = rows.map((row: { service_id?: string }) => row?.service_id).filter(Boolean)
                  if (new Set(ids).size !== ids.length) throw new Error('Gói combo không được trùng dịch vụ')
                },
              }]}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map((field) => (
                    <Row key={field.key} gutter={8} align="middle">
                      <Col span={15}>
                        <Form.Item
                          name={[field.name, 'service_id']}
                          rules={[{ required: true, message: 'Chọn dịch vụ' }]}
                          className="mb-2!"
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            placeholder="Chọn dịch vụ"
                            options={services.map((service) => ({ value: service.id, label: service.title }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item
                          name={[field.name, 'qty']}
                          rules={[{ required: true, message: 'Nhập số buổi' }]}
                          className="mb-2!"
                        >
                          <InputNumber min={1} precision={0} placeholder="Số buổi" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={4} className="mb-2!">
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label="Xóa dịch vụ"
                          title="Xóa dịch vụ"
                          disabled={fields.length <= 2}
                          onClick={() => remove(field.name)}
                        />
                      </Col>
                    </Row>
                  ))}
                  <Form.Item className="mb-1!">
                    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ qty: 1 })}>
                      Thêm dịch vụ
                    </Button>
                  </Form.Item>
                  <Form.ErrorList errors={errors} />
                </>
              )}
            </Form.List>
            <div style={{ height: 8 }} />
          </>
        )}
        <Form.Item
          name="quota_type"
          label="Cách tính"
          rules={[{ required: true, message: 'Chọn cách tính' }]}
          extra={isCombo
            ? 'Gói combo chỉ hỗ trợ cách tính theo số buổi — mỗi dịch vụ có quota riêng theo số buổi đã nhập.'
            : 'Dịch vụ lẻ = gói lẻ tính theo số buổi với đúng 1 buổi.'}
        >
          {isCombo ? (
            <Select disabled options={[{ value: 'SESSIONS', label: 'Theo số buổi' }]} />
          ) : (
            <Select
              placeholder="Chọn cách tính"
              options={CALC_OPTIONS}
              onChange={handleCalcChange}
            />
          )}
        </Form.Item>
        <Row gutter={16}>
          <Col span={8}>
            {isCombo && (
              <Form.Item label="Tổng số buổi" extra="Bằng tổng số buổi của từng dịch vụ — hệ thống tự tính.">
                <Input value={`${comboTotal} buổi`} disabled style={{ width: '100%' }} />
              </Form.Item>
            )}
            {!isCombo && isSessions && (
              <Form.Item
                name="total_sessions"
                label="Số buổi"
                rules={[{ required: true, message: 'Nhập số buổi' }]}
                extra="Nhập 1 = dịch vụ lẻ; từ 2 buổi trở lên là gói theo buổi."
              >
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            )}
            {!isCombo && (isValueQuota || isLifetime) && (
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
        {!isCombo && isLifetime && (
          <Alert type="info" showIcon message="Gói trọn đời không giới hạn số buổi." style={{ marginBottom: 16 }} />
        )}
        {!isCombo && isValueQuota && (
          <Alert
            type="info"
            showIcon
            message="Gói theo mức tiền: không giới hạn số buổi. Mỗi buổi khách tham gia sẽ trừ số tiền của buổi đó vào định mức (= giá bán), trừ hết định mức thì gói kết thúc."
            style={{ marginBottom: 16 }}
          />
        )}
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
