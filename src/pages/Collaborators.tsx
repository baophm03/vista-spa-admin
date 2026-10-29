import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { BarChartOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { Collaborator } from '@/api/models/collaborator'
import {
  getGetCollaboratorsQueryKey,
  useDeleteCollaboratorsId,
  useGetCollaborators,
  useGetCollaboratorsIdSummary,
  usePostCollaborators,
  usePutCollaboratorsId,
} from '@/api/endpoints/admin'
import type { PostCollaboratorsBody } from '@/api/models'
import type { GetCollaboratorsParams } from '@/api/models/getCollaboratorsParams'

const COLLABORATOR_TYPES = ['STAFF', 'CUSTOMER', 'EXTERNAL']

const TYPE_META: Record<string, { label: string; color: string }> = {
  STAFF: { label: 'Nhân viên', color: 'blue' },
  CUSTOMER: { label: 'Khách hàng', color: 'green' },
  EXTERNAL: { label: 'Bên ngoài', color: 'orange' },
}

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

type CollaboratorRow = Collaborator & { referral_count?: number }

function CollaboratorReportDrawer({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const summaryQuery = useGetCollaboratorsIdSummary(id, { query: { enabled: open && !!id } })
  const summary = pickData<{ referral_count?: number; total_package_value?: number; total_commission?: number }>(
    summaryQuery.data,
  )

  return (
    <Drawer title="Báo cáo cộng tác viên" width={420} open={open} onClose={onClose}>
      {summaryQuery.isLoading ? (
        <Spin />
      ) : summaryQuery.isError ? (
        <Alert
          type="error" showIcon
          title="Không tải được báo cáo"
          description={errorMessage(summaryQuery.error)}
          action={<Button size="small" onClick={() => void summaryQuery.refetch()}>Thử lại</Button>}
        />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert type="info" showIcon title="Số liệu tổng hợp theo toàn bộ lịch sử giới thiệu của CTV." />
          <div>
            <Typography.Text type="secondary">Số khách được giới thiệu</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{(summary?.referral_count ?? 0).toLocaleString('vi-VN')}</div>
          </div>
          <div>
            <Typography.Text type="secondary">Tổng giá trị gói điều trị</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{formatVnd(summary?.total_package_value)}</div>
          </div>
          <div>
            <Typography.Text type="secondary">Tổng hoa hồng (đang ACTIVE)</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#389e0d' }}>{formatVnd(summary?.total_commission)}</div>
          </div>
        </Space>
      )}
    </Drawer>
  )
}

export default function Collaborators() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CollaboratorRow | null>(null)
  const [reportRow, setReportRow] = useState<CollaboratorRow | null>(null)
  const [listFilters, setListFilters] = useState<GetCollaboratorsParams>({})
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const listQuery = useGetCollaborators(listFilters)
  const rows = useMemo(() => {
    const raw = pickData<unknown>(listQuery.data)
    const list = (Array.isArray(raw) ? raw : (raw as { rows?: CollaboratorRow[] } | null)?.rows ?? []) as CollaboratorRow[]
    return list
  }, [listQuery.data])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCollaboratorsQueryKey() })
  }

  const createMutation = usePostCollaborators({ mutation: { onSuccess: invalidate } })
  const updateMutation = usePutCollaboratorsId({ mutation: { onSuccess: invalidate } })
  const deleteMutation = useDeleteCollaboratorsId({ mutation: { onSuccess: invalidate } })

  const openEditor = (row?: CollaboratorRow) => {
    setEditing(row ?? null)
    form.setFieldsValue(
      row
        ? {
            name: row.name,
            phone: row.phone ?? '',
            referral_code: row.referral_code,
            type: row.type ?? undefined,
            commission_percent: row.commission_percent ?? undefined,
            note: row.note ?? '',
            is_active: row.is_active !== false,
          }
        : { name: '', phone: '', referral_code: '', type: undefined, commission_percent: undefined, note: '', is_active: true },
    )
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto: PostCollaboratorsBody = {
        name: values.name,
        phone: values.phone || undefined,
        referral_code: values.referral_code,
        type: values.type || undefined,
        commission_percent: values.commission_percent ?? null,
        note: values.note || undefined,
        is_active: values.is_active !== false,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: dto })
        message.success('Đã cập nhật cộng tác viên')
      } else {
        await createMutation.mutateAsync({ data: dto })
        message.success('Đã tạo cộng tác viên')
      }
      setOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const remove = async (row: CollaboratorRow) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id })
      message.success(`Đã ngừng hoạt động CTV "${row.name}"`)
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const columns: TableColumnsType<CollaboratorRow> = [
    {
      title: 'Mã giới thiệu', dataIndex: 'referral_code', width: 140,
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: 'Tên', dataIndex: 'name',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    { title: 'SĐT', dataIndex: 'phone', width: 140, render: (v?: string) => v || '—' },
    {
      title: 'Loại', dataIndex: 'type', width: 120,
      render: (v?: string) => {
        const meta = v ? TYPE_META[v] : undefined
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v || '—'}</Tag>
      },
    },
    { title: 'Khách giới thiệu', dataIndex: 'referral_count', width: 135, align: 'right', render: (v?: number) => Number(v ?? 0).toLocaleString('vi-VN') },
    { title: '% hoa hồng tham khảo', dataIndex: 'commission_percent', width: 155, align: 'right', render: (v?: number | null) => v != null ? `${Number(v)}%` : '—' },
    {
      title: 'Ghi chú', dataIndex: 'note', ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: 'Trạng thái', dataIndex: 'is_active', width: 110,
      render: (v?: boolean) => (v !== false ? <Tag color="green">Đang hoạt động</Tag> : <Tag>Đã ẩn</Tag>),
    },
    {
      title: 'Thao tác', key: 'actions', width: 240,
      render: (_v, row) => <Space>
        <Button size="small" icon={<BarChartOutlined />} onClick={() => setReportRow(row)}>Báo cáo</Button>
        <Can I="UPDATE" a="COLLABORATOR">
          <Button size="small" onClick={() => openEditor(row)}>Sửa</Button>
        </Can>
        <Can I="DELETE" a="COLLABORATOR">
          <Popconfirm
            title="Ngừng hoạt động CTV này?"
            description="Xóa mềm (đặt is_active = false)."
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
    <Can I="READ" a="COLLABORATOR" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <PageTitle>Cộng tác viên</PageTitle>
            <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Input.Search
                allowClear placeholder="Tìm tên, SĐT, mã giới thiệu" style={{ width: 260 }}
                onSearch={(q) => setListFilters((current) => ({ ...current, q: q.trim() || undefined }))}
                onChange={(event) => { if (!event.target.value) setListFilters((current) => ({ ...current, q: undefined })) }}
              />
              <Select
                allowClear placeholder="Loại CTV" style={{ width: 160 }}
                value={listFilters.type}
                options={COLLABORATOR_TYPES.map((type) => ({ value: type, label: TYPE_META[type].label }))}
                onChange={(type) => setListFilters((current) => ({ ...current, type }))}
              />
              <Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>Tải lại</Button>
              <Can I="CREATE" a="COLLABORATOR">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm CTV</Button>
              </Can>
            </Space>
            {listQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                title="Không tải được danh sách cộng tác viên"
                description={errorMessage(listQuery.error)}
                action={<Button size="small" onClick={() => void listQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <Table<CollaboratorRow>
              rowKey="id" loading={listQuery.isLoading} dataSource={rows} columns={columns}
              pagination={{ pageSize: 10 }}
            />
            <Modal
              title={editing ? `Sửa CTV: ${editing.name}` : 'Thêm cộng tác viên'}
              open={open}
              onCancel={() => setOpen(false)}
              onOk={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              okText="Lưu" cancelText="Hủy"
            >
              <Form form={form} layout="vertical">
                <Form.Item
                  name="referral_code" label="Mã giới thiệu"
                  rules={[{ required: true, message: 'Nhập mã giới thiệu' }]}
                  extra={editing ? 'Không thể đổi mã nếu mã này đã được dùng trong lịch sử giới thiệu' : undefined}
                >
                  <Input maxLength={50} placeholder="VD: CTV001" disabled={!!editing && Number(editing.referral_use_count ?? editing.referral_count ?? 0) > 0} />
                </Form.Item>
                <Form.Item name="name" label="Tên CTV" rules={[{ required: true, message: 'Nhập tên CTV' }]}>
                  <Input maxLength={255} />
                </Form.Item>
                <Space style={{ display: 'flex' }} align="start">
                  <Form.Item name="phone" label="SĐT" style={{ flex: 1 }}>
                    <Input maxLength={20} />
                  </Form.Item>
                  <Form.Item name="type" label="Loại" style={{ flex: 1 }}>
                    <Select allowClear placeholder="Chọn loại" options={COLLABORATOR_TYPES.map((t) => ({ value: t, label: TYPE_META[t]?.label ?? t }))} />
                  </Form.Item>
                </Space>
                <Form.Item name="commission_percent" label="% hoa hồng tham khảo" extra="Chỉ gợi ý khi nhập tay trong module Hoa hồng; không tự động tính.">
                  <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="note" label="Ghi chú">
                  <Input.TextArea rows={3} maxLength={2000} />
                </Form.Item>
                {editing && (
                  <Form.Item name="is_active" label="Trạng thái" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: true, label: 'Đang hoạt động' },
                        { value: false, label: 'Đã ẩn' },
                      ]}
                    />
                  </Form.Item>
                )}
              </Form>
            </Modal>
            {reportRow && (
              <CollaboratorReportDrawer
                id={reportRow.id}
                open={!!reportRow}
                onClose={() => setReportRow(null)}
              />
            )}
          </>
        ) : (
          <>
            <PageTitle>Cộng tác viên</PageTitle>
            <Alert type="warning" showIcon title="Bạn không có quyền xem danh sách cộng tác viên (cần quyền collaborator.read)" />
          </>
        )
      }
    </Can>
  )
}
