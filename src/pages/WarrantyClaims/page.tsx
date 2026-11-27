import { useState, useMemo } from 'react'
import { PlusOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { Alert, Button, Form, Select, Table, Tag, message } from 'antd'
import { displayName } from '@/utils/displayName'
import type { TableColumnsType } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import { errorMessage, pickData } from '@/api/helpers'
import { Can } from '@casl/react'
import type { PutWarrantyClaimsIdRejectAdminBody } from '@/api/models/putWarrantyClaimsIdRejectAdminBody'
import { getGetWarrantyClaimsAdminQueryKey, useGetWarrantyClaimsAdmin, usePostWarrantyClaimsAdmin, usePutWarrantyClaimsIdRejectAdmin } from '@/api/endpoints/warranty-claims'
import { useGetTreatmentCustomersAdmin } from '@/api/endpoints/treatment-customers'
import { STATUS_META } from './components/constants'
import { usePostFilesAdmin } from '@/api/endpoints/files'
import { registerUploadedFile } from '@/hooks/useFileUrl'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { useBrandDateTime } from '@/themeRuntime'
import WarrantyClaimCreateModal from './components/WarrantyClaimCreateModal'
import WarrantyClaimDetailModal from './components/WarrantyClaimDetailModal'
import WarrantyClaimRejectModal from './components/WarrantyClaimRejectModal'
import { STATUS_FILTER_OPTIONS, snapshotField, type ClaimRow } from './components/constants'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import type {Branch} from '@/api/models'
import './warranty-claims.css'

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
  const uploadMutation = usePostFilesAdmin()
  const [uploadingContract, setUploadingContract] = useState(false)
  const branchesQuery = useGetBranchesAdmin()
  const branches = useMemo(() => pickData<Branch[]>(branchesQuery.data) ?? [], [branchesQuery.data])

  // Danh sách claims — phân trang server-side (page/limit/status)
  const claimsQuery = useGetWarrantyClaimsAdmin({ page, limit: 10, ...(statusFilter ? { status: statusFilter } : {}) })
  const rows = (claimsQuery.data?.responseData ?? []) as ClaimRow[]
  const total = claimsQuery.data?.meta?.total ?? rows.length

  // Lookup: khách hàng + gói liệu trình để hiển thị tên (claim chỉ trả customer_treatment_id)
  // Gói FINISHED (dùng trong form tiếp nhận — chỉ gói hoàn tất mới được bảo hành)
  const finishedTreatmentsQuery = useGetTreatmentCustomersAdmin(
    { page: 1, limit: 200, status: 'FINISHED' },
    { query: { enabled: createOpen } },
  )
  const finishedTreatments = finishedTreatmentsQuery.data?.responseData ?? []
  const eligibleTreatments = finishedTreatments.filter((t) => snapshotField(t).hasWarranty === true)
  const contractFileId = Form.useWatch('contract_file_id', createForm) as string | undefined

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetWarrantyClaimsAdminQueryKey() })
  }

  const customerLabel = (claim: ClaimRow) => {
    const profile = claim.customer_treatment?.user
    if (!profile) return claim.customer_treatment_id ?? '—'
    const name = displayName(profile, 'Khách hàng')
    return profile.phone ? `${name} — ${profile.phone}` : name
  }
  const packageLabel = (claim: ClaimRow) => {
    const treatment = claim.customer_treatment
    const snapshotName = treatment?.package_snapshot?.name
    return treatment?.package?.name ?? (typeof snapshotName === 'string' ? snapshotName : undefined) ?? treatment?.package_id ?? '—'
  }
  const branchLabel = (claim: ClaimRow) => branches.find((branch) => branch.id === claim.customer_treatment?.branch_id)?.name ?? '—'
  const treatmentCode = (claim: ClaimRow) => (claim.customer_treatment?.id ?? claim.customer_treatment_id)?.slice(0, 8).toUpperCase() ?? '—'
  const finishedDate = (claim: ClaimRow) => claim.customer_treatment?.finished_at ? formatDateTime(claim.customer_treatment.finished_at).split(' ')[0] : '—'
  const statusTag = (status?: string) => (
    <Tag className="me-0!" color={STATUS_META[status ?? '']?.color}>{STATUS_META[status ?? '']?.label ?? status ?? '—'}</Tag>
  )
  const packageLink = (row: ClaimRow) => row.customer_treatment_id ? (
    <Link
      className="text-(--brand-primary)"
      to={`/treatment-customers?treatment_id=${encodeURIComponent(row.customer_treatment_id)}`}
      onClick={(event) => event.stopPropagation()}
    >
      {packageLabel(row)}
    </Link>
  ) : packageLabel(row)

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

  const rejectMutation = usePutWarrantyClaimsIdRejectAdmin()
  const createMutation = usePostWarrantyClaimsAdmin()

  const submitReject = async () => {
    if (!rejectTarget) return
    try {
      const values = await rejectForm.validateFields()
      await rejectMutation.mutateAsync({ id: rejectTarget.id, data: { reason: values.reason } as PutWarrantyClaimsIdRejectAdminBody })
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
    { title: 'Cơ sở', width: 130, render: (_, row) => branchLabel(row) },
    {
      title: 'Mã liệu trình', key: 'treatmentCode', width: 150,
      render: (_v, row) => treatmentCode(row),
    },
    {
      title: 'Gói liệu trình', key: 'package', render: (_v, row) => packageLink(row),
    },
    {
      title: 'Ngày hoàn tất', key: 'finishedAt', width: 150,
      render: (_v, row) => finishedDate(row),
    },
    { title: 'Lý do bảo hành', dataIndex: 'reason', ellipsis: true },
    { title: 'Ngày tạo', dataIndex: 'created_at', width: 150, render: (v: string) => (v ? formatDateTime(v) : '—') },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: (v?: string) => statusTag(v),
    },
  ]

  return (
    <>
      <PageTitle
        className="warranty-claims-title max-lg:mb-3"
        subtitle="Tiếp nhận và xử lý yêu cầu bảo hành"
        left={
          // docs 6.2.1: N = 1 + nút tạo → [Trạng thái][+]; từ tablet tan vào hàng toolbar
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-md:col-span-full md:contents">
            <Select
              aria-label="Lọc theo trạng thái bảo hành"
              allowClear value={statusFilter} placeholder="Trạng thái" className="w-full min-w-0 md:w-[160px]"
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
              options={STATUS_FILTER_OPTIONS}
            />
            <Can I="UPDATE" a="WARRANTY_CLAIM">
              <Button type="primary" icon={<PlusOutlined />} aria-label="Tiếp nhận bảo hành" onClick={() => { createForm.resetFields(); setCreateOpen(true) }}>
                Tiếp nhận bảo hành
              </Button>
            </Can>
          </div>
        }
      >
        Bảo hành gói liệu trình
      </PageTitle>
      {claimsQuery.isError && (
        <Alert
          className="mb-4 wrap-anywhere" type="error" showIcon title="Không tải được danh sách bảo hành"
          description={<>
            {errorMessage(claimsQuery.error)}
            <div className="mt-2"><Button size="small" loading={claimsQuery.isFetching} onClick={() => void claimsQuery.refetch()}>Thử lại</Button></div>
          </>}
        />
      )}
      {!claimsQuery.isLoading && (!claimsQuery.isError || rows.length > 0) && <Table<ClaimRow>
        className="desktop-only max-lg:hidden!"
        rowKey="id" dataSource={rows} columns={columns}
        pagination={false}
        locale={{ emptyText: <TableEmpty description={statusFilter ? 'Không có kết quả' : 'Chưa có yêu cầu bảo hành'} /> }}
        onRow={(row) => ({
          onClick: () => setDetailId(row.id),
          style: { cursor: 'pointer' },
        })}
      />}
      {(!claimsQuery.isError || rows.length > 0) && (
        <MobileCards
          className={claimsQuery.isLoading ? 'warranty-claims-loading' : 'warranty-claim-cards'}
          rows={rows}
          rowKey={(row) => row.id}
          loading={claimsQuery.isLoading}
          emptyText={statusFilter ? 'Không có kết quả' : 'Chưa có yêu cầu bảo hành'}
          renderCard={(row) => (
            <>
              <div className="mobile-card-head flex-wrap">
                <div className="min-w-0">
                  <div className="mobile-card-title">{displayName(row.customer_treatment?.user, 'Khách hàng')}</div>
                  {row.customer_treatment?.user?.phone && (
                    <div className="mobile-card-sub">{row.customer_treatment.user.phone}</div>
                  )}
                </div>
                {statusTag(row.status)}
              </div>
              <div className="mobile-card-rows">
                <MobileCardRow label="Gói liệu trình" value={packageLink(row)} />
                <MobileCardRow label="Mã liệu trình" value={treatmentCode(row)} />
                <MobileCardRow label="Cơ sở" value={branchLabel(row)} />
                <MobileCardRow label="Ngày hoàn tất" value={finishedDate(row)} />
                <MobileCardRow label="Ngày tạo" value={row.created_at ? formatDateTime(row.created_at) : '—'} />
                <MobileCardRow label="Lý do" value={row.reason || '—'} />
              </div>
              <div className="mobile-card-actions warranty-card-actions">
                <Button className="max-md:w-full" onClick={() => setDetailId(row.id)}>Xem chi tiết</Button>
              </div>
            </>
          )}
        />
      )}
      <ListPagination page={page} limit={10} total={total} onChange={setPage} noun="yêu cầu bảo hành" />

      <WarrantyClaimDetailModal
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
        branches={branches}
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

