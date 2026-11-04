import type { Dayjs } from 'dayjs'
import type { ContentPost } from '@/api/models/contentPost'

/** Các trường mới theo đặc tả 5.33 (chưa có trong client sinh tự động). */
export type ContentPostRow = ContentPost & {
  publish_at?: string | null
  expire_at?: string | null
  is_pinned?: boolean
  sort_order?: number
  notified_at?: string | null
}

export const DISPLAY_TYPE_OPTIONS = [
  { value: 'VIDEO', label: 'Video ngắn (Reels)' },
  { value: 'ARTICLE', label: 'Bài viết kiến thức' },
  { value: 'NEWS', label: 'Tin tức & sự kiện' },
  { value: 'LIST', label: 'Danh sách' },
  { value: 'GRID', label: 'Lưới' },
  { value: 'CAROUSEL', label: 'Trượt ngang' },
]

export function makePostSlug(value?: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 255)
}

export interface PostFormValues {
  category_id?: string
  title?: string
  slug?: string
  summary?: string
  content?: string
  cover_url?: string
  video_url?: string
  publish_at?: Dayjs | null
  expire_at?: Dayjs | null
  is_pinned?: boolean
  sort_order?: number
}

export interface CategoryFormValues {
  name?: string
  slug?: string
  display_type?: string
  sort_order?: number
  is_active?: boolean
}
