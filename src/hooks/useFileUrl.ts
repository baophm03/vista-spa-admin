import { useQuery } from '@tanstack/react-query'
import { getFiles } from '@/api/endpoints/files'
import links from '@/configs/links'

export interface FileRow {
  id: string
  path?: string
  file_name?: string
  content_type?: string
}

/** Seed id→path ngay sau upload để preview hiển thị tức thì, không chờ refetch GET /files. */
const uploadedPaths = new Map<string, string>()

export function registerUploadedFile(id?: string | null, filePath?: string | null) {
  if (id && filePath) uploadedPaths.set(id, filePath)
}

function toSrc(filePath?: string | null): string | null {
  if (!filePath) return null
  return `${links.imageEndpoint}/${filePath.replace(/^\/+/, '')}`
}

/** Object file BE trả kèm (image_file/cover_file/photo_file/file...) → URL = imageEndpoint + path. */
export function fileSrc(file?: { path?: string | null } | null): string | null {
  return toSrc(file?.path)
}

/** path (/{bucket}/tên file) → URL hiển thị. */
export function objectKeySrc(filePath?: string | null): string | null {
  return toSrc(filePath)
}

/**
 * Resolve một value có thể là file_id (uuid) hoặc path/URL legacy thành src hiển thị được.
 * Trả về null nếu chưa biết (ví dụ id chưa có trong map).
 */
export function resolveFileSrc(map: Map<string, string> | undefined, value?: string | null): string | null {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/')) return `${links.imageEndpoint}${value}`
  return map?.get(value) ?? toSrc(uploadedPaths.get(value))
}

/** Nạp toàn bộ file đã upload (GET /files) và trả map file_id → URL hiển thị. */
export function useFileUrlMap(): Map<string, string> {
  const { data } = useQuery({
    queryKey: ['files', 'urlMap'],
    queryFn: async () => {
      const body = (await getFiles()) as unknown as { responseData?: FileRow[] } | FileRow[]
      const rows = (body as { responseData?: FileRow[] }).responseData ?? (body as FileRow[])
      const map = new Map<string, string>()
      for (const row of Array.isArray(rows) ? rows : []) {
        if (!row?.id) continue
        const src = toSrc(row.path)
        if (src) map.set(row.id, src)
      }
      for (const [id, filePath] of uploadedPaths) {
        const src = toSrc(filePath)
        if (src) map.set(id, src)
      }
      return map
    },
    staleTime: 30_000,
  })
  return data ?? new Map()
}
