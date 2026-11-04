import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Space, Switch, Table, Tag, Tooltip, Typography, message } from 'antd'
import { EditOutlined, ReloadOutlined } from '@ant-design/icons'
import PageTitle from '@/components/base/PageTitle'
import TableEmpty from '@/components/base/TableEmpty'
import { errorMessage, pickData } from '@/api/helpers'
import {
  getNotificationTemplates,
  putNotificationTemplate,
  type NotificationTemplate,
  type NotificationTemplateUpdate,
} from '@/api/notificationTemplates'
import { useProfileStore } from '@/stores/profile-store'

const EVENTS = [
  { key: 'APPT_REMINDER', label: 'Nhắc lịch hẹn', description: 'Gửi theo mốc nhắc lịch đã cấu hình.' },
  { key: 'BIRTHDAY', label: 'Chúc mừng sinh nhật', description: 'Gửi vào ngày sinh nhật của khách.' },
  { key: 'CONTENT_PUBLISHED', label: 'Nội dung mới', description: 'Gửi khi bài viết được xuất bản và chọn thông báo.' },
  { key: 'NEXT_SESSION_REMINDER', label: 'Nhắc buổi liệu trình tiếp theo', description: 'Nhắc khách trước ngày buổi điều trị đã lên lịch.' },
  { key: 'RANK_NEAR', label: 'Sắp đạt hạng', description: 'Gửi khi khách gần đạt điều kiện lên hạng.' },
  { key: 'RANK_UP', label: 'Khách được nâng hạng', description: 'Gửi khi khách được nâng hạng thành viên.' },
  { key: 'SESSION_THANKS', label: 'Cảm ơn sau buổi điều trị', description: 'Gửi sau khi buổi dịch vụ hoặc liệu trình hoàn tất.' },
  { key: 'WHEEL_RESULT', label: 'Kết quả vòng quay', description: 'Gửi kết quả lượt quay may mắn.' },
]

const CHANNELS = [
  { key: 'app', label: 'Trong ứng dụng' },
  { key: 'email', label: 'Email' },
  { key: 'zalo', label: 'Zalo OA' },
] as const

const VARIABLE_LABELS: Record<string, string> = {
  customer_name: 'Tên khách hàng',
  appt_date: 'Ngày hẹn',
  appt_time: 'Giờ hẹn',
  service_name: 'Dịch vụ / liệu trình',
  branch_name: 'Chi nhánh',
  rank_name: 'Hạng thành viên',
  progress_percent: 'Mức độ đạt hạng',
  remaining_amount: 'Số tiền còn thiếu',
  session_date: 'Ngày điều trị',
  session_time: 'Giờ điều trị',
  staff_name: 'Kỹ thuật viên',
  prize_name: 'Quà nhận được',
  content_title: 'Tiêu đề nội dung',
  content_summary: 'Mô tả nội dung',
}

const PREVIEW_VALUES: Record<string, string> = {
  customer_name: 'Nguyễn Minh Anh', appt_date: '05/11/2026', appt_time: '09:00', service_name: 'Peel da sinh học',
  branch_name: 'NewSky Vista', rank_name: 'Vàng', progress_percent: '90', remaining_amount: '1.000.000 ₫',
  session_date: '05/11/2026', session_time: '09:00', staff_name: 'Nguyễn Minh Anh', prize_name: 'Giảm 50.000 ₫',
  content_title: 'Chăm sóc da mùa hanh khô', content_summary: 'Khám phá các bước chăm sóc da phù hợp trong mùa hanh khô.',
}

const queryKey = ['notification-templates']

function previewTemplate(text: string | null | undefined) {
  return String(text ?? '').replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key: string) => PREVIEW_VALUES[key] ?? `{{${key}}}`)
}

export default function NotificationTemplates() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm<NotificationTemplateUpdate>()
  const profile = useProfileStore((state) => state.profile)
  const isAdmin = Boolean(profile?.is_admin || profile?.roles?.some((role) => role.trim().toLowerCase() === 'admin'))
  const [editing, setEditing] = useState<NotificationTemplate | null>(null)
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const activeFieldRef = useRef<'title' | 'body'>('body')

  const templatesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await getNotificationTemplates()
      const payload = pickData<unknown>(response)
      if (Array.isArray(payload)) return payload as NotificationTemplate[]
      if (payload && typeof payload === 'object') {
        const data = (payload as { data?: unknown; rows?: unknown }).data
        const rows = (payload as { rows?: unknown }).rows
        if (Array.isArray(data)) return data as NotificationTemplate[]
        if (Array.isArray(rows)) return rows as NotificationTemplate[]
      }
      return []
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: NotificationTemplateUpdate }) => putNotificationTemplate(id, data),
    onSuccess: async () => {
      message.success('Đã cập nhật mẫu thông báo')
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => message.error(errorMessage(error, 'Không thể cập nhật mẫu thông báo')),
  })

  const openEditor = (template: NotificationTemplate) => {
    setEditing(template)
    form.setFieldsValue({ title: template.title ?? '', body: template.body ?? '', is_enabled: template.is_enabled })
    activeFieldRef.current = 'body'
  }

  const save = async () => {
    if (!editing) return
    const values = await form.validateFields()
    updateMutation.mutate({ id: editing.id, data: values })
  }

  const insertVariable = (variable: string) => {
    const token = `{{${variable}}}`
    const input = activeInputRef.current
    const field = activeFieldRef.current
    const current = String(form.getFieldValue(field) ?? '')
    const start = input?.selectionStart ?? current.length
    const end = input?.selectionEnd ?? start
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`
    form.setFieldValue(field, next)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const rows = templatesQuery.data ?? []
  const grouped = useMemo(() => {
    const byEvent = new Map(rows.map((template) => [`${template.event_key}:${template.channel}`, template]))
    return EVENTS.map((event) => ({
      ...event,
      app: byEvent.get(`${event.key}:app`),
      email: byEvent.get(`${event.key}:email`),
      zalo: byEvent.get(`${event.key}:zalo`),
    }))
  }, [rows])

  const previewTitle = Form.useWatch('title', form)
  const previewBody = Form.useWatch('body', form)

  const renderChannel = (template?: NotificationTemplate) => {
    if (!template) return <Typography.Text type="secondary">Mẫu chưa được khởi tạo</Typography.Text>
    const available = template.channel_available !== false
    const label = CHANNELS.find((channel) => channel.key === template.channel)?.label ?? template.channel
    return (
      <div className="min-w-[260px]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Space size={8}>
            <Tooltip title={!available ? 'Kết nối và bật Zalo OA trong phần Tích hợp trước khi bật mẫu.' : undefined}>
              <Switch
                size="small"
                checked={template.is_enabled}
                disabled={!isAdmin || !available}
                loading={updateMutation.isPending && updateMutation.variables?.id === template.id}
                checkedChildren="Bật"
                unCheckedChildren="Tắt"
                onChange={(checked) => updateMutation.mutate({
                  id: template.id,
                  data: { title: template.title ?? '', body: template.body ?? '', is_enabled: checked },
                })}
              />
            </Tooltip>
            <Tag color={template.is_enabled ? 'green' : 'default'}>{template.is_enabled ? 'Đang bật' : 'Đang tắt'}</Tag>
          </Space>
          {isAdmin && <Button size="small" icon={<EditOutlined />} onClick={() => openEditor(template)}>Sửa</Button>}
        </div>
        <Typography.Text strong className="block">{previewTemplate(template.title) || `Mẫu ${label}`}</Typography.Text>
        <Typography.Paragraph className="mb-0 mt-1" type="secondary" ellipsis={{ rows: 2, tooltip: previewTemplate(template.body) }}>
          {previewTemplate(template.body) || 'Chưa có nội dung'}
        </Typography.Paragraph>
        {!available && <Typography.Text type="secondary" className="text-xs">Cần kết nối Zalo OA</Typography.Text>}
      </div>
    )
  }

  return (
    <>
      <PageTitle
        subtitle="Quản lý nội dung thông báo tự động theo sự kiện và kênh gửi"
        extra={(
          <Button icon={<ReloadOutlined />} onClick={() => void templatesQuery.refetch()} loading={templatesQuery.isFetching}>
            Tải lại
          </Button>
        )}
      >
        Mẫu thông báo
      </PageTitle>

      <Alert
        className="mb-4!"
        type="info"
        showIcon
        title={isAdmin ? 'Admin có thể sửa mẫu và bật/tắt theo từng kênh.' : 'Lễ tân được xem mẫu thông báo ở chế độ chỉ đọc.'}
        description="Zalo OA chỉ bật được sau khi cấu hình tích hợp và kiểm tra kết nối thành công."
      />

      {templatesQuery.isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          title="Không tải được danh sách mẫu thông báo"
          description={errorMessage(templatesQuery.error)}
          action={<Button size="small" onClick={() => void templatesQuery.refetch()}>Thử lại</Button>}
        />
      )}

      <Table
        rowKey="key"
        loading={templatesQuery.isLoading}
        dataSource={grouped}
        pagination={false}
        scroll={{ x: 1420 }}
        locale={{ emptyText: <TableEmpty description="Chưa có mẫu thông báo" /> }}
        columns={[
          {
            title: 'Sự kiện',
            dataIndex: 'label',
            width: 230,
            fixed: 'left',
            render: (_: string, row: (typeof grouped)[number]) => (
              <div>
                <Typography.Text strong>{row.label}</Typography.Text>
                <div><Typography.Text type="secondary" className="text-xs">{row.description}</Typography.Text></div>
              </div>
            ),
          },
          { title: 'Trong ứng dụng', dataIndex: 'app', width: 390, render: renderChannel },
          { title: 'Email', dataIndex: 'email', width: 390, render: renderChannel },
          { title: 'Zalo OA', dataIndex: 'zalo', width: 390, render: renderChannel },
        ]}
      />

      <Modal
        title="Chỉnh sửa mẫu thông báo"
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={() => void save()}
        okText="Lưu mẫu"
        cancelText="Hủy"
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
        width={720}
      >
        {editing && (
          <>
            <div className="mb-3">
              <Typography.Text strong>{EVENTS.find((event) => event.key === editing.event_key)?.label ?? editing.event_key}</Typography.Text>
              <Typography.Text type="secondary"> · {CHANNELS.find((channel) => channel.key === editing.channel)?.label}</Typography.Text>
            </div>
            <Typography.Text className="mb-2 block">Bấm vào biến để chèn tại vị trí con trỏ:</Typography.Text>
            <Space size={[6, 6]} wrap className="mb-4">
              {editing.allowed_variables.map((variable) => (
                <Button key={variable} size="small" onClick={() => insertVariable(variable)}>
                  {VARIABLE_LABELS[variable] ?? variable}
                </Button>
              ))}
            </Space>
            <Typography.Paragraph type="secondary" className="-mt-3 mb-3 text-xs">
              Khi gửi, hệ thống tự thay các mục này bằng thông tin thực tế. Khung xem trước bên dưới hiển thị ví dụ.
            </Typography.Paragraph>
            <Form form={form} layout="vertical">
              <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề mẫu' }, { max: 255, message: 'Tiêu đề tối đa 255 ký tự' }]}>
                <Input
                  maxLength={255}
                  onFocus={(event) => { activeInputRef.current = event.currentTarget; activeFieldRef.current = 'title' }}
                />
              </Form.Item>
              <Form.Item name="body" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung mẫu' }]}>
                <Input.TextArea
                  rows={5}
                  maxLength={10000}
                  onFocus={(event) => { activeInputRef.current = event.currentTarget; activeFieldRef.current = 'body' }}
                />
              </Form.Item>
              <Form.Item name="is_enabled" label="Trạng thái" valuePropName="checked">
                <Switch
                  checkedChildren="Bật"
                  unCheckedChildren="Tắt"
                  disabled={editing.channel === 'zalo' && editing.channel_available === false}
                />
              </Form.Item>
            </Form>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Typography.Text strong>Xem trước</Typography.Text>
              <Typography.Title level={5} className="mb-2 mt-3">{previewTemplate(previewTitle ?? editing.title)}</Typography.Title>
              <Typography.Paragraph className="mb-0 whitespace-pre-wrap">{previewTemplate(previewBody ?? editing.body)}</Typography.Paragraph>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}