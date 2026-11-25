import { Button, Descriptions, Modal, Tag } from 'antd'
import type { Branch } from '@/api/models/branch'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import {
  VALIDITY_LABEL,
  packageTypeLabel,
  priceLabel,
  type PackageTypeRow,
  type TreatmentPackageRow,
} from './constants'

export default function TreatmentPackageDetailModal({ row, branches, packageTypeById, packageFields, formatMoney, onClose, onEdit }: {
  row: TreatmentPackageRow | null
  branches: Branch[]
  packageTypeById: Map<string, PackageTypeRow>
  packageFields: CustomFieldDefWithOptions[]
  formatMoney: (v?: number | null) => string
  onClose: () => void
  onEdit: (row: TreatmentPackageRow) => void
}) {
  const typeLabel = row ? packageTypeLabel(row, packageTypeById) : 'Chưa phân loại'

  return (
    <Modal
      title="Chi tiết gói liệu trình"
      open={!!row}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>Đóng</Button>,
        row && <Button key="edit" type="primary" onClick={() => onEdit(row)}>Sửa</Button>,
      ]}
      width={720}
    >
      {row && (
        <Descriptions bordered size="small" column={1} style={{ marginTop: 12 }}>
          <Descriptions.Item label="Tên gói">{row.name}</Descriptions.Item>
          <Descriptions.Item label="Cơ sở">{row.branch_id ? branches.find((branch) => branch.id === row.branch_id)?.name ?? '—' : 'Tất cả cơ sở'}</Descriptions.Item>
          <Descriptions.Item label="Loại gói"><Tag color="purple">{typeLabel}</Tag></Descriptions.Item>
          <Descriptions.Item label="Dịch vụ áp dụng">{row.package_service?.title ?? <Tag color="orange">Chưa chọn gói dịch vụ</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Hạn mức">
            {row.quota_type === 'SESSIONS'
              ? `${row.total_sessions ?? '—'} buổi`
              : row.quota_type === 'VALUE'
                ? 'Không giới hạn buổi — mỗi buổi trừ vào định mức tiền'
                : 'Không giới hạn'}
          </Descriptions.Item>
          <Descriptions.Item label="Định mức tiền">
            {row.quota_type === 'VALUE' ? 'Bằng giá bán khi bán gói cho khách' : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Giá niêm yết">{priceLabel(row, formatMoney)}</Descriptions.Item>
          <Descriptions.Item label="Thời hạn">
            {row.validity_value && row.validity_unit
              ? `${row.validity_value} ${VALIDITY_LABEL[row.validity_unit] ?? row.validity_unit}`
              : 'Không thời hạn'}
          </Descriptions.Item>
          <Descriptions.Item label="Buổi tặng mặc định">{Number(row.bonus_sessions_default ?? 0)}</Descriptions.Item>
          <Descriptions.Item label="Bảo hành">
            {row.warranty_text ? row.warranty_text : <Tag>Không bảo hành</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Mô tả">{row.description || '—'}</Descriptions.Item>
          <Descriptions.Item label="Điều khoản">{row.terms || '—'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            {row.is_active ? <Tag color="green">Đang sử dụng</Tag> : <Tag>Ngưng sử dụng</Tag>}
          </Descriptions.Item>
          {Object.entries(row.custom_fields ?? {}).map(([key, value]) => {
            const field = packageFields.find((item) => item.key === key)
            if (value === undefined || value === null || value === '') return null
            const text = Array.isArray(value)
              ? value.map(String).join(', ')
              : typeof value === 'boolean'
                ? value ? 'Có' : 'Không'
                : typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)
            return <Descriptions.Item key={key} label={field?.label ?? key}>{text}</Descriptions.Item>
          })}
        </Descriptions>
      )}
    </Modal>
  )
}
