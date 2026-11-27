import type { ReactNode } from 'react'
import { EditOutlined, UserOutlined } from '@ant-design/icons'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import { DetailCard, DetailChip, DetailField, DetailNote } from '@/components/base/DetailModal'
import { displayDate, hasAllergy, recordFields, type HealthFields, type SkinTypeOption } from './constants'

/** Khối giao diện phiếu khám dùng chung: modal Sổ sức khỏe (/health-records) và tab Sức khỏe trong chi tiết khách hàng. */

export function EditLink({ onClick, label = 'Sửa' }: { onClick?: () => void; label?: string }) {
  if (!onClick) return null
  return (
    <button type="button" className="dm-link" onClick={onClick}>
      <EditOutlined /> {label}
    </button>
  )
}

/** Nội dung 1 phiếu khám: các chỉ mục 2 cột, lời dặn KTV thành thẻ nhấn ở cuối */
export function HealthBody({ fields }: { fields: HealthFields }) {
  return (
    <>
      <div className="dm-grid">
        <DetailField label="Loại da" value={fields.skin_type} />
        <DetailField label="Tiền sử bệnh lý" value={fields.medical_history} />
        <DetailField wide label="Tình trạng da" value={fields.condition} />
        <DetailField label="Phác đồ điều trị" value={fields.protocol} />
        <DetailField label="Sản phẩm đã dùng" value={fields.products_used} />
        {fields.note && <DetailField wide label="Ghi chú" value={fields.note} />}
      </div>
      {fields.advice && <DetailNote title="Lời dặn KTV">{fields.advice}</DetailNote>}
    </>
  )
}

/** Thẻ "Tình trạng sức khỏe" theo phiếu mới nhất (hoặc dữ liệu cũ trên hồ sơ) */
export function HealthStatusCard({ fields, onEdit }: { fields: HealthFields; onEdit?: () => void }) {
  return (
    <DetailCard title="Tình trạng sức khỏe" extra={<EditLink onClick={onEdit} label="Chỉnh sửa" />}>
      <HealthBody fields={fields} />
    </DetailCard>
  )
}

/** Dị ứng: có → thẻ nhấn đỏ; không → 1 dòng nhãn | giá trị */
export function AllergyCard({ allergies }: { allergies?: string }) {
  if (hasAllergy(allergies)) return <DetailNote tone="danger" title="Dị ứng">{allergies}</DetailNote>
  return (
    <div className="dm-card dm-inline-field">
      <span className="dm-label">Dị ứng</span>
      <span className="dm-value">{allergies || 'Không ghi nhận'}</span>
    </div>
  )
}

/** Thẻ 1 phiếu khám trong lịch sử */
export function HealthRecordCard({ record, skinTypes, latest, onEdit, extra }: {
  record: CustomerHealthRecord
  skinTypes: SkinTypeOption[]
  latest?: boolean
  onEdit?: () => void
  extra?: ReactNode
}) {
  return (
    <DetailCard
      title={(
        <span className="dm-title-row">
          {displayDate(record.checked_date)}
          {latest && <DetailChip tone="primary">Mới nhất</DetailChip>}
        </span>
      )}
      extra={extra ?? <EditLink onClick={onEdit} />}
    >
      <div className="dm-meta"><UserOutlined /> {record.checked_by || 'Chưa ghi người khám'}</div>
      {hasAllergy(record.allergies) && <div className="dm-meta dm-meta-danger">Dị ứng: {record.allergies}</div>}
      <HealthBody fields={recordFields(record, skinTypes)} />
    </DetailCard>
  )
}
