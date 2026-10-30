import { Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { EyeOutlined, MoreOutlined } from '@ant-design/icons'

export interface RowActionItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  danger?: boolean
  /** Đánh dấu hành động "xem chi tiết" — luôn hiển thị nút icon con mắt ra ngoài. */
  view?: boolean
}

interface RowActionsMenuProps {
  items: RowActionItem[]
  onSelect: (key: string) => void
}

function isEyeIcon(icon: ReactNode): boolean {
  return isValidElement(icon) && (icon.type === EyeOutlined)
}

/** Hành động "xem chi tiết": item được đánh dấu `view`, key 'view', hoặc icon là EyeOutlined. */
function isViewAction(item: RowActionItem): boolean {
  return item.view === true || item.key === 'view' || isEyeIcon(item.icon)
}

/** Cột hành động chuẩn hóa:
 *  - Hành động xem chi tiết (mắt) luôn ở ngoài, kế bên nút còn lại.
 *  - Còn hơn 2 hành động → gom vào nút chấm chấm (dropdown).
 *  - Còn ≤ 2 hành động → hiển thị nút chữ ra ngoài luôn.
 *  Tự chặn click lan lên dòng (onRow). */
export default function RowActionsMenu({ items, onSelect }: RowActionsMenuProps) {
  if (items.length === 0) return null
  const viewItems = items.filter(isViewAction)
  const rest = items.filter((item) => !isViewAction(item))
  const plain = rest.filter((item) => typeof item.key === 'string')
  if (viewItems.length === 0 && rest.length === 0) return null

  const menuItems = rest.map(({ key, label, icon, danger }) => ({ key, label, icon, danger })) as MenuProps['items']

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      onClick={(event) => event.stopPropagation()}
    >
      {viewItems.map((item) => (
        <Button
          key={item.key}
          size="small"
          icon={<EyeOutlined />}
          aria-label={typeof item.label === 'string' ? item.label : 'Xem chi tiết'}
          title={typeof item.label === 'string' ? item.label : undefined}
          onClick={() => onSelect(item.key)}
        />
      ))}
      {plain.length > 2 ? (
        <Dropdown
          trigger={['click']}
          menu={{
            items: menuItems,
            onClick: ({ key }) => onSelect(key),
          }}
        >
          <Button size="small" icon={<MoreOutlined />} aria-label="Thao tác khác" />
        </Dropdown>
      ) : (
        plain.map((item) => (
          <Button
            key={item.key}
            size="small"
            danger={item.danger}
            icon={item.icon}
            onClick={() => onSelect(item.key)}
          >
            {item.label}
          </Button>
        ))
      )}
    </span>
  )
}
