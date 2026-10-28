import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import {
  getGetCommissionRulesQueryKey,
  useDeleteCommissionRulesId,
  useGetCommissionRules,
  usePostCommissionRules,
  usePutCommissionRulesId,
} from '@/api/endpoints/commissions'
import type { CommissionRule, CommissionRulePayeeType, PostCommissionRulesBody } from '@/api/models'

type PayeeType = CommissionRulePayeeType

const PAYEE_META: Record<PayeeType, { label: string; color: string }> = {
  STAFF: { label: 'KTV', color: 'blue' },
  COLLABORATOR: { label: 'Cộng tác viên', color: 'purple' },
  CUSTOMER_REFERRER: { label: 'Khách giới thiệu', color: 'geekblue' },
}

const BASE_OPTIONS = [
  { value: 'PAYMENT', label: 'Trên thanh toán' },
  { value: 'SESSION_VALUE', label: 'Trên giá trị buổi' },
]

export default function CommissionRules() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CommissionRule | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const rulesQuery = useGetCommissionRules()
  const rules = useMemo(() => {
    const raw = pickData<CommissionRule[]>(rulesQuery.data)
    return Array.isArray(raw) ? raw : []
  }, [rulesQuery.data])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCommissionRulesQueryKey() })
  }

  const createMutation = usePostCommissionRules({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutCommissionRulesId({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteCommissionRulesId({ mutation: { onSuccess: invalidate } })

  const openEditor = (row?: CommissionRule) => {
    setEditing(row ?? null)
    form.setFieldsValue(
      row
        ? {
            name: row.name,
            payee_type: row.payee_type,
            base: row.base ?? 'PAYMENT',
            percent: row.percent ?? 0,
            priority: row.priority ?? 0,
            valid_range: row.valid_from && row.valid_to ? [row.valid_from, row.valid_to] : undefined,
            is_active: row.is_active ?? true,
          }
        : { name: '', payee_type: 'STAFF', base: 'PAYMENT', percent: 10, priority: 0, is_active: true },
    )
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto: PostCommissionRulesBody = {
        name: values.name,
        payee_type: values.payee_type,
        base: values.base,
        percent: values.percent ?? 0,
        priority: values.priority ?? 0,
        is_active: !!values.is_active,
        valid_from: values.valid_range?.[0] ?? undefined,
        valid_to: values.valid_range?.[1] ?? undefined,
        service_id: values.service_id || undefined,
        staff_id: values.staff_id || undefined,
        branch_id: values.branch_id || undefined,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id!, data: dto })
        message.success('Đã cập nhật quy tắc hoa hồng')
      } else {
        await createMutation.mutateAsync({ data: dto })
        message.success('Đã tạo quy tắc hoa hồng')
      }
      setOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const remove = async (row: CommissionRule) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id! })
      message.success(`Đã ngừng quy tắc "${row.name}"`)
    } catch (err) {
      message.error(errorMessage(err, 'Không ngừng được quy tắc'))
    }
  }

  const columns: TableColumnsType<CommissionRule> = [
    {
      title: 'Tên quy tắc', dataIndex: 'name',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Người nhận', dataIndex: 'payee_type', width: 150,
      render: (v: PayeeType) => {
        const meta = PAYEE_META[v]
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    { title: 'Căn tính', dataIndex: 'base', width: 150, render: (v?: string) => BASE_OPTIONS.find((o) => o.value === v)?.label ?? '—' },
    { title: '% hoa hồng', dataIndex: 'percent', width: 100, align: 'right', render: (v?: number) => (v != null ? `${v}%` : '—') },
    {
      title: 'Phạm vi', key: 'scope', width: 220,
      render: (_v, row) => {
        const parts: string[] = []
        if (row.service_id) parts.push('Theo dịch vụ')
        if (row.staff_id) parts.push('Theo KTV')
        if (row.branch_id) parts.push('Theo cơ sở')
        return parts.length ? parts.join(', ') : <Tag>Toàn hệ thống</Tag>
      },
    },
    { title: 'Ưu tiên', dataIndex: 'priority', width: 80, align: 'center', render: (v?: number) => v ?? 0 },
    {
      title: 'Hạn', key: 'validity', width: 200,
      render: (_v, row) => (row.valid_from || row.valid_to ? `${row.valid_from ?? '...'} → ${row.valid_to ?? '...'}` : 'Không giới hạn'),
    },
    {
      title: 'Trạng thái', dataIndex: 'is_active', width: 110,
      render: (v?: boolean) => (v !== false ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã ngừng</Tag>),
    },
    {
      title: 'Thao tác', key: 'actions', width: 160,
      render: (_v, row) => (
        <Space>
          <Can I="RULE_MANAGE" a="COMMISSION">
            <Button size="small" onClick={() => openEditor(row)}>Sửa</Button>
            <Popconfirm
              title="Ngừng quy tắc này?"
              description="Quy tắc sẽ không áp dụng cho giao dịch mới; bút toán đã sinh không đổi."
              okText="Ngừng" okButtonProps={{ danger: true }} cancelText="Hủy"
              onConfirm={() => void remove(row)}
            >
              <Button size="small" danger>Ngừng</Button>
            </Popconfirm>
          </Can>
        </Space>
      ),
    },
  ]

  return (
    <Can I="RULE_MANAGE" a="COMMISSION" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <PageTitle>Quy tắc hoa hồng</PageTitle>
            <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button icon={<ReloadOutlined />} onClick={() => void rulesQuery.refetch()}>Tải lại</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm quy tắc</Button>
            </Space>
            {rulesQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                message="Không tải được quy tắc hoa hồng"
                description={errorMessage(rulesQuery.error)}
                action={<Button size="small" onClick={() => void rulesQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              message="Hoa hồng tự động chỉ chạy khi bật cấu hình commission.auto_enabled. Rule cụ thể hơn (theo dịch vụ/KTV/cơ sở) được ưu tiên, rồi đến mức ưu tiên."
            />
            <Table<CommissionRule>
              rowKey="id" loading={rulesQuery.isLoading} dataSource={rules} columns={columns}
              pagination={{ pageSize: 10 }}
            />
            <Modal
              title={editing ? `Sửa quy tắc: ${editing.name}` : 'Thêm quy tắc hoa hồng'}
              open={open}
              onCancel={() => setOpen(false)}
              onOk={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              okText="Lưu" cancelText="Hủy"
              width={560}
            >
              <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
                <Form.Item name="name" label="Tên quy tắc" rules={[{ required: true, message: 'Nhập tên quy tắc' }]}>
                  <Input maxLength={150} placeholder="VD: Hoa hồng KTV dịch vụ mặt" />
                </Form.Item>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="payee_type" label="Người nhận" rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Select options={Object.entries(PAYEE_META).map(([value, meta]) => ({ value, label: meta.label }))} />
                  </Form.Item>
                  <Form.Item name="base" label="Căn tính" rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Select options={BASE_OPTIONS} />
                  </Form.Item>
                  <Form.Item name="percent" label="% hoa hồng" rules={[{ required: true, message: 'Nhập %' }]} style={{ flex: 1 }}>
                    <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="priority" label="Mức ưu tiên" style={{ flex: 1 }} extra="Số càng cao càng ưu tiên khi nhiều rule khớp">
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="valid_range" label="Hạn áp dụng" style={{ flex: 2 }}>
                    <DatePicker.RangePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
                <Form.Item name="is_active" label="Đang dùng" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Form>
            </Modal>
          </>
        ) : (
          <>
            <PageTitle>Quy tắc hoa hồng</PageTitle>
            <Alert type="warning" showIcon message="Bạn không có quyền quản lý quy tắc hoa hồng (cần quyền commission.rule_manage)" />
          </>
        )
      }
    </Can>
  )
}
