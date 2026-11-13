import { useState } from 'react'
import { Alert, Button, Form, Modal, Table, Tabs, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, GiftOutlined, MinusCircleOutlined, PauseCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Can, useAbility } from '@casl/react'
import { useGetCardRanks } from '@/api/endpoints/membership'
import PageTitle from '../../components/base/PageTitle'
import StatCards, { type StatItem } from '../../components/base/StatCards'
import RowActionsMenu from '../../components/base/RowActionsMenu'
import ListPagination from '../../components/base/ListPagination'
import { paginateRows } from '../../utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import { getTreatmentPackages } from '@/api/endpoints/services'
import { getAcademyCourses } from '@/api/endpoints/academy'
import { getProducts } from '@/api/endpoints/products'
import {
  deleteVoucherCategory,
  getVoucherCategory,
  postVoucherCategory,
  putVoucherCategory,
  type VoucherCategory,
  type VoucherCategoryRow,
} from '@/api/custom/voucherCategories'
import VoucherModal from './components/VoucherModal'
import { CATEGORY_META } from './components/constants'

const PAGE_SIZE = 10
const CATEGORIES: VoucherCategory[] = ['treatment-package', 'academy-course', 'product']

function toRows(payload: unknown): VoucherCategoryRow[] {
  const data = pickData<any>(payload)
  if (Array.isArray(data)) return data
  return Array.isArray(data?.rows) ? data.rows : []
}

function toTargets(payload: unknown, collectionKeys: string[]) {
  const data = pickData<any>(payload)
  const list = Array.isArray(data) ? data : collectionKeys.map((key) => data?.[key]).find(Array.isArray) ?? []
  return (list as any[]).map((item) => ({
    value: String(item.id),
    label: String(item.name ?? item.title ?? item.package_name ?? item.course_name ?? 'Chưa có tên'),
  }))
}

async function loadTargets(category: VoucherCategory) {
  if (category === 'treatment-package') {
    return toTargets(await getTreatmentPackages({ page: 1, limit: 200, is_active: true }), ['rows', 'items', 'treatment_packages', 'packages'])
  }
  if (category === 'academy-course') {
    return toTargets(await getAcademyCourses({ is_active: true }), ['rows', 'items', 'courses'])
  }
  return toTargets(await getProducts({ is_active: true }), ['rows', 'items', 'products'])
}

function VoucherCategoryTab({ category }: { category: VoucherCategory }) {
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'VOUCHER')
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VoucherCategoryRow | null>(null)
  const [form] = Form.useForm()
  const meta = CATEGORY_META[category]
  const listKey = ['voucher-category', category]

  const vouchersQuery = useQuery({ queryKey: listKey, queryFn: () => getVoucherCategory(category) })
  const targetsQuery = useQuery({ queryKey: ['voucher-category-targets', category], queryFn: () => loadTargets(category) })
  const ranksQuery = useGetCardRanks({ is_active: true })
  const rows = toRows(vouchersQuery.data)
  const targets = targetsQuery.data ?? []
  const ranks = (ranksQuery.data?.responseData ?? [])
    .filter((rank) => rank.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((rank) => ({ value: rank.id, label: rank.name }))
  const createMutation = useMutation({ mutationFn: (body: Partial<VoucherCategoryRow>) => postVoucherCategory(category, body) })
  const updateMutation = useMutation({ mutationFn: ({ id, body }: { id: string; body: Partial<VoucherCategoryRow> }) => putVoucherCategory(category, id, body) })
  const hideMutation = useMutation({ mutationFn: (id: string) => deleteVoucherCategory(category, id) })

  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng voucher', value: rows.length.toLocaleString('vi-VN'), icon: <GiftOutlined />, tone: 'primary' },
    { key: 'active', label: 'Đang hoạt động', value: rows.filter((row) => row.is_active).length.toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
    { key: 'inactive', label: 'Đã tắt', value: rows.filter((row) => !row.is_active).length.toLocaleString('vi-VN'), icon: <MinusCircleOutlined />, tone: 'neutral' },
    { key: 'expired', label: 'Đã hết hạn', value: rows.filter((row) => row.end_date && dayjs(row.end_date).isBefore(dayjs(), 'day')).length.toLocaleString('vi-VN'), icon: <ClockCircleOutlined />, tone: 'neutral' },
  ]

  const openModal = (row?: VoucherCategoryRow) => {
    setEditing(row ?? null)
    form.resetFields()
    if (row) {
      form.setFieldsValue({
        ...row,
        [meta.targetField]: row[meta.targetField] ?? undefined,
        quantity_total: row.quantity_total ?? undefined,
        card_rank_id: category === 'academy-course' ? undefined : row.card_rank_id ?? undefined,
        is_loyalty: row.is_loyalty ?? false,
        discount_type: row.discount_type ?? (category === 'product' ? 'AMOUNT' : 'GIFT'),
        discount_value: Number(row.discount_value ?? 0),
        minimum_order_amount: Number(row.minimum_order_amount ?? 0),
        maximum_discount_amount: row.maximum_discount_amount == null ? undefined : Number(row.maximum_discount_amount),
        minimum_tuition: Number(row.minimum_tuition ?? 0),
        max_uses_per_student: row.max_uses_per_student ?? 1,
        start_date: row.start_date ? dayjs(row.start_date) : undefined,
        end_date: row.end_date ? dayjs(row.end_date) : undefined,
      })
    } else {
      form.setFieldsValue({ title: '', card_rank_id: undefined, is_loyalty: false, is_active: true, discount_type: category === 'treatment-package' || category === 'product' ? 'AMOUNT' : category === 'academy-course' ? 'PERCENT' : undefined, discount_value: undefined, minimum_tuition: 0, minimum_order_amount: 0, maximum_discount_amount: undefined, max_uses_per_student: 1 })
    }
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const body: Partial<VoucherCategoryRow> = {
        ...values,
        [meta.targetField]: values[meta.targetField] || null,
        ...(category !== 'academy-course' ? { card_rank_id: values.card_rank_id || null } : {}),
        is_loyalty: Boolean(values.is_loyalty),
        quantity_total: values.quantity_total ?? null,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, body })
        message.success('Đã cập nhật voucher')
      } else {
        await createMutation.mutateAsync(body)
        message.success('Đã thêm voucher')
      }
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: listKey })
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err, 'Không thể lưu voucher'))
    }
  }

  // Tắt voucher = ngừng phát hành (is_active=false qua PUT); DELETE riêng là xóa mềm is_deleted.
  const hide = async (row: VoucherCategoryRow) => {
    try {
      await updateMutation.mutateAsync({ id: row.id, body: { is_active: false } })
      message.success('Đã tắt voucher; voucher vẫn còn trong danh sách quản trị')
      await queryClient.invalidateQueries({ queryKey: listKey })
    } catch (err) {
      message.error(errorMessage(err, 'Không thể tắt voucher'))
    }
  }

  const remove = async (row: VoucherCategoryRow) => {
    try {
      await hideMutation.mutateAsync(row.id)
      message.success('Đã xóa voucher')
      await queryClient.invalidateQueries({ queryKey: listKey })
    } catch (err) {
      message.error(errorMessage(err, 'Không thể xóa voucher'))
    }
  }

  const columns: TableColumnsType<VoucherCategoryRow> = [
    { title: 'Tên voucher', dataIndex: 'title', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    ...(category === 'academy-course' || category === 'treatment-package' || category === 'product' ? [{
      title: 'Ưu đãi', key: 'benefit', width: 190,
      render: (_value: unknown, row: VoucherCategoryRow) => {
        if (row.discount_type === 'GIFT') return <Tag color="purple">Quà tặng / quyền lợi</Tag>
        if (row.discount_type === 'AMOUNT') return `Giảm ${Number(row.discount_value ?? 0).toLocaleString('vi-VN')} đ`
        return `Giảm ${Number(row.discount_value ?? 0).toLocaleString('vi-VN')}%`
      },
    }, ...(category === 'academy-course' ? [{
      title: 'Điều kiện', key: 'conditions', width: 230,
      render: (_value: unknown, row: VoucherCategoryRow) => (
        <Typography.Text type="secondary">
          {Number(row.minimum_tuition ?? 0) > 0 ? `Học phí từ ${Number(row.minimum_tuition).toLocaleString('vi-VN')} đ` : 'Không yêu cầu học phí tối thiểu'}
          {` · Tối đa ${row.max_uses_per_student ?? 1} lần/học viên`}
        </Typography.Text>
      ),
    }] : category === 'product' ? [{
      title: 'Điều kiện', key: 'conditions', width: 230,
      render: (_value: unknown, row: VoucherCategoryRow) => (
        <Typography.Text type="secondary">
          {Number(row.minimum_order_amount ?? 0) > 0 ? `Đơn từ ${Number(row.minimum_order_amount).toLocaleString('vi-VN')} đ` : 'Không yêu cầu tối thiểu'}
          {row.discount_type === 'PERCENT' && row.maximum_discount_amount != null ? ` · Giảm tối đa ${Number(row.maximum_discount_amount).toLocaleString('vi-VN')} đ` : ''}
        </Typography.Text>
      ),
    }] : [])] : []),
    { title: 'Áp dụng cho', dataIndex: 'target_name', width: 220, render: (value?: string) => value || `Tất cả ${meta.label.replace('Voucher ', '').toLowerCase()}` },
    ...(category !== 'academy-course' ? [{ title: 'Hạng khách', dataIndex: 'card_rank_name', width: 150, render: (value?: string) => value ? <Tag color="gold">{value}</Tag> : <Tag>Tất cả hạng</Tag> }] : []),
    { title: 'Đối tượng', dataIndex: 'is_loyalty', width: 150, render: (value: boolean) => value ? <Tag color="magenta">Khách cũ</Tag> : <Tag>Mọi khách</Tag> },
    { title: 'Số lượng', width: 120, render: (_value, row) => row.quantity_total == null ? 'Không giới hạn' : `${Math.max(Number(row.quantity_total) - Number(row.quantity_given ?? 0), 0)}/${row.quantity_total}` },
    { title: 'Bắt đầu', dataIndex: 'start_date', width: 120, render: (value?: string) => value ? dayjs(value).format('DD/MM/YYYY') : '—' },
    { title: 'Kết thúc', dataIndex: 'end_date', width: 120, render: (value?: string) => value ? dayjs(value).format('DD/MM/YYYY') : '—' },
    { title: 'Trạng thái', dataIndex: 'is_active', width: 130, render: (value: boolean, row) => row.end_date && dayjs(row.end_date).isBefore(dayjs(), 'day') ? <Tag>Đã hết hạn</Tag> : value ? <Tag color="green">Hoạt động</Tag> : <Tag>Tắt</Tag> },
    ...(canUpdate ? [{
      title: 'Hành động', key: 'actions', align: 'center' as const, width: 110, fixed: 'right' as const,
      render: (_value: unknown, row: VoucherCategoryRow) => (
        <RowActionsMenu
          items={[
            { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
            ...(row.is_active ? [{ key: 'hide', icon: <PauseCircleOutlined />, label: 'Tắt voucher' }] : []),
            { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true },
          ]}
          onSelect={(key) => {
            if (key === 'edit') openModal(row)
            if (key === 'hide') Modal.confirm({ title: 'Tắt voucher này?', content: 'Voucher ngừng phát hành nhưng vẫn còn trong danh sách; có thể bật lại trong modal Sửa.', okText: 'Tắt voucher', cancelText: 'Hủy', onOk: () => hide(row) })
            if (key === 'delete') Modal.confirm({ title: 'Xóa voucher này?', content: 'Xóa mềm (is_deleted). Không xóa được voucher đã phát hành cho khách hoặc đang cấu hình ở quà/vòng quay.', okText: 'Xóa', okButtonProps: { danger: true }, cancelText: 'Hủy', onOk: () => remove(row) })
          }}
        />
      ),
    }] : []),
  ]

  return (
    <>
      <StatCards items={statItems} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0' }}>
        <Can I="UPDATE" a="VOUCHER">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm voucher</Button>
        </Can>
      </div>
      {vouchersQuery.isError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Không tải được danh sách voucher" description={errorMessage(vouchersQuery.error)} action={<Button size="small" onClick={() => void vouchersQuery.refetch()}>Thử lại</Button>} />}
      {targetsQuery.isError && <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={`Không tải được danh sách ${meta.label.replace('Voucher ', '').toLowerCase()}`} description={errorMessage(targetsQuery.error)} />}
      <Table<VoucherCategoryRow>
        rowKey="id"
        loading={vouchersQuery.isLoading}
        dataSource={paginateRows(rows, page, PAGE_SIZE)}
        pagination={false}
        columns={columns}
        scroll={{ x: 1000 }}
      />
      <ListPagination page={page} limit={PAGE_SIZE} total={rows.length} onChange={setPage} noun="voucher" />
      <VoucherModal
        form={form}
        open={open}
        category={category}
        targets={targets}
        ranks={ranks}
        editing={editing}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      />
    </>
  )
}

export default function Vouchers() {
  const [activeTab, setActiveTab] = useState<VoucherCategory>('treatment-package')
  return (
    <>
      <PageTitle subtitle="Mỗi loại voucher được quản lý riêng theo gói liệu trình, khóa học hoặc sản phẩm">Voucher</PageTitle>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key as VoucherCategory) }}
        items={CATEGORIES.map((category) => ({
          key: category,
          label: CATEGORY_META[category].label,
          children: <VoucherCategoryTab category={category} />,
        }))}
      />
    </>
  )
}
