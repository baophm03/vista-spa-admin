import { useState } from 'react'
import { Alert, Button, Descriptions, Form, Modal, Skeleton, Tag, message } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import InfoBanner from '@/components/base/InfoBanner'
import { errorMessage } from '@/api/helpers'
import { Can } from '@casl/react'
import { useGetWarrantyClaimsIdAdmin, usePutWarrantyClaimsIdApproveAdmin } from '@/api/endpoints/warranty-claims'
import CustomFieldFormItems, { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { fileSrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import { useBrandDateTime } from '@/themeRuntime'
import { STATUS_META, type ClaimRow } from './constants'

interface WarrantyClaimDetailModalProps {
  claimId: string | null
  fallback: ClaimRow | null
  onClose: () => void
  customerLabel: (c: ClaimRow) => string
  packageLabel: (c: ClaimRow) => string
  isAdmin: boolean
  onChanged: () => Promise<void> | void
  onReject: (claim: ClaimRow) => void
  rejecting: boolean
}

export default function WarrantyClaimDetailModal(props: WarrantyClaimDetailModalProps) {
  const { claimId, fallback, onClose } = props
  const { formatDateTime } = useBrandDateTime()
  const urlMap = useFileUrlMap()
  const approveMutation = usePutWarrantyClaimsIdApproveAdmin()
  const [approveForm] = Form.useForm()
  const [approveOpen, setApproveOpen] = useState(false)
  const sessionCustomFields = useCustomFieldDefinitions('SESSION')

  const detailQuery = useGetWarrantyClaimsIdAdmin(claimId ?? '', { query: { enabled: !!claimId } })
  const claim = (detailQuery.data?.responseData as ClaimRow | undefined) ?? fallback
  const contractSrc = fileSrc((claim as any)?.contract_file) ?? resolveFileSrc(urlMap, claim?.contract_file_id)

  const doApprove = async () => {
    if (!claim) return
    try {
      const values = await approveForm.validateFields()
      const customFields = normalizeCustomFieldValues(sessionCustomFields, values.custom_fields ?? {})
      await approveMutation.mutateAsync({ id: claim.id, data: { session_custom_fields: customFields ?? {} } })
      message.success('Đã duyệt bảo hành — hệ thống sẽ tạo buổi bảo hành cho khách')
      setApproveOpen(false)
      approveForm.resetFields()
      await props.onChanged()
      await detailQuery.refetch()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const title = 'Chi tiết yêu cầu bảo hành'
  const closeDetail = () => { setApproveOpen(false); onClose() }
  const actions = claim?.status === 'PENDING' && props.isAdmin && (
    <Can I="UPDATE" a="WARRANTY_CLAIM">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="primary" loading={approveMutation.isPending} onClick={() => { approveForm.resetFields(); setApproveOpen(true) }}>Duyệt</Button>
        <Button danger loading={props.rejecting} onClick={() => props.onReject(claim)}>Từ chối</Button>
      </div>
    </Can>
  )

  const content = (
    <>
      {!claim ? (
        detailQuery.isError
          ? <Alert type="error" title="Không tải được chi tiết bảo hành" description={
              <Button size="small" onClick={() => void detailQuery.refetch()}>Thử lại</Button>
            } />
          : <Skeleton active paragraph={{ rows: 5 }} />
      ) : (
        <>
          <Descriptions column={1} size="small" bordered className="warranty-detail-fields wrap-anywhere">
            <Descriptions.Item label="Khách hàng">{props.customerLabel(claim)}</Descriptions.Item>
            <Descriptions.Item label="Gói liệu trình">{props.packageLabel(claim)}</Descriptions.Item>
            {claim.customer_treatment?.finished_at ? <Descriptions.Item label="Ngày hoàn tất liệu trình">{formatDateTime(claim.customer_treatment.finished_at)}</Descriptions.Item> : null}
            <Descriptions.Item label="Trạng thái">
              <Tag color={STATUS_META[claim.status ?? '']?.color}>{STATUS_META[claim.status ?? '']?.label ?? claim.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Lý do bảo hành">{claim.reason || '—'}</Descriptions.Item>
            {contractSrc ? (
              <Descriptions.Item label="Hợp đồng cam kết">
                <a className="inline-flex min-h-8 items-center gap-1" href={contractSrc} target="_blank" rel="noreferrer">
                  <FileTextOutlined /> Xem hợp đồng
                </a>
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="Ngày tạo">{claim.created_at ? formatDateTime(claim.created_at) : '—'}</Descriptions.Item>
            <Descriptions.Item label="Cập nhật">{claim.updated_at ? formatDateTime(claim.updated_at) : '—'}</Descriptions.Item>
          </Descriptions>
          {claim.status === 'PENDING' && (
            <InfoBanner
              className="warranty-detail-notice"
              title="Đang chờ Admin duyệt"
              description="Duyệt sẽ tạo buổi bảo hành miễn phí, không trừ số buổi hoặc tính công kỹ thuật. Bảo hành trọn đời tính từ ngày hoàn tất liệu trình."
            />
          )}
          {claim.status === 'APPROVED' && claim.session_id && (
            <Alert
              type="success" showIcon className="warranty-detail-notice"
              message="Đã duyệt — buổi bảo hành miễn phí đã được tạo"
              description={`Buổi điều trị: ${claim.session?.status ?? 'đã tạo'} · Không trừ số buổi của gói · Tiền sản phẩm phát sinh hiện tại: ${Number(claim.session?.product_amount ?? 0).toLocaleString('vi-VN')}đ`}
            />
          )}
          {claim.status === 'REJECTED' && claim.reject_reason && (
            <Alert type="warning" showIcon className="warranty-detail-notice" message="Yêu cầu đã bị từ chối" description={claim.reject_reason} />
          )}
        </>
      )}
    </>
  )

  return (
    <>
      <Modal title={title} open={!!claimId} onCancel={closeDetail} width="min(560px, calc(100vw - 24px))"
        footer={actions || null}>
        {content}
      </Modal>
      {claim && (
          <Modal
            title="Duyệt yêu cầu bảo hành"
            width="min(520px, calc(100vw - 24px))"
            open={approveOpen}
            onCancel={() => setApproveOpen(false)}
            onOk={() => void doApprove()}
            okText="Duyệt và tạo buổi"
            cancelText="Hủy"
            confirmLoading={approveMutation.isPending}
          >
            <Alert type="info" showIcon message="Buổi bảo hành không trừ quota và không tính tiền công kỹ thuật. Có thể ghi số tiền sản phẩm phát sinh sau khi tạo buổi." style={{ marginBottom: 16 }} />
            <Form form={approveForm} layout="vertical" className="warranty-claim-form">
              <CustomFieldFormItems definitions={sessionCustomFields} />
            </Form>
          </Modal>
      )}
    </>
  )
}
