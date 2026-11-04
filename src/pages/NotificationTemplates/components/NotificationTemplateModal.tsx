import { useRef } from 'react'
import { Button, Form, type FormInstance, Input, Modal, Space, Switch, Typography } from 'antd'
import type { NotificationTemplate, NotificationTemplateUpdate } from '@/api/notificationTemplates'
import {
  CHANNELS,
  EVENTS,
  VARIABLE_LABELS,
  previewTemplate,
} from './constants'

interface NotificationTemplateModalProps {
  editing: NotificationTemplate | null
  onCancel: () => void
  onSave: () => void
  confirmLoading: boolean
  form: FormInstance<NotificationTemplateUpdate>
}

export default function NotificationTemplateModal({
  editing,
  onCancel,
  onSave,
  confirmLoading,
  form,
}: NotificationTemplateModalProps) {
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const activeFieldRef = useRef<'title' | 'body'>('body')

  const previewTitle = Form.useWatch('title', form)
  const previewBody = Form.useWatch('body', form)

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

  return (
    <Modal
      title="Chỉnh sửa mẫu thông báo"
      open={Boolean(editing)}
      onCancel={onCancel}
      onOk={onSave}
      okText="Lưu mẫu"
      cancelText="Hủy"
      confirmLoading={confirmLoading}
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
  )
}

