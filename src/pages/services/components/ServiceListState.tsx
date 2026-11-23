import { Alert, Button } from 'antd'

export default function ServiceListState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert
      className="service-list-error"
      type="error"
      showIcon
      message={message}
      action={<Button onClick={onRetry}>Thử lại</Button>}
    />
  )
}
