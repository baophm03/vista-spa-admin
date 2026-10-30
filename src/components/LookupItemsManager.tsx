import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, ColorPicker, Form, Input, InputNumber, Modal, Space, Table, Tag, Typography, message } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { errorMessage, pickData } from '@/api/helpers'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { paginateRows } from '@/utils/listTable'
import type { LookupItem } from '@/api/models/lookupItem'
import type { LookupList } from '@/api/models/lookupList'
import type { PostLookupListsIdItemsBody } from '@/api/models/postLookupListsIdItemsBody'
import type { PutLookupItemsIdBody } from '@/api/models/putLookupItemsIdBody'
import type { PutLookupListsIdBody } from '@/api/models/putLookupListsIdBody'
import {
  deleteLookupItemsId,
  postLookupListsIdItems,
  putLookupItemsId,
	} from '@/api/endpoints/lookup-items'
import { getLookupListsId, putLookupListsId } from '@/api/endpoints/lookup-lists'
import { Can } from '@casl/react'

type LookupItemWithColor = LookupItem & { color?: string | null }

function normalizeLookupColor(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const color = value.trim()
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1]
    return `#${digits.toLowerCase()}`
  }
  const rgb = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i)
  if (!rgb) return color
  const channels = rgb.slice(1, 4).map(Number)
  if (channels.some((channel) => channel > 255)) return color
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** Danh sách mục trong một lookup list: sắp thứ tự (drag + nút lên/xuống), thêm/sửa/ẩn mục. */
export default function LookupItemsManager({ listId }: { listId: string }) {
  const [items, setItems] = useState<LookupItemWithColor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<LookupItemWithColor | null>(null)
  const [open, setOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [itemsPage, setItemsPage] = useState(1)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = pickData<LookupList & { lookup_items?: LookupItemWithColor[] }>(await getLookupListsId(listId))
      setItems((list?.lookup_items ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.code.localeCompare(b.code)))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [listId])

  useEffect(() => { void load() }, [load])

  const color = Form.useWatch('color', form)

  const openEditor = (row?: LookupItemWithColor) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(row ? { ...row, color: normalizeLookupColor(row.color) } : { sort_order: items.length * 10, is_active: true, color: null })
    setOpen(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const dto = { ...values, color: normalizeLookupColor(values.color) }
      if (editing) await putLookupItemsId(editing.id, dto as unknown as PutLookupItemsIdBody)
      else await postLookupListsIdItems(listId, dto as unknown as PostLookupListsIdItemsBody)
      setOpen(false)
      message.success(editing ? 'Đã cập nhật mục chọn' : 'Đã thêm mục chọn')
      await load()
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: LookupItemWithColor) => {
    setSaving(true)
    try {
      if (row.is_active === false) await putLookupItemsId(row.id, { is_active: true } as PutLookupItemsIdBody)
      else await deleteLookupItemsId(row.id)
      message.success(row.is_active === false ? 'Đã bật lại mục chọn' : 'Đã ẩn mục chọn; dữ liệu cũ được giữ lại')
      await load()
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const persistOrder = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    const from = items.findIndex((item) => item.id === sourceId)
    const to = items.findIndex((item) => item.id === targetId)
    if (from < 0 || to < 0) return
    const next = items.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setItems(next)
    setSaving(true)
    try {
      // Backend nhận mảng ID; model orval gen sai kiểu string nên phải cast
      await putLookupListsId(listId, { item_order: next.map((item) => item.id) } as unknown as PutLookupListsIdBody)
      await load()
    } catch (err) {
      message.error(errorMessage(err))
      await load()
    } finally {
      setSaving(false)
      setDragId(null)
    }
  }

  // Booleans đọc từ CASL ability một cách reactive qua children-as-function của <Can>
  return (
    <Can I="UPDATE" a="LOOKUP" passThrough>
      {({ ability }) => {
        const canUpdate = ability.can('UPDATE' as never, 'LOOKUP')
        const canDelete = ability.can('DELETE' as never, 'LOOKUP')
        return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Text type="secondary">Mã mục không đổi sau khi tạo. Mục đã dùng chỉ có thể ẩn.</Typography.Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { setItemsPage(1); void load() }}>Tải lại</Button>
          {canUpdate && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm mục</Button>}
        </Space>
      </Space>
      {error && <Alert className="mb-4" type="error" showIcon message="Không tải được mục trong danh mục" description={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />}
      <Table<LookupItemWithColor>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={paginateRows(items, itemsPage, 10)}
        pagination={false}
        locale={{ emptyText: <TableEmpty description="Danh mục chưa có mục chọn nào" /> }}
        onRow={(row) => ({
          draggable: canUpdate && !saving,
          onDragStart: (event) => { setDragId(row.id); event.dataTransfer.effectAllowed = 'move' },
          onDragOver: (event) => event.preventDefault(),
          onDrop: (event) => { event.preventDefault(); if (dragId) void persistOrder(dragId, row.id) },
          onDragEnd: () => setDragId(null),
        })}
        columns={[
          { title: 'Mã', dataIndex: 'code', width: 150, render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
          { title: 'Nhãn hiển thị', dataIndex: 'label', render: (value: string, row) => <Space><span style={{ width: 12, height: 12, borderRadius: 2, background: row.color || '#d9d9d9', display: 'inline-block' }} />{value}</Space> },
          { title: 'Màu', dataIndex: 'color', width: 110, render: (value?: string | null) => { const color = normalizeLookupColor(value); return color ? <Tag color={color}>{color.toUpperCase()}</Tag> : '—' } },
          { title: 'Thứ tự', dataIndex: 'sort_order', width: 90 },
          { title: 'Trạng thái', dataIndex: 'is_active', width: 120, render: (value?: boolean) => <Tag color={value === false ? 'default' : 'green'}>{value === false ? 'Đã ẩn' : 'Đang dùng'}</Tag> },
          ...(canUpdate || canDelete ? [{ title: 'Thao tác', key: 'actions', width: 220, render: (_: unknown, row: LookupItemWithColor) => {
            // index là vị trí trong trang hiện tại; quy đổi về vị trí trong mảng items đầy đủ
            const globalIndex = items.findIndex((item) => item.id === row.id)
            return (
            <Space size="small">
              {canUpdate && <>
                <Button size="small" aria-label="Đưa lên" disabled={saving || globalIndex === 0} icon={<ArrowUpOutlined />} onClick={() => void persistOrder(row.id, items[globalIndex - 1].id)} />
                <Button size="small" aria-label="Đưa xuống" disabled={saving || globalIndex === items.length - 1} icon={<ArrowDownOutlined />} onClick={() => void persistOrder(row.id, items[globalIndex + 1].id)} />
                <Button size="small" onClick={() => openEditor(row)}>Sửa</Button>
              </>}
              {row.is_active === false
                ? canUpdate && <Button size="small" type="link" disabled={saving} onClick={() => void toggleActive(row)}>Bật lại</Button>
                : canDelete && <Button size="small" type="link" disabled={saving} onClick={() => void toggleActive(row)}>Ẩn</Button>}
            </Space>
            )
          } }] : []),
        ]}
      />
      <ListPagination page={itemsPage} limit={10} total={items.length} onChange={setItemsPage} noun="mục danh mục" />
      <Modal
        title={editing ? 'Sửa mục chọn' : 'Thêm mục chọn'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="code" label="Mã mục" rules={[{ required: true, message: 'Nhập mã mục' }, { max: 50 }]}>
            <Input disabled={!!editing} maxLength={50} />
          </Form.Item>
          <Form.Item name="label" label="Nhãn hiển thị" rules={[{ required: true, message: 'Nhập nhãn mục' }, { max: 100 }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="color" label="Màu nhãn">
            <Space>
              <ColorPicker value={normalizeLookupColor(color) || '#8e63a9'} onChange={(selectedColor) => form.setFieldValue('color', selectedColor.toHexString())} />
              <Typography.Text type="secondary">{color || 'Chưa chọn màu'}</Typography.Text>
              <Button size="small" onClick={() => form.setFieldValue('color', null)}>Xóa màu</Button>
            </Space>
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị" rules={[{ required: true, type: 'number', min: 0, message: 'Nhập số nguyên không âm' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
        )
      }}
    </Can>
  )
}
