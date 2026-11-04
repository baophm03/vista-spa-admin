import { Alert, Button, Form, Input, Modal, Select, Space, Upload } from 'antd'
import { FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import { snapshotField } from './constants'
import { useBrandDateTime } from '@/themeRuntime'

interface WarrantyClaimCreateModalProps {
  form: ReturnType<typeof import('antd').Form.useForm>[0]
  open: boolean
  treatmentsLoading: boolean
  eligibleTreatments: CustomerTreatment[]
  contractFileId: string | undefined
  uploading: boolean
  submitting: boolean
  onCancel: () => void
  onOk: () => void
  onUpload: (file: File) => void
  onRemoveFile: () => void
}

export default function WarrantyClaimCreateModal({
  form,
  open,
  treatmentsLoading,
  eligibleTreatments,
  contractFileId,
  uploading,
  submitting,
  onCancel,
  onOk,
  onUpload,
  onRemoveFile,
}: WarrantyClaimCreateModalProps) {
  const { formatDateTime } = useBrandDateTime()

  return (
    <Modal
      title="Tiếp nhận bảo hành"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Tiếp nhận"
      cancelText="Hủy"
      confirmLoading={submitting || uploading}
    >
      <Alert
        type="info" showIcon style={{ marginTop: 12 }}
        message="Chỉ tiếp nhận bảo hành cho liệu trình đã hoàn tất và có chính sách bảo hành."
      />
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="customer_treatment_id" label="Gói liệu trình của khách" rules={[{ required: true, message: 'Chọn gói liệu trình' }]}>
          <Select
            showSearch optionFilterProp="label" loading={treatmentsLoading}
            placeholder="Chỉ hiện gói đã hoàn tất"
            notFoundContent={treatmentsLoading ? 'Đang tải...' : 'Không có liệu trình nào đã hoàn tất và có bảo hành'}
            options={eligibleTreatments.map((t) => {
              const snap = snapshotField(t)
              const treatment = t as CustomerTreatment & { customer_profile?: { full_name?: string; phone?: string } }
              const pkg = snap.name
              const customerName = treatment.customer_profile?.full_name ?? 'Khách'
              const customer = treatment.customer_profile?.phone ? `${customerName} — ${treatment.customer_profile.phone}` : customerName
              return {
                value: t.id,
                label: `${customer} — ${pkg ?? 'Gói'}${t.finished_at ? ` — ${formatDateTime(t.finished_at).split(' ')[0]}` : ''}`,
              }
            })}
          />
        </Form.Item>
        <Form.Item
          name="reason" label="Lý do / lịch sử tái phát"
          rules={[{ required: true, message: 'Nhập lý do hoặc mô tả tình trạng tái phát' }]}
        >
          <Input.TextArea rows={4} maxLength={2000} placeholder="VD: Sau 2 tuần hết liệu trình, vùng điều trị bắt đầu tái phát..." />
        </Form.Item>
        <Form.Item name="contract_file_id" hidden><Input /></Form.Item>
        <Form.Item
          label="Giấy cam kết bảo hành đã ký (nếu có)"
          extra="Tải ảnh hoặc PDF giấy khách đã ký để lưu cùng yêu cầu. Không có giấy thì để trống."
        >
          <Space wrap>
            <Upload
              accept=".pdf,image/*"
              showUploadList={false}
              beforeUpload={(file) => { onUpload(file); return false }}
            >
              <Button icon={<UploadOutlined />} loading={uploading} disabled={uploading}>Tải giấy cam kết</Button>
            </Upload>
            {contractFileId && <a href={contractFileId} target="_blank" rel="noreferrer"><FileTextOutlined /> Xem tệp đã tải</a>}
            {contractFileId && <Button type="link" danger onClick={onRemoveFile}>Gỡ tệp</Button>}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
