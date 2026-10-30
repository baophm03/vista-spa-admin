import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Modal, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { paginateRows } from '@/utils/listTable'
import LookupItemsManager from '@/components/LookupItemsManager'
import { errorMessage, pickData } from '@/api/helpers'
import type { LookupList } from '@/api/models/lookupList'
import type { PostLookupListsBody } from '@/api/models/postLookupListsBody'
import { deleteLookupListsId, getLookupLists, postLookupLists, putLookupListsId } from '@/api/endpoints/lookup-lists'
import { Can } from '@casl/react'

/** Bảng danh mục lookup; bấm icon con mắt mở modal quản lý các mục của danh mục đó. */
export default function LookupLists() {
  const [lists, setLists] = useState<LookupList[]>([])
  const [viewingList, setViewingList] = useState<LookupList | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingList, setEditingList] = useState<LookupList | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm<{ name: string; is_active: boolean }>()

  const load = useCallback(async (search: string) => {
    setLoading(true)
    setError('')
    try {
      const body = await getLookupLists(search.trim() ? { q: search.trim() } : {})
      setLists((pickData<LookupList[]>(body) ?? []) as LookupList[])
      setPage(1)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load('') }, [load])

  // Nếu danh mục đang mở modal bị xóa/tắt thì đóng modal
  useEffect(() => {
    if (viewingList && !lists.some((row) => row.id === viewingList.id)) setViewingList(null)
  }, [lists, viewingList])

  const createList = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await postLookupLists({
        key: values.key.trim(),
        name: values.name.trim(),
      } as PostLookupListsBody)
      setCreateOpen(false)
      form.resetFields()
      message.success('Đã tạo danh mục')
      await load('')
      setQuery('')
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openEditList = (row: LookupList) => {
    setEditingList(row)
    editForm.setFieldsValue({ name: row.name, is_active: row.is_active !== false })
  }

  const updateList = async () => {
    if (!editingList) return
    const values = await editForm.validateFields()
    setSaving(true)
    try {
      await putLookupListsId(editingList.id, {
        name: values.name.trim(),
        is_active: values.is_active,
      })
      setEditingList(null)
      message.success('Đã cập nhật danh mục')
      await load(query)
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


  // Booleans đọc từ CASL ability một cách reactive qua children-as-function của <Can>
  return (
    <Can I="UPDATE" a="LOOKUP" passThrough>
      {({ ability }) => {
        const canRead = ability.can('READ' as never, 'LOOKUP')
        const canCreate = ability.can('CREATE' as never, 'LOOKUP')
        const canUpdate = ability.can('UPDATE' as never, 'LOOKUP')
        const canDelete = ability.can('DELETE' as never, 'LOOKUP')
        return (
    <>
      <PageTitle subtitle="Danh mục dùng chung cho các trường tùy chỉnh" extra={(
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
            placeholder="Tìm tên, mã danh mục hoặc mã mục"
            style={{ width: 260 }}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              if (!event.target.value) void load('')
            }}
            onPressEnter={() => void load(query)}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void load(query)}>Tải lại</Button>
          {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true) }}>Tạo danh mục</Button>}
        </Space>
      )}>Danh mục chọn</PageTitle>

      {!canRead && !loading && <Alert className="mb-4" type="error" showIcon message="Tài khoản chưa có quyền xem danh mục" />}
      {error && <Alert className="mb-4" type="error" showIcon message="Không tải được danh mục" description={error} action={<Button size="small" onClick={() => void load(query)}>Thử lại</Button>} />}

      <Table<LookupList>
        rowKey="id"
        loading={loading}
        dataSource={paginateRows(lists, page, 8)}
        pagination={false}
        locale={{ emptyText: <TableEmpty description={query ? 'Không tìm thấy danh mục' : 'Chưa có danh mục'} /> }}
        columns={[
          { title: 'Tên / mã', render: (_: unknown, row: LookupList) => (
            <Space direction="vertical" size={0} align="start">
              <span>{row.name}</span><Typography.Text type="secondary" code>{row.key}</Typography.Text>
            </Space>
          ) },
          { title: 'Loại', dataIndex: 'is_system', width: 110, render: (value?: boolean) => <Tag color={value ? 'blue' : 'default'}>{value ? 'Hệ thống' : 'Tự tạo'}</Tag> },
          { title: 'Trạng thái', dataIndex: 'is_active', width: 130, render: (value?: boolean) => <Tag color={value === false ? 'default' : 'green'}>{value === false ? 'Đã tắt' : 'Đang hoạt động'}</Tag> },
          { title: 'Hành động', key: 'actions', width: 150, fixed: 'right' as const, render: (_: unknown, row: LookupList) => (
            <RowActionsMenu
              items={[
                { key: 'view', label: 'Xem các mục', icon: <EyeOutlined /> },
                ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
                ...(canDelete && !row.is_system ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true }] : []),
              ]}
              onSelect={(key) => {
                if (key === 'view') setViewingList(row)
                else if (key === 'edit') openEditList(row)
                else if (key === 'delete') removeList(row)
              }}
            />
          ) },
        ]}
      />
      <ListPagination page={page} limit={8} total={lists.length} onChange={setPage} noun="danh mục dùng chung" />

      <Modal
        title={`Các mục — ${viewingList?.name ?? ''}`}
        open={!!viewingList}
        onCancel={() => setViewingList(null)}
        footer={null}
        width="min(1200px, calc(100vw - 24px))"
        destroyOnHidden
      >
        {viewingList && (
          <>
            <Typography.Text type="secondary" code style={{ display: 'block', marginBottom: 12 }}>{viewingList.key}</Typography.Text>
            <LookupItemsManager listId={viewingList.id} />
          </>
        )}
      </Modal>

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
      <Modal
        title="Sửa danh mục"
        open={!!editingList}
        onCancel={() => setEditingList(null)}
        onOk={() => updateList()}
        confirmLoading={saving}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, whitespace: true, message: 'Nhập tên danh mục' }, { max: 100 }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Typography.Text type="secondary">Mã danh mục không đổi. Tắt danh mục sẽ ngừng cho phép dùng danh mục này ở các lựa chọn mới.</Typography.Text>
        </Form>
      </Modal>
    </>
        )
      }}
    </Can>
  )
}
