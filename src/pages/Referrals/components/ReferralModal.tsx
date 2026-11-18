import { Alert, Form, type FormInstance, Input, Modal, Select } from 'antd'
import type { DiscountRule } from '@/api/models'
import {
  REFERRER_TYPES,
  REFERRER_TYPE_META,
  STATUS_KEYS,
  STATUS_META,
  type CustomerOption,
  type ReferralRow,
} from './constants'

interface ReferralModalProps {
  open: boolean
  editing: ReferralRow | null
  onCancel: () => void
  onSubmit: () => void
  confirmLoading: boolean
  form: FormInstance
  discountRulesQueryLoading: boolean
  discountRules: DiscountRule[]
  referrerTypeValue: string | undefined
  customers: CustomerOption[]
  customersQueryLoading: boolean
  alreadyReferredIds: Set<string>
}

export default function ReferralModal({
  open,
  editing,
  onCancel,
  onSubmit,
  confirmLoading,
  form,
  discountRulesQueryLoading,
  discountRules,
  referrerTypeValue,
  customers,
  customersQueryLoading,
  alreadyReferredIds,
}: ReferralModalProps) {
  const referrerIdValue = Form.useWatch('referrer_id', form) as string | undefined

  return (
    <Modal
      title={editing ? 'Sửa giới thiệu' : 'Ghi nhận hoa hồng'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={confirmLoading}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical">
        {editing ? (
          <>
            {editing.status === 'PAID' ? (
              <Alert
                className="mb-4"
                type="warning"
                showIcon
                title="Lượt này có trạng thái chi trả cũ"
                description="Không sửa trạng thái ở đây. Hãy đối soát từng khoản hoa hồng trong phần chi trả bên dưới."
              />
            ) : (
              <Form.Item name="status" label="Trạng thái" rules={[{ required: true, message: 'Chọn trạng thái' }]}>
                <Select options={STATUS_KEYS.map((s) => ({ value: s, label: STATUS_META[s].label }))} />
              </Form.Item>
            )}
            <Form.Item name="discount_rule_id" label="Ưu đãi khách được giới thiệu">
              <Select
                allowClear
                placeholder="Chọn ưu đãi (không bắt buộc)"
                loading={discountRulesQueryLoading}
                options={discountRules.map((rule: DiscountRule) => ({ value: rule.id, label: `${rule.code} — ${rule.name}` }))}
              />
            </Form.Item>
            <Form.Item name="note" label="Ghi chú">
              <Input.TextArea rows={3} maxLength={2000} />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item name="referrer_type" label="Loại người giới thiệu" rules={[{ required: true, message: 'Chọn loại' }]}>
              <Select
                options={REFERRER_TYPES.map((t) => ({ value: t, label: REFERRER_TYPE_META[t].label }))}
                onChange={() => form.setFieldValue('referrer_id', undefined)}
              />
            </Form.Item>
            <Form.Item
              name="referrer_id"
              label="User giới thiệu"
              rules={[{ required: true, message: 'Chọn người giới thiệu' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn khách hàng"
                onChange={(value) => {
                  // Khách không thể tự giới thiệu chính mình — nếu đã chọn trùng thì xóa phía "được giới thiệu"
                  if (form.getFieldValue('referred_profile_id') === value) {
                    form.setFieldValue('referred_profile_id', undefined)
                  }
                }}
                options={customers.map((c) => ({
                  value: c.id,
                  label: [c.full_name, c.phone].filter(Boolean).join(' — ') || c.id,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="referred_profile_id"
              label="Khách được giới thiệu"
              rules={[
                { required: true, message: 'Chọn khách được giới thiệu' },
                {
                  validator: (_, value) =>
                    referrerTypeValue === 'CUSTOMER' && value && referrerIdValue && value === referrerIdValue
                      ? Promise.reject(new Error('Khách được giới thiệu phải khác khách giới thiệu'))
                      : Promise.resolve(),
                },
              ]}
              extra="Mỗi khách chỉ được ghi nhận 1 lượt giới thiệu"
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn khách hàng"
                loading={customersQueryLoading}
                options={customers
                  .filter((c) => !alreadyReferredIds.has(c.id) && c.id !== referrerIdValue)
                  .map((c) => ({
                    value: c.id,
                    label: [c.full_name, c.phone].filter(Boolean).join(' — ') || c.id,
                  }))}
              />
            </Form.Item>
            <Form.Item name="discount_rule_id" label="Ưu đãi khách được giới thiệu">
              <Select
                allowClear
                placeholder="Chọn ưu đãi (không bắt buộc)"
                loading={discountRulesQueryLoading}
                options={discountRules.map((rule: DiscountRule) => ({ value: rule.id, label: `${rule.code} — ${rule.name}` }))}
              />
            </Form.Item>
            <Form.Item name="note" label="Ghi chú">
              <Input.TextArea rows={3} maxLength={2000} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  )
}

