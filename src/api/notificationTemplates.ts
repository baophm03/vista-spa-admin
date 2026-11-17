// Thin wrapper cho NotificationTemplates — chỉ còn PUT /notification-templates/{id}/admin
// vì client orval chưa sinh route item (BE {id}/admin.ts chưa có block @openapi, chỉ sinh
// được GET list /notification-templates/admin qua generated client).
import { apiClient } from '@/api/mutator/custom-instance'

export interface NotificationTemplate {
  id: string
  event_key: string
  channel: 'app' | 'email' | 'zalo'
  title?: string | null
  body?: string | null
  is_enabled: boolean
  allowed_variables: string[]
  channel_available?: boolean
}

export interface NotificationTemplateUpdate {
  title: string
  body: string
  is_enabled: boolean
}

export const putNotificationTemplate = async (id: string, data: NotificationTemplateUpdate) =>
  (await apiClient.put(`/notification-templates/${id}/admin`, data)).data
