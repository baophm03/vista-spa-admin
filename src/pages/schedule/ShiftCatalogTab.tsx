import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { Alert, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, TimePicker, message } from 'antd'
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { errorMessage, pickData } from '@/api/helpers'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import { paginateRows } from '@/utils/listTable'
import {
  deleteShiftTemplatesId,
  getGetShiftTemplatesQueryKey,
  postShiftTemplates,
  putShiftTemplatesId,
  useGetShiftTemplates,
} from '@/api/endpoints/staff'
import type { ShiftTemplate } from './types'
import type { SchedulePageData } from './types'

interface Props extends SchedulePageData { loadingShared: boolean }
const ALL_BRANCHES = '__all_branches__'

export default function ShiftCatalogTab({ branches, access, loadingShared }: Props) {
  const queryClient = useQueryClient()
  const [branchFilter, setBranchFilter] = useState<string>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ShiftTemplate | null>(null)
  const [page, setPage] = useState(1)
  const [form] = Form.useForm()

  const templatesQuery = useGetShiftTemplates(branchFilter ? { branch_id: branchFilter } : {})
  const rows = (pickData<ShiftTemplate[] | undefined>(templatesQuery.data) ?? []) as ShiftTemplate[]
  const error = templatesQuery.isError ? errorMessage(templatesQuery.error) : ''

  const reload = useCallback(
    () => queryClient.invalidateQueries({ queryKey: getGetShiftTemplatesQueryKey() }),
    [queryClient],
  )

  const openForm = (row?: ShiftTemplate) => {
    setEditing(row ?? null)
    form.setFieldsValue(row ? {
      name: row.name,
      start_time: dayjs(`2000-01-01T${row.start_time}`),
      end_time: dayjs(`2000-01-01T${row.end_time}`),
    } : { name: '', start_time: dayjs('2000-01-01T08:00:00'), end_time: dayjs('2000-01-01T12:00:00'), branch_id: branchFilter || ALL_BRANCHES })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const start = values.start_time as Dayjs
    const end = values.end_time as Dayjs
    // So sánh theo giờ trong ngày: prefill gắn ngày 2000-01-01 nhưng TimePicker trả về
    // ngày hiện tại khi người dùng chọn — so nguyên timestamp sẽ sai lệch
    const minuteOfDay = (d: Dayjs) => d.hour() * 60 + d.minute()
    if (!start || !end || minuteOfDay(start) >= minuteOfDay(end)) {
      form.setFields([{ name: 'end_time', errors: ['Giờ kết thúc phải sau giờ bắt đầu'] }])
      return
    }
    const dto = {
      name: String(values.name).trim(),
      start_time: start.format('HH:mm:ss'),
      end_time: end.format('HH:mm:ss'),
      ...(!editing ? { branch_id: values.branch_id === ALL_BRANCHES ? null : values.branch_id } : {}),
    }
    try {
      if (editing) await putShiftTemplatesId(editing.id, dto)
      else await postShiftTemplates(dto)
      message.success(editing ? 'Đã cập nhật ca' : 'Đã tạo ca')
      setOpen(false)
      await reload()
    } catch (err) { message.error(errorMessage(err)) }
  }

  const setActive = async (row: ShiftTemplate, is_active: boolean) => {
    try {
      if (is_active) await putShiftTemplatesId(row.id, { is_active: true })
      else await deleteShiftTemplatesId(row.id)
      message.success(is_active ? 'Đã bật lại ca' : 'Đã ẩn ca')
      await reload()
    } catch (err) { message.error(errorMessage(err)) }
  }

  const columns = [
    { title: 'Tên ca', dataIndex: 'name', key: 'name', render: (value: string) => <strong>{value}</strong> },
    { title: 'Thời gian', key: 'time', render: (_: unknown, row: ShiftTemplate) => `${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}` },
    { title: 'Áp dụng', key: 'branch', render: (_: unknown, row: ShiftTemplate) => row.branch_id ? branches.find((branch) => branch.id === row.branch_id)?.name || 'Cơ sở' : 'Mọi cơ sở' },
    { title: 'Trạng thái', dataIndex: 'is_active', key: 'status', render: (value: boolean) => <Tag color={value === false ? 'default' : 'green'}>{value === false ? 'Đã ẩn' : 'Đang dùng'}</Tag> },
    ...(access.isAdmin ? [{ title: 'Thao tác', align: 'center' as const, key: 'actions', width: 180, render: (_: unknown, row: ShiftTemplate) => <Space>
      <Button icon={<EditOutlined />} size="small" onClick={() => openForm(row)}>Sửa</Button>
      {row.is_active === false
        ? <Button size="small" onClick={() => void setActive(row, true)}>Bật lại</Button>
        : <Popconfirm title="Ẩn ca này?" description="Không thể ẩn nếu lịch KTV còn đang dùng ca." okText="Ẩn ca" cancelText="Hủy" onConfirm={() => void setActive(row, false)}><Button size="small" danger>Ẩn</Button></Popconfirm>}
    </Space> }] : []),
  ]

  return <div>
    <Space wrap style={{ marginBottom: 16 }}>
      {access.isAdmin && <Select allowClear placeholder="Tất cả cơ sở" style={{ width: 190 }} value={branchFilter} onChange={(value) => { setBranchFilter(value); setPage(1) }} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />}
      {access.isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()}>Thêm ca</Button>}
    </Space>
    {!!error && <Alert type="error" showIcon message="Không tải được danh mục ca" description={error} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => { setPage(1); void templatesQuery.refetch() }}>Thử lại</Button>} style={{ marginBottom: 16 }} />}
    <Table<ShiftTemplate>
      className="desktop-only"
      rowKey="id" size="middle" pagination={false}
      loading={loadingShared || templatesQuery.isLoading} dataSource={paginateRows(rows, page, 10)} columns={columns}
      locale={{ emptyText: <TableEmpty description="Chưa có ca làm nào được cấu hình" /> }}
    />
    <MobileCards
      rows={paginateRows(rows, page, 10)}
      rowKey={(row) => row.id}
      loading={loadingShared || templatesQuery.isLoading}
      emptyText="Chưa có ca làm nào được cấu hình"
      renderCard={(row) => (
        <>
          <div className="mobile-card-head">
            <div className="mobile-card-title">{row.name}</div>
            <Tag color={row.is_active === false ? 'default' : 'green'}>{row.is_active === false ? 'Đã ẩn' : 'Đang dùng'}</Tag>
          </div>
          <div className="mobile-card-rows">
            <MobileCardRow label="Thời gian" value={`${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}`} />
            <MobileCardRow label="Áp dụng" value={row.branch_id ? branches.find((branch) => branch.id === row.branch_id)?.name || 'Cơ sở' : 'Mọi cơ sở'} />
          </div>
          {access.isAdmin && (
            <div className="mobile-card-actions">
              <Button icon={<EditOutlined />} size="small" onClick={() => openForm(row)}>Sửa</Button>
              {row.is_active === false
                ? <Button size="small" onClick={() => void setActive(row, true)}>Bật lại</Button>
                : <Popconfirm title="Ẩn ca này?" description="Không thể ẩn nếu lịch KTV còn đang dùng ca." okText="Ẩn ca" cancelText="Hủy" onConfirm={() => void setActive(row, false)}><Button size="small" danger>Ẩn</Button></Popconfirm>}
            </div>
          )}
        </>
      )}
    />
    <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="ca làm việc" />

    <Modal title={editing ? 'Sửa ca làm' : 'Tạo ca làm'} open={open} onCancel={() => setOpen(false)} onOk={() => void submit()} okText="Lưu" cancelText="Hủy" destroyOnHidden>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Tên ca" rules={[{ required: true, whitespace: true, message: 'Nhập tên ca' }]}><Input maxLength={100} placeholder="Ví dụ: Ca sáng" /></Form.Item>
        <Space size={16} style={{ display: 'flex' }}>
          <Form.Item name="start_time" label="Bắt đầu" rules={[{ required: true, message: 'Chọn giờ bắt đầu' }]} style={{ flex: 1 }}><TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="end_time" label="Kết thúc" rules={[{ required: true, message: 'Chọn giờ kết thúc' }]} style={{ flex: 1 }}><TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} /></Form.Item>
        </Space>
        {!editing && <Form.Item name="branch_id" label="Cơ sở áp dụng" rules={[{ required: true, message: 'Chọn phạm vi áp dụng' }]}>
          <Select options={[{ value: ALL_BRANCHES, label: 'Mọi cơ sở' }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
        </Form.Item>}
        {!editing && <Alert type="info" showIcon message="Giờ mẫu là giá trị khởi tạo; hãy chỉnh theo jam vận hành đã được cơ sở xác nhận." />}
      </Form>
    </Modal>
  </div>
}