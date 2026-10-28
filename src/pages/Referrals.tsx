import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
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
import { Can } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { PostReferralsBody, PutReferralsIdBody, Referral } from '@/api/models'
import {
  getGetReferralsQueryKey,
  useGetReferrals,
  usePostReferrals,
  usePutReferralsId,
} from '@/api/endpoints/membership'
import { useGetCollaborators } from '@/api/endpoints/admin'
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'

const REFERRER_TYPES = ['COLLABORATOR', 'CUSTOMER'] as const

const REFERRER_TYPE_META: Record<string, { label: string; color: string }> = {
  COLLABORATOR: { label: 'Cộng tác viên', color: 'blue' },
  CUSTOMER: { label: 'Khách hàng', color: 'green' },
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ duyệt', color: 'gold' },
  APPROVED: { label: 'Đã duyệt', color: 'blue' },
  REJECTED: { label: 'Từ chối', color: 'red' },
  PAID: { label: 'Đã chi trả', color: 'green' },
}

const STATUS_KEYS = Object.keys(STATUS_META)

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

/** Hàng trả về có thêm `referred_profile` (include ở BE) — model gen chưa khai báo. */
type ReferralRow = Referral & {
  referred_profile?: { id?: string; full_name?: string; phone?: string; customer_code?: string } | null
}

type CustomerOption = { id: string; full_name?: string; phone?: string; customer_code?: string }

export default function Referrals() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ReferralRow | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const listQuery = useGetReferrals()
  const rows = useMemo(() => {
    const raw = pickData<unknown>(listQuery.data)
    return (Array.isArray(raw) ? raw : (raw as { rows?: ReferralRow[] } | null)?.rows ?? []) as ReferralRow[]
  }, [listQuery.data])

  // Map tên CTV để hiển thị "người giới thiệu" khi referrer_type = COLLABORATOR
  const collaboratorsQuery = useGetCollaborators()
  const collaboratorNameById = useMemo(() => {
    const raw = pickData<unknown>(collaboratorsQuery.data)
    const list = (Array.isArray(raw) ? raw : (raw as { rows?: { id: string; name: string }[] } | null)?.rows ?? []) as { id: string; name: string }[]
    return new Map(list.map((c) => [c.id, c.name]))
  }, [collaboratorsQuery.data])

  // Danh sách khách hàng — dùng cho "khách được giới thiệu" và referrer CUSTOMER
  const customersQuery = useGetCustomerProfiles({ page: 1, limit: 200 })
  const customers = useMemo(() => {
    const raw = pickData<unknown>(customersQuery.data)
    const list = (Array.isArray(raw) ? raw : (raw as { rows?: CustomerOption[] } | null)?.rows ?? []) as CustomerOption[]
    return list
  }, [customersQuery.data])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetReferralsQueryKey() })
  }

  const createMutation = usePostReferrals({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutReferralsId({ mutation: { onSuccess: invalidate } })

  const referrerLabel = (row: ReferralRow): string => {
    if (row.referrer_type === 'COLLABORATOR') {
      return collaboratorNameById.get(row.referrer_id) ?? row.referrer_id
    }
    const customer = customers.find((c) => c.id === row.referrer_id)
    return customer?.full_name ?? row.referrer_id
  }

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({
      referrer_type: 'COLLABORATOR',
      referrer_id: undefined,
      referred_profile_id: undefined,
      commission_amount: undefined,
      note: '',
    })
    setOpen(true)
  }

  const openEdit = (row: ReferralRow) => {
    setEditing(row)
    form.setFieldsValue({
      status: row.status ?? 'PENDING',
      commission_amount: row.commission_amount ?? undefined,
      note: row.note ?? '',
    })
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          data: {
            status: values.status,
            commission_amount: values.commission_amount ?? undefined,
            note: values.note || undefined,
          } satisfies PutReferralsIdBody,
        })
        message.success('Đã cập nhật giới thiệu')
      } else {
        if (!values.referrer_id) {
          message.error('Chọn người giới thiệu')
          return
        }
        await createMutation.mutateAsync({
          data: {
            referrer_type: values.referrer_type,
            referrer_id: values.referrer_id,
            referred_profile_id: values.referred_profile_id,
            commission_amount: values.commission_amount ?? undefined,
            note: values.note || undefined,
          } satisfies PostReferralsBody,
        })
        message.success('Đã ghi nhận giới thiệu')
      }
      setOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const columns: TableColumnsType<ReferralRow> = [
    {
      title: 'Người giới thiệu', key: 'referrer',
      render: (_v, row) => <span style={{ fontWeight: 500 }}>{referrerLabel(row)}</span>,
    },
    {
      title: 'Loại', dataIndex: 'referrer_type', width: 130,
      render: (v?: string) => {
        const meta = v ? REFERRER_TYPE_META[v] : undefined
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v || '—'}</Tag>
      },
    },
    {
      title: 'Khách được giới thiệu', key: 'referred',
      render: (_v, row) => {
        const p = row.referred_profile
        if (!p?.full_name) return <Typography.Text type="secondary">{row.referred_profile_id}</Typography.Text>
        return (
          <Space size={4}>
            <span>{p.full_name}</span>
            {p.phone && <Typography.Text type="secondary">({p.phone})</Typography.Text>}
          </Space>
        )
      },
    },
    {
      title: 'Ngày', dataIndex: 'created_at', width: 120,
      render: (v?: string) => (v ? new Date(v).toLocaleDateString('vi-VN') : '—'),
    },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 110,
      render: (v?: string) => {
        const meta = v ? STATUS_META[v] : undefined
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v || '—'}</Tag>
      },
    },
    {
      title: 'Hoa hồng', dataIndex: 'commission_amount', width: 130, align: 'right',
      render: (v?: number | null) => formatVnd(v),
    },
    {
      title: 'Ghi chú', dataIndex: 'note', ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: 'Thao tác', key: 'actions', width: 90,
      render: (_v, row) => (
        <Can I="UPDATE" a="REFERRAL">
          <Button size="small" onClick={() => openEdit(row)}>Sửa</Button>
        </Can>
      ),
    },
  ]

  const referrerTypeValue = Form.useWatch('referrer_type', form)

  return (
    <Can I="READ" a="REFERRAL" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <PageTitle>Lịch sử giới thiệu</PageTitle>
            <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>Tải lại</Button>
              <Can I="CREATE" a="REFERRAL">
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Ghi nhận giới thiệu</Button>
              </Can>
            </Space>
            {listQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                message="Không tải được lịch sử giới thiệu"
                description={errorMessage(listQuery.error)}
                action={<Button size="small" onClick={() => void listQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <Table<ReferralRow>
              rowKey="id" loading={listQuery.isLoading} dataSource={rows} columns={columns}
              pagination={{ pageSize: 10 }}
            />
            <Modal
              title={editing ? 'Sửa giới thiệu' : 'Ghi nhận giới thiệu'}
              open={open}
              onCancel={() => setOpen(false)}
              onOk={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              okText="Lưu" cancelText="Hủy"
            >
              <Form form={form} layout="vertical">
                {editing ? (
                  <>
                    <Form.Item name="status" label="Trạng thái" rules={[{ required: true, message: 'Chọn trạng thái' }]}>
                      <Select options={STATUS_KEYS.map((s) => ({ value: s, label: STATUS_META[s].label }))} />
                    </Form.Item>
                    <Form.Item name="commission_amount" label="Hoa hồng (₫)">
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="VD: 200000" />
                    </Form.Item>
                    <Form.Item name="note" label="Ghi chú">
                      <Input.TextArea rows={3} maxLength={2000} />
                    </Form.Item>
                  </>
                ) : (
                  <>
                    <Form.Item name="referrer_type" label="Loại người giới thiệu" rules={[{ required: true, message: 'Chọn loại' }]}>
                      <Select
                        options={REFERRER_TYPES.map((t) => ({ value: t, label: REFERRER_TYPE_META[t].label }))}
                        onChange={() => form.setFieldValue('referrer_id', undefined)}
                      />
                    </Form.Item>
                    <Form.Item
                      name="referrer_id" label={referrerTypeValue === 'CUSTOMER' ? 'Khách giới thiệu' : 'Cộng tác viên giới thiệu'}
                      rules={[{ required: true, message: 'Chọn người giới thiệu' }]}
                    >
                      {referrerTypeValue === 'CUSTOMER' ? (
                        <Select
                          showSearch optionFilterProp="label" placeholder="Chọn khách hàng"
                          options={customers.map((c) => ({
                            value: c.id,
                            label: [c.full_name, c.phone].filter(Boolean).join(' — ') || c.id,
                          }))}
                        />
                      ) : (
                        <Select
                          showSearch optionFilterProp="label" placeholder="Chọn cộng tác viên"
                          loading={collaboratorsQuery.isLoading}
                          options={[...collaboratorNameById.entries()].map(([value, label]) => ({ value, label }))}
                        />
                      )}
                    </Form.Item>
                    <Form.Item
                      name="referred_profile_id" label="Khách được giới thiệu"
                      rules={[{ required: true, message: 'Chọn khách được giới thiệu' }]}
                      extra="Mỗi khách chỉ được ghi nhận 1 lượt giới thiệu"
                    >
                      <Select
                        showSearch optionFilterProp="label" placeholder="Chọn khách hàng"
                        loading={customersQuery.isLoading}
                        options={customers.map((c) => ({
                          value: c.id,
                          label: [c.full_name, c.phone].filter(Boolean).join(' — ') || c.id,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item name="commission_amount" label="Hoa hồng (₫)">
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="VD: 200000" />
                    </Form.Item>
                    <Form.Item name="note" label="Ghi chú">
                      <Input.TextArea rows={3} maxLength={2000} />
                    </Form.Item>
                  </>
                )}
              </Form>
            </Modal>
          </>
        ) : (
          <>
            <PageTitle>Lịch sử giới thiệu</PageTitle>
            <Alert type="warning" showIcon message="Bạn không có quyền xem lịch sử giới thiệu (cần quyền referral.read)" />
          </>
        )
      }
    </Can>
  )
}
