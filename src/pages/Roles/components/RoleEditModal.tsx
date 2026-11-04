import { Input, Modal } from 'antd'
import type { RoleRow } from './constants'

interface RoleEditModalProps {
  open: boolean
  editingRole: RoleRow | null
  roleName: string
  roleCode: string
  roleDescription: string
  saving: boolean
  onRoleNameChange: (value: string) => void
  onRoleCodeChange: (value: string) => void
  onRoleDescriptionChange: (value: string) => void
  onCancel: () => void
  onOk: () => void
}

export default function RoleEditModal({
  open,
  editingRole,
  roleName,
  roleCode,
  roleDescription,
  saving,
  onRoleNameChange,
  onRoleCodeChange,
  onRoleDescriptionChange,
  onCancel,
  onOk,
}: RoleEditModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText={editingRole ? 'Lưu thay đổi' : 'Tạo vai trò'}
      cancelText="Hủy"
      confirmLoading={saving}
      title={
        <span className="text-lg text-[var(--brand-dark)]">
          {editingRole ? 'Sửa vai trò' : 'Tạo vai trò mới'}
        </span>
      }
      okButtonProps={{ className: 'rounded-xl' }}
      cancelButtonProps={{ className: 'rounded-xl' }}
    >
      <div className="flex flex-col gap-4 pt-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Tên vai trò *</span>
          <Input
            value={roleName}
            onChange={(e) => onRoleNameChange(e.target.value)}
            placeholder="VD: Quản lý cơ sở"
            maxLength={100}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Mã vai trò (code)</span>
          <Input
            value={roleCode}
            onChange={(e) => onRoleCodeChange(e.target.value)}
            placeholder="VD: admin, ktv — bỏ trống nếu không dùng"
            maxLength={50}
            disabled={!!editingRole}
          />
          {!!editingRole && (
            <span className="mt-1 block text-xs text-slate-400">
              Mã vai trò cố định sau khi tạo, không thể sửa.
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Mô tả</span>
          <Input.TextArea
            value={roleDescription}
            onChange={(e) => onRoleDescriptionChange(e.target.value)}
            placeholder="Mô tả ngắn về vai trò này"
            rows={3}
            maxLength={255}
          />
        </label>
      </div>
    </Modal>
  )
}
