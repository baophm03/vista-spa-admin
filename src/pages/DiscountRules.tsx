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
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage } from '@/api/helpers'
import {
  getGetDiscountRulesQueryKey,
  useDeleteDiscountRulesId,
  useGetDiscountRules,
  usePostDiscountRules,
  usePutDiscountRulesId,
} from '@/api/endpoints/settings'
import { useGetCardRanks } from '@/api/endpoints/membership'
import { useGetService } from '@/api/endpoints/services'
import type {
  DiscountRule,
  DiscountRuleAppliesTo,
  DiscountRuleAudience,
  PostDiscountRulesBody,
  PutDiscountRulesIdBody,
} from '@/api/models'

const AUDIENCE_META: Record<DiscountRuleAudience, { label: string; color: string }> = {
  RANK: { label: 'Theo hạng thẻ', color: 'blue' },
  RETURNING_MEMBER: { label: 'Khách quay lại', color: 'green' },
  NEW_BY_REFERRAL: { label: 'Khách mới được giới thiệu', color: 'purple' },
  UPSELL: { label: 'Upsell', color: 'orange' },
}

const APPLIES_TO_OPTIONS = [
  { value: 'PACKAGE', label: 'Gói liệu trình' },
  { value: 'SERVICE', label: 'Dịch vụ' },
  { value: 'ALL', label: 'Tất cả' },
]

export default function DiscountRules() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DiscountRule | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const rulesQuery = useGetDiscountRules()
  const ranksQuery = useGetCardRanks(undefined, { query: { enabled: open } })
  const servicesQuery = useGetService({ page: 1, limit: 200, is_active: true }, { query: { enabled: open } })
  const rules = useMemo(() => rulesQuery.data?.responseData ?? [], [rulesQuery.data])
  const ranks = useMemo(() => ranksQuery.data?.responseData ?? [], [ranksQuery.data])
  const services = useMemo(() => {
    const data = servicesQuery.data?.responseData as unknown
    if (Array.isArray(data)) return data as { id: string; title: string }[]
    return ((data as { services?: { id: string; title: string }[] } | undefined)?.services ?? [])
  }, [servicesQuery.data])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetDiscountRulesQueryKey() })
  }

  const createMutation = usePostDiscountRules({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutDiscountRulesId({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteDiscountRulesId({ mutation: { onSuccess: invalidate } })

  const openEditor = (row?: DiscountRule) => {
    setEditing(row ?? null)
    form.setFieldsValue(
      row
        ? {
            code: row.code,
            name: row.name,
            audience: row.audience,
            applies_to: row.applies_to ?? 'ALL',
            requires_rank_id: row.requires_rank_id ?? undefined,
            percent_min: row.percent_min ?? 0,
            percent_max: row.percent_max ?? 0,
            max_total_percent: row.max_total_percent ?? undefined,
            stackable: row.stackable ?? true,
            once_per_customer: row.once_per_customer ?? false,
            show_in_app: row.show_in_app ?? true,
            valid_range: row.start_date && row.end_date ? [row.start_date, row.end_date] : undefined,
            service_ids: row.service_ids ?? [],
            is_active: row.is_active ?? true,
          }
        : { audience: 'RANK', applies_to: 'ALL', percent_min: 10, percent_max: 30, stackable: true, once_per_customer: false, show_in_app: true, is_active: true },
    )
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto = {
        code: values.code,
        name: values.name,
        audience: values.audience as DiscountRuleAudience,
        applies_to: values.applies_to as DiscountRuleAppliesTo,
        percent_min: values.percent_min ?? 0,
        percent_max: values.percent_max ?? 0,
        stackable: !!values.stackable,
        once_per_customer: !!values.once_per_customer,
        show_in_app: !!values.show_in_app,
        service_ids: values.applies_to === 'SERVICE' ? (values.service_ids ?? []) : undefined,
      }
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          data: {
            ...dto,
            requires_rank_id: values.audience === 'RANK' ? values.requires_rank_id : null,
            max_total_percent: values.max_total_percent ?? null,
            start_date: values.valid_range?.[0] ?? null,
            end_date: values.valid_range?.[1] ?? null,
            is_active: !!values.is_active,
          } satisfies PutDiscountRulesIdBody,
        })
        message.success('Đã cập nhật quy tắc giảm giá')
      } else {
        await createMutation.mutateAsync({
          data: {
            ...dto,
            requires_rank_id: values.audience === 'RANK' ? values.requires_rank_id : undefined,
            max_total_percent: values.max_total_percent ?? undefined,
            start_date: values.valid_range?.[0] ?? undefined,
            end_date: values.valid_range?.[1] ?? undefined,
          } satisfies PostDiscountRulesBody,
        })
        message.success('Đã tạo quy tắc giảm giá')
      }
      setOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const remove = async (row: DiscountRule) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id })
      message.success(`Đã xóa quy tắc "${row.name}"`)
    } catch (err) {
      message.error(errorMessage(err, 'Không xóa được quy tắc'))
    }
  }

  const columns: TableColumnsType<DiscountRule> = [
    {
      title: 'Mã', dataIndex: 'code', width: 140,
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    { title: 'Tên', dataIndex: 'name', render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    {
      title: 'Đối tượng', dataIndex: 'audience', width: 180,
      render: (v: DiscountRuleAudience, row) => {
        const meta = AUDIENCE_META[v]
        return (
          <Space size={4}>
            {meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v}</Tag>}
            {v === 'RANK' && row.requires_rank?.name
              ? <Typography.Text code style={{ fontSize: 12 }}>{String(row.requires_rank.name)}</Typography.Text>
              : null}
          </Space>
        )
      },
    },
    { title: 'Khoảng %', key: 'percent', width: 110, align: 'right', render: (_v, row) => `${row.percent_min ?? 0}–${row.percent_max ?? 0}%` },
    { title: 'Trần tổng', dataIndex: 'max_total_percent', width: 90, align: 'right', render: (v?: number | null) => (v != null ? `${v}%` : '—') },
    {
      title: 'Xếp chồng', key: 'stack', width: 130, align: 'center',
      render: (_v, row) => <Space size={4}>{row.stackable !== false && <Tag color="cyan">Xếp chồng</Tag>}{row.once_per_customer && <Tag color="volcano">1 lần/khách</Tag>}</Space>,
    },
    {
      title: 'Trên app', dataIndex: 'show_in_app', width: 90, align: 'center',
      render: (v?: boolean) => (v !== false ? <Tag color="green">Hiện</Tag> : <Tag>Ẩn</Tag>),
    },
    {
      title: 'Hạn', key: 'validity', width: 190,
      render: (_v, row) => (row.start_date || row.end_date ? `${row.start_date ?? '...'} → ${row.end_date ?? '...'}` : 'Không giới hạn'),
    },
    {
      title: 'Trạng thái', dataIndex: 'is_active', width: 100,
      render: (v?: boolean) => (v !== false ? <Tag color="green">Đang dùng</Tag> : <Tag>Đã xóa</Tag>),
    },
    {
      title: 'Thao tác', key: 'actions', width: 150,
      render: (_v, row) => (
        <Space>
          <Can I="UPDATE" a="DISCOUNT">
            <Button size="small" onClick={() => openEditor(row)}>Sửa</Button>
          </Can>
          <Can I="DELETE" a="DISCOUNT">
            <Popconfirm title="Xóa quy tắc này?" description="Xóa mềm (is_active=false)." okText="Xóa" okButtonProps={{ danger: true }} cancelText="Hủy" onConfirm={() => void remove(row)}>
              <Button size="small" danger>Xóa</Button>
            </Popconfirm>
          </Can>
        </Space>
      ),
    },
  ]

  return (
    <Can I="READ" a="DISCOUNT" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <PageTitle>Giảm giá & Ưu đãi</PageTitle>
            <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button icon={<ReloadOutlined />} onClick={() => void rulesQuery.refetch()}>Tải lại</Button>
              <Can I="CREATE" a="DISCOUNT">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm quy tắc</Button>
              </Can>
            </Space>
            {rulesQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                title="Không tải được quy tắc giảm giá"
                description={errorMessage(rulesQuery.error)}
                action={<Button size="small" onClick={() => void rulesQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              title="Nhân viên chỉ áp được % trong khoảng của quy tắc; vượt khoảng cần quyền discount.override. Tổng % xếp chồng (gồm giảm hạng thẻ) không vượt trần của quy tắc."
            />
            <Table<DiscountRule>
              rowKey="id" loading={rulesQuery.isLoading} dataSource={rules} columns={columns}
              pagination={{ pageSize: 10 }}
            />
            <Modal
              title={editing ? `Sửa quy tắc: ${editing.name}` : 'Thêm quy tắc giảm giá'}
              open={open}
              onCancel={() => setOpen(false)}
              onOk={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              okText="Lưu" cancelText="Hủy"
              width={600}
            >
              <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]} style={{ flex: 1 }}>
                    <Input maxLength={50} placeholder="VD: RANK-VIP-10" disabled={!!editing} />
                  </Form.Item>
                  <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]} style={{ flex: 2 }}>
                    <Input maxLength={150} placeholder="VD: Ưu đãi hạng VIP" />
                  </Form.Item>
                </Space>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="audience" label="Đối tượng" rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Select options={Object.entries(AUDIENCE_META).map(([value, meta]) => ({ value, label: meta.label }))} />
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate={(p, c) => p.audience !== c.audience}>
                    {({ getFieldValue }) =>
                      getFieldValue('audience') === 'RANK' ? (
                        <Form.Item name="requires_rank_id" label="Hạng thẻ" rules={[{ required: true, message: 'Chọn hạng' }]} style={{ flex: 1 }}>
                          <Select
                            showSearch optionFilterProp="label"
                            options={ranks.map((r) => ({ value: r.id, label: r.name }))}
                            placeholder="Chọn hạng thẻ"
                          />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>
                  <Form.Item name="applies_to" label="Áp vào" rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Select options={APPLIES_TO_OPTIONS} />
                  </Form.Item>
                </Space>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="percent_min" label="% tối thiểu" rules={[{ required: true, message: 'Nhập % tối thiểu' }]} style={{ flex: 1 }}>
                    <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="percent_max" label="% tối đa" rules={[{ required: true, message: 'Nhập % tối đa' }]} style={{ flex: 1 }}>
                    <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="max_total_percent" label="Trần tổng % xếp chồng" style={{ flex: 1 }} extra="Mặc định 50%">
                    <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
                <Form.Item noStyle shouldUpdate={(p, c) => p.applies_to !== c.applies_to}>
                  {({ getFieldValue }) =>
                    getFieldValue('applies_to') === 'SERVICE' ? (
                      <Form.Item
                        name="service_ids" label="Dịch vụ áp dụng"
                        rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một dịch vụ' }]}
                      >
                        <Select
                          mode="multiple" showSearch optionFilterProp="label"
                          loading={servicesQuery.isLoading}
                          placeholder="Chọn ít nhất một dịch vụ"
                          options={services.map((service) => ({ value: service.id, label: service.title }))}
                        />
                      </Form.Item>
                    ) : null
                  }
                </Form.Item>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="stackable" label="Xếp chồng được" valuePropName="checked" style={{ flex: 1 }}>
                    <Switch />
                  </Form.Item>
                  <Form.Item name="once_per_customer" label="1 lần mỗi khách" valuePropName="checked" style={{ flex: 1 }}>
                    <Switch />
                  </Form.Item>
                  <Form.Item name="show_in_app" label="Hiện trên app" valuePropName="checked" style={{ flex: 1 }}>
                    <Switch />
                  </Form.Item>
                  <Form.Item name="is_active" label="Đang dùng" valuePropName="checked" style={{ flex: 1 }}>
                    <Switch />
                  </Form.Item>
                </Space>
                <Form.Item name="valid_range" label="Hạn áp dụng">
                  <DatePicker.RangePicker style={{ width: '100%' }} />
                </Form.Item>
              </Form>
            </Modal>
          </>
        ) : (
          <>
            <PageTitle>Giảm giá & Ưu đãi</PageTitle>
            <Alert type="warning" showIcon title="Bạn không có quyền xem quy tắc giảm giá (cần quyền discount.read)" />
          </>
        )
      }
    </Can>
  )
}
