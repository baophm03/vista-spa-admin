import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '../components/PageTitle'
import {
  bizErrorMessage,
  listCustomerProfiles,
  listUsers,
  updateCustomerProfile,
} from '../api/newsky'
import type { CustomerProfile } from '../api/newsky'

const SKIN_TYPES = ['Da dầu', 'Da khô', 'Da hỗn hợp', 'Da nhạy cảm', 'Da thường']

interface HealthFields {
  skin_type?: string
  condition?: string
  allergies?: string
  checked_by?: string
  checked_date?: string
}

type HealthRow = CustomerProfile & { custom_fields?: HealthFields }

export default function HealthRecords() {
  const [rows, setRows] = useState<HealthRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HealthRow | null>(null)
  const [staffs, setStaffs] = useState<{ id: string; zalo_name?: string; email?: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await listCustomerProfiles({ page: 1, limit: 200 })
      setRows(data)
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    listUsers({ page: 1, limit: 200 })
      .then((d: any) => setStaffs(d?.rows ?? []))
      .catch(() => undefined)
  }, [load])

  const list = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.full_name?.toLowerCase().includes(keyword.toLowerCase()) ||
          (r.custom_fields?.condition ?? '').toLowerCase().includes(keyword.toLowerCase()),
      ),
    [rows, keyword],
  )

  const openModal = (r?: HealthRow) => {
    setEditing(r ?? null)
    const cf = r?.custom_fields ?? {}
    form.setFieldsValue(
      r
        ? {
            skin_type: cf.skin_type ?? SKIN_TYPES[0],
            condition: cf.condition ?? '',
            allergies: cf.allergies ?? 'Không',
            checked_by: cf.checked_by,
            checked_date: cf.checked_date ? dayjs(cf.checked_date) : dayjs(),
          }
        : { skin_type: SKIN_TYPES[0], condition: '', allergies: 'Không', checked_date: dayjs() },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (!editing) {
      message.warning('Chọn khách hàng từ bảng để cập nhật sổ sức khỏe')
      return
    }
    const custom_fields: HealthFields = {
      ...(editing.custom_fields ?? {}),
      skin_type: values.skin_type,
      condition: values.condition,
      allergies: values.allergies,
      checked_by: values.checked_by,
      checked_date: values.checked_date?.format?.('YYYY-MM-DD'),
    }
    try {
      await updateCustomerProfile(editing.id, { custom_fields: custom_fields as Record<string, unknown> })
      message.success('Đã cập nhật sổ sức khỏe')
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#A9ADB2' }} />}
              placeholder="Tìm theo khách, tình trạng da..."
              style={{ width: 260 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </Space>
        }
      >
        Sổ sức khỏe
      </PageTitle>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        columns={[
          {
            title: 'Khách hàng',
            render: (_, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{row.full_name}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.phone}</div>
              </div>
            ),
          },
          {
            title: 'Loại da',
            width: 130,
            render: (_, row) =>
              row.custom_fields?.skin_type ? <Tag color="purple">{row.custom_fields.skin_type}</Tag> : '—',
          },
          {
            title: 'Tình trạng da',
            render: (_, row) => row.custom_fields?.condition || '—',
          },
          {
            title: 'Dị ứng',
            width: 140,
            render: (_, row) =>
              !row.custom_fields?.allergies || row.custom_fields.allergies === 'Không' ? (
                <Typography.Text type="secondary">Không</Typography.Text>
              ) : (
                <Tag color="red">{row.custom_fields.allergies}</Tag>
              ),
          },
          {
            title: 'Khám bởi',
            width: 120,
            render: (_, row) => row.custom_fields?.checked_by || '—',
          },
          {
            title: 'Ngày khám',
            width: 110,
            render: (_, row) =>
              row.custom_fields?.checked_date ? dayjs(row.custom_fields.checked_date).format('DD/MM/YYYY') : '—',
          },
          {
            title: '',
            width: 140,
            render: (_, row) => (
              <Button size="small" icon={<PlusOutlined />} onClick={() => openModal(row)}>
                {row.custom_fields?.condition ? 'Sửa' : 'Ghi nhận'}
              </Button>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? `Sổ sức khỏe — ${editing.full_name}` : 'Ghi nhận'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="skin_type" label="Loại da" style={{ flex: 1 }}>
              <Select options={SKIN_TYPES.map((t) => ({ value: t, label: t }))} />
            </Form.Item>
            <Form.Item name="checked_by" label="Khám bởi" style={{ flex: 1 }}>
              <Select
                allowClear
                options={staffs.map((s) => ({ value: s.zalo_name || s.email || s.id.slice(0, 8), label: s.zalo_name || s.email || s.id.slice(0, 8) }))}
              />
            </Form.Item>
          </Space>
          <Form.Item name="condition" label="Tình trạng da" rules={[{ required: true, message: 'Nhập tình trạng da' }]}>
            <Input.TextArea rows={3} placeholder="VD: Mụn viêm vùng cằm, thâm nhẹ..." />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="allergies" label="Dị ứng" style={{ flex: 1 }}>
              <Input placeholder="VD: Cồn khô / Không" />
            </Form.Item>
            <Form.Item name="checked_date" label="Ngày khám" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
