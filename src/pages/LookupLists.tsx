import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import LookupItemsManager from '@/components/LookupItemsManager'
import { errorMessage, pickData } from '@/api/helpers'
import type { LookupList } from '@/api/models/lookupList'
import type { PostLookupListsBody } from '@/api/models/postLookupListsBody'
import { deleteLookupListsId, getLookupLists, postLookupLists } from '@/api/endpoints/settings'
import { usePermissions } from '@/utils/permissions'

/** Hai cột: danh sách lookup lists (bên trái) và các mục của list đang chọn (bên phải). */
export default function LookupLists() {
  const [lists, setLists] = useState<LookupList[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()
  const { can } = usePermissions()
  const canRead = can('lookup.read')
  const canCreate = can('lookup.create')
  const canUpdate = can('lookup.update')
  const canDelete = can('lookup.delete')

  const load = useCallback(async (search: string) => {
    setLoading(true)
    setError('')
    try {
      const body = await getLookupLists(search.trim() ? { q: search.trim() } : {})
      const rows = (pickData<LookupList[]>(body) ?? []) as LookupList[]
      setLists(rows)
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load('') }, [load])

  const createList = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const created = pickData<LookupList>(await postLookupLists({
        key: values.key.trim(),
        name: values.name.trim(),
      } as PostLookupListsBody))
      setCreateOpen(false)
      form.resetFields()
      message.success('Đã tạo danh mục')
      await load('')
      setSelectedId(created?.id ?? null)
      setQuery('')
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const removeList = (row: LookupList) => {
    Modal.confirm({
      title: `Xóa danh mục “${row.name}”?`,
      content: 'Danh mục chỉ xóa được khi chưa được trường tùy chỉnh sử dụng.',
      okText: 'Xóa danh mục',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteLookupListsId(row.id)
          message.success('Đã xóa danh mục')
          await load(query)
        } catch (err) {
          message.error(errorMessage(err))
          throw err
        }
      },
    })
  }

  const selected = lists.find((row) => row.id === selectedId) ?? null
  const canManageList = canCreate || canUpdate || canDelete

  return (
    <>
      <PageTitle extra={(
        <Space wrap>
          <Input.Search
            allowClear
            value={query}
            placeholder="Tìm tên, mã danh mục hoặc mã mục"
            onChange={(event) => setQuery(event.target.value)}
            onSearch={(value) => void load(value)}
            style={{ width: 300, maxWidth: '70vw' }}
            enterButton={<SearchOutlined />}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void load(query)}>Tải lại</Button>
          {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true) }}>Tạo danh mục</Button>}
        </Space>
      )}>Danh mục chọn</PageTitle>

      {!canRead && !loading && <Alert className="mb-4" type="error" showIcon message="Tài khoản chưa có quyền xem danh mục" />}
      {error && <Alert className="mb-4" type="error" showIcon message="Không tải được danh mục" description={error} action={<Button size="small" onClick={() => void load(query)}>Thử lại</Button>} />}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' }}>
        <section aria-label="Danh sách danh mục">
          <Typography.Title level={5}>Các danh mục</Typography.Title>
          <Table<LookupList>
            rowKey="id"
            size="small"
            loading={loading}
            dataSource={lists}
            pagination={{ pageSize: 8 }}
            rowClassName={(row) => row.id === selectedId ? 'ant-table-row-selected' : ''}
            locale={{ emptyText: query ? 'Không tìm thấy danh mục' : 'Chưa có danh mục' }}
            columns={[
              { title: 'Tên / mã', render: (_: unknown, row: LookupList) => (
                <Button type="link" style={{ paddingInline: 0, textAlign: 'left', height: 'auto' }} onClick={() => setSelectedId(row.id)}>
                  <Space direction="vertical" size={0} align="start">
                    <span>{row.name}</span><Typography.Text type="secondary" code>{row.key}</Typography.Text>
                  </Space>
                </Button>
              ) },
              { title: 'Loại', dataIndex: 'is_system', width: 100, render: (value?: boolean) => <Tag color={value ? 'blue' : 'default'}>{value ? 'Hệ thống' : 'Tự tạo'}</Tag> },
              ...(canDelete ? [{ title: '', key: 'actions', width: 76, render: (_: unknown, row: LookupList) => row.is_system ? null : (
                <Button type="link" danger size="small" onClick={() => removeList(row)}>Xóa</Button>
              ) }] : []),
            ]}
          />
        </section>

        <section aria-label="Các mục trong danh mục">
          <Typography.Title level={5}>{selected ? selected.name : 'Mục chọn'}</Typography.Title>
          {selected ? (
            <LookupItemsManager listId={selected.id} canUpdate={canUpdate} canDelete={canDelete} />
          ) : (
            <Alert type="info" showIcon message="Chọn một danh mục để xem các mục lựa chọn" description={canManageList ? 'Tạo danh mục tự tạo để dùng làm nguồn lựa chọn cho trường tùy chỉnh.' : undefined} />
          )}
        </section>
      </div>

      <Modal
        title="Tạo danh mục tự tạo"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void createList()}
        confirmLoading={saving}
        okText="Tạo danh mục"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="key" label="Mã danh mục" rules={[{ required: true, message: 'Nhập mã danh mục' }, { max: 50 }, { pattern: /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, message: 'Chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang' }]}>
            <Input maxLength={50} placeholder="vd customer.sources" />
          </Form.Item>
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: 'Nhập tên danh mục' }, { max: 100 }]}>
            <Input maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
