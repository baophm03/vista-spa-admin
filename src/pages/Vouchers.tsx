import { useState } from 'react'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, GiftOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '../components/base/PageTitle'
import StatCards, { type StatItem } from '../components/base/StatCards'
import RowActionsMenu from '../components/base/RowActionsMenu'
import ListPagination from '../components/base/ListPagination'
import { paginateRows } from '../utils/listTable'
import { useDeleteVouchersId, useGetVouchers, usePostVouchers, usePutVouchersId } from '../api/endpoints/vouchers'
import { Can, useAbility } from '@casl/react'

interface VoucherRow {
  id: string
  title: string
  required_points?: number
  type?: number
  start_date?: string
  end_date?: string
  is_active?: boolean
}

/** type theo contract BE: hạng thẻ được áp dụng (0=Tất cả, 1=Silver, 2=Gold, 3=Diamond, 4=VIP) */
const TYPE_LABEL: Record<number, string> = {
  0: 'Tất cả hạng',
  1: 'Silver',
  2: 'Gold',
  3: 'Diamond',
  4: 'VIP',
}

export default function Vouchers() {
  const canUpdate = useAbility().can('UPDATE', 'VOUCHER')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VoucherRow | null>(null)
  const [form] = Form.useForm()
  const vouchersQuery = useGetVouchers({ currentPage: 1, pageSize: 100 })
  const createMutation = usePostVouchers()
  const updateMutation = usePutVouchersId()
  const deleteMutation = useDeleteVouchersId()
  const responseData = (vouchersQuery.data?.responseData ?? {}) as { rows?: VoucherRow[] }
  const rows = responseData.rows ?? []
  const loading = vouchersQuery.isLoading

  // Thống kê đầu trang — tính trên toàn bộ rows đã tải (query lấy pageSize 100)
  const activeVoucherCount = rows.filter((row) => !!row.is_active).length
  const expiredVoucherCount = rows.filter((row) => row.end_date && dayjs(row.end_date).isBefore(dayjs(), 'day')).length
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng voucher', value: rows.length.toLocaleString('vi-VN'), icon: <GiftOutlined />, tone: 'primary' },
    { key: 'active', label: 'Hoạt động', value: activeVoucherCount.toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
    { key: 'inactive', label: 'Đã tắt', value: (rows.length - activeVoucherCount).toLocaleString('vi-VN'), icon: <MinusCircleOutlined />, tone: 'neutral' },
    { key: 'expired', label: 'Đã hết hạn', value: expiredVoucherCount.toLocaleString('vi-VN'), icon: <ClockCircleOutlined />, tone: 'neutral' },
  ]

  const openModal = (voucher?: VoucherRow) => {
    setEditing(voucher ?? null)
    form.setFieldsValue(
      voucher
        ? {
          ...voucher,
          start_date: voucher.start_date ? dayjs(voucher.start_date) : undefined,
          end_date: voucher.end_date ? dayjs(voucher.end_date) : undefined,
        }
        : { title: '', required_points: 0, type: 0, is_active: true },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const payload = {
      ...values,
      start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
      end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload })
        message.success('Đã cập nhật voucher')
      } else {
        await createMutation.mutateAsync({ data: payload })
        message.success('Đã thêm voucher')
      }
      setOpen(false)
      await vouchersQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể lưu voucher')
    }
  }

  const remove = async (row: VoucherRow) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id })
      message.success('Đã xóa voucher')
      await vouchersQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể xóa voucher')
    }
  }

  return (
    <>
      <StatCards items={statItems} />
      <PageTitle
        subtitle="Voucher ưu đãi phát hành cho khách hàng"
        extra={
          <Can I="UPDATE" a="VOUCHER">
            <Button className="max-sm:w-full" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm voucher
            </Button>
          </Can>
        }
      >
        Voucher & Quà tặng
      </PageTitle>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={paginateRows(rows, page, 10)}
        pagination={false}
        columns={[
          {
            title: 'Tên chương trình',
            dataIndex: 'title',
            render: (v) => <Typography.Text strong>{v}</Typography.Text>,
          },
          { title: 'Áp dụng hạng', dataIndex: 'type', width: 140, render: (v: number) => <Tag color="gold">{TYPE_LABEL[v] ?? v}</Tag> },
          {
            title: 'Điểm đổi',
            dataIndex: 'required_points',
            width: 110,
            render: (v) => Number(v ?? 0).toLocaleString('vi-VN'),
          },
          {
            title: 'Bắt đầu',
            dataIndex: 'start_date',
            width: 110,
            render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
          },
          {
            title: 'Kết thúc',
            dataIndex: 'end_date',
            width: 110,
            render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
          },
          {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            width: 110,
            render: (v) => (v ? <Tag color="green">Hoạt động</Tag> : <Tag>Tắt</Tag>),
          },
          ...(canUpdate ? [{
            title: 'Hành động', align: 'center' as const,
            key: 'actions',
            width: 120,
            fixed: 'right' as const,
            render: (_: unknown, row: VoucherRow) => (
              <RowActionsMenu
                items={[
                  { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
                  { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true },
                ]}
                onSelect={(key) => {
                  if (key === 'edit') openModal(row)
                  else if (key === 'delete') {
                    Modal.confirm({
                      title: 'Xóa voucher này?',
                      okText: 'Xóa',
                      okButtonProps: { danger: true },
                      cancelText: 'Hủy',
                      onOk: () => remove(row),
                    })
                  }
                }}
              />
            ),
          }] : []),
        ]}
      />
      <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="voucher" />

      <Modal
        title={editing ? 'Sửa voucher' : 'Thêm voucher'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="Tên chương trình" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="VD: Giảm 50k cho hóa đơn đầu" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="type" label="Áp dụng hạng" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value: Number(value), label }))} />
            </Form.Item>
            <Form.Item name="required_points" label="Điểm đổi" rules={[{ required: true, message: 'Nhập điểm' }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="start_date" label="Bắt đầu" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="end_date" label="Kết thúc" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
          <Form.Item name="is_active" label="Hoạt động" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
