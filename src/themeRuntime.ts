import { useSyncExternalStore } from 'react'
import { brandColors } from './theme'
import { getSettings, getSettingsBrand } from './api/endpoints/settings'
import type { BrandSettings } from './api/models/brandSettings'
import { pickData } from './api/helpers'

/** Key màu giao diện trong localStorage (đọc đồng bộ trước khi login). */
export const THEME_KEYS = {
  primary: 'brand.primary_color',
  legacyPrimary: 'theme.primary_color',
  accent: 'theme.accent_color',
} as const

export interface BrandRuntime {
  name: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
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
export const getAccentColor = () => read(THEME_KEYS.accent, brandColors.accent)

let runtime: BrandRuntime = {
  name: read(LOCALE_KEYS.name, 'Vista Spa'),
  logoUrl: localStorage.getItem(LOCALE_KEYS.logo) || null,
  primaryColor: getPrimaryColor(),
  accentColor: getAccentColor(),
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

/**
 * Derive bộ tông màu (đậm/nhạt/viền/nền) từ màu chủ đạo rồi ghi vào CSS vars.
 * Toàn bộ CSS/Tailwind trong app dùng var(--brand-*) → đổi màu là đổi hết.
 */
export function applyCssVars() {
  const primary = getPrimaryColor()
  const accent = getAccentColor()
  const root = document.documentElement.style
  root.setProperty('--brand-primary', primary)
  root.setProperty('--brand-rgb', hexToRgb(primary))
  root.setProperty('--brand-dark', mixHex(primary, '#000000', 0.62))
  root.setProperty('--brand-dark-rgb', hexToRgb(mixHex(primary, '#000000', 0.62)))
  root.setProperty('--brand-accent', accent)
  root.setProperty('--brand-tint', mixHex(primary, '#FFFFFF', 0.14)) // nền selected/active
  root.setProperty('--brand-hover', mixHex(primary, '#FFFFFF', 0.08)) // nền hover nhẹ
  root.setProperty('--brand-bg', mixHex(primary, '#FFFFFF', 0.05)) // nền trang/section
  root.setProperty('--brand-border', mixHex(primary, '#FFFFFF', 0.2)) // viền chính
  root.setProperty('--brand-border-strong', mixHex(primary, '#FFFFFF', 0.33)) // viền đậm (input, select)
  root.setProperty('--brand-border-soft', mixHex(primary, '#FFFFFF', 0.12)) // viền mảnh
}

/** Cập nhật brand + locale vào bộ nhớ/localStorage để các màn hình Admin refresh ngay. */
export function applyBrandSettings(settings: BrandSettings) {
  const { brand, locale } = settings
  const name = brand.name || 'Vista Spa'
  const logoUrl = brand.logo_url || brand.logo_file_id || null
  const primaryColor = brand.primary_color || brandColors.primary
  const accentColor = getAccentColor()
  const timezone = locale.timezone || 'Asia/Ho_Chi_Minh'
  const currency = locale.currency || 'VND'

  localStorage.setItem(LOCALE_KEYS.name, name)
  if (logoUrl) localStorage.setItem(LOCALE_KEYS.logo, logoUrl)
  else localStorage.removeItem(LOCALE_KEYS.logo)
  localStorage.setItem(THEME_KEYS.primary, primaryColor)
  localStorage.setItem(LOCALE_KEYS.timezone, timezone)
  localStorage.setItem(LOCALE_KEYS.currency, currency)
  runtime = { name, logoUrl, primaryColor, accentColor, timezone, currency, language: 'vi' }
  applyCssVars()
  notify()
}

/** Giữ hành vi lưu màu cũ (SiteConfig/legacy settings) hoạt động; brand.primary_color là canonical. */
export function applyThemeColors(colors: { primary?: string; accent?: string }) {
  if (colors.primary) localStorage.setItem(THEME_KEYS.primary, colors.primary)
  if (colors.accent) localStorage.setItem(THEME_KEYS.accent, colors.accent)
  runtime = { ...runtime, primaryColor: getPrimaryColor(), accentColor: getAccentColor() }
  applyCssVars()
  notify()
}

/** Tải brand settings từ server sau khi đăng nhập; fallback về GET /settings legacy nếu lỗi. */
export async function refreshThemeFromServer() {
  try {
    applyBrandSettings(pickData<BrandSettings>(await getSettingsBrand()))
    try {
      const rows = pickData<Array<{ key: string; value: unknown }>>(await getSettings())
      const accent = rows?.find((row) => row.key === THEME_KEYS.accent)?.value
      if (typeof accent === 'string') applyThemeColors({ accent })
    } catch {
      // accent color là tùy chọn khi caller không có quyền setting.read
    }
  } catch {
    try {
      const rows = pickData<Array<{ key: string; value: unknown }>>(await getSettings())
      const pick = (key: string) => {
        const value = rows?.find((row) => row.key === key)?.value
        return typeof value === 'string' ? value : undefined
      }
      applyThemeColors({ primary: pick(THEME_KEYS.legacyPrimary), accent: pick(THEME_KEYS.accent) })
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
  const { primaryColor: primary, accentColor: accent } = useBrandRuntime()
  return {
    primary,
    accent,
    dark: mixHex(primary, '#000000', 0.62),
    tint: mixHex(primary, '#FFFFFF', 0.14),
    hover: mixHex(primary, '#FFFFFF', 0.08),
    border: mixHex(primary, '#FFFFFF', 0.2),
  }
}

export function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: runtime.currency }).format(Number(value ?? 0))
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const raw = typeof value === 'string' ? value : value.toISOString()
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw)
  const date = new Date(isDateOnly ? `${raw}T00:00:00Z` : raw)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeZone: isDateOnly ? 'UTC' : runtime.timezone,
  }).format(date)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: runtime.timezone,
  }).format(date)
}

export function formatCalendarDateTime(date: string, time?: string | null): string {
  const clock = time?.slice(0, 5)
  return `${formatDate(date)}${clock ? ` ${clock}` : ''}`
}

// Áp CSS vars ngay khi load (kể cả trang login, đọc từ localStorage).
applyCssVars()
