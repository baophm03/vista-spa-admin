import { useState } from 'react'
import { Alert, Button, Card, DatePicker, Form, Input, Modal, Select, Table, Typography, message } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { PaymentLog } from '@/api/models/paymentLog'
import { getGetPaymentsQueryKey, useGetPayments, usePostPaymentsIdVoid } from '@/api/endpoints/customer-treatments'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetUsers } from '@/api/endpoints/users'
import { Can } from '@casl/react'
import { useQueryClient } from '@tanstack/react-query'

const PAY_METHOD: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  POS: 'Quẹt thẻ',
  OTHER: 'Khác',
}

interface LedgerRow extends PaymentLog {
  customer_treatment?: {
    customer_profile?: { full_name?: string; phone?: string }
    package_snapshot?: { name?: string }
    branch_id?: string
  }
}

/** PM-03 — Sổ thanh toán toàn hệ thống + PM-04 hủy giao dịch (Admin). */
export default function Payments() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [branchFilter, setBranchFilter] = useState<string>()
  const [staffFilter, setStaffFilter] = useState<string>()
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [voidRow, setVoidRow] = useState<LedgerRow | null>(null)
  const [voidForm] = Form.useForm()
  const queryClient = useQueryClient()

  const params = {
    page,
    limit: pageSize,
    ...(branchFilter ? { branch_id: branchFilter } : {}),
    ...(staffFilter ? { entered_by: staffFilter } : {}),
    ...(range?.[0] ? { from_date: range[0].format('YYYY-MM-DD') } : {}),
    ...(range?.[1] ? { to_date: range[1].format('YYYY-MM-DD') } : {}),
  }

  const paymentsQuery = useGetPayments(params)
  const branchesQuery = useGetBranches()
  const staffQuery = useGetUsers({ currentPage: 1, pageSize: 100, has_role: true } as never)
  const voidMutation = usePostPaymentsIdVoid()

  const raw = pickData<LedgerRow[] | { rows?: LedgerRow[] }>(paymentsQuery.data)
  const rows = (Array.isArray(raw) ? raw : raw?.rows ?? []) as LedgerRow[]
  const meta = (paymentsQuery.data as unknown as { meta?: { total?: number } })?.meta
  const total = meta?.total ?? rows.length

  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const staffRows = (pickData<{ rows?: { id: string; zalo_name?: string; email?: string }[] }>(staffQuery.data) as
    | { rows?: { id: string; zalo_name?: string; email?: string }[] }
    | undefined)?.rows ?? []

  const staffById = new Map(staffRows.map((s) => [s.id, s.zalo_name || s.email || s.id]))
  const branchById = new Map(branches.map((b) => [b.id, b.name]))

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetPaymentsQueryKey() })

  const submitVoid = async () => {
    if (!voidRow) return
    const values = await voidForm.validateFields()
    try {
      await voidMutation.mutateAsync({ id: voidRow.id, data: { void_reason: values.void_reason } })
      message.success('Đã hủy giao dịch thanh toán')
      setVoidRow(null)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'paid_at',
      width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_: unknown, row: LedgerRow) => {
        const profile = row.customer_treatment?.customer_profile
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{profile?.full_name || '—'}</div>
            <div style={{ fontSize: 12, color: '#6F7071' }}>{profile?.phone || ''}</div>
          </div>
        )
      },
    },
    {
      title: 'Gói dịch vụ',
      key: 'package',
      render: (_: unknown, row: LedgerRow) => row.customer_treatment?.package_snapshot?.name || '—',
    },
    {
      title: 'Cơ sở',
      key: 'branch',
      width: 150,
      render: (_: unknown, row: LedgerRow) => branchById.get(row.customer_treatment?.branch_id ?? '') || '—',
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      width: 140,
      render: (v: number) => <Typography.Text strong>{Number(v).toLocaleString('vi-VN')} ₫</Typography.Text>,
    },
    {
      title: 'Phương thức',
      dataIndex: 'method',
      width: 130,
      render: (v: string) => PAY_METHOD[v] ?? v,
    },
    {
      title: 'Thu ngân',
      key: 'entered_by',
      width: 150,
      render: (_: unknown, row: LedgerRow) => staffById.get(row.entered_by ?? '') || '—',
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_: unknown, row: LedgerRow) => (
        <Can I="DELETE" a="CUSTOMER">
          <Button size="small" danger onClick={() => { voidForm.resetFields(); setVoidRow(row) }}>
            Hủy
          </Button>
        </Can>
      ),
    },
  ]

  return (
    <>
      <PageTitle>Sổ thanh toán</PageTitle>

      {paymentsQuery.isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Không tải được sổ thanh toán"
          description={errorMessage(paymentsQuery.error)}
          action={<Button size="small" onClick={() => void paymentsQuery.refetch()}>Thử lại</Button>}
        />
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            allowClear
            placeholder="Tất cả cơ sở"
            style={{ width: 180 }}
            value={branchFilter}
            onChange={(v) => { setBranchFilter(v); setPage(1) }}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Thu ngân"
            style={{ width: 180 }}
            value={staffFilter}
            onChange={(v) => { setStaffFilter(v); setPage(1) }}
            options={staffRows.map((s) => ({ value: s.id, label: s.zalo_name || s.email || s.id }))}
          />
          <DatePicker.RangePicker
            placeholder={['Từ ngày', 'Đến ngày']}
            value={range}
            onChange={(v) => { setRange(v as [Dayjs | null, Dayjs | null] | null); setPage(1) }}
          />
          <Button icon={<SearchOutlined />} onClick={() => { setPage(1); refresh() }}>Lọc</Button>
          <Button icon={<ReloadOutlined />} onClick={() => refresh()} />
        </div>

        <Table<LedgerRow>
          rowKey="id"
          loading={paymentsQuery.isLoading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (t) => `Tổng ${t} giao dịch`,
            onChange: (p, ps) => { setPage(ps !== pageSize ? 1 : p); setPageSize(ps) },
          }}
          locale={{ emptyText: 'Chưa có giao dịch thanh toán nào khớp điều kiện' }}
        />
      </Card>

      <Modal
        title="Hủy giao dịch thanh toán"
        open={!!voidRow}
        onCancel={() => setVoidRow(null)}
        onOk={() => void submitVoid()}
        okText="Hủy giao dịch"
        okButtonProps={{ danger: true }}
        cancelText="Không"
        confirmLoading={voidMutation.isPending}
        destroyOnHidden
      >
        {voidRow && (
          <div style={{ marginBottom: 12 }}>
            <Typography.Paragraph>
              Giao dịch <Typography.Text strong>{Number(voidRow.amount).toLocaleString('vi-VN')} ₫</Typography.Text> —
              ngày {dayjs(String(voidRow.paid_at)).format('DD/MM/YYYY HH:mm')}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Hủy mềm: giao dịch được giữ vết (người hủy, lý do), số nợ của khách được tính lại tự động.
            </Typography.Paragraph>
          </div>
        )}
        <Form form={voidForm} layout="vertical">
          <Form.Item name="void_reason" label="Lý do hủy (bắt buộc)" rules={[{ required: true, whitespace: true, message: 'Nhập lý do hủy' }]}>
            <Input.TextArea rows={2} maxLength={500} placeholder="VD: Thu nhầm tiền, khách yêu cầu hoàn trả" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
