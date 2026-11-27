import { notification } from 'antd'

/** Toast xanh ở đáy màn hình (mobile/tablet) — "Đã lưu đăng ký ca", "Đã xóa ca"... */
export function notifyCompactSuccess(title: string, description: string) {
  notification.success({
    title,
    description,
    placement: 'bottom',
    duration: 3,
    className: 'schedule-compact-toast',
  })
}
