import { Form, Input, InputNumber, Modal, Select, Space } from 'antd'
import type { FormInstance } from 'antd'
import { useGetVouchersAdmin } from '@/api/endpoints/vouchers'
import { useGetService } from '@/api/endpoints/services'
import { pickData } from '../../../api/helpers'
import type { Voucher, Service } from '../../../api/models'
import { PRIZE_TYPE_META } from './constants'

export default function PrizeFormModal({ open, form, editingPrize, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  editingPrize?: { id: string } | null
  onCancel: () => void
  onSubmit: () => void
}) {
  const vouchersQuery = useGetVouchersAdmin({ pageSize: 200 } as never, { query: { enabled: open } })
  const servicesQuery = useGetService({ query: { enabled: open } })
  const vouchers = (pickData<{ rows?: Voucher[] }>(vouchersQuery.data)?.rows ?? []) as Voucher[]
  const services = (pickData<Service[]>(servicesQuery.data) ?? []) as Service[]
  const voucherOptions = vouchers
    .filter((item) => item.is_active !== false)
    .map((item) => ({ value: item.id, label: item.title }))
  const serviceOptions = services
    .map((item) => ({ value: item.id, label: item.title }))

  return (
    <Modal className="lucky-wheel-form-modal" title={editingPrize ? 'Sửa giải thưởng' : 'Thêm giải thưởng'} open={open} onCancel={onCancel} onOk={onSubmit} okText="Lưu" cancelText="Hủy">
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
                <Form.Item name="voucher_id" label="Voucher cấp khi trúng" rules={[{ required: true, message: 'Chọn voucher' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn voucher từ danh sách"
                    loading={vouchersQuery.isLoading}
                    options={voucherOptions}
                    notFoundContent={vouchersQuery.isError ? 'Không tải được danh sách voucher' : undefined}
                  />
                </Form.Item>
              ) : null}
              {getFieldValue('prize_type') === 'SERVICE' ? (
                <Form.Item name="service_id" label="Dịch vụ tặng khi trúng" rules={[{ required: true, message: 'Chọn dịch vụ' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn dịch vụ từ danh sách"
                    loading={servicesQuery.isLoading}
                    options={serviceOptions}
                    notFoundContent={servicesQuery.isError ? 'Không tải được danh sách dịch vụ' : undefined}
                  />
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
