import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Space, Switch, Table, Tag, Tooltip, Typography, message } from 'antd'
import { EditOutlined } from '@ant-design/icons'
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
import NotificationTemplateModal from './components/NotificationTemplateModal'
import {
  CHANNELS,
  EVENTS,
  previewTemplate,
} from './components/constants'

const queryKey = ['notification-templates']

export default function NotificationTemplates() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm<NotificationTemplateUpdate>()
  const profile = useProfileStore((state) => state.profile)
  const isAdmin = Boolean(profile?.is_admin || profile?.roles?.some((role) => role.trim().toLowerCase() === 'admin'))
  const [editing, setEditing] = useState<NotificationTemplate | null>(null)

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
  }

  const save = async () => {
    if (!editing) return
    const values = await form.validateFields()
    updateMutation.mutate({ id: editing.id, data: values })
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

      <NotificationTemplateModal
        editing={editing}
        onCancel={() => setEditing(null)}
        onSave={() => void save()}
        confirmLoading={updateMutation.isPending}
        form={form}
      />
    </>
  )
}
