import { useState } from 'react'
import { Alert, Button, Checkbox, Form, Table, Tag, message } from 'antd'
import { BellOutlined, CheckOutlined, MailOutlined, SendOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import { errorMessage, pickData } from '@/api/helpers'
import type { Notification } from '@/api/models/notification'
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useGetNotifications, usePostNotifications, usePutNotificationsId } from '@/api/endpoints/admin'
import { Can } from '@casl/react'
import { useBrandDateTime } from '@/themeRuntime'
import NotificationModal from './components/NotificationModal'

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
  const profilePayload = pickData<CustomerProfile[] | { rows?: CustomerProfile[] }>(profilesQuery.data)
  const profiles = (Array.isArray(profilePayload) ? profilePayload : profilePayload?.rows ?? []) as CustomerProfile[]
  const loading = notificationsQuery.isLoading
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [hoverHeaderStt, setHoverHeaderStt] = useState(false)

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

  // Chọn nhiều thông báo chưa đọc để đánh dấu đã đọc hàng loạt
  const pageUnreadIds = rows.filter((row) => !row.is_read).map((row) => row.id)
  const allSelected = pageUnreadIds.length > 0 && pageUnreadIds.every((id) => selectedIds.includes(id))
  const toggleRowSelect = (row: NotificationRow, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...new Set([...prev, row.id])] : prev.filter((id) => id !== row.id)))
  const toggleSelectAll = (checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...new Set([...prev, ...pageUnreadIds])] : prev.filter((id) => !pageUnreadIds.includes(id))))

  const markSelectedRead = async () => {
    if (!selectedIds.length) return
    try {
      await Promise.all(selectedIds.map((id) => markReadMutation.mutateAsync({ id })))
      message.success(`Đã đánh dấu ${selectedIds.length} thông báo đã đọc`)
      setSelectedIds([])
      await notificationsQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể cập nhật thông báo'))
    }
  }

  const audience = (row: NotificationRow) =>
    row.user_id ? profiles.find((p) => p.user_id === row.user_id)?.full_name ?? 'Một khách hàng' : 'Tất cả khách (broadcast)'

  // Thống kê đầu trang — rows tải toàn bộ, không phân trang server
  const unreadCount = rows.filter((row) => !row.is_read).length
  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng thông báo', value: rows.length.toLocaleString('vi-VN'), icon: <BellOutlined />, tone: 'primary' },
    { key: 'unread', label: 'Chưa đọc', value: unreadCount.toLocaleString('vi-VN'), icon: <MailOutlined />, tone: 'tertiary' },
    { key: 'read', label: 'Đã đọc', value: (rows.length - unreadCount).toLocaleString('vi-VN'), icon: <CheckOutlined />, tone: 'neutral' },
  ]

  return (
    <>
      <StatCards items={statItems} />

      <PageTitle
        subtitle="Thông báo hệ thống gửi tới khách hàng"
        left={
          selectedIds.length > 0 && (
            <Button icon={<CheckOutlined />} onClick={() => void markSelectedRead()}>
              Đánh dấu đã đọc ({selectedIds.length})
            </Button>
          )
        }
        right={
          <Can I="CREATE" a="NOTIFICATION">
            <Button
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
        className="desktop-only"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: <TableEmpty description="Chưa có thông báo nào" /> }}
        style={{ marginTop: 4 }}
        onRow={(row) => ({
          onMouseEnter: () => setHoveredRowId(row.id),
          onMouseLeave: () => setHoveredRowId((current) => (current === row.id ? null : current)),
        })}
        columns={[
          {
            title: (
              <span
                onMouseEnter={() => setHoverHeaderStt(true)}
                onMouseLeave={() => setHoverHeaderStt(false)}
                style={{ display: 'inline-block', minWidth: 32 }}
              >
                {hoverHeaderStt || allSelected
                  ? <Checkbox checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />
                  : 'STT'}
              </span>
            ),
            key: 'stt',
            width: 64,
            align: 'center' as const,
            render: (_v, row) => {
              const checked = selectedIds.includes(row.id)
              const isHovered = hoveredRowId === row.id
              const index = rows.indexOf(row) + 1
              if (row.is_read) return <span style={{ color: '#A9ADB2' }}>{index}</span>
              if (!isHovered && !checked && !allSelected) return index
              return <Checkbox checked={checked || allSelected} onChange={(e) => toggleRowSelect(row, e.target.checked)} />
            },
          },
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
            width: 110,
            render: (_, row) => (row.is_read ? <Tag>Đã đọc</Tag> : <Tag color="processing">Chưa đọc</Tag>),
          },
          {
            title: 'Hành động', align: 'center' as const,
            key: 'actions',
            width: 90,
            fixed: 'right' as const,
            render: (_, row) => row.is_read ? undefined : (
              <RowActionsMenu
                items={[{ key: 'mark_read', icon: <CheckOutlined />, label: 'Đánh dấu đã đọc' }]}
                onSelect={(key) => {
                  if (key === 'mark_read') void markRead(row)
                }}
              />
            ),
          },
        ]}
      />
      <MobileCards
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        emptyText="Chưa có thông báo nào"
        renderCard={(row) => (
          <>
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">{row.title || 'Thông báo'}</div>
                <div className="mobile-card-sub">{row.body}</div>
              </div>
              {row.is_read ? <Tag>Đã đọc</Tag> : <Tag color="processing">Chưa đọc</Tag>}
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Loại" value={<Tag color={EVENT_META[row.event_key]?.color} style={{ margin: 0 }}>{EVENT_META[row.event_key]?.label ?? row.event_key}</Tag>} />
              <MobileCardRow label="Kênh" value={row.channel === 'email' ? 'Email' : 'Trong ứng dụng'} />
              <MobileCardRow label="Đối tượng" value={audience(row)} />
              <MobileCardRow label="Thời gian" value={formatDateTime(row.sent_at)} />
            </div>
            {!row.is_read && (
              <div className="mobile-card-actions">
                <Button size="small" type="primary" icon={<CheckOutlined />} loading={markReadMutation.isPending} onClick={() => void markRead(row)}>Đánh dấu đã đọc</Button>
              </div>
            )}
          </>
        )}
      />
      <ListPagination page={1} limit={rows.length || 10} total={rows.length || 0} onChange={() => undefined} noun="thông báo" />

      <NotificationModal
        open={open}
        form={form}
        profiles={profiles}
        eventMeta={EVENT_META}
        onCancel={() => setOpen(false)}
        onSubmit={() => void submit()}
      />
    </>
  )
}