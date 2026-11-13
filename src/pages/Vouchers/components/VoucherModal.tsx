import { Alert, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import dayjs from 'dayjs'
import { CATEGORY_META, type VoucherCategory, type VoucherCategoryRow } from './constants'

interface VoucherModalProps {
  form: FormInstance
  open: boolean
  category: VoucherCategory
  targets: Array<{ value: string; label: string }>
  ranks: Array<{ value: string; label: string }>
  editing: VoucherCategoryRow | null
  onCancel: () => void
  onOk: () => void
  confirmLoading?: boolean
}

export default function VoucherModal({ form, open, category, targets, ranks, editing, onCancel, onOk, confirmLoading }: VoucherModalProps) {
  const { targetField, targetLabel } = CATEGORY_META[category]
  const discountType = Form.useWatch('discount_type', form)

  return (
    <Modal
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
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}>
            <Form.Item name="title" label="Tên voucher" extra="Tên này sẽ hiển thị khi nhân viên hoặc khách chọn voucher." rules={[{ required: true, message: 'Nhập tên voucher' }, { max: 150, message: 'Tên voucher tối đa 150 ký tự' }]}>
              <Input maxLength={150} placeholder={category === 'product' ? 'VD: Giảm 10% sản phẩm chăm sóc da' : 'VD: Giảm 10% gói chăm sóc da'} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name={targetField} label={targetLabel} extra="Chọn một mục cụ thể; để trống nếu áp dụng cho tất cả.">
              <Select allowClear showSearch optionFilterProp="label" placeholder={`Tất cả ${CATEGORY_META[category].label.replace('Voucher ', '').toLowerCase()}`} options={targets} />
            </Form.Item>
          </Col>

          {(category === 'academy-course' || category === 'treatment-package' || category === 'product') && (
            <>
              <Col xs={24} md={12}>
                <Form.Item
                  name="discount_type"
                  label={category === 'academy-course' ? 'Ưu đãi khóa học' : category === 'treatment-package' ? 'Ưu đãi gói liệu trình' : 'Hình thức giảm giá'}
                  extra={category === 'product' ? 'Chọn giảm theo % hoặc trừ một số tiền cố định.' : 'Có thể giảm tiền hoặc tặng quyền lợi.'}
                  rules={[{ required: true, message: 'Chọn hình thức ưu đãi' }]}
                >
                  <Select options={[
                    { value: 'PERCENT', label: 'Giảm theo phần trăm' },
                    { value: 'AMOUNT', label: 'Giảm số tiền cố định' },
                    ...(category === 'product' ? [] : [{ value: 'GIFT', label: 'Tặng quà / quyền lợi' }]),
                  ]} onChange={(value) => { if (category === 'product' && value !== 'PERCENT') form.setFieldValue('maximum_discount_amount', undefined) }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                {discountType !== 'GIFT' ? (
                  <Form.Item
                    name="discount_value"
                    label={discountType === 'PERCENT' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (đ)'}
                    extra={discountType === 'PERCENT' ? 'Tỷ lệ giảm trên mục được áp dụng.' : 'Số tiền trừ trực tiếp vào giá trị được áp dụng.'}
                    rules={[{ required: true, message: 'Nhập mức giảm' }, { type: 'number', min: 0.01, message: 'Mức giảm phải lớn hơn 0' }, ...(discountType === 'PERCENT' ? [{ type: 'number' as const, max: 100, message: 'Không thể giảm quá 100%' }] : [])]}
                  >
                    <InputNumber min={0.01} max={discountType === 'PERCENT' ? 100 : undefined} precision={discountType === 'PERCENT' ? 2 : 0} style={{ width: '100%' }} placeholder={discountType === 'PERCENT' ? 'VD: 10' : 'VD: 500000'} />
                  </Form.Item>
                ) : (
                  <Alert type="info" showIcon message="Ghi rõ quà tặng hoặc quyền lợi trong phần mô tả bên dưới." style={{ marginTop: 30 }} />
                )}
              </Col>
            </>
          )}

          {category === 'product' && (
            <>
              <Col xs={24} md={discountType === 'PERCENT' ? 12 : 24}>
                <Form.Item
                  name="minimum_order_amount"
                  label="Giá trị đơn hàng tối thiểu (đ)"
                  extra="Tính trên toàn đơn trước khi giảm; nhập 0 nếu không yêu cầu."
                  rules={[{ type: 'number', min: 0, message: 'Giá trị tối thiểu không được âm' }]}
                >
                  <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="VD: 500000" />
                </Form.Item>
              </Col>
              {discountType === 'PERCENT' && (
                <Col xs={24} md={12}>
                  <Form.Item
                    name="maximum_discount_amount"
                    label="Số tiền giảm tối đa (đ)"
                    extra="Để trống nếu không giới hạn số tiền giảm."
                    rules={[{ type: 'number', min: 1, message: 'Số tiền giảm tối đa phải lớn hơn 0' }]}
                    preserve={false}
                  >
                    <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
                  </Form.Item>
                </Col>
              )}
            </>
          )}

          {category === 'academy-course' && (
            <>
              <Col xs={24} md={12}>
                <Form.Item name="minimum_tuition" label="Học phí tối thiểu (đ)" extra="Chỉ áp dụng từ mức học phí này trở lên; nhập 0 nếu không yêu cầu." rules={[{ type: 'number', min: 0, message: 'Học phí tối thiểu không được âm' }]}>
                  <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="max_uses_per_student" label="Số lần dùng mỗi học viên" extra="Giới hạn số lần một học viên được dùng." rules={[{ required: true, type: 'number', min: 1, message: 'Ít nhất 1 lần' }]}>
                  <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </>
          )}

          {category !== 'academy-course' && (
            <Col xs={24} md={12}>
              <Form.Item name="card_rank_id" label="Hạng khách áp dụng" extra="Dùng để chọn khách nhận ưu đãi theo hạng; để trống nếu không giới hạn.">
                <Select allowClear showSearch optionFilterProp="label" placeholder="Tất cả hạng" options={ranks} />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} md={category === 'academy-course' ? 24 : 12}>
            <Form.Item name="quantity_total" label="Số lượng phát hành" extra="Tổng số voucher được phát; để trống nếu không giới hạn." rules={[{ type: 'number', min: 0, message: 'Số lượng không được âm' }]}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="is_loyalty" label="Ưu đãi tri ân khách cũ" valuePropName="checked" extra="Bật nếu voucher chỉ dành cho khách cũ.">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="is_active" label="Đang hoạt động" valuePropName="checked" extra="Tắt để ngừng phát hành và sử dụng voucher này.">
              <Switch />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="start_date"
              label="Ngày bắt đầu"
              extra="Từ ngày này voucher mới có hiệu lực. Không chọn ngày đã qua."
              rules={[{
                validator: (_, value) => !value || !value.isBefore(dayjs(), 'day') || (editing?.start_date && value.format('YYYY-MM-DD') === editing.start_date.slice(0, 10))
                  ? Promise.resolve()
                  : Promise.reject(new Error('Ngày bắt đầu không được ở quá khứ')),
              }]}
            >
              <DatePicker disabledDate={(date) => Boolean(date && date.isBefore(dayjs(), 'day'))} style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="end_date"
              label="Ngày kết thúc"
              dependencies={['start_date']}
              extra="Hết ngày này voucher không dùng được. Không chọn ngày đã qua."
              rules={[{
                validator: (_, value) => {
                  if (!value) return Promise.resolve()
                  const isUnchangedPastDate = editing?.end_date && value.format('YYYY-MM-DD') === editing.end_date.slice(0, 10)
                  if (value.isBefore(dayjs(), 'day') && !isUnchangedPastDate) return Promise.reject(new Error('Ngày kết thúc không được ở quá khứ'))
                  const startDate = form.getFieldValue('start_date')
                  if (startDate && value.isBefore(startDate, 'day')) return Promise.reject(new Error('Ngày kết thúc không được trước ngày bắt đầu'))
                  return Promise.resolve()
                },
              }]}
            >
              <DatePicker
                disabledDate={(date) => {
                  if (!date) return false
                  const startDate = form.getFieldValue('start_date')
                  return date.isBefore(dayjs(), 'day') || Boolean(startDate && date.isBefore(startDate, 'day'))
                }}
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
              />
            </Form.Item>
          </Col>

          <Col xs={24}>
            <Form.Item name="description" label="Mô tả" extra="Ghi quyền lợi hoặc điều kiện để khách dễ hiểu.">
              <Input.TextArea rows={3} maxLength={1000} placeholder={discountType === 'GIFT' && (category === 'academy-course' || category === 'treatment-package') ? 'Ghi rõ quà tặng hoặc quyền lợi khách nhận được' : 'Điều kiện hoặc nội dung ưu đãi'} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
