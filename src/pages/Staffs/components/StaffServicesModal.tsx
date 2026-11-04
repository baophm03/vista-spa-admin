import { Checkbox, Modal, Typography } from 'antd'
import type { StaffRow } from './constants'

interface StaffServicesModalProps {
  open: boolean
  servicesUser: StaffRow | null
  serviceRows: { id: string; title?: string }[]
  checkedServiceIds: string[]
  loading: boolean
  saving: boolean
  onCheckedChange: (ids: string[]) => void
  onCancel: () => void
  onOk: () => void
}

export default function StaffServicesModal({
  open,
  servicesUser,
  serviceRows,
  checkedServiceIds,
  loading,
  saving,
  onCheckedChange,
  onCancel,
  onOk,
}: StaffServicesModalProps) {
  return (
    <Modal
      title={`Dịch vụ phụ trách — ${servicesUser?.zalo_name || servicesUser?.email || ''}`}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={saving}
      okButtonProps={{ disabled: loading }}
    >
      {loading ? (
        <Typography.Text type="secondary">Đang tải dịch vụ hiện tại…</Typography.Text>
      ) : (
        <Checkbox.Group
          value={checkedServiceIds}
          onChange={(values) => onCheckedChange(values as string[])}
          className="mt-2 grid max-h-[50vh] gap-2 overflow-y-auto"
          options={serviceRows.map((service) => ({ value: service.id, label: service.title || service.id }))}
        />
      )}
      <Typography.Text type="secondary" className="mt-3 block">
        Lưu sẽ thay thế toàn bộ danh sách dịch vụ KTV này phụ trách. Danh sách dùng để lọc KTV khi đặt lịch.
      </Typography.Text>
    </Modal>
  )
}
