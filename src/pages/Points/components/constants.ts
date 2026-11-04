import {
  CrownOutlined,
  HeartOutlined,
  StarOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from '@ant-design/icons'

export interface RankRow {
  id: string
  code: string
  name: string
  sort_order: number
  min_spent?: number
  max_spent?: number
  validity?: string
  benefits?: string
  color?: string | null
  is_active?: boolean
}

export interface MemberRow {
  id: string
  full_name?: string
  phone?: string
  user_id?: string | null
  user?: { zalo_name?: string | null; phone_number?: string | null } | null
  membership?: {
    id?: string
    lifetime_points?: number
    year_spent?: number
    card_rank_id?: string
    card_rank?: { name?: string }
  } | null
}

export interface ProfileLite {
  id: string
  user_id?: string | null
  full_name?: string
  phone?: string
}

export type PointColumnKey = 'customer' | 'rank' | 'points' | 'year_spent'

export const POINT_COLUMN_OPTIONS: { label: string; value: PointColumnKey }[] = [
  { label: 'Khách hàng', value: 'customer' },
  { label: 'Hạng', value: 'rank' },
  { label: 'Điểm', value: 'points' },
  { label: 'Chi tiêu năm', value: 'year_spent' },
]

export const DEFAULT_VISIBLE_COLUMNS = POINT_COLUMN_OPTIONS.map((column) => column.value)

export const REF_TYPE_LABELS: Record<string, string> = {
  PAYMENT: 'Thanh toán',
  MANUAL: 'Điều chỉnh tay',
  RANK: 'Hạng',
  REWARD: 'Đổi quà',
  REWARD_CANCEL: 'Hủy đổi quà',
  REDEEM: 'Trừ vào gói',
  WHEEL: 'Vòng quay',
}

/** Theme hiển thị của thẻ hạng: ưu tiên màu admin chọn ở /card-ranks (rank.color),
 *  thiếu thì xoay vòng palette mặc định theo thứ tự hạng. */
export interface RankCardTheme {
  pillBg: string
  pillColor: string
  pillBorder: string
  cardBorder: string
  cardBg: string
  circle: string
  ink: string
  icon: typeof CrownOutlined
}

export const RANK_THEMES: RankCardTheme[] = [
  { pillBg: '#FBF3DE', pillColor: '#8A6A1F', pillBorder: '#EBD9A8', cardBorder: '#EFE7D2', cardBg: 'linear-gradient(135deg, #FCF8EE 0%, #FEFEFC 62%)', circle: 'rgba(213, 178, 94, 0.18)', ink: '#8A6A1F', icon: CrownOutlined },
  { pillBg: '#E8F2FE', pillColor: '#1E6FD0', pillBorder: '#C4DCFA', cardBorder: '#E3EDF7', cardBg: 'linear-gradient(135deg, #F3F8FE 0%, #FEFEFC 62%)', circle: 'rgba(96, 155, 222, 0.14)', ink: '#1E6FD0', icon: StarOutlined },
  { pillBg: '#FDF1DE', pillColor: '#C07A10', pillBorder: '#F0D9AC', cardBorder: '#F2EADA', cardBg: 'linear-gradient(135deg, #FCF6EA 0%, #FEFEFC 62%)', circle: 'rgba(224, 150, 60, 0.14)', ink: '#C07A10', icon: ThunderboltOutlined },
  { pillBg: '#E7F3FE', pillColor: '#2B77C9', pillBorder: '#C3DDF8', cardBorder: '#E0ECF8', cardBg: 'linear-gradient(135deg, #F0F7FE 0%, #FDFEFE 62%)', circle: 'rgba(120, 170, 225, 0.16)', ink: '#2B77C9', icon: TrophyOutlined },
  { pillBg: '#A11E42', pillColor: '#FFFFFF', pillBorder: '#A11E42', cardBorder: '#F3C7D4', cardBg: 'linear-gradient(135deg, #FDF0F4 0%, #FFFDFD 62%)', circle: 'rgba(212, 90, 130, 0.18)', ink: '#A11E42', icon: HeartOutlined },
]

/** Chuẩn hóa mã màu từ DB về #RRGGBB (chấp nhận #RGB và không có #). */
export function normalizeHex(color: string): string | null {
  const raw = color.trim().replace(/^#/, '')
  const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  return /^[0-9A-Fa-f]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : null
}

export function hexChannelAlpha(hex: string, alpha: number): string {
  const value = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${value}`
}

/** Độ sáng 0..1 của màu; dùng để chỉnh chữ pill khi admin chọn màu quá sáng. */
export function hexLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function rankThemeFromColor(color: string, fallback: RankCardTheme): RankCardTheme {
  const hex = normalizeHex(color)
  if (!hex) return fallback
  const luminance = hexLuminance(hex)
  const onColor = luminance > 0.62 ? '#3F3F46' : '#FFFFFF'
  return {
    pillBg: hex,
    pillColor: onColor,
    pillBorder: hex,
    cardBorder: hexChannelAlpha(hex, 0.35),
    cardBg: `linear-gradient(135deg, ${hexChannelAlpha(hex, 0.14)} 0%, #FEFEFC 62%)`,
    circle: hexChannelAlpha(hex, 0.22),
    ink: luminance > 0.62 ? '#4B5563' : hex,
    icon: fallback.icon,
  }
}
