import { useMemo } from 'react'
import { useGetAppConfig } from '@/api/endpoints/app'
import { pickData } from '@/api/helpers'

const DEFAULTS = {
  scheduled: { label: 'Chưa làm', color: '#BFBFBF' },
  in_progress: { label: 'Đang làm', color: '#1677FF' },
  done: { label: 'Đã làm', color: '#FAAD14' },
  completed: { label: 'Hoàn thành', color: '#52C41A' },
} as const

type SessionStatus = keyof typeof DEFAULTS
type AppConfig = { settings?: Record<string, unknown> }

export default function useSessionStatusConfig() {
  const configQuery = useGetAppConfig(undefined, { query: { staleTime: 60_000 } })
  const config = pickData<AppConfig>(configQuery.data)

  return useMemo(() => {
    const labels = config?.settings?.['status.labels'] as Partial<Record<SessionStatus, unknown>> | undefined
    const colors = config?.settings?.['status.colors'] as Partial<Record<SessionStatus, unknown>> | undefined

    return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => {
      const status = key as SessionStatus
      const configuredLabel = labels?.[status]
      const configuredColor = colors?.[status]
      return [status, {
        label: typeof configuredLabel === 'string' && configuredLabel.trim() ? configuredLabel : fallback.label,
        color: typeof configuredColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(configuredColor) ? configuredColor : fallback.color,
      }]
    })) as Record<SessionStatus, { label: string; color: string }>
  }, [config])
}
