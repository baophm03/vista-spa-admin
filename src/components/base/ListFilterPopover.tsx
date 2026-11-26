import { Badge, Button, Checkbox, Divider, Form, Grid, Popover, Space, Typography } from 'antd'
import type { FormInstance } from 'antd'
import type { ReactNode } from 'react'
import { FilterOutlined } from '@ant-design/icons'

export interface ListColumnOption {
  label: string
  value: string
}

interface ListFilterPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeFilterCount: number
  /** Bắt buộc khi có `filterItems`; bỏ qua nếu popover chỉ chọn cột hiển thị. */
  form?: FormInstance
  /** Các Form.Item của phần "Điều kiện lọc", nằm trong `form` đã truyền vào. */
  filterItems?: ReactNode
  onApply: (values: Record<string, unknown>) => void
  onClear: () => void
  /** Nếu truyền thì hiển thị phần chọn "Cột hiển thị" phía trên điều kiện lọc. */
  columnOptions?: ListColumnOption[]
  tableBreakpoint?: 'md' | 'lg' | 'xl'
  draftVisibleColumns?: string[]
  onDraftVisibleColumnsChange?: (values: string[]) => void
  /** Chỉ hiện nút icon, số lọc đang bật thành badge — dùng cho thanh công cụ 1 hàng */
  iconOnly?: boolean
  /** Node trigger tùy biến (ưu tiên hơn iconOnly) — dùng cho nút pill mobile theo Figma. */
  trigger?: ReactNode
}

export default function ListFilterPopover({
  open,
  onOpenChange,
  activeFilterCount,
  form,
  filterItems,
  onApply,
  onClear,
  columnOptions,
  tableBreakpoint = 'md',
  draftVisibleColumns,
  onDraftVisibleColumnsChange,
  iconOnly,
  trigger,
}: ListFilterPopoverProps) {
  // Mobile: popover full-width theo Figma "Danh sách khách · Bộ lọc" (358px/390px)
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const showColumns = Boolean(screens[tableBreakpoint] && columnOptions && draftVisibleColumns && onDraftVisibleColumnsChange)
  const hasFilters = Boolean(filterItems && form)
  if (!showColumns && !hasFilters) return null
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      // Mobile: CSS .pinned-popover ghim vào mép phải viewport, hết lệch khỏi màn hình
      rootClassName="pinned-popover"
      open={open}
      onOpenChange={onOpenChange}
      content={(
        <div style={{ width: isMobile ? 'calc(100vw - 60px)' : 300, maxHeight: 'min(70vh, 580px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflowY: 'auto', paddingRight: 4 }}>
            {showColumns && columnOptions && draftVisibleColumns && onDraftVisibleColumnsChange && (
              <>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Typography.Text strong style={{ fontSize: 14 }}>Cột hiển thị</Typography.Text>
                  {/* Chip đếm cột theo Figma: nền tím nhạt #F2E5F4, radius 7, chữ 11px */}
                  <span style={{ padding: '4px 7px', borderRadius: 7, background: '#f2e5f4', color: '#655E71', fontSize: 11, fontWeight: 500, lineHeight: 'normal' }}>
                    {draftVisibleColumns.length}/{columnOptions.length} cột
                  </span>
                </Space>
                <Checkbox.Group
                  value={draftVisibleColumns}
                  onChange={(values) => onDraftVisibleColumnsChange(values as string[])}
                  style={{ display: 'grid', gap: 10 }}
                  options={columnOptions}
                />
                {hasFilters && <Divider style={{ margin: '14px 0' }} />}
              </>
            )}
            {filterItems && form && (
              <>
                <Typography.Text strong>Điều kiện lọc</Typography.Text>
                <Form form={form} layout="vertical" onFinish={onApply} style={{ marginTop: 10 }}>
                  {filterItems}
                </Form>
              </>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 12, marginTop: 12, borderTop: '1px solid var(--brand-border-soft)' }}>
            {/* Figma: Xóa lọc trắng viền chữ tím / Xác nhận tím đặc, h44 r10 trên mobile */}
            <Button
              onClick={onClear}
              style={isMobile ? { height: 44, borderRadius: 10, color: 'var(--brand-primary)', fontWeight: 500 } : undefined}
            >
              Xóa lọc
            </Button>
            <Button
              type="primary"
              onClick={() => (filterItems && form ? form.submit() : onApply({}))}
              style={isMobile ? { height: 44, borderRadius: 10, fontWeight: 500 } : undefined}
            >
              Xác nhận
            </Button>
          </div>
        </div>
      )}
    >
      {trigger ?? (iconOnly
        ? (
          <Badge count={activeFilterCount} size="small" offset={[-4, 4]}>
            <Button icon={<FilterOutlined />} aria-label="Bộ lọc" title="Bộ lọc" />
          </Badge>
        )
        : <Button icon={<FilterOutlined />}>Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</Button>)}
    </Popover>
  )
}
