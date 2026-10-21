import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Select, Table, Tag, message } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '../components/base/PageTitle'
import { bizErrorMessage, listCustomerProfiles, listNotifications, markNotificationRead, sendNotification } from '../api/newsky'
import type { CustomerProfile, NotificationRow } from '../api/newsky'

const EVENT_META: Record<string, { label: string; color: string }> = {
  APPT_REMINDER: { label: 'Nhắc lịch', color: 'purple' },
  BIRTHDAY: { label: 'Sinh nhật', color: 'magenta' },
  RANK_CHANGE: { label: 'Nâng hạng', color: 'gold' },
  SYSTEM: { label: 'Hệ thống', color: 'default' },
}

export default function Notifications() {
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<CustomerProfile[]>([])
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, meta } = await listNotifications({ page, limit })
      setRows(data)
      setTotal(meta?.total ?? data.length)
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    listCustomerProfiles({ page: 1, limit: 200 }).then(({ data }) => setProfiles(data)).catch(() => undefined)
  }, [])

  const submit = async () => {
    const values = await form.validateFields()
    try {
      await sendNotification({
        event_key: values.event_key,
        title: values.title,
        body: values.body,
        user_id: values.user_id || null,
      })
      message.success('Đã gửi thông báo')
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const markRead = async (row: NotificationRow) => {
    try {
      await markNotificationRead(row.id)
      message.success('Đã đánh dấu đã đọc')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const audience = (row: NotificationRow) =>
    row.user_id ? profiles.find((p) => p.user_id === row.user_id)?.full_name ?? 'Một khách hàng' : 'Tất cả khách (broadcast)'

  return (
    <>
      <PageTitle
        extra={
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => {
              form.setFieldsValue({ event_key: 'SYSTEM', title: '', body: '', user_id: undefined })
              setOpen(true)
            }}
          >
            Gửi thông báo
          </Button>
        }
      >
        Thông báo
      </PageTitle>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ current: page, pageSize: limit, total, onChange: setPage }}
        style={{ marginTop: 4 }}
        columns={[
          {
            title: 'Thông báo',
            dataIndex: 'title',
            render: (v, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.body}</div>
              </div>
            ),
          },
          {
            title: 'Loại',
            dataIndex: 'event_key',
            width: 120,
            render: (v: string) => <Tag color={EVENT_META[v]?.color}>{EVENT_META[v]?.label ?? v}</Tag>,
          },
          { title: 'Đối tượng', key: 'audience', width: 180, render: (_, row) => audience(row) },
          { title: 'Thời gian', dataIndex: 'sent_at', width: 170, render: (v) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—') },
          {
            title: 'Trạng thái',
            key: 'read',
            width: 160,
            render: (_, row) =>
              row.is_read ? (
                <Tag>Đã đọc</Tag>
              ) : (
                <Button size="small" onClick={() => markRead(row)}>
                  Đánh dấu đã đọc
                </Button>
              ),
          },
        ]}
      />

      <Modal title="Gửi thông báo" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Gửi" cancelText="Hủy">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="event_key" label="Loại thông báo" rules={[{ required: true }]}>
            <Select options={Object.entries(EVENT_META).map(([value, meta]) => ({ value, label: meta.label }))} />
          </Form.Item>
          <Form.Item name="user_id" label="Đối tượng nhận (bỏ trống = broadcast tất cả)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tất cả khách hàng"
              options={profiles
                .filter((p) => p.user_id)
                .map((c) => ({ value: c.user_id, label: `${c.full_name} — ${c.phone}` }))}
            />
          </Form.Item>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
            <Input placeholder="VD: Ưu đãi tháng 11" />
          </Form.Item>
          <Form.Item name="body" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung' }]}>
            <Input.TextArea rows={3} placeholder="Nội dung thông báo gửi qua app..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
