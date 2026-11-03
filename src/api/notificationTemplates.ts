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

export const getNotificationTemplates = async () => (await apiClient.get('/notificationTemplates')).data

export const getNotificationTemplate = async (id: string) => (await apiClient.get(`/notificationTemplates/${id}`)).data

export const putNotificationTemplate = async (id: string, data: NotificationTemplateUpdate) =>
  (await apiClient.put(`/notificationTemplates/${id}`, data)).data
