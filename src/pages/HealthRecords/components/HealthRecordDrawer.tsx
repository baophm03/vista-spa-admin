import { Alert, Button, Card, Descriptions, Drawer, Empty, Space, Tag, Typography } from 'antd'
import {
  CalendarOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ProfileOutlined,
} from '@ant-design/icons'
import { Can } from '@casl/react'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import {
  currentHealth,
  displayDate,
  healthDetails,
  skinTypeLabel,
  type HealthRow,
  type ServiceHistoryAppointment,
  type SkinTypeOption,
} from './constants'

interface HealthRecordDrawerProps {
  detail: HealthRow | null
  onClose: () => void
  onOpenRecordForm: (row: HealthRow, record?: CustomerHealthRecord) => void
  skinTypes: SkinTypeOption[]
  history: CustomerHealthRecord[]
  historyLoading: boolean
  historyError: boolean
  onRetryHistory: () => void
  detailTreatments: CustomerTreatment[]
  packageNames: Record<string, string>
  detailAppointments: ServiceHistoryAppointment[]
}

export default function HealthRecordDrawer({
  detail,
  onClose,
  onOpenRecordForm,
  skinTypes,
  history,
  historyLoading,
  historyError,
  onRetryHistory,
  detailTreatments,
  packageNames,
  detailAppointments,
}: HealthRecordDrawerProps) {
  return (
    <Drawer
      title={detail ? `${detail.full_name} — ${detail.customer_code}` : 'Hồ sơ sức khỏe'}
      width={560}
      open={!!detail}
      onClose={onClose}
      extra={detail && <Can I="UPDATE" a="CUSTOMER"><Button type="primary" icon={<PlusOutlined />} onClick={() => onOpenRecordForm(detail)}>Tạo phiếu khám</Button></Can>}
    >
      {detail && (() => {
        const current = currentHealth(detail, skinTypes)
        const hasLegacy = !detail.latestRecord && healthDetails(current).some((field) => !!field.value)
        return (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" title={<Space><ProfileOutlined />Tổng quan sức khỏe</Space>}>
              {hasLegacy && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 14 }}
                  message="Thông tin cũ trên hồ sơ"
                  description="Khách chưa có phiếu khám mới. Dữ liệu này vẫn được giữ nguyên và chưa được tính là một lần khám."
                />
              )}
              {detail.latestRecord && (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  Theo phiếu khám ngày {displayDate(detail.latestRecord.checked_date)}
                </Typography.Text>
              )}
              <Descriptions column={1} size="small" labelStyle={{ width: 150, color: '#7E8581' }}>
                <Descriptions.Item label="Khám bởi">{current.checked_by || '—'}</Descriptions.Item>
                <Descriptions.Item label="Ngày khám">{displayDate(current.checked_date)}</Descriptions.Item>
                {healthDetails(current).map((field) => (
                  <Descriptions.Item key={field.label} label={field.label}>{field.value || '—'}</Descriptions.Item>
                ))}
              </Descriptions>
            </Card>

            <Card
              size="small"
              title={<Space><FileTextOutlined />Lịch sử phiếu khám</Space>}
            >
              {historyLoading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>Đang tải lịch sử khám...</div>
              ) : historyError ? (
                <Alert
                  type="error"
                  showIcon
                  message="Không tải được lịch sử phiếu khám"
                  action={<Button size="small" onClick={onRetryHistory}>Thử lại</Button>}
                />
              ) : history.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phiếu khám mới" />
              ) : (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {history.map((record) => (
                    <Card
                      key={record.id}
                      size="small"
                      title={<Space><CalendarOutlined />{displayDate(record.checked_date)}{record.checked_by ? ` · ${record.checked_by}` : ''}</Space>}
                      extra={<Button size="small" onClick={() => onOpenRecordForm(detail, record)}>Sửa</Button>}
                    >
                      <Descriptions column={1} size="small" labelStyle={{ width: 145, color: '#7E8581' }}>
                        {healthDetails({
                          medical_history: record.medical_history ?? undefined,
                          skin_type: skinTypeLabel(record.skin_type, skinTypes),
                          condition: record.condition,
                          allergies: record.allergies ?? undefined,
                          protocol: record.protocol ?? undefined,
                          products_used: record.products_used ?? undefined,
                          advice: record.advice ?? undefined,
                          note: record.note ?? undefined,
                        }).map((field) => (
                          <Descriptions.Item key={field.label} label={field.label}>{field.value || '—'}</Descriptions.Item>
                        ))}
                      </Descriptions>
                    </Card>
                  ))}
                </Space>
              )}
            </Card>

            <Card size="small" title={<Space><MedicineBoxOutlined />Liệu trình</Space>}>
              {detailTreatments.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Khách chưa có liệu trình" />
              ) : (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {detailTreatments.map((treatment) => (
                    <div key={treatment.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Typography.Text style={{ flex: 1 }}>{packageNames[treatment.package_id] || 'Gói liệu trình'}</Typography.Text>
                      <Typography.Text type="secondary">
                        {treatment.quota_type === 'SESSIONS'
                          ? `${treatment.sessions_used ?? 0}/${treatment.sessions_total ?? '?'} buổi`
                          : 'Không giới hạn buổi'}
                      </Typography.Text>
                      <Tag color={treatment.status === 'ACTIVE' ? 'green' : treatment.status === 'FINISHED' ? 'blue' : 'default'}>
                        {treatment.status === 'ACTIVE' ? 'Đang dùng' : treatment.status === 'FINISHED' ? 'Hoàn tất' : 'Đã hủy'}
                      </Tag>
                    </div>
                  ))}
                </Space>
              )}
            </Card>

            <Card size="small" title={<Space><CalendarOutlined />Lịch sử dịch vụ lẻ</Space>}>
              {historyLoading ? (
                <div style={{ padding: 16, textAlign: 'center' }}>Đang tải lịch sử dịch vụ…</div>
              ) : detailAppointments.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Khách chưa có lần làm dịch vụ lẻ" />
              ) : (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {detailAppointments.map((appointment) => (
                    <Card
                      key={appointment.id}
                      size="small"
                      title={`${displayDate(appointment.appt_date)} ${appointment.start_time?.slice(0, 5) || ''} · ${appointment.service?.title || 'Dịch vụ'}`}
                      extra={<Tag color={appointment.status === 'completed' ? 'green' : appointment.status === 'in_progress' ? 'blue' : 'default'}>{appointment.status === 'completed' ? 'Hoàn tất' : appointment.status === 'in_progress' ? 'Đang làm' : appointment.status || '—'}</Tag>}
                    >
                      <Descriptions column={1} size="small" labelStyle={{ width: 110, color: '#7E8581' }}>
                        <Descriptions.Item label="KTV">{appointment.staff?.zalo_name || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Giá dịch vụ">{Number(appointment.service_amount ?? appointment.service?.price ?? 0).toLocaleString('vi-VN')} ₫</Descriptions.Item>
                        {appointment.diary && <Descriptions.Item label="Nhật ký">{appointment.diary}</Descriptions.Item>}
                        {appointment.result && <Descriptions.Item label="Kết quả / dặn dò">{appointment.result}</Descriptions.Item>}
                      </Descriptions>
                    </Card>
                  ))}
                </Space>
              )}
            </Card>
          </Space>
        )
      })()}
    </Drawer>
  )
}

