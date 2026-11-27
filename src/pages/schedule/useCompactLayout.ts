import { useSyncExternalStore } from 'react'

/** Cùng mốc với CSS .mobile-only/.desktop-only (index.css): dưới 1024px là mobile + tablet. */
const COMPACT_QUERY = '(max-width: 1023px)'

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(COMPACT_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** true khi màn hình đang ở layout mobile/tablet của trang Lịch làm việc. */
export function useCompactLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(COMPACT_QUERY).matches, () => false)
}
