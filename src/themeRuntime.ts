import { useSyncExternalStore } from 'react'
import { brandColors } from './theme'
import { listSettings } from './api/newsky'

/** Các key màu giao diện lưu trong bảng setting (group "theme"). */
export const THEME_KEYS = {
  primary: 'theme.primary_color',
  accent: 'theme.accent_color',
} as const

const listeners = new Set<() => void>()

function read(key: string, fallback: string): string {
  return localStorage.getItem(key) || fallback
}

/** Màu hiện tại — đọc từ localStorage để render ngay không chờ API. */
export const getPrimaryColor = () => read(THEME_KEYS.primary, brandColors.primary)
export const getAccentColor = () => read(THEME_KEYS.accent, brandColors.accent)

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
 * Toàn bộ CSS viết tay trong app dùng var(--brand-*) → đổi màu là đổi hết.
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

/** Ghi màu mới vào localStorage + CSS vars + bắn event để ConfigProvider re-render. */
export function applyThemeColors(colors: { primary?: string; accent?: string }) {
  if (colors.primary) localStorage.setItem(THEME_KEYS.primary, colors.primary)
  if (colors.accent) localStorage.setItem(THEME_KEYS.accent, colors.accent)
  applyCssVars()
  notify()
}

/** Tải màu từ GET /settings (sau khi đăng nhập) và áp vào giao diện. */
export async function refreshThemeFromServer() {
  try {
    const rows = (await listSettings()) as Array<{ key: string; value: unknown }>
    const pick = (key: string) => {
      const v = rows.find((r) => r.key === key)?.value
      return typeof v === 'string' ? v : undefined
    }
    applyThemeColors({
      primary: pick(THEME_KEYS.primary),
      accent: pick(THEME_KEYS.accent),
    })
  } catch {
    // Không chặn UI nếu chưa login hoặc thiếu quyền setting.read
  }
}

/** Hook cho component cần giá trị màu JS thật (chart SVG, canvas...) — tự re-render khi đổi màu. */
export function useBrandColors() {
  const primary = useSyncExternalStore(subscribeTheme, getPrimaryColor)
  const accent = useSyncExternalStore(subscribeTheme, getAccentColor)
  return {
    primary,
    accent,
    dark: mixHex(primary, '#000000', 0.62),
    tint: mixHex(primary, '#FFFFFF', 0.14),
    hover: mixHex(primary, '#FFFFFF', 0.08),
    border: mixHex(primary, '#FFFFFF', 0.2),
  }
}

// Áp CSS vars ngay khi load (kể cả trang login, đọc từ localStorage).
applyCssVars()
