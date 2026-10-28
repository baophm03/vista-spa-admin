import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import CustomFieldFormItems, { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import { errorMessage, pickData } from '@/api/helpers'
import type { AcademyCourse } from '@/api/models/academyCourse'
import type { Branch } from '@/api/models/branch'
import {
  getGetAcademyCoursesQueryKey,
  useDeleteAcademyCoursesId,
  useGetAcademyCourses,
  usePostAcademyCourses,
  usePutAcademyCoursesId,
} from '@/api/endpoints/academy'
import { useGetBranches } from '@/api/endpoints/branches'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { Can } from '@casl/react'
import { useState } from 'react'
import { useBrandCurrency } from '@/themeRuntime'

type CourseFormValues = Omit<AcademyCourse, 'id' | 'created_at' | 'updated_at' | 'custom_fields' | 'start_date' | 'end_date'> & {
  start_date?: Dayjs | null
  end_date?: Dayjs | null
  custom_fields?: Record<string, unknown>
}

const CATEGORY_OPTIONS = [
  { value: 'SKINCARE', label: 'Chăm sóc da' },
  { value: 'ACNE', label: 'Điều trị mụn' },
  { value: 'MELASMA', label: 'Điều trị nám' },
  { value: 'SCAR', label: 'Điều trị sẹo' },
  { value: 'OTHER', label: 'Khác' },
]
const LEVEL_OPTIONS = [
  { value: 'BASIC', label: 'Cơ bản' },
  { value: 'ADVANCED', label: 'Nâng cao' },
]

export default function AcademyCourses() {
  const queryClient = useQueryClient()
  const { format: formatMoney } = useBrandCurrency()
  const courseFields = useCustomFieldDefinitions('COURSE')
  const coursesQuery = useGetAcademyCourses()
  const branchesQuery = useGetBranches()
  const rows = (pickData<AcademyCourse[]>(coursesQuery.data) ?? []) as AcademyCourse[]
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AcademyCourse | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<CourseFormValues>()
  const createMutation = usePostAcademyCourses()
  const updateMutation = usePutAcademyCoursesId()
  const deleteMutation = useDeleteAcademyCoursesId()

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetAcademyCoursesQueryKey() })
  }

  const openEditor = (row?: AcademyCourse) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(row ? {
      ...row,
      start_date: row.start_date ? dayjs(row.start_date) : undefined,
      end_date: row.end_date ? dayjs(row.end_date) : undefined,
      custom_fields: row.custom_fields ?? {},
    } : {
      code: '',
      name: '',
      category: 'OTHER',
      level: 'BASIC',
      tuition: 0,
      is_active: true,
      custom_fields: {},
    })
    setOpen(true)
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const dto = {
        ...values,
        code: values.code.trim(),
        name: values.name.trim(),
        start_date: values.start_date?.format('YYYY-MM-DD') ?? null,
        end_date: values.end_date?.format('YYYY-MM-DD') ?? null,
        custom_fields: normalizeCustomFieldValues(courseFields, values.custom_fields ?? {}, editing?.custom_fields ?? {}),
      }
      if (editing) await updateMutation.mutateAsync({ id: editing.id, data: { ...editing, ...dto } as never })
      else await createMutation.mutateAsync({ data: dto as never })
      message.success(editing ? 'Đã cập nhật khóa học' : 'Đã tạo khóa học')
      setOpen(false)
      await reload()
    } catch (error) {
      if ((error as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: AcademyCourse) => {
    try {
      if (row.is_active) await deleteMutation.mutateAsync({ id: row.id })
      else await updateMutation.mutateAsync({ id: row.id, data: { ...row, is_active: true } as never })
      message.success(row.is_active ? 'Đã ẩn khóa học' : 'Đã mở khóa học')
      await reload()
    } catch (error) {
      message.error(errorMessage(error))
    }
  }

  return (
    <>
      <PageTitle>Khóa học đào tạo</PageTitle>
      {coursesQuery.isError && <Alert type="error" showIcon message="Không tải được danh sách khóa học" description={errorMessage(coursesQuery.error)} style={{ marginBottom: 16 }} />}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Can I="CREATE" a="ACADEMY"><Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm khóa học</Button></Can>
      </div>
      <Table<AcademyCourse>
        rowKey="id"
        loading={coursesQuery.isLoading}
        dataSource={rows}
        columns={[
          { title: 'Mã khóa', dataIndex: 'code' },
          { title: 'Tên khóa học', dataIndex: 'name' },
          { title: 'Danh mục', dataIndex: 'category', render: (value: string) => CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value },
          { title: 'Trình độ', dataIndex: 'level', render: (value: string) => LEVEL_OPTIONS.find((item) => item.value === value)?.label ?? value },
          { title: 'Học phí', dataIndex: 'tuition', render: (value: number) => formatMoney(value) },
          { title: 'Trạng thái', dataIndex: 'is_active', render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? 'Đang mở' : 'Đã ẩn'}</Tag> },
          { title: '', key: 'actions', render: (_: unknown, row: AcademyCourse) => (
            <Space>
              <Can I="UPDATE" a="ACADEMY"><Button size="small" onClick={() => openEditor(row)}>Sửa</Button></Can>
              <Can I={row.is_active ? 'DELETE' : 'UPDATE'} a="ACADEMY" passThrough>
                {(allowed) => allowed ? <Popconfirm title={row.is_active ? 'Ẩn khóa học này?' : 'Mở lại khóa học này?'} okText={row.is_active ? 'Ẩn' : 'Mở'} cancelText="Hủy" onConfirm={() => void toggleActive(row)}>
                  <Button size="small" type="link">{row.is_active ? 'Ẩn' : 'Mở lại'}</Button>
                </Popconfirm> : null}
              </Can>
            </Space>
          ) },
        ]}
      />
      <Modal
        title={editing ? 'Sửa khóa học' : 'Thêm khóa học'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="code" label="Mã khóa học" rules={[{ required: true, whitespace: true, message: 'Nhập mã khóa học' }]}>
            <Input disabled={!!editing} maxLength={50} />
          </Form.Item>
          <Form.Item name="name" label="Tên khóa học" rules={[{ required: true, whitespace: true, message: 'Nhập tên khóa học' }]}>
            <Input maxLength={255} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start" wrap>
            <Form.Item name="category" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục' }]} style={{ minWidth: 200 }}>
              <Select options={CATEGORY_OPTIONS} />
            </Form.Item>
            <Form.Item name="level" label="Trình độ" rules={[{ required: true }]} style={{ minWidth: 160 }}>
              <Select options={LEVEL_OPTIONS} />
            </Form.Item>
            <Form.Item name="branch_id" label="Cơ sở" style={{ minWidth: 200 }}>
              <Select disabled={!!editing} allowClear options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
          <Space style={{ display: 'flex' }} align="start" wrap>
            <Form.Item name="tuition" label="Học phí" rules={[{ required: true, type: 'number', min: 0 }]} style={{ minWidth: 180 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="duration_hours" label="Thời lượng (giờ)" style={{ minWidth: 180 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="max_students" label="Số học viên tối đa" style={{ minWidth: 180 }}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start" wrap>
            <Form.Item name="start_date" label="Ngày bắt đầu"><DatePicker format="DD/MM/YYYY" /></Form.Item>
            <Form.Item name="end_date" label="Ngày kết thúc"><DatePicker format="DD/MM/YYYY" /></Form.Item>
          </Space>
          {editing && <Form.Item name="is_active" label="Trạng thái"><Select options={[{ value: true, label: 'Đang mở' }, { value: false, label: 'Đã ẩn' }]} /></Form.Item>}
          <CustomFieldFormItems definitions={courseFields} />
        </Form>
      </Modal>
    </>
  )
}
