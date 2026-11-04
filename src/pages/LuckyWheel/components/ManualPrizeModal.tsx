import { Modal, Select, Typography } from 'antd'
import { PRIZE_TYPE_META } from './constants'

export default function ManualPrizeModal({ open, prizes, prizeId, onPrizeIdChange, customerName, loading, onCancel, onSubmit }: {
  open: boolean
  prizes: { id?: string; name: string; prize_type: string; quantity_total?: number | null; quantity_given?: number | null }[]
  prizeId: string | null
  onPrizeIdChange: (id: string) => void
  customerName?: string
  loading?: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <Modal
      title="Ghi kết quả tay"
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      okText="Ghi kết quả"
      cancelText="Hủy"
      okButtonProps={{ disabled: !prizeId, loading }}
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
        Chọn giải trúng cho {customerName} — hệ thống sẽ ghi kết quả và phát thưởng (bỏ qua quay ngẫu nhiên).
      </Typography.Paragraph>
      <Select
        style={{ width: '100%' }}
        placeholder="Chọn giải trúng"
        value={prizeId}
        onChange={onPrizeIdChange}
        options={prizes
          .filter((p) => p.prize_type !== 'NONE' && (p.quantity_total == null || (p.quantity_given ?? 0) < p.quantity_total))
          .map((p) => ({ value: p.id!, label: `${p.name} (${PRIZE_TYPE_META[p.prize_type]?.label ?? p.prize_type})` }))}
      />
    </Modal>
  )
}
