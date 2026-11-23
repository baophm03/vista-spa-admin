import { Col, DatePicker, Form, Input, InputNumber, Modal, Radio, Row, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import dayjs from 'dayjs'
import { CATEGORY_META, type VoucherCategory, type VoucherCategoryRow } from './constants'
import { useBrandCurrency } from '@/themeRuntime'
import './VoucherModal.css'

function formatCurrencyInput(value: number | string | null | undefined, fractionDigits: number) {
  if (value === null || value === undefined || value === '') return ''
  const [integer, fraction] = String(value).split('.')
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const formattedFraction = fraction?.slice(0, fractionDigits)
  return `${formattedInteger}${formattedFraction ? `,${formattedFraction}` : ''}`
}

function parseCurrencyInput(value?: string): number {
  const normalized = (value ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  return normalized ? Number(normalized) : '' as unknown as number
}

interface VoucherModalProps {
  form: FormInstance
  open: boolean
  category: VoucherCategory
  targets: Array<{ value: string; label: string }>
  productCategories: Array<{ value: string; label: string }>
  branches: Array<{ value: string; label: string }>
  branchesLoading?: boolean
  ranks: Array<{ value: string; label: string }>
  editing: VoucherCategoryRow | null
  onCancel: () => void
  onOk: () => void
  confirmLoading?: boolean
}

export default function VoucherModal({ form, open, category, targets, productCategories, branches, branchesLoading, ranks, editing, onCancel, onOk, confirmLoading }: VoucherModalProps) {
  const { targetField, targetLabel } = CATEGORY_META[category]
  const { currency, symbol: currencySymbol } = useBrandCurrency()
  const currencyFractionDigits = new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 0
  const discountType = Form.useWatch('discount_type', form)
  const issueMode = Form.useWatch('issue_mode', form) ?? 'AUTO'
  const productTargetType = Form.useWatch('product_target_type', form) ?? 'ALL'
  const hasProductTarget = category === 'product' && productTargetType !== 'ALL'

  return (
    <Modal
      className="voucher-editor-modal"
      title={editing ? `Sửa ${CATEGORY_META[category].label.toLowerCase()}` : `Thêm ${CATEGORY_META[category].label.toLowerCase()}`}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={confirmLoading}
      okText="Lưu"
      cancelText="Hủy"
      width={820}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="voucher-form" style={{ marginTop: 12 }}>
        <Row gutter={[16, 0]}>
          <Col xs={24} md={8}>
            <Form.Item name="title" label="Tên voucher" rules={[{ required: true, message: 'Nhập tên voucher' }, { max: 150, message: 'Tên voucher tối đa 150 ký tự' }]}>
              <Input maxLength={150} placeholder={category === 'product' ? 'VD: Giảm 10% sản phẩm chăm sóc da' : 'VD: Giảm 10% gói chăm sóc da'} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            {category === 'product' ? (
              <Form.Item name="product_target_type" label="Phạm vi sản phẩm" rules={[{ required: true, message: 'Chọn phạm vi áp dụng' }]}>
                <Select
                  options={[
                    { value: 'ALL', label: 'Toàn bộ hóa đơn sản phẩm' },
                    { value: 'PRODUCT', label: 'Một sản phẩm' },
                    { value: 'CATEGORY', label: 'Một danh mục sản phẩm' },
                  ]}
                  onChange={(value) => {
                    if (value !== 'PRODUCT') form.setFieldValue('product_id', undefined)
                    if (value !== 'CATEGORY') form.setFieldValue('product_category_id', undefined)
                  }}
                />
              </Form.Item>
            ) : (
              <Form.Item name={targetField} label={targetLabel}>
                <Select allowClear showSearch optionFilterProp="label" placeholder={`Tất cả ${CATEGORY_META[category].label.replace('Voucher ', '').toLowerCase()}`} options={targets} />
              </Form.Item>
            )}
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="branch_id" label="Cơ sở áp dụng">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                loading={branchesLoading}
                placeholder="Tất cả cơ sở"
                options={branches}
              />
            </Form.Item>
          </Col>
          {hasProductTarget && (
            <Col xs={24} md={8}>
              {productTargetType === 'PRODUCT' ? (
                <Form.Item name="product_id" label="Sản phẩm áp dụng" rules={[{ required: true, message: 'Chọn sản phẩm' }]}>
                  <Select allowClear showSearch optionFilterProp="label" placeholder="Chọn sản phẩm" options={targets} />
                </Form.Item>
              ) : (
                <Form.Item name="product_category_id" label="Danh mục áp dụng" rules={[{ required: true, message: 'Chọn danh mục' }]}>
                  <Select allowClear showSearch optionFilterProp="label" placeholder="Chọn danh mục sản phẩm" options={productCategories} />
                </Form.Item>
              )}
            </Col>
          )}
        </Row>

        {category === 'product' ? (
          <>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="discount_type"
                  label="Hình thức giảm giá"
                  rules={[{ required: true, message: 'Chọn hình thức ưu đãi' }]}
                >
                  <Select placeholder="Chọn hình thức giảm giá" options={[
                    { value: 'PERCENT', label: 'Giảm theo phần trăm' },
                    { value: 'AMOUNT', label: 'Giảm số tiền cố định' },
                  ]} onChange={(value) => {
                    if (value !== 'PERCENT') form.setFieldValue('maximum_discount_amount', undefined)
                  }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="discount_value"
                  label={discountType === 'PERCENT' ? 'Phần trăm giảm (%)' : `Số tiền giảm (${currencySymbol})`}
                  validateTrigger={['onChange', 'onBlur']}
                  rules={[{ required: true, message: 'Nhập mức giảm' }, { type: 'number', min: 0.01, message: 'Mức giảm phải lớn hơn 0' }, ...(discountType === 'PERCENT' ? [{ type: 'number' as const, max: 100, message: 'Không thể giảm quá 100%' }] : [])]}
                >
                  <InputNumber
                    min={0.01}
                    precision={discountType === 'PERCENT' ? 2 : currencyFractionDigits}
                    suffix={discountType === 'PERCENT' ? '%' : currencySymbol}
                    formatter={discountType === 'PERCENT' ? undefined : (value) => formatCurrencyInput(value, currencyFractionDigits)}
                    parser={discountType === 'PERCENT' ? undefined : parseCurrencyInput}
                    style={{ width: '100%' }}
                    placeholder={discountType === 'PERCENT' ? 'VD: 10' : 'VD: 500.000'}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="minimum_order_amount"
                  label={`Giá trị áp dụng tối thiểu (${currencySymbol})`}
                  rules={[{ type: 'number', min: 0, message: 'Giá trị tối thiểu không được âm' }]}
                  extra="Chỉ cộng sản phẩm thuộc phạm vi voucher."
                >
                  <InputNumber min={0} precision={currencyFractionDigits} suffix={currencySymbol} formatter={(value) => formatCurrencyInput(value, currencyFractionDigits)} parser={parseCurrencyInput} style={{ width: '100%' }} placeholder="0 = không yêu cầu" />
                </Form.Item>
              </Col>
              {discountType === 'PERCENT' && (
                <Col xs={24} md={12}>
                  <Form.Item
                    name="maximum_discount_amount"
                    label={`Số tiền giảm tối đa (${currencySymbol})`}
                    rules={[{ type: 'number', min: 1, message: 'Số tiền giảm tối đa phải lớn hơn 0' }]}
                    preserve={false}
                  >
                    <InputNumber min={1} precision={currencyFractionDigits} suffix={currencySymbol} formatter={(value) => formatCurrencyInput(value, currencyFractionDigits)} parser={parseCurrencyInput} style={{ width: '100%' }} placeholder="Không giới hạn" />
                  </Form.Item>
                </Col>
              )}
            </Row>
          </>
        ) : (category === 'academy-course' || category === 'treatment-package') && (
          <Row gutter={[16, 0]}>
            <Col xs={24} md={category === 'treatment-package' ? 12 : 8}>
              <Form.Item
                name="discount_type"
                label={category === 'academy-course' ? 'Ưu đãi khóa học' : category === 'treatment-package' ? 'Ưu đãi gói liệu trình' : 'Hình thức giảm giá'}
                rules={[{ required: true, message: 'Chọn hình thức ưu đãi' }]}
              >
                <Select placeholder="Chọn hình thức giảm giá" options={[
                  { value: 'PERCENT', label: 'Giảm theo phần trăm' },
                  { value: 'AMOUNT', label: 'Giảm số tiền cố định' },
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={category === 'treatment-package' ? 12 : 8}>
              <Form.Item
                name="discount_value"
                label={discountType === 'PERCENT' ? 'Phần trăm giảm (%)' : `Số tiền giảm (${currencySymbol})`}
                validateTrigger={['onChange', 'onBlur']}
                rules={[{ required: true, message: 'Nhập mức giảm' }, { type: 'number', min: 0.01, message: 'Mức giảm phải lớn hơn 0' }, ...(discountType === 'PERCENT' ? [{ type: 'number' as const, max: 100, message: 'Không thể giảm quá 100%' }] : [])]}
              >
                <InputNumber
                  min={0.01}
                  precision={discountType === 'PERCENT' ? 2 : currencyFractionDigits}
                  suffix={discountType === 'PERCENT' ? '%' : currencySymbol}
                  formatter={discountType === 'PERCENT' ? undefined : (value) => formatCurrencyInput(value, currencyFractionDigits)}
                  parser={discountType === 'PERCENT' ? undefined : parseCurrencyInput}
                  style={{ width: '100%' }}
                  placeholder={discountType === 'PERCENT' ? 'VD: 10' : 'VD: 500.000'}
                />
              </Form.Item>
            </Col>
            {category === 'academy-course' && (
              <Col xs={24} md={8}>
                <Form.Item name="minimum_tuition" label={`Học phí tối thiểu (${currencySymbol})`} rules={[{ type: 'number', min: 0, message: 'Học phí tối thiểu không được âm' }]}>
                  <InputNumber min={0} precision={currencyFractionDigits} suffix={currencySymbol} formatter={(value) => formatCurrencyInput(value, currencyFractionDigits)} parser={parseCurrencyInput} style={{ width: '100%' }} placeholder="0 = không yêu cầu" />
                </Form.Item>
              </Col>
            )}
          </Row>
        )}

        <Row gutter={[16, 0]}>
          <Col xs={24} md={8}>
            <Form.Item name="issue_mode" label="Phát hành">
              <Radio.Group
                onChange={(event) => {
                  if (event.target.value === 'FIXED') form.setFieldValue('card_rank_id', undefined)
                }}
              >
                <Radio.Button value="AUTO">Tự động</Radio.Button>
                <Radio.Button value="FIXED">Gán thủ công</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="points_cost" label="Điểm đổi voucher" rules={[{ type: 'number', min: 0, message: 'Điểm đổi không được âm' }]}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Miễn phí" />
            </Form.Item>
          </Col>
          {category === 'academy-course' ? (
            <Col xs={24} md={8}>
              <Form.Item name="max_uses_per_student" label="Lượt dùng mỗi học viên" rules={[{ required: true, type: 'number', min: 1, message: 'Ít nhất 1 lần' }]}>
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          ) : (
            <Col xs={24} md={8}>
              <Form.Item name="card_rank_id" label="Hạng khách áp dụng">
                <Select allowClear showSearch optionFilterProp="label" disabled={issueMode === 'FIXED'} placeholder={issueMode === 'FIXED' ? 'Gán thủ công' : 'Tất cả hạng'} options={ranks} />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Row gutter={[16, 0]}>
          <Col xs={24} md={8}>
            <Form.Item name="quantity_total" label="Số lượng phát hành" rules={[{ type: 'number', min: 0, message: 'Số lượng không được âm' }]}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="date_range"
              label="Thời hạn"
              rules={[{
                validator: (_, value) => {
                  const [startDate, endDate] = value ?? [form.getFieldValue('start_date'), form.getFieldValue('end_date')]
                  const isUnchanged = (date: typeof startDate, previous?: string | null) => Boolean(date && previous && date.format('YYYY-MM-DD') === previous.slice(0, 10))
                  if (startDate?.isBefore(dayjs(), 'day') && !isUnchanged(startDate, editing?.start_date)) return Promise.reject(new Error('Ngày bắt đầu không được ở quá khứ'))
                  if (endDate?.isBefore(dayjs(), 'day') && !isUnchanged(endDate, editing?.end_date)) return Promise.reject(new Error('Ngày kết thúc không được ở quá khứ'))
                  if (startDate && endDate && endDate.isBefore(startDate, 'day')) return Promise.reject(new Error('Ngày kết thúc không được trước ngày bắt đầu'))
                  return Promise.resolve()
                },
              }]}
            >
              <DatePicker.RangePicker
                allowEmpty={[true, true]}
                disabledDate={(date) => Boolean(date && date.isBefore(dayjs(), 'day'))}
                format="DD/MM/YYYY"
                placeholder={['Từ ngày', 'Đến ngày']}
                style={{ width: '100%' }}
                onCalendarChange={(dates) => form.setFieldsValue({ start_date: dates?.[0] ?? undefined, end_date: dates?.[1] ?? undefined })}
                onChange={(dates) => form.setFieldsValue({ start_date: dates?.[0] ?? undefined, end_date: dates?.[1] ?? undefined })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8} className="voucher-active-col">
            <Form.Item name="is_active" label="Đang hoạt động" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="start_date" hidden><Input /></Form.Item>
        <Form.Item name="end_date" hidden><Input /></Form.Item>

        <Row gutter={[16, 0]}>
          <Col xs={24}>
            <Form.Item name="description" label="Mô tả">
              <Input.TextArea rows={3} maxLength={1000} placeholder="Điều kiện hoặc nội dung ưu đãi" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
