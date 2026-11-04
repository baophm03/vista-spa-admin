import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Spin, Table, Tabs, Tag, Typography, message } from 'antd'
import { EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Can, useAbility } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import ListPagination from '@/components/base/ListPagination'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import TableEmpty from '@/components/base/TableEmpty'
import LookupItemsManager from '@/components/LookupItemsManager'
import CustomFieldEditorModal from './components/CustomFieldEditorModal'
import type { CustomFieldFormValues } from './components/CustomFieldEditorModal'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import type { CustomFieldDef } from '@/api/models/customFieldDef'
import type { CustomFieldDefEntity } from '@/api/models/customFieldDefEntity'
import type { LookupList } from '@/api/models/lookupList'
import type { PostCustomFieldDefsBody } from '@/api/models/postCustomFieldDefsBody'
import type { PutCustomFieldDefsIdBody } from '@/api/models/putCustomFieldDefsIdBody'
import {
  deleteCustomFieldDefsId,
  getCustomFieldDefs,
  postCustomFieldDefs,
  putCustomFieldDefsId,
} from '@/api/endpoints/settings'
import { getLookupLists } from '@/api/endpoints/lookup-lists'

function splitOptions(value?: string) {
  return value?.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) ?? []
}

const SERVICE_BASE_FIELDS = [
  { label: 'Tên dịch vụ', key: 'title', dataType: 'Văn bản', required: 'Có' },
  { label: 'Danh mục', key: 'category_id', dataType: 'Danh mục', required: 'Không' },
  { label: 'Thời lượng (phút)', key: 'duration_minutes', dataType: 'Số', required: 'Không' },
  { label: 'Điểm đổi dịch vụ', key: 'required_points', dataType: 'Số', required: 'Không' },
  { label: 'Giá niêm yết', key: 'price', dataType: 'Số tiền', required: 'Không' },
  { label: 'Giá tối đa', key: 'price_max', dataType: 'Số tiền', required: 'Không' },
  { label: 'Đơn vị giá', key: 'price_unit', dataType: 'Lựa chọn cố định', required: 'Không' },
  { label: 'Mô tả', key: 'description', dataType: 'Văn bản dài', required: 'Không' },
  { label: 'Ảnh bìa', key: 'image_file_id', dataType: 'Ảnh', required: 'Không' },
  { label: 'Bộ ảnh', key: 'gallery_file_ids', dataType: 'Danh sách ảnh', required: 'Không' },
]

function CustomerFieldsConfig({ entity, sectionTitle }: {
  entity: CustomFieldDefEntity
  sectionTitle?: string
}) {
  const [rows, setRows] = useState<CustomFieldDef[]>([])
  const [lookupLists, setLookupLists] = useState<LookupList[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<CustomFieldDef | null>(null)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<CustomFieldFormValues>()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'CUSTOM_FIELD')
  const canToggleRow = (row: CustomFieldDef) =>
    ability.can(row.is_active === false ? 'UPDATE' : 'DELETE', 'CUSTOM_FIELD')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [definitions, catalogs] = await Promise.all([
        getCustomFieldDefs({ entity }),
        getLookupLists({ is_active: true }),
      ])
      setRows((pickData<CustomFieldDef[]>(definitions) ?? []) as CustomFieldDef[])
      setLookupLists((pickData<LookupList[]>(catalogs) ?? []) as LookupList[])
      setPage(1)
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [entity])

  useEffect(() => { void load() }, [load])

  const openEditor = (row?: CustomFieldDef) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(row ? {
      label: row.label,
      key: row.key,
      data_type: row.data_type,
      options_text: Array.isArray(row.options) ? row.options.join('\n') : '',
      option_source: row.lookup_list_id ? 'lookup' : 'manual',
      sort_order: row.sort_order,
      required: row.required,
      visible_to_customer: row.visible_to_customer,
    } : { data_type: 'text', option_source: 'manual', required: false, visible_to_customer: false, sort_order: rows.length })
    setOpen(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    const supportsOptions = ['select', 'multiselect'].includes(values.data_type)
    const lookupListId = supportsOptions && values.option_source === 'lookup' ? values.lookup_list_id : null
    const dto = {
      entity,
      label: values.label,
      // key/data_type bất biến sau khi tạo
      ...(editing ? {} : { key: values.key, data_type: values.data_type }),
      lookup_list_id: lookupListId ?? undefined,
      options: supportsOptions && !lookupListId ? splitOptions(values.options_text) : null,
      sort_order: values.sort_order ?? 0,
      required: values.required ?? false,
      ...(entity === 'CUSTOMER_PROFILE' ? { visible_to_customer: values.visible_to_customer ?? false } : {}),
    }
    setSaving(true)
    try {
      if (editing) await putCustomFieldDefsId(editing.id, dto as unknown as PutCustomFieldDefsIdBody)
      else await postCustomFieldDefs(dto as unknown as PostCustomFieldDefsBody)
      setOpen(false)
      message.success(editing ? `Đã cập nhật trường ${sectionTitle}` : `Đã tạo trường ${sectionTitle}`)
      await load()
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: CustomFieldDef) => {
    try {
      if (row.is_active === false) await putCustomFieldDefsId(row.id, { is_active: true })
      else await deleteCustomFieldDefsId(row.id)
      message.success(row.is_active === false ? 'Đã bật lại trường' : 'Đã ẩn trường; dữ liệu đã lưu được giữ nguyên')
      await load()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const helperText = entity === 'CUSTOMER_PROFILE'
    ? 'Trường sẽ xuất hiện trong biểu mẫu hồ sơ khách. Trường bị ẩn không nhận dữ liệu mới; giá trị đã lưu vẫn được giữ.'
    : entity === 'SERVICE'
      ? 'Trường bổ sung sẽ xuất hiện trong biểu mẫu thêm/sửa dịch vụ. Các trường cơ bản đã được cấu hình sẵn ở mục Dịch vụ.'
      : 'Trường tùy chỉnh sẽ xuất hiện trong biểu mẫu tương ứng. Trường bị ẩn không nhận dữ liệu mới; giá trị đã lưu vẫn được giữ.'

  const columns = [
    { title: 'Tên trường', dataIndex: 'label' },
    { title: 'Key', dataIndex: 'key', render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
    { title: 'Kiểu dữ liệu', dataIndex: 'data_type' },
    { title: 'Nguồn lựa chọn', render: (_: unknown, row: CustomFieldDef) => row.lookup_list_id ? `Danh mục: ${lookupLists.find((list) => list.id === row.lookup_list_id)?.key ?? row.lookup_list_id}` : (row.data_type === 'select' || row.data_type === 'multiselect') ? 'Nhập tay' : '—' },
    { title: 'Bắt buộc', dataIndex: 'required', render: (value: boolean) => value ? <Tag color="blue">Có</Tag> : 'Không' },
    ...(entity === 'CUSTOMER_PROFILE' ? [{ title: 'Hiển thị với khách', dataIndex: 'visible_to_customer', render: (value: boolean) => value ? 'Có' : 'Không' }] : []),
    { title: 'Trạng thái', dataIndex: 'is_active', render: (value: boolean) => <Tag color={value === false ? 'default' : 'green'}>{value === false ? 'Đã ẩn' : 'Đang dùng'}</Tag> },
    {
      title: 'Hành động', key: 'actions', align: 'center' as const, width: 90,
      render: (_: unknown, row: CustomFieldDef) => (
        <RowActionsMenu
          items={[
            ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
            ...(canToggleRow(row) ? [{ key: 'toggle', danger: row.is_active !== false, label: row.is_active === false ? 'Bật lại' : 'Ẩn' }] : []),
          ]}
          onSelect={(key) => {
            if (key === 'edit') openEditor(row)
            else if (key === 'toggle') void toggleActive(row)
          }}
        />
      ),
    },
  ]

  const canCreate = ability.can('CREATE', 'CUSTOM_FIELD')

  const customFieldsTable = (
    <Table<CustomFieldDef>
      rowKey="id"
      loading={loading}
      dataSource={paginateRows(rows, page, 10)}
      pagination={false}
      locale={{
        emptyText: entity === 'SERVICE' ? (
          <TableEmpty
            title="Chưa có trường tùy chỉnh cho dịch vụ"
            description="Tạo trường nếu cần lưu thêm thông tin ngoài các trường dịch vụ cơ bản."
          />
        ) : undefined,
      }}
      columns={columns}
    />
  )

  return (
    <>
      {entity === 'SERVICE' ? (
        <>
          <PageTitle subtitle="Các trường cơ bản đã được cấu hình sẵn — chỉnh sửa chi tiết tại mục Dịch vụ.">
            Các trường dịch vụ có sẵn
          </PageTitle>
          <Table
            rowKey="key"
            dataSource={SERVICE_BASE_FIELDS}
            pagination={false}
            columns={[
              { title: 'Tên trường', dataIndex: 'label' },
              { title: 'Key', dataIndex: 'key', render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
              { title: 'Kiểu dữ liệu', dataIndex: 'dataType' },
              { title: 'Bắt buộc', dataIndex: 'required' },
              { title: 'Cấu hình tại', render: () => 'Mục Dịch vụ' },
            ]}
          />
          <PageTitle
            subtitle={helperText}
            right={canCreate ? (
              <Can I="CREATE" a="CUSTOM_FIELD">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm trường</Button>
              </Can>
            ) : undefined}
          >
            Trường tùy chỉnh bổ sung
          </PageTitle>
          {customFieldsTable}
        </>
      ) : (
        <>
          <PageTitle
            subtitle={helperText}
            right={canCreate ? (
              <Can I="CREATE" a="CUSTOM_FIELD">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm trường</Button>
              </Can>
            ) : undefined}
          >
            {sectionTitle ?? 'Trường tùy chỉnh'}
          </PageTitle>
          {customFieldsTable}
        </>
      )}
      <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="trường tùy chỉnh" />
      <CustomFieldEditorModal
        entity={entity}
        sectionTitle={sectionTitle}
        editing={editing}
        form={form}
        lookupLists={lookupLists}
        open={open}
        saving={saving}
        onClose={() => setOpen(false)}
        onSave={save}
      />
    </>
  )
}

function HealthMetricsConfig() {
  const [lookup, setLookup] = useState<LookupList | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const lists = (pickData<LookupList[]>(await getLookupLists()) ?? []) as LookupList[]
      setLookup(lists.find((row) => row.key === 'health.metrics') ?? null)
    } catch (err) {
      setLookup(null)
      setLoadError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <div style={{ padding: 36, textAlign: 'center' }}><Spin tip="Đang tải danh mục chỉ số…" /></div>
  }

  if (loadError) {
    return <Alert
      type="error"
      showIcon
      message="Không tải được danh mục chỉ số sức khỏe"
      description={loadError}
      action={<Button size="small" onClick={() => void load()}>Thử lại</Button>}
    />
  }

  if (!lookup) {
    return <Alert
      type="info"
      showIcon
      message="Chưa có danh mục health.metrics"
      description="Danh mục hệ thống được tạo khi áp dụng migration; không tự thêm chỉ số trước khi cơ sở thống nhất bộ mã."
    />
  }

  return (
    <>
      <PageTitle subtitle="Mã đã ngừng sử dụng không nhận số đo mới; dữ liệu lịch sử được giữ lại.">
        Chỉ số sức khỏe (HM)
      </PageTitle>
      <LookupItemsManager listId={lookup.id} />
    </>
  )
}

export default function CustomerDataConfig() {
  const [selectedSection, setSelectedSection] = useState<CustomFieldDefEntity | 'HEALTH_METRICS'>('CUSTOMER_PROFILE')
  const sectionOptions = [
    { value: 'CUSTOMER_PROFILE', label: 'Hồ sơ khách' },
    { value: 'SESSION', label: 'Buổi điều trị' },
    { value: 'SERVICE', label: 'Dịch vụ' },
    { value: 'PACKAGE', label: 'Gói dịch vụ' },
    { value: 'COURSE', label: 'Khóa học' },
    { value: 'APPOINTMENT', label: 'Lịch hẹn' },
    { value: 'CUSTOMER_TREATMENT', label: 'Gói liệu trình của khách' },
    { value: 'HEALTH_METRICS', label: 'Chỉ số sức khỏe (HM)' },
  ]

  return (
    <>
      <PageTitle subtitle="Cấu hình trường dữ liệu khách hàng">Cấu hình dữ liệu khách hàng</PageTitle>
      <Tabs
        activeKey={selectedSection}
        onChange={(key) => setSelectedSection(key as CustomFieldDefEntity | 'HEALTH_METRICS')}
        items={sectionOptions.map((option) => ({
          key: option.value,
          label: option.label,
          // chỉ render tab đang chọn để tránh gọi API 7 section cùng lúc
          children: selectedSection !== option.value ? null : option.value === 'HEALTH_METRICS'
            ? <HealthMetricsConfig />
            : <CustomerFieldsConfig entity={option.value} sectionTitle={option.label} />,
        }))}
      />
    </>
  )
}