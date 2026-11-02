import { Card, Descriptions, Empty, Image, Space, Table, Tag, Typography } from 'antd'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { PaymentLog } from '@/api/models/paymentLog'
import type { SessionPhoto } from '@/api/models/sessionPhoto'
import type { TreatmentSession } from '@/api/models/treatmentSession'
import { useBrandCurrency, useBrandDateTime } from '@/themeRuntime'
import useSessionStatusConfig from '@/hooks/useSessionStatusConfig'

interface Props {
  treatment: CustomerTreatment & { package_type?: { name?: string } | null }
  sessions: TreatmentSession[]
  payments: PaymentLog[]
  photos: SessionPhoto[]
  canReadPayments: boolean
}

const TREATMENT_STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Đang dùng', color: 'green' },
  FINISHED: { label: 'Hoàn tất', color: 'blue' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
}

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  UNPAID: { label: 'Chưa thanh toán', color: 'red' },
  PARTIAL: { label: 'Thanh toán một phần', color: 'orange' },
  PAID: { label: 'Đã thanh toán', color: 'green' },
}

const QUOTA_LABEL: Record<string, string> = {
  SESSIONS: 'Theo số buổi',
  VALUE: 'Theo định mức tiền',
  UNLIMITED: 'Trọn gói',
}

const PAYMENT_METHOD: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  POS: 'POS',
  OTHER: 'Khác',
}

function localizedLabel(value: unknown, labels: Record<string, string>) {
  const raw = String(value ?? '')
  return labels[raw] ?? labels[raw.toUpperCase()] ?? (raw || '—')
}

/** Ảnh có thể là URL tuyệt đối (MinIO) hoặc đường dẫn tương đối (/images, /files — đã được vite proxy). */
const mediaSource = (url?: string | null) => (!url ? undefined : url)

export default function CustomerTreatmentDetailCard({ treatment, sessions, payments, photos, canReadPayments }: Props) {
  const { format: money } = useBrandCurrency()
  const { formatDateTime } = useBrandDateTime()
  const sessionStatusConfig = useSessionStatusConfig()
  const title = (treatment.package_snapshot?.name as string | undefined) || treatment.package_type?.name || 'Gói dịch vụ'
  const treatmentStatus = TREATMENT_STATUS[String(treatment.status ?? '').toUpperCase()] ?? { label: treatment.status || '—', color: 'default' }
  const paymentStatus = PAYMENT_STATUS[String(treatment.payment_status ?? '').toUpperCase()] ?? { label: treatment.payment_status || '—', color: 'default' }
  const quota = treatment.quota_type === 'SESSIONS'
    ? Math.max(0, Number(treatment.sessions_total ?? 0) - Number(treatment.sessions_used ?? 0)) + ' buổi'
    : treatment.quota_type === 'VALUE'
      ? money(Number(treatment.value_total ?? 0) - Number(treatment.value_used ?? 0))
      : 'Không giới hạn'

  return (
    <Card size="small" title={title} extra={<Tag color={treatmentStatus.color}>{treatmentStatus.label}</Tag>}>
      <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
        <Descriptions.Item label="Loại hạn mức">{localizedLabel(treatment.quota_type, QUOTA_LABEL)}</Descriptions.Item>
        <Descriptions.Item label="Buổi">{treatment.sessions_used ?? 0}/{treatment.sessions_total ?? '∞'}</Descriptions.Item>
        <Descriptions.Item label="Còn lại">{quota}</Descriptions.Item>
        {canReadPayments && <Descriptions.Item label="Thanh toán">{money(treatment.paid_amount)}</Descriptions.Item>}
        <Descriptions.Item label="Công nợ">{money(treatment.debt_amount)}</Descriptions.Item>
        {canReadPayments && <Descriptions.Item label="Trạng thái thanh toán"><Tag color={paymentStatus.color}>{paymentStatus.label}</Tag></Descriptions.Item>}
      </Descriptions>

      <Typography.Title level={5} className="mt-[18px]">Lịch sử buổi</Typography.Title>
      {sessions.length ? <Table<TreatmentSession> rowKey="id" size="small" pagination={false} dataSource={sessions} columns={[
        { title: 'Buổi', dataIndex: 'session_no', width: 70 },
        { title: 'Ngày', dataIndex: 'scheduled_at', render: (value: string | null) => formatDateTime(value) },
        { title: 'Trạng thái', dataIndex: 'status', render: (value: string | null) => {
          const status = value ? sessionStatusConfig[value.toLowerCase() as keyof typeof sessionStatusConfig] : undefined
          return (
            <Tag
              color={status ? undefined : 'default'}
              style={status ? { color: status.color, backgroundColor: `${status.color}1A`, borderColor: `${status.color}55` } : undefined}
            >
              {status?.label ?? value ?? '—'}
            </Tag>
          )
        } },
        { title: 'Ghi chú', dataIndex: 'diary', ellipsis: true, render: (value: string | null) => value || '—' },
      ]} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có buổi điều trị" />}

      {canReadPayments && <>
        <Typography.Title level={5} className="mt-[18px]">Thanh toán</Typography.Title>
        {payments.length ? <Table<PaymentLog> rowKey="id" size="small" pagination={false} dataSource={payments} columns={[
          { title: 'Thời gian', dataIndex: 'paid_at', render: (value: string | null) => formatDateTime(value) },
          { title: 'Số tiền', dataIndex: 'amount', render: (value: number) => money(value) },
          { title: 'Phương thức', dataIndex: 'method', render: (value: string) => localizedLabel(value, PAYMENT_METHOD) },
          { title: 'Ghi chú', dataIndex: 'note', ellipsis: true, render: (value: string | null) => value || '—' },
        ]} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thanh toán" />}
      </>}

      <Typography.Title level={5} className="mt-[18px]">Ảnh buổi điều trị</Typography.Title>
      {photos.length ? (
        <Space wrap>
          {photos.map((photo) => photo.url
            ? <Image key={photo.id} width={110} height={110} style={{ objectFit: 'cover', borderRadius: 8 }} src={mediaSource(photo.url)} alt={photo.caption || 'Ảnh buổi điều trị'} />
            : <Tag key={photo.id}>{photo.caption || 'Ảnh buổi điều trị'} đã lưu</Tag>)}
        </Space>
      ) : <Typography.Text type="secondary">Chưa có ảnh buổi điều trị.</Typography.Text>}
    </Card>
  )
}
