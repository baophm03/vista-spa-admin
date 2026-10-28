import { useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage } from '@/api/helpers'
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
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useGetTreatmentPackages } from '@/api/endpoints/services'

type ClaimRow = WarrantyClaim

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
  const snap = row?.package_snapshot as { has_warranty?: unknown; name?: unknown } | undefined
  return {
    hasWarranty: typeof snap?.has_warranty === 'boolean' ? snap.has_warranty : undefined,
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

  // Danh sách claims — phân trang server-side (page/limit/status)
  const claimsQuery = useGetWarrantyClaims({ page, limit: 10, ...(statusFilter ? { status: statusFilter } : {}) })
  const rows = claimsQuery.data?.responseData ?? []
  const total = claimsQuery.data?.meta?.total ?? rows.length

  // Lookup: khách hàng + gói liệu trình để hiển thị tên (claim chỉ trả customer_treatment_id)
  const profilesQuery = useGetCustomerProfiles({ page: 1, limit: 200 })
  const profiles = profilesQuery.data?.responseData ?? []
  const treatmentsQuery = useGetCustomerTreatments({ page: 1, limit: 200 })
  const treatments = treatmentsQuery.data?.responseData ?? []
  const packagesQuery = useGetTreatmentPackages({ page: 1, limit: 200 })
  const packages = packagesQuery.data?.responseData ?? []

  // Gói FINISHED (dùng trong form tiếp nhận — chỉ gói hoàn tất mới được bảo hành)
  const finishedTreatmentsQuery = useGetCustomerTreatments(
    { page: 1, limit: 200, status: 'FINISHED' },
    { query: { enabled: createOpen } },
  )
  const finishedTreatments = finishedTreatmentsQuery.data?.responseData ?? []

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetWarrantyClaimsQueryKey() })
  }

  const treatmentOf = (id: string) => treatments.find((t) => t.id === id)
  const profileOf = (id?: string) => profiles.find((p) => p.id === id)
  const customerLabel = (claim: ClaimRow) => {
    const treatment = treatmentOf(claim.customer_treatment_id)
    const profile = profileOf(treatment?.customer_profile_id)
    if (!profile) return claim.customer_treatment_id
    return profile.phone ? `${profile.full_name ?? 'Khách hàng'} — ${profile.phone}` : profile.full_name ?? 'Khách hàng'
  }
  const packageLabel = (claim: ClaimRow) => {
    const treatment = treatmentOf(claim.customer_treatment_id)
    const snap = snapshotField(treatment)
    return snap.name ?? packages.find((p) => p.id === treatment?.package_id)?.name ?? treatment?.package_id ?? '—'
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
    { title: 'Gói liệu trình', key: 'package', render: (_v, row) => packageLabel(row) },
    { title: 'Lý do bảo hành', dataIndex: 'reason', ellipsis: true },
    { title: 'Ngày tạo', dataIndex: 'created_at', width: 150, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—') },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: (v?: string) => <Tag color={STATUS_META[v ?? '']?.color}>{STATUS_META[v ?? '']?.label ?? v ?? '—'}</Tag>,
    },
    { title: 'Thao tác', key: 'actions', width: 110, render: (_v, row) => <Button size="small" onClick={() => setDetailId(row.id)}>Chi tiết</Button> },
  ]

  return (
    <>
      <PageTitle>Bảo hành gói liệu trình</PageTitle>
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
        pagination={{ current: page, pageSize: 10, total, showTotal: (c) => `${c} yêu cầu` }}
        onChange={(p) => { if (p.current) setPage(p.current) }}
      />

      <ClaimDetailDrawer
        claimId={detailId}
        fallback={rows.find((r) => r.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
        customerLabel={customerLabel}
        packageLabel={packageLabel}
        onChanged={invalidate}
        onReject={(claim) => { setRejectTarget(claim); rejectForm.resetFields() }}
        rejecting={rejectMutation.isPending}
      />

      <Modal
        title="Tiếp nhận bảo hành"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void submitCreate()}
        okText="Tiếp nhận"
        cancelText="Hủy"
      >
        <Alert
          type="info" showIcon style={{ marginTop: 12 }}
          message="Chỉ gói đã hoàn tất (FINISHED) thuộc loại gói có bảo hành (has_warranty) mới đủ điều kiện. Hệ thống sẽ từ chối nếu gói không hợp lệ."
        />
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer_treatment_id" label="Gói liệu trình của khách" rules={[{ required: true, message: 'Chọn gói liệu trình' }]}>
            <Select
              showSearch optionFilterProp="label" loading={finishedTreatmentsQuery.isLoading}
              placeholder="Chỉ hiện gói đã hoàn tất"
              notFoundContent={finishedTreatmentsQuery.isLoading ? 'Đang tải...' : 'Không có gói hoàn tất nào'}
              options={finishedTreatments.map((t) => {
                const snap = snapshotField(t)
                const profile = profileOf(t.customer_profile_id)
                const pkg = packages.find((p) => p.id === t.package_id)?.name ?? snap.name
                const warrantyNote = snap.hasWarranty === false ? ' (gói không có bảo hành)' : ''
                return {
                  value: t.id,
                  label: `${profile?.full_name ?? t.customer_profile_id} — ${pkg ?? 'Gói'}${warrantyNote}`,
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
            <Input.TextArea rows={3} maxLength={1000} placeholder="VD: Gói không thuộc loại có bảo hành / quá thời hạn bảo hành" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

/** Drawer chi tiết claim; khi PENDING hiện nút Duyệt (Popconfirm) / Từ chối (Modal reason ở trang). */
function ClaimDetailDrawer(props: {
  claimId: string | null
  fallback: ClaimRow | null
  onClose: () => void
  customerLabel: (c: ClaimRow) => string
  packageLabel: (c: ClaimRow) => string
  onChanged: () => Promise<void> | void
  onReject: (claim: ClaimRow) => void
  rejecting: boolean
}) {
  const { claimId, fallback, onClose } = props
  const approveMutation = usePutWarrantyClaimsIdApprove({ mutation: { onSuccess: props.onChanged } })

  const detailQuery = useGetWarrantyClaimsId(claimId ?? '', { query: { enabled: !!claimId } })
  const claim = detailQuery.data?.responseData ?? fallback

  const doApprove = async () => {
    if (!claim) return
    try {
      await approveMutation.mutateAsync({ id: claim.id, data: {} })
      message.success('Đã duyệt bảo hành — hệ thống sẽ tạo buổi bảo hành cho khách')
      await props.onChanged()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  return (
    <Drawer title="Chi tiết yêu cầu bảo hành" open={!!claimId} onClose={onClose} width={480}>
      {!claim ? (
        <Typography.Text type="secondary">Đang tải...</Typography.Text>
      ) : (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Khách hàng">{props.customerLabel(claim)}</Descriptions.Item>
            <Descriptions.Item label="Gói liệu trình">{props.packageLabel(claim)}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={STATUS_META[claim.status ?? '']?.color}>{STATUS_META[claim.status ?? '']?.label ?? claim.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Lý do bảo hành">{claim.reason || '—'}</Descriptions.Item>
            {claim.reject_reason ? <Descriptions.Item label="Lý do từ chối">{claim.reject_reason}</Descriptions.Item> : null}
            {claim.session_id ? <Descriptions.Item label="Buổi bảo hành">{claim.session_id}</Descriptions.Item> : null}
            {claim.approved_by ? <Descriptions.Item label="Người duyệt">{claim.approved_by}</Descriptions.Item> : null}
            <Descriptions.Item label="Ngày tạo">{claim.created_at ? dayjs(claim.created_at).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Cập nhật">{claim.updated_at ? dayjs(claim.updated_at).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
          </Descriptions>
          {claim.status === 'PENDING' && (
            <Can I="UPDATE" a="CUSTOMER">
              <Space style={{ marginTop: 16 }}>
                <Popconfirm
                  title="Duyệt bảo hành?"
                  description="Hệ thống sẽ tạo buổi bảo hành (is_warranty) cho khách."
                  onConfirm={() => void doApprove()}
                >
                  <Button type="primary" loading={approveMutation.isPending}>Duyệt</Button>
                </Popconfirm>
                <Button danger loading={props.rejecting} onClick={() => props.onReject(claim)}>Từ chối</Button>
              </Space>
            </Can>
          )}
        </>
      )}
    </Drawer>
  )
}
