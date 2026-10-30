import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Can } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import LookupItemsManager from '@/components/LookupItemsManager'
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

interface CustomFieldFormValues {
  label: string
  key: string
  data_type: string
  option_source?: string
  lookup_list_id?: string
  options_text?: string
  sort_order?: number
  required?: boolean
  visible_to_customer?: boolean
}

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
    { title: '', key: 'actions', render: (_: unknown, row: CustomFieldDef) => (
      <Space>
        <Can I="UPDATE" a="CUSTOM_FIELD"><Button size="small" onClick={() => openEditor(row)}>Sửa</Button></Can>
        <Can I={row.is_active === false ? 'UPDATE' : 'DELETE'} a="CUSTOM_FIELD" passThrough>
          {(allowed) => allowed ? <Button size="small" type="link" onClick={() => void toggleActive(row)}>{row.is_active === false ? 'Bật lại' : 'Ẩn'}</Button> : null}
        </Can>
      </Space>
    ) },
  ]

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {helperText}
        </Typography.Paragraph>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>Tải lại</Button>
          <Can I="CREATE" a="CUSTOM_FIELD"><Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm trường</Button></Can>
        </Space>
      </Space>
      {entity === 'SERVICE' && (
        <>
          <Typography.Title level={5} style={{ margin: '0 0 12px' }}>Các trường dịch vụ có sẵn</Typography.Title>
          <Table
            size="small"
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
          <Typography.Title level={5} style={{ margin: '24px 0 12px' }}>Trường tùy chỉnh bổ sung</Typography.Title>
        </>
      )}
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
      <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="trường tùy chỉnh" />
      <Modal
        title={editing ? `Sửa trường ${sectionTitle}` : `Thêm trường ${sectionTitle}`}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="label" label="Tên hiển thị" rules={[{ required: true, message: 'Nhập tên trường' }]}>
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item name="key" label="Key" rules={[{ required: true, message: 'Nhập key' }, { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: 'Key bắt đầu bằng chữ và chỉ gồm chữ, số, gạch dưới' }]}>
            <Input disabled={!!editing} maxLength={100} />
          </Form.Item>
          <Form.Item name="data_type" label="Kiểu dữ liệu" rules={[{ required: true }]}>
            <Select disabled={!!editing} options={[
              { value: 'text', label: 'Văn bản' },
              { value: 'number', label: 'Số' },
              { value: 'date', label: 'Ngày' },
              { value: 'select', label: 'Chọn một' },
              { value: 'multiselect', label: 'Chọn nhiều' },
              { value: 'bool', label: 'Có/Không' },
            ]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.data_type !== next.data_type || prev.option_source !== next.option_source}>
            {({ getFieldValue }) => ['select', 'multiselect'].includes(getFieldValue('data_type')) && (
              <>
                <Form.Item name="option_source" label="Nguồn lựa chọn" rules={[{ required: true }]}>
                  <Select onChange={(value) => {
                    if (value === 'manual') form.setFieldValue('lookup_list_id', undefined)
                    else form.setFieldValue('options_text', undefined)
                  }} options={[
                    { value: 'manual', label: 'Nhập lựa chọn thủ công' },
                    { value: 'lookup', label: 'Dùng danh mục dùng chung' },
                  ]} />
                </Form.Item>
                {getFieldValue('option_source') === 'lookup' ? (
                  <Form.Item name="lookup_list_id" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục' }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Chọn danh mục đang hoạt động"
                      options={lookupLists.map((list) => ({ value: list.id, label: `${list.name} · ${list.key}` }))}
                      notFoundContent="Chưa có danh mục đang hoạt động"
                    />
                  </Form.Item>
                ) : (
                  <Form.Item name="options_text" label="Các lựa chọn" rules={[{ required: true, message: 'Nhập ít nhất một lựa chọn' }]}>
                    <Input.TextArea rows={4} placeholder={'Mỗi lựa chọn một dòng\nhoặc phân cách bằng dấu phẩy'} />
                  </Form.Item>
                )}
              </>
            )}
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="required" valuePropName="checked"><Checkbox>Bắt buộc nhập</Checkbox></Form.Item>
          {entity === 'CUSTOMER_PROFILE' && <Form.Item name="visible_to_customer" valuePropName="checked"><Checkbox>Hiển thị với khách hàng</Checkbox></Form.Item>}
        </Form>
      </Modal>
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
      <Typography.Paragraph type="secondary">Mã đã ngừng sử dụng không nhận số đo mới; dữ liệu lịch sử được giữ lại.</Typography.Paragraph>
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
      <PageTitle
        subtitle="Cấu hình trường dữ liệu khách hàng"
        extra={(
          <Select
            aria-label="Chọn loại dữ liệu cần cấu hình"
            value={selectedSection}
            options={sectionOptions}
            onChange={(value: CustomFieldDefEntity | 'HEALTH_METRICS') => setSelectedSection(value)}
            style={{ width: 260 }}
          />
        )}
      >Cấu hình dữ liệu khách hàng</PageTitle>
      {selectedSection === 'HEALTH_METRICS'
        ? <HealthMetricsConfig />
        : <CustomerFieldsConfig
            entity={selectedSection}
            sectionTitle={sectionOptions.find((option) => option.value === selectedSection)?.label}
          />}
    </>
  )
}
