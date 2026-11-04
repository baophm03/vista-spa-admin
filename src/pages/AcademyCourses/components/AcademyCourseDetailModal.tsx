import dayjs from 'dayjs'
import { Button, Descriptions, Modal, Tag } from 'antd'
import type { AcademyCourse } from '@/api/models/academyCourse'
import type { Branch } from '@/api/models/branch'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import { CATEGORY_OPTIONS, LEVEL_OPTIONS } from './constants'

export default function AcademyCourseDetailModal({ detail, branches, courseFields, formatMoney, onClose }: {
  detail: AcademyCourse | null
  branches: Branch[]
  courseFields: CustomFieldDefWithOptions[]
  formatMoney: (v?: number | null) => string
  onClose: () => void
}) {
  return (
    <Modal
      title="Chi tiết khóa học"
      open={!!detail}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={720}
    >
      {detail && (
        <Descriptions bordered size="small" column={1} style={{ marginTop: 12 }}>
          <Descriptions.Item label="Mã khóa">{detail.code}</Descriptions.Item>
          <Descriptions.Item label="Tên khóa học">{detail.name}</Descriptions.Item>
          <Descriptions.Item label="Danh mục">{CATEGORY_OPTIONS.find((item) => item.value === detail.category)?.label ?? detail.category}</Descriptions.Item>
          <Descriptions.Item label="Trình độ">{LEVEL_OPTIONS.find((item) => item.value === detail.level)?.label ?? detail.level}</Descriptions.Item>
          <Descriptions.Item label="Cơ sở">{branches.find((branch) => branch.id === detail.branch_id)?.name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Học phí tham khảo">{formatMoney(detail.tuition)}</Descriptions.Item>
          <Descriptions.Item label="Thời lượng">{detail.duration_hours ? `${detail.duration_hours} giờ` : '—'}</Descriptions.Item>
          <Descriptions.Item label="Số học viên tối đa">{detail.max_students ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày bắt đầu">{detail.start_date ? dayjs(detail.start_date).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày kết thúc">{detail.end_date ? dayjs(detail.end_date).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Mô tả">{detail.description || '—'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái"><Tag color={detail.is_active ? 'green' : 'default'}>{detail.is_active ? 'Đang mở' : 'Đã ẩn'}</Tag></Descriptions.Item>
          {Object.entries(detail.custom_fields ?? {}).map(([key, value]) => {
            const field = courseFields.find((item) => item.key === key)
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
