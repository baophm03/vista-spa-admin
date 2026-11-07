import { useMemo, useSyncExternalStore } from 'react'
import { brandColors } from './theme'
import { getSettings, getSettingsBrand } from './api/endpoints/settings'
import type { BrandSettings } from './api/models/brandSettings'
import { pickData } from './api/helpers'

/** Key màu giao diện trong localStorage (đọc đồng bộ trước khi login). */
export const THEME_KEYS = {
  primary: 'brand.primary_color',
  legacyPrimary: 'theme.primary_color',
  tertiary: 'theme.tertiary_color',
  secondary: 'brand.secondary_color',
  background: 'brand.background_color',
} as const

export interface BrandRuntime {
  name: string
  logoUrl: string | null
  primaryColor: string
  tertiaryColor: string
  secondaryColor: string
  backgroundColor: string | null
  timezone: string
  currency: string
  language: 'vi'
}

const listeners = new Set<() => void>()
const LOCALE_KEYS = {
  name: 'brand.name',
  logo: 'brand.logo_file_id',
  timezone: 'locale.timezone',
  currency: 'locale.currency',
} as const

function read(key: string, fallback: string): string {
  return localStorage.getItem(key) || fallback
}

export const getPrimaryColor = () =>
  localStorage.getItem(THEME_KEYS.primary) || localStorage.getItem(THEME_KEYS.legacyPrimary) || brandColors.primary
export const getTertiaryColor = () => read(THEME_KEYS.tertiary, brandColors.tertiary)
/** Màu phụ (tiêu đề nhấn, hiệu ứng phụ) — mặc định hồng đậm theo palette thương hiệu gốc. */
export const getSecondaryColor = () => read(THEME_KEYS.secondary, brandColors.secondary)
/** Màu nền trang; null/'' = tự suy từ màu chủ đạo. */
export const getBackgroundColor = (): string | null => localStorage.getItem(THEME_KEYS.background) || null

let runtime: BrandRuntime = {
  name: read(LOCALE_KEYS.name, 'Vista Spa'),
  logoUrl: localStorage.getItem(LOCALE_KEYS.logo) || null,
  primaryColor: getPrimaryColor(),
  tertiaryColor: getTertiaryColor(),
  secondaryColor: getSecondaryColor(),
  backgroundColor: getBackgroundColor(),
  timezone: read(LOCALE_KEYS.timezone, 'Asia/Ho_Chi_Minh'),
  currency: read(LOCALE_KEYS.currency, 'VND'),
  language: 'vi',
}

export function getBrandRuntime(): BrandRuntime {
  return runtime
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  listeners.forEach((fn) => fn())
}

/** Trộn 2 màu hex theo tỉ lệ `w` (phần trăm của `hex`). */
function mixHex(hex: string, target: string, w: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [r1, g1, b1] = p(hex)
  const [r2, g2, b2] = p(target)
  const c = (a: number, b: number) => Math.round(a * w + b * (1 - w)).toString(16).padStart(2, '0')
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`
}

function hexToRgb(hex: string): string {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')
}

/** Độ sáng 0..1 của màu hex — dùng chọn chữ trắng/tối trên nền màu chủ đạo. */
function hexLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contrast ratio WCAG 2.1 giữa 2 màu hex (1..21). */
function contrastRatio(fgHex: string, bgHex: string): number {
  const [l1, l2] = [hexLuminance(fgHex), hexLuminance(bgHex)].sort((a, b) => b - a)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Chọn màu chữ (on-*) đạt tương phản cao nhất trên nền bg — chuẩn Material Design 3.
 *  Ưu tiên trắng rồi tới near-black #1D1B20; trả về candidate có ratio tốt nhất. */
function computeOnColor(bgHex: string): string {
  const normalized = normalizeHexStrict(bgHex)
  if (!normalized) return '#FFFFFF'
  let best = '#FFFFFF'
  let bestRatio = -1
  for (const candidate of ['#FFFFFF', '#1D1B20']) {
    const ratio = contrastRatio(candidate, normalized)
    if (ratio > bestRatio) {
      best = candidate
      bestRatio = ratio
    }
  }
  return best
}

function normalizeHexStrict(color: string): string | null {
  const raw = color.trim().replace(/^#/, '')
  if (!/^[0-9A-Fa-f]{6}$/.test(raw)) return null
  return `#${raw.toUpperCase()}`
}

/**
 * Derive bộ tông màu (đậm/nhạt/viền/nền) từ màu chủ đạo rồi ghi vào CSS vars.
 * Toàn bộ CSS/Tailwind trong app dùng var(--brand-*) → đổi màu là đổi hết.
 */
export function applyCssVars() {
  const primary = getPrimaryColor()
  const tertiary = getTertiaryColor()
  const secondary = getSecondaryColor()
  const background = getBackgroundColor()
  const root = document.documentElement.style
  root.setProperty('--brand-primary', primary)
  root.setProperty('--brand-rgb', hexToRgb(primary))
  // Chữ trên nền màu chủ đạo: trắng nếu màu đậm, gần đen nếu màu quá sáng
  root.setProperty('--brand-on-primary', hexLuminance(primary) > 0.62 ? 'rgba(0, 0, 0, 0.88)' : '#FFFFFF')
  root.setProperty('--brand-dark', mixHex(primary, '#000000', 0.62))
  root.setProperty('--brand-dark-rgb', hexToRgb(mixHex(primary, '#000000', 0.62)))
  root.setProperty('--brand-tertiary', tertiary)
  root.setProperty('--brand-tertiary-rgb', hexToRgb(tertiary))
  // Chữ trên nền tertiary (tối lại nếu màu quá sáng) + tint/viền phái sinh cho badge, pill nhấn
  root.setProperty('--brand-tertiary-ink', hexLuminance(tertiary) > 0.62 ? mixHex(tertiary, '#000000', 0.55) : tertiary)
  root.setProperty('--brand-tertiary-tint', mixHex(tertiary, '#FFFFFF', 0.86))
  root.setProperty('--brand-tertiary-border', mixHex(tertiary, '#FFFFFF', 0.45))
  // Màu phụ (tiêu đề nhấn, hiệu ứng phụ) + bộ phái sinh giống tertiary
  root.setProperty('--brand-secondary', secondary)
  root.setProperty('--brand-secondary-ink', hexLuminance(secondary) > 0.62 ? mixHex(secondary, '#000000', 0.55) : secondary)
  root.setProperty('--brand-secondary-tint', mixHex(secondary, '#FFFFFF', 0.86))
  root.setProperty('--brand-secondary-border', mixHex(secondary, '#FFFFFF', 0.45))
  // Nền trang: override bằng brand.background_color nếu có, không thì suy nhẹ từ màu chủ đạo
  root.setProperty('--brand-bg', background || mixHex(primary, '#FFFFFF', 0.05))
  root.setProperty('--brand-bg-card', '#FFFFFF') // nền card/section nổi trên nền trang
  root.setProperty('--brand-tint', mixHex(primary, '#FFFFFF', 0.14)) // nền selected/active
  root.setProperty('--brand-hover', mixHex(primary, '#FFFFFF', 0.08)) // nền hover nhẹ
  root.setProperty('--brand-border', mixHex(primary, '#FFFFFF', 0.2)) // viền chính
  root.setProperty('--brand-border-strong', mixHex(primary, '#FFFFFF', 0.33)) // viền đậm (input, select)
  root.setProperty('--brand-border-soft', mixHex(primary, '#FFFFFF', 0.12)) // viền mảnh

  // ===== Material Design 3 color roles — tự tính on-* theo contrast WCAG 2.1 =====
  root.setProperty('--md-primary', primary)
  root.setProperty('--md-on-primary', computeOnColor(primary))
  root.setProperty('--md-secondary', secondary)
  root.setProperty('--md-on-secondary', computeOnColor(secondary))
  root.setProperty('--md-tertiary', tertiary)
  root.setProperty('--md-on-tertiary', computeOnColor(tertiary))
  root.setProperty('--md-error', '#B3261E')
  root.setProperty('--md-on-error', '#FFFFFF')
  root.setProperty('--md-surface', '#FFFFFF')
  root.setProperty('--md-on-surface', '#1D1B20')
  root.setProperty('--md-surface-variant', mixHex(primary, '#FFFFFF', 0.9))
  root.setProperty('--md-on-surface-variant', '#49454F')
}

/** Cập nhật brand + locale vào bộ nhớ/localStorage để các màn hình Admin refresh ngay. */
export function applyBrandSettings(settings: BrandSettings) {
  const { brand, locale } = settings
  const name = brand.name || 'Vista Spa'
  // BE trả logo_file object (id/path trong bảng file) — path ghép imageEndpoint khi render
  const logoPath = (brand as { logo_file?: { path?: string | null } | null })?.logo_file?.path || null
  const logoUrl = logoPath
  const primaryColor = brand.primary_color || brandColors.primary
  const tertiaryColor = (brand as { tertiary_color?: string }).tertiary_color || getTertiaryColor()
  const secondaryColor = (brand as { secondary_color?: string }).secondary_color || getSecondaryColor()
  const backgroundColor = (brand as { background_color?: string | null }).background_color || null
  const timezone = locale.timezone || 'Asia/Ho_Chi_Minh'
  const currency = locale.currency || 'VND'

  localStorage.setItem(LOCALE_KEYS.name, name)
  if (logoUrl) localStorage.setItem(LOCALE_KEYS.logo, logoUrl)
  else localStorage.removeItem(LOCALE_KEYS.logo)
  localStorage.setItem(THEME_KEYS.primary, primaryColor)
  localStorage.setItem(THEME_KEYS.tertiary, tertiaryColor)
  localStorage.setItem(THEME_KEYS.secondary, secondaryColor)
  if (backgroundColor) localStorage.setItem(THEME_KEYS.background, backgroundColor)
  else localStorage.removeItem(THEME_KEYS.background)
  localStorage.setItem(LOCALE_KEYS.timezone, timezone)
  localStorage.setItem(LOCALE_KEYS.currency, currency)
  runtime = { name, logoUrl, primaryColor, tertiaryColor, secondaryColor, backgroundColor, timezone, currency, language: 'vi' }
  applyCssVars()
  notify()
}

/** Giữ hành vi lưu màu cũ (SiteConfig/legacy settings) hoạt động; brand.primary_color là canonical. */
export function applyThemeColors(colors: { primary?: string; tertiary?: string }) {
  if (colors.primary) localStorage.setItem(THEME_KEYS.primary, colors.primary)
  if (colors.tertiary) localStorage.setItem(THEME_KEYS.tertiary, colors.tertiary)
  runtime = { ...runtime, primaryColor: getPrimaryColor(), tertiaryColor: getTertiaryColor() }
  applyCssVars()
  notify()
}

/** Tải brand settings từ server sau khi đăng nhập; fallback về GET /settings legacy nếu lỗi. */
export async function refreshThemeFromServer() {
  try {
    // brand settings là nguồn chính thức cho cả 4 màu — không cho giá trị legacy đè lên
    applyBrandSettings(pickData<BrandSettings>(await getSettingsBrand()))
  } catch {
    try {
      const rows = pickData<Array<{ key: string; value: unknown }>>(await getSettings())
      const pick = (key: string) => {
        const value = rows?.find((row) => row.key === key)?.value
        return typeof value === 'string' ? value : undefined
      }
      applyThemeColors({ primary: pick(THEME_KEYS.legacyPrimary), tertiary: pick(THEME_KEYS.tertiary) })
    } catch {
      // Không chặn login/render nếu chưa đọc được settings
    }
  }
}

export function useBrandRuntime() {
  return useSyncExternalStore(subscribeTheme, getBrandRuntime)
}

/** Hook cho component cần giá trị màu JS thật (chart SVG, canvas...) — tự re-render khi đổi màu. */
export function useBrandColors() {
  const { primaryColor: primary, secondaryColor: secondary, tertiaryColor: tertiary } = useBrandRuntime()
  return {
    primary,
    secondary,
    tertiary,
    dark: mixHex(primary, '#000000', 0.62),
    tint: mixHex(primary, '#FFFFFF', 0.14),
    hover: mixHex(primary, '#FFFFFF', 0.08),
    border: mixHex(primary, '#FFFFFF', 0.2),
  }
}

export function formatCurrency(value: unknown, currency = runtime.currency): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(Number(value ?? 0))
}

export function getCurrencySymbol(currency = runtime.currency): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value ?? currency
}

export function useBrandCurrency() {
  const { currency } = useBrandRuntime()
  return {
    currency,
    symbol: getCurrencySymbol(currency),
    format: (value: unknown) => formatCurrency(value, currency),
    formatCompact: (value: unknown) => new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(value ?? 0)),
  }
}

export function formatDate(value: string | Date | null | undefined, timezone = runtime.timezone): string {
  if (!value) return '—'
  const raw = typeof value === 'string' ? value : value.toISOString()
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw)
  const date = new Date(isDateOnly ? `${raw}T00:00:00Z` : raw)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeZone: isDateOnly ? 'UTC' : timezone,
  }).format(date)
}

export function formatDateTime(value: string | Date | null | undefined, timezone = runtime.timezone): string {
  if (!value) return '—'
  const parts = getConfiguredDateTimeParts(value, timezone)
  if (!parts) return '—'
  const [year, month, day] = parts.date.split('-')
  return `${day}/${month}/${year} ${parts.time}`
}

export function getConfiguredDateTimeParts(
  value: string | Date | null | undefined,
  timezone = runtime.timezone,
): { date: string; time: string } | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  const year = part('year')
  const month = part('month')
  const day = part('day')
  const hour = part('hour')
  const minute = part('minute')
  if (!year || !month || !day || !hour || !minute) return null
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` }
}

export function useBrandDateTime() {
  const { timezone } = useBrandRuntime()
  // Phải useMemo: component nào đưa các hàm này vào deps của useCallback/useEffect
  // mà identity đổi mỗi render sẽ tạo vòng lặp load vô hạn (ví dụ SessionTimeline tải ảnh buổi).
  return useMemo(
    () => ({
      timezone,
      formatDate: (value: string | Date | null | undefined) => formatDate(value, timezone),
      formatDateTime: (value: string | Date | null | undefined) => formatDateTime(value, timezone),
      getDateTimeParts: (value: string | Date | null | undefined) => getConfiguredDateTimeParts(value, timezone),
    }),
    [timezone],
  )
}

export function formatCalendarDateTime(date: string, time?: string | null): string {
  const clock = time?.slice(0, 5)
  return `${formatDate(date)}${clock ? ` ${clock}` : ''}`
}

// Áp CSS vars ngay khi load (kể cả trang login, đọc từ localStorage).
applyCssVars()
