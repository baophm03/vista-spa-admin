import { Form, Input, InputNumber, Modal, Select, Space, Typography } from 'antd'
import type { FormInstance } from 'antd'
import { useGetVouchersAdmin } from '@/api/endpoints/vouchers'
import { useGetService } from '@/api/endpoints/services'
import { pickData } from '../../../api/helpers'
import type { Voucher, Service, WheelPrize } from '../../../api/models'
import { PRIZE_TYPE_META, formatChance, prizeChance, prizeChanceOf, totalPrizeWeight } from './constants'

export default function PrizeFormModal({ open, form, editingPrize, prizes = [], onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  editingPrize?: { id: string } | null
  /** Các giải hiện có của vòng quay — để tính tỉ lệ trúng ngay khi nhập trọng số. */
  prizes?: WheelPrize[]
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
  // Các giải KHÁC giải đang sửa — trọng số của chúng là phần cố định của mẫu số
  const otherPrizes = prizes.filter((prize) => prize.id !== editingPrize?.id)
  const otherWeight = totalPrizeWeight(otherPrizes)

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
          <Form.Item
            name="weight"
            label="Trọng số"
            rules={[{ required: true, message: 'Nhập trọng số' }]}
            style={{ flex: 1 }}
            tooltip="Số phần cơ hội của giải này. Trọng số càng lớn thì càng dễ trúng; để 0 là không bao giờ trúng."
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="VD: 10" />
          </Form.Item>
        </Space>
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.weight !== cur.weight || prev.name !== cur.name || prev.is_active !== cur.is_active}>
          {({ getFieldValue }) => {
            // Giải đang tắt không tham gia chia giải → không tính vào tổng và tỉ lệ = 0
            const drawable = getFieldValue('is_active') !== false
            const weight = drawable ? Math.max(Number(getFieldValue('weight') ?? 0), 0) : 0
            const total = otherWeight + weight
            // Ghép giải đang nhập vào danh sách để xem tỉ lệ của cả vòng quay sau khi lưu
            const rows = [
              ...otherPrizes.map((prize) => ({
                key: prize.id,
                name: prize.name,
                weight: Math.max(Number(prize.weight ?? 0), 0),
                chance: prizeChanceOf(prize, total),
                current: false,
              })),
              {
                key: 'current',
                name: getFieldValue('name') || (editingPrize ? 'Giải đang sửa' : 'Giải mới'),
                weight,
                chance: drawable ? prizeChance(weight, total) : 0,
                current: true,
              },
            ].sort((a, b) => b.weight - a.weight)

            return (
              <div className="lucky-wheel-chance-preview">
                <div className="lucky-wheel-chance-preview-head">
                  <Typography.Text strong>Tỉ lệ sau khi lưu</Typography.Text>
                  <Typography.Text type="secondary">Tổng trọng số {total.toLocaleString('vi-VN')}</Typography.Text>
                </div>
                {total > 0 ? (
                  <ul className="lucky-wheel-chance-preview-list">
                    {rows.map((row) => (
                      <li key={row.key} className={row.current ? 'is-current' : undefined}>
                        <span className="lucky-wheel-chance-preview-name" title={row.name}>{row.name}</span>
                        <span className="lucky-wheel-chance-preview-bar" aria-hidden="true">
                          <i style={{ width: `${Math.min(row.chance ?? 0, 100)}%` }} />
                        </span>
                        <span className="lucky-wheel-chance-preview-value">{formatChance(row.chance)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Typography.Text type="secondary">Nhập trọng số lớn hơn 0 để xem tỉ lệ.</Typography.Text>
                )}
                <Typography.Text type="secondary" className="lucky-wheel-chance-preview-note">
                  Tỉ lệ = trọng số ÷ tổng trọng số. Giải tắt hoặc hết lượt không được tính.
                </Typography.Text>
              </div>
            )
          }}
        </Form.Item>
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
