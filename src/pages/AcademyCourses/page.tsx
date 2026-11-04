import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Modal, Space, Table, Tag, message } from 'antd'
import { BookOutlined, CheckCircleOutlined, EditOutlined, EyeInvisibleOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
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
import { Can, useAbility } from '@casl/react'
import { useState } from 'react'
import { useBrandCurrency } from '@/themeRuntime'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import AcademyCourseDetailModal from './components/AcademyCourseDetailModal'
import AcademyCourseFormModal from './components/AcademyCourseFormModal'
import { CATEGORY_OPTIONS, LEVEL_OPTIONS, type CourseFormValues } from './components/constants'

type CourseColumnKey = 'code' | 'name' | 'category' | 'level' | 'tuition' | 'is_active'

const COURSE_COLUMN_OPTIONS: { label: string; value: CourseColumnKey }[] = [
  { label: 'Mã khóa', value: 'code' },
  { label: 'Tên khóa học', value: 'name' },
  { label: 'Danh mục', value: 'category' },
  { label: 'Trình độ', value: 'level' },
  { label: 'Học phí', value: 'tuition' },
  { label: 'Trạng thái', value: 'is_active' },
]

const DEFAULT_VISIBLE_COLUMNS = COURSE_COLUMN_OPTIONS.map((column) => column.value)

export default function AcademyCourses() {
  const queryClient = useQueryClient()
  const { format: formatMoney } = useBrandCurrency()
  const courseFields = useCustomFieldDefinitions('COURSE')
  const coursesQuery = useGetAcademyCourses()
  const branchesQuery = useGetBranches()
  const rows = (pickData<AcademyCourse[]>(coursesQuery.data) ?? []) as AcademyCourse[]
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<AcademyCourse | null>(null)
  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AcademyCourse | null>(null)
  const [saving, setSaving] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<CourseColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<CourseColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [form] = Form.useForm<CourseFormValues>()
  const createMutation = usePostAcademyCourses()
  const updateMutation = usePutAcademyCoursesId()
  const deleteMutation = useDeleteAcademyCoursesId()
  const ability = useAbility()
  const { isAdmin } = useCustomerProfileAccess()
  const canUpdate = isAdmin && ability.can('UPDATE', 'ACADEMY')
  const canDelete = isAdmin && ability.can('DELETE', 'ACADEMY')

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetAcademyCoursesQueryKey() })
  }

  // Thống kê đầu trang — rows là danh sách đầy đủ client-side (query không có bộ lọc server)
  const activeCourseCount = rows.filter((row) => !!row.is_active).length
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng khóa học', value: rows.length.toLocaleString('vi-VN'), icon: <BookOutlined />, tone: 'primary' },
    { key: 'active', label: 'Đang mở', value: activeCourseCount.toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
    { key: 'hidden', label: 'Đã ẩn', value: (rows.length - activeCourseCount).toLocaleString('vi-VN'), icon: <EyeInvisibleOutlined />, tone: 'neutral' },
  ]

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
      <StatCards items={statItems} />
      <PageTitle
        subtitle="Khóa học đào tạo spa của trung tâm"
        extra={
          <Space wrap>
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={setFilterOpen}
              activeFilterCount={0}
              onApply={() => {
                if (draftVisibleColumns.length === 0) {
                  message.error('Hãy giữ lại ít nhất một cột hiển thị')
                  return
                }
                setVisibleColumns(draftVisibleColumns)
                setFilterOpen(false)
              }}
              onClear={() => {
                setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
                setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
              }}
              columnOptions={COURSE_COLUMN_OPTIONS}
              draftVisibleColumns={draftVisibleColumns}
              onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as CourseColumnKey[])}
            />
            {isAdmin && (
              <Can I="CREATE" a="ACADEMY">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm khóa học</Button>
              </Can>
            )}
          </Space>
        }
      >
        Khóa học đào tạo
      </PageTitle>
      {coursesQuery.isError && <Alert type="error" showIcon message="Không tải được danh sách khóa học" description={errorMessage(coursesQuery.error)} style={{ marginBottom: 16 }} />}
      <Table<AcademyCourse>
        rowKey="id"
        loading={coursesQuery.isLoading}
        dataSource={paginateRows(rows, page, 10)}
        scroll={{ x: 900 }}
        pagination={false}
        onRow={(row) => ({
          onClick: () => setDetail(row),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { key: 'code', title: 'Mã khóa', dataIndex: 'code' },
          { key: 'name', title: 'Tên khóa học', dataIndex: 'name' },
          { key: 'category', title: 'Danh mục', dataIndex: 'category', render: (value: string) => CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value },
          { key: 'level', title: 'Trình độ', dataIndex: 'level', render: (value: string) => LEVEL_OPTIONS.find((item) => item.value === value)?.label ?? value },
          { key: 'tuition', title: 'Học phí', dataIndex: 'tuition', render: (value: number) => formatMoney(value) },
          { key: 'is_active', title: 'Trạng thái', dataIndex: 'is_active', render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? 'Đang mở' : 'Đã ẩn'}</Tag> },
          {
            key: 'actions',
            title: 'Hành động', align: 'center' as const,
            width: 90,
            fixed: 'right' as const,
            render: (_: unknown, row: AcademyCourse) => {
              const canToggle = row.is_active ? canDelete : canUpdate
              return (
                <RowActionsMenu
                  items={[
                    ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
                    ...(canToggle ? [{ key: 'toggle', danger: row.is_active, label: row.is_active ? 'Ẩn' : 'Mở lại' }] : []),
                  ]}
                  onSelect={(key) => {
                    if (key === 'edit') openEditor(row)
                    else if (key === 'toggle') {
                      Modal.confirm({
                        title: row.is_active ? 'Ẩn khóa học này?' : 'Mở lại khóa học này?',
                        okText: row.is_active ? 'Ẩn' : 'Mở',
                        okButtonProps: row.is_active ? { danger: true } : undefined,
                        cancelText: 'Hủy',
                        onOk: () => void toggleActive(row),
                      })
                    }
                  }}
                />
              )
            },
          },
        ].filter((column) =>
          column.key === 'actions' || visibleColumns.includes(column.key as CourseColumnKey),
        )}
      />
      <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="khóa học" />
      <AcademyCourseDetailModal
        detail={detail}
        branches={branches}
        courseFields={courseFields}
        formatMoney={formatMoney}
        onClose={() => setDetail(null)}
      />
      <AcademyCourseFormModal
        open={open}
        form={form}
        editing={editing}
        branches={branches}
        courseFields={courseFields}
        saving={saving}
        onCancel={() => setOpen(false)}
        onSubmit={() => void save()}
      />
    </>
  )
}