import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert, Button } from 'antd'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

interface ViteHot {
  on: (event: string, callback: () => void) => void
  off: (event: string, callback: () => void) => void
}

const getViteHot = (): ViteHot | undefined =>
  (import.meta as unknown as { hot?: ViteHot }).hot

export default class ScheduleErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidMount() {
    getViteHot()?.on('vite:afterUpdate', this.resetAfterHotUpdate)
  }

  componentWillUnmount() {
    getViteHot()?.off('vite:afterUpdate', this.resetAfterHotUpdate)
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[schedule] Lỗi khi hiển thị trang lịch', error, info.componentStack)
  }

  private resetAfterHotUpdate = () => this.setState({ error: null })

  private reloadPage = () => window.location.reload()

  render() {
    if (!this.state.error) return this.props.children

    return (
      <Alert
        type="error"
        showIcon
        message="Trang lịch gặp lỗi khi hiển thị"
        description={
          <div>
            <p>Trang đã được giữ lại để không bị trắng. Hãy tải lại trang; nếu lỗi xuất hiện sau khi sửa code, trang cũng sẽ tự thử lại khi Vite cập nhật.</p>
            {import.meta.env.DEV && (
              <pre style={{ maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
            )}
            <Button size="small" onClick={this.reloadPage}>Tải lại trang lịch</Button>
          </div>
        }
      />
    )
  }
}
