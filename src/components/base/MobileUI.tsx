import { ConfigProvider, type ThemeConfig } from 'antd'
import type { ReactNode } from 'react'
import useDesktopLayout from '@/hooks/useDesktopLayout'

/** Token antd cho mobile/tablet (docs/mobile-design-guide.md): mọi control cao 44px, bo 8px.
 *  Giữ nguyên size small/large của theme gốc (30/50) để nút trong card không đổi. */
const MOBILE_THEME: ThemeConfig = {
  token: {
    controlHeight: 44,
    controlHeightSM: 30,
    controlHeightLG: 50,
    borderRadius: 8,
    borderRadiusSM: 8,
    borderRadiusLG: 8,
  },
  components: {
    Card: { borderRadiusLG: 8 },
  },
}

/** Bọc 1 trang để áp chuẩn giao diện mobile: class "mobile-ui" (src/mobile-ui.css) + token antd dưới 1024px. */
export default function MobileUI({ children, className = '' }: { children: ReactNode; className?: string }) {
  const desktop = useDesktopLayout()
  return (
    <ConfigProvider theme={desktop ? undefined : MOBILE_THEME}>
      <div className={`mobile-ui ${className}`.trim()}>{children}</div>
    </ConfigProvider>
  )
}
