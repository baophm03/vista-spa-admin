import { useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { FileTextOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import ListPagination from '@/components/base/ListPagination'
import { errorMessage, pickData } from '@/api/helpers'
import { Can } from '@casl/react'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { WarrantyClaim } from '@/api/models/warrantyClaim'
import type { PutWarrantyClaimsIdRejectBody } from '@/api/models/putWarrantyClaimsIdRejectBody'
import {
  getGetWarrantyClaimsQueryKey,
  useGetCustomerTreatments,
  useGetWarrantyClaims,
  useGetWarrantyClaimsId,
  usePostWarrantyClaims,
  usePutWarrantyClaimsIdApprove,
  usePutWarrantyClaimsIdReject,
} from '@/api/endpoints/customer-treatments'
import { usePostFiles } from '@/api/endpoints/files'
import CustomFieldFormItems, { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { useBrandDateTime } from '@/themeRuntime'

type ClaimRow = Omit<WarrantyClaim, 'customer_treatment' | 'session'> & {
  contract_file_id?: string | null
  customer_treatment?: {
    id: string
    branch_id?: string
    customer_profile_id?: string
    package_id?: string
    package_snapshot?: Record<string, unknown>
    finished_at?: string | null
    customer_profile?: { id?: string; customer_code?: string; full_name?: string; phone?: string }
    package?: { id?: string; name?: string }
    package_type?: { has_warranty?: boolean }
  }
  session?: { id?: string; status?: string; scheduled_at?: string | null; product_amount?: number }
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ duyệt', color: 'orange' },
  APPROVED: { label: 'Đã duyệt', color: 'green' },
  REJECTED: { label: 'Đã từ chối', color: 'red' },
}

const STATUS_FILTER_OPTIONS = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
]

/** package_snapshot là object tự do — đọc has_warranty/name nếu BE trả kèm. */
function snapshotField(row: CustomerTreatment | undefined): { hasWarranty?: boolean; name?: string } {
  const snap = row?.package_snapshot as {
    has_warranty?: unknown
    name?: unknown
    package_type?: { has_warranty?: unknown }
  } | undefined
  const hasWarranty = typeof snap?.package_type?.has_warranty === 'boolean'
    ? snap.package_type.has_warranty
    : snap?.has_warranty
  return {
    hasWarranty: typeof hasWarranty === 'boolean' ? hasWarranty : undefined,
    name: typeof snap?.name === 'string' ? snap.name : undefined,
  }
}

export default function WarrantyClaims() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<ClaimRow | null>(null)
  const [createForm] = Form.useForm()
  const [rejectForm] = Form.useForm()
  const queryClient = useQueryClient()
  const { isAdmin } = useCustomerProfileAccess()
  const { formatDateTime } = useBrandDateTime()
  const uploadMutation = usePostFiles()
  const [uploadingContract, setUploadingContract] = useState(false)

  // Danh sách claims — phân trang server-side (page/limit/status)
  const claimsQuery = useGetWarrantyClaims({ page, limit: 10, ...(statusFilter ? { status: statusFilter } : {}) })
  const rows = (claimsQuery.data?.responseData ?? []) as ClaimRow[]
  const total = claimsQuery.data?.meta?.total ?? rows.length

  // Lookup: khách hàng + gói liệu trình để hiển thị tên (claim chỉ trả customer_treatment_id)
  // Gói FINISHED (dùng trong form tiếp nhận — chỉ gói hoàn tất mới được bảo hành)
  const finishedTreatmentsQuery = useGetCustomerTreatments(
    { page: 1, limit: 200, status: 'FINISHED' },
    { query: { enabled: createOpen } },
  )
  const finishedTreatments = finishedTreatmentsQuery.data?.responseData ?? []
  const eligibleTreatments = finishedTreatments.filter((t) => snapshotField(t).hasWarranty === true)
  const contractFileId = Form.useWatch('contract_file_id', createForm) as string | undefined

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetWarrantyClaimsQueryKey() })
  }

  const customerLabel = (claim: ClaimRow) => {
    const profile = claim.customer_treatment?.customer_profile
    if (!profile) return claim.customer_treatment_id
    const name = profile.full_name ?? 'Khách hàng'
    return profile.phone ? `${name} — ${profile.phone}` : name
  }
  const packageLabel = (claim: ClaimRow) => {
    const treatment = claim.customer_treatment
    const snapshotName = treatment?.package_snapshot?.name
    return treatment?.package?.name ?? (typeof snapshotName === 'string' ? snapshotName : undefined) ?? treatment?.package_id ?? '—'
  }

  const uploadContract = async (file: File) => {
    setUploadingContract(true)
    try {
      const uploaded = pickData<{ original?: string }>(await uploadMutation.mutateAsync({ data: { file } as never }))
      if (!uploaded?.original) throw new Error('Máy chủ không trả về đường dẫn tệp')
      createForm.setFieldValue('contract_file_id', uploaded.original)
      message.success('Đã tải hợp đồng lên')
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setUploadingContract(false)
    }
  }

  const rejectMutation = usePutWarrantyClaimsIdReject()
  const createMutation = usePostWarrantyClaims()

  const submitReject = async () => {
    if (!rejectTarget) return
    try {
      const values = await rejectForm.validateFields()
      await rejectMutation.mutateAsync({ id: rejectTarget.id, data: { reason: values.reason } as PutWarrantyClaimsIdRejectBody })
      message.success('Đã từ chối yêu cầu bảo hành')
      setRejectTarget(null)
      setDetailId(null)
      await invalidate()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const submitCreate = async () => {
    try {
      const values = await createForm.validateFields()
      await createMutation.mutateAsync({
        data: {
          customer_treatment_id: values.customer_treatment_id,
          reason: values.reason,
          contract_file_id: values.contract_file_id || undefined,
        },
      })
      message.success('Đã tiếp nhận yêu cầu bảo hành')
      setCreateOpen(false)
      createForm.resetFields()
      await invalidate()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const columns: TableColumnsType<ClaimRow> = [
    { title: 'Khách hàng', key: 'customer', render: (_v, row) => customerLabel(row) },
    {
      title: 'Mã liệu trình', key: 'treatmentCode', width: 150,
      render: (_v, row) => row.customer_treatment?.id?.slice(0, 8).toUpperCase() ?? row.customer_treatment_id.slice(0, 8).toUpperCase(),
    },
    { title: 'Gói liệu trình', key: 'package', render: (_v, row) => packageLabel(row) },
    {
      title: 'Ngày hoàn tất', key: 'finishedAt', width: 150,
      render: (_v, row) => row.customer_treatment?.finished_at ? formatDateTime(row.customer_treatment.finished_at).split(' ')[0] : '—',
    },
    { title: 'Lý do bảo hành', dataIndex: 'reason', ellipsis: true },
    { title: 'Ngày tạo', dataIndex: 'created_at', width: 150, render: (v: string) => (v ? formatDateTime(v) : '—') },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: (v?: string) => <Tag color={STATUS_META[v ?? '']?.color}>{STATUS_META[v ?? '']?.label ?? v ?? '—'}</Tag>,
    },
    { title: 'Thao tác', align: 'center' as const, key: 'actions', width: 110, render: (_v, row) => <Button size="small" onClick={() => setDetailId(row.id)}>Chi tiết</Button> },
  ]

  return (
    <>
      <PageTitle subtitle="Tiếp nhận và xử lý yêu cầu bảo hành">Bảo hành gói liệu trình</PageTitle>
      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Select
          allowClear value={statusFilter} placeholder="Trạng thái" style={{ width: 160 }}
          onChange={(v) => { setStatusFilter(v); setPage(1) }}
          options={STATUS_FILTER_OPTIONS}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void claimsQuery.refetch()}>Tải lại</Button>
        <Can I="UPDATE" a="CUSTOMER">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true) }}>
            Tiếp nhận bảo hành
          </Button>
        </Can>
      </Space>
      {claimsQuery.isError && (
        <Alert
          className="mb-4" type="error" showIcon message="Không tải được danh sách bảo hành"
          description={errorMessage(claimsQuery.error)}
          action={<Button size="small" onClick={() => void claimsQuery.refetch()}>Thử lại</Button>}
        />
      )}
      <Table<ClaimRow>
        rowKey="id" loading={claimsQuery.isLoading} dataSource={rows} columns={columns}
        pagination={false}
      />
      <ListPagination page={page} limit={10} total={total} onChange={setPage} noun="yêu cầu bảo hành" />

      <ClaimDetailDrawer
        claimId={detailId}
        fallback={rows.find((r) => r.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
        customerLabel={customerLabel}
        packageLabel={packageLabel}
        isAdmin={isAdmin}
        onChanged={invalidate}
        onReject={(claim) => { setRejectTarget(claim); rejectForm.resetFields() }}
        rejecting={rejectMutation.isPending}
      />

      <Modal
        title="Tiếp nhận bảo hành"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => { if (!uploadingContract) void submitCreate() }}
        okText="Tiếp nhận"
        cancelText="Hủy"
        confirmLoading={createMutation.isPending || uploadingContract}
      >
        <Alert
          type="info" showIcon style={{ marginTop: 12 }}
          message="Chỉ tiếp nhận bảo hành cho liệu trình đã hoàn tất và có chính sách bảo hành."
        />
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer_treatment_id" label="Gói liệu trình của khách" rules={[{ required: true, message: 'Chọn gói liệu trình' }]}>
            <Select
              showSearch optionFilterProp="label" loading={finishedTreatmentsQuery.isLoading}
              placeholder="Chỉ hiện gói đã hoàn tất"
              notFoundContent={finishedTreatmentsQuery.isLoading ? 'Đang tải...' : 'Không có liệu trình nào đã hoàn tất và có bảo hành'}
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
                beforeUpload={(file) => { void uploadContract(file); return false }}
              >
                <Button icon={<UploadOutlined />} loading={uploadingContract} disabled={uploadingContract}>Tải giấy cam kết</Button>
              </Upload>
              {contractFileId && <a href={contractFileId} target="_blank" rel="noreferrer"><FileTextOutlined /> Xem tệp đã tải</a>}
              {contractFileId && <Button type="link" danger onClick={() => createForm.setFieldValue('contract_file_id', undefined)}>Gỡ tệp</Button>}
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Từ chối bảo hành"
        open={!!rejectTarget}
        onCancel={() => setRejectTarget(null)}
        onOk={() => void submitReject()}
        okText="Từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
        confirmLoading={rejectMutation.isPending}
      >
        <Form form={rejectForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="reason" label="Lý do từ chối" rules={[{ required: true, message: 'Bắt buộc nhập lý do từ chối' }]}>
            <Input.TextArea rows={3} maxLength={1000} placeholder="Nhập lý do từ chối cụ thể" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

/** Drawer chi tiết claim; ADM có thể duyệt hoặc từ chối yêu cầu đang chờ xử lý. */
function ClaimDetailDrawer(props: {
  claimId: string | null
  fallback: ClaimRow | null
  onClose: () => void
  customerLabel: (c: ClaimRow) => string
  packageLabel: (c: ClaimRow) => string
  isAdmin: boolean
  onChanged: () => Promise<void> | void
  onReject: (claim: ClaimRow) => void
  rejecting: boolean
}) {
  const { claimId, fallback, onClose } = props
  const { formatDateTime } = useBrandDateTime()
  const approveMutation = usePutWarrantyClaimsIdApprove()
  const [approveForm] = Form.useForm()
  const [approveOpen, setApproveOpen] = useState(false)
  const sessionCustomFields = useCustomFieldDefinitions('SESSION')

  const detailQuery = useGetWarrantyClaimsId(claimId ?? '', { query: { enabled: !!claimId } })
  const claim = (detailQuery.data?.responseData as ClaimRow | undefined) ?? fallback

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

  return (
    <Drawer
      title="Chi tiết yêu cầu bảo hành" open={!!claimId} onClose={onClose} width={480}
      styles={{ body: { display: 'flex', flexDirection: 'column' } }}
    >
      {!claim ? (
        <Typography.Text type="secondary">Đang tải...</Typography.Text>
      ) : (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Khách hàng">{props.customerLabel(claim)}</Descriptions.Item>
            <Descriptions.Item label="Gói liệu trình">{props.packageLabel(claim)}</Descriptions.Item>
            {claim.customer_treatment?.finished_at ? <Descriptions.Item label="Ngày hoàn tất liệu trình">{formatDateTime(claim.customer_treatment.finished_at)}</Descriptions.Item> : null}
            <Descriptions.Item label="Trạng thái">
              <Tag color={STATUS_META[claim.status ?? '']?.color}>{STATUS_META[claim.status ?? '']?.label ?? claim.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Lý do bảo hành">{claim.reason || '—'}</Descriptions.Item>
            {claim.contract_file_id ? <Descriptions.Item label="Hợp đồng cam kết"><a href={claim.contract_file_id} target="_blank" rel="noreferrer"><FileTextOutlined /> Xem hợp đồng</a></Descriptions.Item> : null}
            <Descriptions.Item label="Ngày tạo">{claim.created_at ? formatDateTime(claim.created_at) : '—'}</Descriptions.Item>
            <Descriptions.Item label="Cập nhật">{claim.updated_at ? formatDateTime(claim.updated_at) : '—'}</Descriptions.Item>
          </Descriptions>
          {claim.status === 'PENDING' && (
            <Alert
              type="info" showIcon style={{ marginTop: 16 }}
              message="Đang chờ Admin duyệt"
              description="Khi được duyệt, hệ thống tự tạo một buổi điều trị bảo hành miễn phí — không trừ số buổi và không tính công kỹ thuật của gói. Bảo hành có hiệu lực trọn đời kể từ ngày hoàn tất liệu trình."
            />
          )}
          {claim.status === 'APPROVED' && claim.session_id && (
            <Alert
              type="success" showIcon style={{ marginTop: 16 }}
              message="Đã duyệt — buổi bảo hành miễn phí đã được tạo"
              description={`Buổi điều trị: ${claim.session?.status ?? 'đã tạo'} · Không trừ số buổi của gói · Tiền sản phẩm phát sinh hiện tại: ${Number(claim.session?.product_amount ?? 0).toLocaleString('vi-VN')}đ`}
            />
          )}
          {claim.status === 'REJECTED' && claim.reject_reason && (
            <Alert type="warning" showIcon style={{ marginTop: 16 }} message="Yêu cầu đã bị từ chối" description={claim.reject_reason} />
          )}
          {claim.status === 'PENDING' && (
            <Can I="UPDATE" a="CUSTOMER">
              <Space style={{ marginTop: 'auto', paddingTop: 16 }}>
                {props.isAdmin && <Button type="primary" loading={approveMutation.isPending} onClick={() => { approveForm.resetFields(); setApproveOpen(true) }}>Duyệt</Button>}
                {props.isAdmin && <Button danger loading={props.rejecting} onClick={() => props.onReject(claim)}>Từ chối</Button>}
              </Space>
            </Can>
          )}
          <Modal
            title="Duyệt yêu cầu bảo hành"
            open={approveOpen}
            onCancel={() => setApproveOpen(false)}
            onOk={() => void doApprove()}
            okText="Duyệt và tạo buổi"
            cancelText="Hủy"
            confirmLoading={approveMutation.isPending}
          >
            <Alert type="info" showIcon message="Buổi bảo hành không trừ quota và không tính tiền công kỹ thuật. Có thể ghi số tiền sản phẩm phát sinh sau khi tạo buổi." style={{ marginBottom: 16 }} />
            <Form form={approveForm} layout="vertical">
              <CustomFieldFormItems definitions={sessionCustomFields} />
            </Form>
          </Modal>
        </>
      )}
    </Drawer>
  )
}
