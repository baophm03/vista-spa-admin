/**
 * Đọc payload từ envelope Response chuẩn của BE: { status, message, responseData, meta, code, details }.
 * Toàn bộ endpoint (cả legacy lẫn mới) đã hợp nhất về một envelope này.
 */
export interface PagedMeta {
  page?: number
  limit?: number
  total?: number
}

export function pickData<T = unknown>(body: unknown): T {
  const b = body as { responseData?: unknown; data?: unknown } | null
  return (b?.responseData ?? b?.data ?? (b as T)) as T
}

export function pickMeta(body: unknown): PagedMeta | undefined {
  const meta = (body as { meta?: PagedMeta })?.meta
  return meta ?? undefined
}

export function pickErrorCode(body: unknown): string | null {
  return ((body as { code?: string | null })?.code ?? null) || null
}

export function pickDetails(body: unknown): Record<string, unknown> | null {
  return ((body as { details?: Record<string, unknown> | null })?.details ?? null) || null
}

/** Trích thông điệp lỗi từ axios error (body có `message`) hoặc Error thường. */
export function errorMessage(err: unknown, fallback = 'Đã có lỗi xảy ra'): string {
  if (!err) return fallback
  const anyErr = err as { response?: { data?: { message?: unknown } }; message?: unknown }
  const apiMessage = anyErr?.response?.data?.message
  if (typeof apiMessage === 'string' && apiMessage) return apiMessage
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}

/** Tải blob (CSV export, QR PNG...) kèm bearer token từ store — dùng cho endpoint trả file. */
export async function downloadBlob(path: string, filename: string): Promise<void> {
  const { apiClient } = await import('@/api/mutator/custom-instance')
  const response = await apiClient.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data as Blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
