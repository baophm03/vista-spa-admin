import React, { useMemo, useSyncExternalStore } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { theme } from './theme'
import { getPrimaryColor, subscribeTheme } from './themeRuntime'
import TableEmpty from '@/components/base/TableEmpty'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

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
    <ConfigProvider
      locale={viVN}
      theme={merged}
      renderEmpty={() => <TableEmpty />}
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
