import { Alert, Button, Descriptions, Modal, Spin, Tag } from 'antd'
import dayjs from 'dayjs'
import { useGetDiscountRulesId } from '@/api/endpoints/settings'
import { errorMessage } from '@/api/helpers'
import { APPLIES_TO_OPTIONS, AUDIENCE_META } from './constants'

interface DiscountDetailModalProps {
  ruleId?: string
  services: { id: string; title: string }[]
  onClose: () => void
}

export default function DiscountDetailModal({ ruleId, services, onClose }: DiscountDetailModalProps) {
  const detailQuery = useGetDiscountRulesId(ruleId ?? '', {
    query: { enabled: !!ruleId, retry: false },
  })
  const detailRule = detailQuery.data?.responseData

  return (
    <Modal
      title="Chi tiết quy tắc giảm giá"
      open={!!ruleId}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={680}
      destroyOnHidden
    >
      {detailQuery.isLoading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 160 }}><Spin /></div>
      ) : detailQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được chi tiết quy tắc"
          description={errorMessage(detailQuery.error)}
          action={<Button size="small" onClick={() => void detailQuery.refetch()}>Thử lại</Button>}
        />
      ) : detailRule ? (
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Mã">{detailRule.code}</Descriptions.Item>
          <Descriptions.Item label="Tên">{detailRule.name}</Descriptions.Item>
          <Descriptions.Item label="Đối tượng">
            {AUDIENCE_META[detailRule.audience ?? 'RANK']?.label ?? detailRule.audience ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Hạng thẻ">
            {detailRule.audience === 'RANK' ? (detailRule.requires_rank?.name ? String(detailRule.requires_rank.name) : '—') : 'Không giới hạn theo hạng'}
          </Descriptions.Item>
          <Descriptions.Item label="Áp dụng cho">
            {APPLIES_TO_OPTIONS.find((option) => option.value === detailRule.applies_to)?.label ?? 'Tất cả'}
          </Descriptions.Item>
          <Descriptions.Item label="Mức giảm">
            {(detailRule.percent_min ?? 0)}–{(detailRule.percent_max ?? 0)}%
          </Descriptions.Item>
          {detailRule.applies_to === 'SERVICE' && (
            <Descriptions.Item label="Dịch vụ áp dụng" span={2}>
              {(detailRule.service_ids ?? []).length
                ? (detailRule.service_ids ?? []).map((id) => services.find((service) => service.id === id)?.title ?? id).join(', ')
                : 'Chưa gắn dịch vụ'}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Trần giảm tổng">
            {detailRule.max_total_percent != null ? `${detailRule.max_total_percent}%` : 'Mặc định 50%'}
          </Descriptions.Item>
          <Descriptions.Item label="Được cộng dồn">
            {detailRule.stackable === false ? 'Không' : 'Có'}
          </Descriptions.Item>
          <Descriptions.Item label="Giới hạn mỗi khách">
            {detailRule.once_per_customer ? 'Chỉ 1 lần' : 'Không giới hạn'}
          </Descriptions.Item>
          <Descriptions.Item label="Hiển thị trên app">
            {detailRule.show_in_app === false ? 'Không' : 'Có'}
          </Descriptions.Item>
          <Descriptions.Item label="Thời hạn">
            {detailRule.start_date || detailRule.end_date
              ? `${detailRule.start_date ? dayjs(detailRule.start_date).format('DD/MM/YYYY') : 'Không giới hạn'} → ${detailRule.end_date ? dayjs(detailRule.end_date).format('DD/MM/YYYY') : 'Không giới hạn'}`
              : 'Không giới hạn'}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={detailRule.is_active === false ? 'default' : 'green'}>
              {detailRule.is_active === false ? 'Đã ẩn' : 'Đang áp dụng'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Alert type="warning" showIcon message="Không tìm thấy thông tin quy tắc này." />
      )}
    </Modal>
  )
}
