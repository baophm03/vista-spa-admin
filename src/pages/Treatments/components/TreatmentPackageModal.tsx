import { Alert, Cascader, Col, Collapse, Form, Input, InputNumber, Modal, Row, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import ServiceImageField from '@/components/ServiceImageField'
import type { Branch } from '@/api/models/branch'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import {
  PACKAGE_TYPE_HINT,
  PACKAGE_TYPE_LABEL,
  PACKAGE_TYPE_QUOTA,
  type PackageKind,
  type PackageTypeRow,
  type ServiceOption,
  type TreatmentPackageRow,
} from './constants'

const UNCATEGORIZED_SERVICE_GROUP = '__none__'

interface TreatmentPackageModalProps {
  form: FormInstance
  open: boolean
  editing: TreatmentPackageRow | null
  kind: PackageKind
  services: ServiceOption[]
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
  kind,
  services,
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
  const isSingle = kind === 'SINGLE'
  // Số buổi / Buổi tặng chỉ áp dụng cho Gói buổi; Gói lẻ, Trọn đời, Dịch vụ lẻ ẩn đi (buổi tặng = 0)
  const showSessionFields = !isSingle && quotaType === 'SESSIONS'
  const noun = isSingle ? 'dịch vụ lẻ' : 'gói liệu trình'

  // Dịch vụ đang chọn phải luôn hiển thị (kể cả đã ẩn / khác cơ sở) để không mất giá trị khi sửa
  const currentServiceId = editing?.service_id ?? undefined
  const selectableServices = services
    .filter((item) => item.id === currentServiceId || (item.is_active !== false && (!branchIdWatch || !item.branch_id || item.branch_id === branchIdWatch)))
  // Cascader 2 cột: danh mục → dịch vụ (hover danh mục mở dịch vụ bên phải); chưa có danh mục gom vào "Không có danh mục"
  const serviceCascaderOptions = (() => {
    const groups = new Map<string, { value: string; label: string; sort: number; children: { value: string; label: string }[] }>()
    for (const item of selectableServices) {
      const categoryId = item.service_category?.id ?? item.category_id ?? UNCATEGORIZED_SERVICE_GROUP
      const group = groups.get(categoryId) ?? {
        value: categoryId,
        label: categoryId === UNCATEGORIZED_SERVICE_GROUP ? 'Không có danh mục' : item.service_category?.name ?? 'Danh mục',
        sort: categoryId === UNCATEGORIZED_SERVICE_GROUP ? Number.MAX_SAFE_INTEGER : Number(item.service_category?.sort_order ?? 0),
        children: [],
      }
      group.children.push({ value: item.id, label: `${item.title}${item.is_active === false ? ' (đã ẩn)' : ''}` })
      groups.set(categoryId, group)
    }
    return [...groups.values()]
      .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, 'vi'))
      .map(({ value, label, children }) => ({ value, label, children: children.sort((a, b) => a.label.localeCompare(b.label, 'vi')) }))
  })()
  const servicePath = (serviceId?: string) => {
    if (!serviceId) return undefined
    const group = serviceCascaderOptions.find((option) => option.children.some((child) => child.value === serviceId))
    return group ? [group.value, serviceId] : undefined
  }
  const onServiceChange = (serviceId?: string) => {
    // Dịch vụ lẻ: giá niêm yết mặc định = giá dịch vụ (chỉ khi tạo mới)
    if (!isSingle || editing) return
    const price = services.find((item) => item.id === serviceId)?.price
    if (price != null) form.setFieldValue('list_price', Number(price))
  }

  return (
    <Modal
      title={editing ? `Sửa ${noun}` : `Thêm ${noun}`}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={saving}
      okText="Lưu"
      cancelText="Hủy"
      width="min(960px, calc(100vw - 24px))"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="name" label={isSingle ? 'Tên dịch vụ lẻ' : 'Tên gói'} rules={[{ required: true, whitespace: true, message: isSingle ? 'Nhập tên dịch vụ lẻ' : 'Nhập tên gói' }]}>
          <Input placeholder={isSingle ? 'VD: Trải nghiệm chăm sóc da (1 buổi)' : 'VD: Peel Acne chuyên sâu'} />
        </Form.Item>
        <Form.Item name="image_file_id" label="Ảnh bìa">
          <ServiceImageField />
        </Form.Item>
        <Row gutter={{ xs: 12, md: 16 }}>
          <Col xs={24} md={12} style={isSingle ? { display: 'none' } : undefined}>
            {/* Loại gói quyết định cách tính: Gói lẻ = theo số tiền, Gói buổi = theo số buổi, Trọn đời = không giới hạn buổi */}
            <Form.Item name="package_type_id" label="Loại gói" rules={[{ required: true, message: 'Chọn loại gói' }]}>
              <Select
                placeholder="Chọn loại gói"
                options={packageTypes.map((type) => {
                  const code = String(type.code).toUpperCase()
                  return { value: type.id, label: `${PACKAGE_TYPE_LABEL[code] ?? type.name} — ${PACKAGE_TYPE_HINT[code] ?? ''}` }
                })}
                onChange={(typeId: string) => {
                  const nextCode = String(packageTypes.find((type) => type.id === typeId)?.code ?? '').toUpperCase()
                  form.setFieldsValue({
                    total_sessions: undefined,
                    ...(PACKAGE_TYPE_QUOTA[nextCode] === 'SESSIONS' ? {} : { bonus_sessions_default: 0 }),
                  })
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="branch_id" label="Cơ sở">
              <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={{ xs: 12, md: 16 }} style={showSessionFields ? undefined : { display: 'none' }}>
          <Col xs={12} md={8}>
            {showSessionFields && (
              <Form.Item name="total_sessions" label="Số buổi" rules={[{ required: true, message: 'Nhập số buổi' }]}>
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            )}
          </Col>
          <Col xs={12} md={8}>
            <Form.Item name="bonus_sessions_default" label="Buổi tặng">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        {showSessionFields && (
          <Alert
            type="info"
            showIcon
            message="Gói buổi tính theo số buổi: mỗi buổi khách hoàn thành sẽ trừ 1 buổi — trừ buổi mua trước, buổi tặng sau. Dùng hết số buổi (gồm cả buổi tặng) thì gói kết thúc."
            style={{ marginBottom: 16 }}
          />
        )}
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
        <Form.Item
          name="service_id"
          label="Dịch vụ áp dụng"
          // Form giữ service_id; Cascader nhận/trả path [danh mục, dịch vụ]
          getValueProps={(value?: string) => ({ value: servicePath(value) })}
          normalize={(path?: string[]) => path?.[path.length - 1]}
          rules={[{ required: true, message: 'Chọn dịch vụ áp dụng' }]}
        >
          <Cascader
            placeholder="Chọn danh mục → dịch vụ"
            options={serviceCascaderOptions}
            expandTrigger="hover"
            showSearch={{ filter: (input, path) => path.some((option) => String(option.label).toLowerCase().includes(input.toLowerCase())) }}
            displayRender={(labels) => labels.join(' / ')}
            onChange={(path) => onServiceChange(path?.[path.length - 1] as string | undefined)}
          />
        </Form.Item>
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
            label: isSingle ? 'Tùy chọn nâng cao (mô tả, điều khoản)' : 'Tùy chọn nâng cao (mô tả, thời hạn, bảo hành, điều khoản)',
            forceRender: true,
            children: (
              <>
                <Form.Item name="description" label="Mô tả">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Row gutter={{ xs: 12, md: 16 }} style={isSingle ? { display: 'none' } : undefined}>
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
                <Form.Item name="has_warranty" label="Có bảo hành" valuePropName="checked" hidden={isSingle}>
                  <Switch />
                </Form.Item>
                {hasWarrantyWatch && !isSingle && (
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
