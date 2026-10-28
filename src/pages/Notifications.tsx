import { useState } from 'react'
import { Alert, Button, Form, Input, Modal, Select, Table, Tag, message } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { Notification } from '@/api/models/notification'
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useGetNotifications, usePostNotifications, usePutNotificationsId } from '@/api/endpoints/admin'
import { Can } from '@casl/react'
import { useBrandDateTime } from '@/themeRuntime'

interface NotificationRow {
  id: string
  user_id?: string | null
  event_key: string
  channel?: 'app' | 'email'
  title?: string
  body?: string
  is_read?: boolean
  sent_at?: string
}
interface CustomerProfile {
  id: string
  user_id?: string
  full_name: string
  phone: string
}

const EVENT_META: Record<string, { label: string; color: string }> = {
  APPT_REMINDER: { label: 'Nhắc lịch', color: 'purple' },
  BIRTHDAY: { label: 'Sinh nhật', color: 'magenta' },
  RANK_CHANGE: { label: 'Nâng hạng', color: 'gold' },
  SYSTEM: { label: 'Hệ thống', color: 'default' },
}

export default function Notifications() {
  const { formatDateTime } = useBrandDateTime()
  const notificationsQuery = useGetNotifications()
  const profilesQuery = useGetCustomerProfiles()
  const sendMutation = usePostNotifications()
  const markReadMutation = usePutNotificationsId()
  // Envelope chuẩn: responseData: Notification[] + meta.total
  const payload = pickData<NotificationRow[] | { rows?: NotificationRow[] }>(notificationsQuery.data)
  const rows = (Array.isArray(payload) ? payload : payload?.rows ?? []) as NotificationRow[]
  const total = pickMeta(notificationsQuery.data)?.total ?? rows.length
  const profilePayload = pickData<CustomerProfile[] | { rows?: CustomerProfile[] }>(profilesQuery.data)
  const profiles = (Array.isArray(profilePayload) ? profilePayload : profilePayload?.rows ?? []) as CustomerProfile[]
  const loading = notificationsQuery.isLoading
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const submit = async () => {
    const values = await form.validateFields()
    try {
      await sendMutation.mutateAsync({
        data: {
          event_key: values.event_key,
          channel: values.channel || 'app',
          title: values.title,
          body: values.body,
          user_id: values.user_id || null,
        } as unknown as Notification,
      })
      message.success('Đã gửi thông báo')
      setOpen(false)
      await notificationsQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể gửi thông báo'))
    }
  }

  const markRead = async (row: NotificationRow) => {
    try {
      await markReadMutation.mutateAsync({ id: row.id })
      message.success('Đã đánh dấu đã đọc')
      await notificationsQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể cập nhật thông báo'))
    }
  }

  const audience = (row: NotificationRow) =>
    row.user_id ? profiles.find((p) => p.user_id === row.user_id)?.full_name ?? 'Một khách hàng' : 'Tất cả khách (broadcast)'

  return (
    <>
      <PageTitle
        extra={
          <Can I="CREATE" a="NOTIFICATION">
            <Button
              className="max-sm:w-full"
              type="primary"
              icon={<SendOutlined />}
              onClick={() => {
                form.setFieldsValue({ event_key: 'SYSTEM', channel: 'app', title: '', body: '', user_id: undefined })
                setOpen(true)
              }}
            >
              Gửi thông báo
            </Button>
          </Can>
        }
      >
        Thông báo
      </PageTitle>

      {notificationsQuery.isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Không tải được danh sách thông báo"
          description={errorMessage(notificationsQuery.error)}
          action={<Button size="small" onClick={() => void notificationsQuery.refetch()}>Thử lại</Button>}
        />
      )}

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ current: 1, pageSize: rows.length || 10, total }}
        locale={{ emptyText: 'Chưa có thông báo nào' }}
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
          {
            title: 'Kênh',
            dataIndex: 'channel',
            width: 110,
            render: (value?: string) => <Tag color={value === 'email' ? 'blue' : 'default'}>{value === 'email' ? 'Email' : 'Trong ứng dụng'}</Tag>,
          },
          { title: 'Đối tượng', key: 'audience', width: 180, render: (_, row) => audience(row) },
          { title: 'Thời gian', dataIndex: 'sent_at', width: 170, render: (v) => formatDateTime(v) },
          {
            title: 'Trạng thái',
            key: 'read',
            width: 160,
            render: (_, row) =>
              row.is_read ? (
                <Tag>Đã đọc</Tag>
              ) : (
                <Button size="small" onClick={() => void markRead(row)}>
                  Đánh dấu đã đọc
                </Button>
              ),
          },
        ]}
      />

      <Modal title="Gửi thông báo" open={open} onCancel={() => setOpen(false)} onOk={() => void submit()} okText="Gửi" cancelText="Hủy">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="channel" label="Kênh gửi" rules={[{ required: true }]} initialValue="app">
          <Select options={[{ value: 'app', label: 'Thông báo trong ứng dụng' }, { value: 'email', label: 'Email' }]} />
          </Form.Item>
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
