import { Button } from 'antd'
import RowActionsMenu, { type RowActionItem } from '@/components/base/RowActionsMenu'

interface Props {
  items: RowActionItem[]
  onSelect: (key: string) => void
  ariaLabel: string
  disabled?: boolean
}

export default function RewardCardActions({ items, onSelect, ariaLabel, disabled }: Props) {
  if (!items.length) return null
  const showInlineOnTablet = items.length <= 3

  return (
    <div className="mobile-card-actions reward-card-actions" role="group" aria-label={ariaLabel}>
      <div className={showInlineOnTablet ? 'md:max-lg:hidden' : undefined}>
        <RowActionsMenu dropdownOnly ariaLabel={ariaLabel} disabled={disabled} items={items} onSelect={onSelect} />
      </div>
      {showInlineOnTablet && (
        <div className="hidden flex-wrap justify-end gap-2 md:max-lg:flex">
          {items.map((item) => (
            <Button key={item.key} size="small" icon={item.icon} danger={item.danger} disabled={disabled || item.disabled} onClick={() => onSelect(item.key)}>
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
