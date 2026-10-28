import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
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
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage } from '@/api/helpers'
import type { CardRank } from '@/api/models/cardRank'
import type { PostCardRanksBody } from '@/api/models/postCardRanksBody'
import type { PutCardRanksIdBody } from '@/api/models/putCardRanksIdBody'
import {
  getGetCardRanksQueryKey,
  useDeleteCardRanksId,
  useGetCardRanks,
  usePostCardRanks,
  usePutCardRanksId,
} from '@/api/endpoints/membership'

const VALIDITY_META: Record<string, { label: string; color: string }> = {
  ONE_YEAR: { label: '1 năm', color: 'blue' },
  PERMANENT: { label: 'Vĩnh viễn', color: 'green' },
}

const RANK_HINT = 'Sửa ngưỡng/% chỉ ảnh hưởng lần xét hạng sau; không tự đổi hạng khách hiện có.'

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

/** Hàng có thể kèm số khách giữ hạng nếu BE trả về (model gen chưa khai báo). */
type CardRankRow = CardRank & {
  customer_count?: number
  holder_count?: number
  holders_count?: number
  total_customers?: number
}

function holderCount(row: CardRankRow): number | undefined {
  return row.customer_count ?? row.holder_count ?? row.holders_count ?? row.total_customers
}

export default function CardRanks() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CardRankRow | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const ranksQuery = useGetCardRanks()
  const ranks = useMemo<CardRankRow[]>(() => {
    const list = ranksQuery.data?.responseData ?? []
    return [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }, [ranksQuery.data])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCardRanksQueryKey() })
  }

  const createMutation = usePostCardRanks({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutCardRanksId({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteCardRanksId({ mutation: { onSuccess: invalidate } })

  const openEditor = (row?: CardRankRow) => {
    setEditing(row ?? null)
    form.setFieldsValue(
      row
        ? {
            code: row.code,
            name: row.name,
            sort_order: row.sort_order ?? 0,
            min_spent: row.min_spent ?? 0,
            max_spent: row.max_spent ?? undefined,
            discount_percent: row.discount_percent ?? undefined,
            validity: row.validity ?? 'PERMANENT',
            auto_assign: row.auto_assign ?? false,
            benefits: row.benefits ?? '',
          }
        : { code: '', name: '', sort_order: (ranks.length ? Math.max(...ranks.map((r) => r.sort_order ?? 0)) : 0) + 1, min_spent: 0, max_spent: undefined, discount_percent: undefined, validity: 'PERMANENT', auto_assign: false, benefits: '' },
    )
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto = {
        name: values.name,
        sort_order: values.sort_order ?? 0,
        min_spent: values.min_spent ?? 0,
        max_spent: values.max_spent ?? undefined,
        discount_percent: values.discount_percent ?? undefined,
        validity: values.validity,
        auto_assign: !!values.auto_assign,
        benefits: values.benefits || undefined,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: dto as PutCardRanksIdBody })
        message.success('Đã cập nhật hạng thẻ')
      } else {
        await createMutation.mutateAsync({ data: { ...dto, code: values.code } as PostCardRanksBody })
        message.success('Đã tạo hạng thẻ')
      }
      setOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const remove = async (row: CardRankRow) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id })
      message.success(`Đã xóa hạng "${row.name}"`)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        message.error(
          errorMessage(err, 'Không thể xóa: vẫn còn khách hàng đang giữ hạng này'),
        )
      } else {
        message.error(errorMessage(err))
      }
    }
  }

  const showHolders = ranks.some((r) => holderCount(r) != null)

  const columns: TableColumnsType<CardRankRow> = [
    {
      title: 'Mã', dataIndex: 'code', width: 110,
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    { title: 'Tên hạng', dataIndex: 'name', render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    {
      title: 'Thứ tự', dataIndex: 'sort_order', width: 90, align: 'center',
      render: (v?: number) => v ?? '—',
    },
    {
      title: 'Ngưỡng chi tiêu', key: 'spent', width: 220,
      render: (_v, row) =>
        row.max_spent != null
          ? `${formatVnd(row.min_spent)} → ${formatVnd(row.max_spent)}`
          : `${formatVnd(row.min_spent)} trở lên`,
    },
    {
      title: 'Hiệu lực', dataIndex: 'validity', width: 120,
      render: (v?: string) => {
        const meta = v ? VALIDITY_META[v] : undefined
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v ?? '—'}</Tag>
      },
    },
    {
      title: 'Tự gán hạng', dataIndex: 'auto_assign', width: 110, align: 'center',
      render: (v?: boolean) => <Switch size="small" checked={!!v} disabled />,
    },
    ...(showHolders
      ? [{
          title: 'Khách đang giữ', key: 'holders', width: 130, align: 'center' as const,
          render: (_v: unknown, row: CardRankRow) => holderCount(row)?.toLocaleString('vi-VN') ?? '—',
        } satisfies TableColumnsType<CardRankRow>[number]]
      : []),
    {
      title: 'Trạng thái', dataIndex: 'is_active', width: 110,
      render: (v?: boolean) => (v !== false ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã xóa</Tag>),
    },
    {
      title: 'Thao tác', key: 'actions', width: 160,
      render: (_v, row) => <Space>
        <Can I="UPDATE" a="CARD_RANK">
          <Button size="small" onClick={() => openEditor(row)}>Sửa</Button>
        </Can>
        <Can I="DELETE" a="CARD_RANK">
          <Popconfirm
            title="Xóa hạng thẻ này?"
            description="Xóa mềm (đặt is_active = false). Không xóa được nếu còn khách giữ hạng."
            okText="Xóa" okButtonProps={{ danger: true }} cancelText="Hủy"
            onConfirm={() => void remove(row)}
          >
            <Button size="small" danger>Xóa</Button>
          </Popconfirm>
        </Can>
      </Space>,
    },
  ]

  return (
    <Can I="READ" a="CARD_RANK" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <PageTitle>Hạng thẻ thành viên</PageTitle>
            <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button icon={<ReloadOutlined />} onClick={() => void ranksQuery.refetch()}>Tải lại</Button>
              <Can I="CREATE" a="CARD_RANK">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm hạng</Button>
              </Can>
            </Space>
            {ranksQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                message="Không tải được danh mục hạng thẻ"
                description={errorMessage(ranksQuery.error)}
                action={<Button size="small" onClick={() => void ranksQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <Table<CardRankRow>
              rowKey="id" loading={ranksQuery.isLoading} dataSource={ranks} columns={columns}
              pagination={{ pageSize: 10 }}
            />
            <Modal
              title={editing ? `Sửa hạng: ${editing.name}` : 'Thêm hạng thẻ'}
              open={open}
              onCancel={() => setOpen(false)}
              onOk={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              okText="Lưu" cancelText="Hủy"
            >
              <Alert
                type="info" showIcon style={{ marginTop: 12, marginBottom: 12 }}
                message={RANK_HINT}
              />
              <Form form={form} layout="vertical">
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item
                    name="code" label="Mã hạng" style={{ flex: 1 }}
                    rules={editing ? undefined : [{ required: true, message: 'Nhập mã hạng' }]}
                    extra={editing ? 'Mã hạng không thể thay đổi' : undefined}
                  >
                    <Input maxLength={50} placeholder="VD: SILVER" disabled={!!editing} />
                  </Form.Item>
                  <Form.Item name="sort_order" label="Thứ tự sắp xếp" rules={[{ required: true, message: 'Nhập thứ tự' }]} style={{ flex: 1 }}>
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
                <Form.Item name="name" label="Tên hạng" rules={[{ required: true, message: 'Nhập tên hạng' }]}>
                  <Input maxLength={255} placeholder="VD: Bạc" />
                </Form.Item>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="min_spent" label="Chi tiêu tối thiểu (₫)" rules={[{ required: true, message: 'Nhập ngưỡng tối thiểu' }]} style={{ flex: 1 }}>
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="VD: 5000000" />
                  </Form.Item>
                  <Form.Item name="max_spent" label="Chi tiêu tối đa (₫)" style={{ flex: 1 }} extra="Bỏ trống nếu không giới hạn trên">
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
                  </Form.Item>
                  <Form.Item name="discount_percent" label='% giảm giá của hạng (%)' style={{ flex: 1 }} extra='Tính vào trần xếp chồng ưu đãi'>
                    <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} placeholder="VD: 10" />
                  </Form.Item>
                </Space>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="validity" label="Hiệu lực thẻ" rules={[{ required: true, message: 'Chọn hiệu lực' }]} style={{ flex: 1 }}>
                    <Select options={Object.entries(VALIDITY_META).map(([value, meta]) => ({ value, label: meta.label }))} />
                  </Form.Item>
                  <Form.Item name="auto_assign" label="Tự gán hạng" valuePropName="checked" style={{ flex: 1 }} extra="Tự động xét hạng khi khách đạt ngưỡng chi tiêu">
                    <Switch />
                  </Form.Item>
                </Space>
                <Form.Item name="benefits" label="Quyền lợi">
                  <Input.TextArea rows={3} maxLength={2000} placeholder="Mô tả quyền lợi của hạng thẻ" />
                </Form.Item>
              </Form>
            </Modal>
          </>
        ) : (
          <>
            <PageTitle>Hạng thẻ thành viên</PageTitle>
            <Alert type="warning" showIcon message="Bạn không có quyền xem danh mục hạng thẻ (cần quyền card_rank.read)" />
          </>
        )
      }
    </Can>
  )
}
