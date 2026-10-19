import React, { useMemo, useSyncExternalStore } from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { theme } from './theme'
import { getPrimaryColor, subscribeTheme } from './themeRuntime'
import App from './App'
import './index.css'

function Root() {
  const primary = useSyncExternalStore(subscribeTheme, getPrimaryColor)
  const merged = useMemo(
    () => ({
      ...theme,
      token: { ...theme.token, colorPrimary: primary, colorInfo: primary, colorLink: primary },
    }),
    [primary],
  )
  return (
    <ConfigProvider locale={viVN} theme={merged}>
      <App />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
