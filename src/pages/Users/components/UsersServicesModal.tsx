import { Checkbox, Modal, Typography } from 'antd'
import type { UserRow } from './constants'

interface UserservicesModalProps {
  open: boolean
  servicesUser: UserRow | null
  serviceRows: { id: string; title?: string }[]
  checkedServiceIds: string[]
  loading: boolean
  saving: boolean
  onCheckedChange: (ids: string[]) => void
  onCancel: () => void
  onOk: () => void
}

export default function UserservicesModal({
  open,
  servicesUser,
  serviceRows,
  checkedServiceIds,
  loading,
  saving,
  onCheckedChange,
  onCancel,
  onOk,
}: UserservicesModalProps) {
  return (
    <Modal
      title={`Dịch vụ phụ trách — ${servicesUser?.zalo_name || servicesUser?.email || ''}`}
      width={600}
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
          className="User-services-grid mt-2 max-h-[50vh] overflow-y-auto"
          options={serviceRows.map((service) => ({ value: service.id, label: service.title || service.id }))}
        />
      )}
      <Typography.Text type="secondary" className="mt-3 block">
        Lưu sẽ thay thế toàn bộ danh sách dịch vụ KTV này phụ trách. Danh sách dùng để lọc KTV khi đặt lịch.
      </Typography.Text>
    </Modal>
  )
}
