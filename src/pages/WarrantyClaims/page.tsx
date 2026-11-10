import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Select, Space, Table, Tag, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import ListPagination from '@/components/base/ListPagination'
import { errorMessage, pickData } from '@/api/helpers'
import { Can } from '@casl/react'
import type { PutWarrantyClaimsIdRejectBody } from '@/api/models/putWarrantyClaimsIdRejectBody'
import {
  getGetWarrantyClaimsQueryKey,
  useGetTreatmentCustomers,
  useGetWarrantyClaims,
  usePostWarrantyClaims,
  usePutWarrantyClaimsIdReject,
} from '@/api/endpoints/treatment-customers'
import { STATUS_META } from './components/constants'
import { usePostFiles } from '@/api/endpoints/files'
import { registerUploadedFile } from '@/hooks/useFileUrl'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { useBrandDateTime } from '@/themeRuntime'
import WarrantyClaimCreateModal from './components/WarrantyClaimCreateModal'
import WarrantyClaimDetailDrawer from './components/WarrantyClaimDetailDrawer'
import WarrantyClaimRejectModal from './components/WarrantyClaimRejectModal'
import { STATUS_FILTER_OPTIONS, snapshotField, type ClaimRow } from './components/constants'

export default function WarrantyClaims() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const navigate = useNavigate()
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
  const finishedTreatmentsQuery = useGetTreatmentCustomers(
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
      const uploaded = pickData<{ id?: string; path?: string }>(await uploadMutation.mutateAsync({ data: { file } as never }))
      if (!uploaded?.id) throw new Error('Máy chủ không trả về file')
      registerUploadedFile(uploaded.id, uploaded.path)
      createForm.setFieldValue('contract_file_id', uploaded.id)
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
    {
      title: 'Thao tác', align: 'center' as const, key: 'actions', width: 170,
      render: (_v, row) => (
        <Space size={6}>
          <Button size="small" onClick={() => setDetailId(row.id)}>Chi tiết</Button>
          <Button
            size="small"
            onClick={() => navigate(`/treatment-customers?treatment_id=${encodeURIComponent(row.customer_treatment_id)}`)}
          >
            Mở gói
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageTitle
        subtitle="Tiếp nhận và xử lý yêu cầu bảo hành"
        left={
          <>
            <Select
              allowClear value={statusFilter} placeholder="Trạng thái" className="w-[160px]"
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
              options={STATUS_FILTER_OPTIONS}
            />
          </>
        }
        right={
          <Can I="UPDATE" a="CUSTOMER">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true) }}>
              Tiếp nhận bảo hành
            </Button>
          </Can>
        }
      >
        Bảo hành gói liệu trình
      </PageTitle>
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

      <WarrantyClaimDetailDrawer
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

      <WarrantyClaimCreateModal
        form={createForm}
        open={createOpen}
        treatmentsLoading={finishedTreatmentsQuery.isLoading}
        eligibleTreatments={eligibleTreatments}
        contractFileId={contractFileId}
        uploading={uploadingContract}
        submitting={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={() => { if (!uploadingContract) void submitCreate() }}
        onUpload={(file) => void uploadContract(file)}
        onRemoveFile={() => createForm.setFieldValue('contract_file_id', undefined)}
      />

      <WarrantyClaimRejectModal
        form={rejectForm}
        target={rejectTarget}
        submitting={rejectMutation.isPending}
        onCancel={() => setRejectTarget(null)}
        onOk={() => void submitReject()}
      />
    </>
  )
}

