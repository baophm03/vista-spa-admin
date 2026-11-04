import { Form, Input, InputNumber, Modal, Select, Space } from 'antd'
import type { FormInstance } from 'antd'
import { PRIZE_TYPE_META } from './constants'

export default function PrizeFormModal({ open, form, editingPrize, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  editingPrize?: { id: string } | null
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <Modal title={editingPrize ? 'Sửa giải thưởng' : 'Thêm giải thưởng'} open={open} onCancel={onCancel} onOk={onSubmit} okText="Lưu" cancelText="Hủy">
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Tên giải" rules={[{ required: true, message: 'Nhập tên giải' }]}>
          <Input placeholder="VD: Voucher giảm 100k" />
        </Form.Item>
        <Space style={{ display: 'flex' }}>
          <Form.Item name="prize_type" label="Loại giải" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select options={Object.keys(PRIZE_TYPE_META).map((k) => ({ value: k, label: PRIZE_TYPE_META[k].label }))} />
          </Form.Item>
          <Form.Item name="weight" label="Trọng số" rules={[{ required: true }]} style={{ flex: 1 }}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.prize_type !== cur.prize_type}>
          {({ getFieldValue }) => (
            <>
              {getFieldValue('prize_type') === 'POINTS' ? (
                <Form.Item name="points" label="Số điểm tặng" rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              ) : null}
              {getFieldValue('prize_type') === 'VOUCHER' ? (
                <Form.Item name="voucher_id" label="Voucher ID (UUID)" rules={[{ required: true, message: 'Nhập voucher ID' }]}>
                  <Input placeholder="UUID voucher cấp khi trúng" />
                </Form.Item>
              ) : null}
              {getFieldValue('prize_type') === 'SERVICE' ? (
                <Form.Item name="service_id" label="Dịch vụ ID (UUID)" rules={[{ required: true, message: 'Nhập dịch vụ ID' }]}>
                  <Input placeholder="UUID dịch vụ tặng khi trúng" />
                </Form.Item>
              ) : null}
            </>
          )}
        </Form.Item>
        <Form.Item name="quantity_total" label="Số lượng (bỏ trống = không giới hạn)">
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        {editingPrize && (
          <Form.Item name="is_active" label="Đang kích hoạt">
            <Select options={[{ value: true, label: 'Bật' }, { value: false, label: 'Tắt' }]} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
