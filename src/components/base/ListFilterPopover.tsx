import { Badge, Button, Checkbox, Divider, Form, Popover, Space, Tag, Typography } from 'antd'
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
  draftVisibleColumns?: string[]
  onDraftVisibleColumnsChange?: (values: string[]) => void
  /** Chỉ hiện nút icon, số lọc đang bật thành badge — dùng cho thanh công cụ 1 hàng */
  iconOnly?: boolean
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
  draftVisibleColumns,
  onDraftVisibleColumnsChange,
  iconOnly,
}: ListFilterPopoverProps) {
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={onOpenChange}
      content={(
        <div style={{ width: 300, maxHeight: 'min(70vh, 580px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflowY: 'auto', paddingRight: 4 }}>
            {columnOptions && draftVisibleColumns && onDraftVisibleColumnsChange && (
              <>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Typography.Text strong>Cột hiển thị</Typography.Text>
                  <Tag style={{ marginInlineEnd: 0 }}>{draftVisibleColumns.length}/{columnOptions.length} cột</Tag>
                </Space>
                <Checkbox.Group
                  value={draftVisibleColumns}
                  onChange={(values) => onDraftVisibleColumnsChange(values as string[])}
                  style={{ display: 'grid', gap: 10 }}
                  options={columnOptions}
                />
                <Divider style={{ margin: '14px 0' }} />
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
            <Button onClick={onClear}>Xóa lọc</Button>
            <Button type="primary" onClick={() => (filterItems && form ? form.submit() : onApply({}))}>Xác nhận</Button>
          </div>
        </div>
      )}
    >
      {iconOnly
        ? (
          <Badge count={activeFilterCount} size="small" offset={[-4, 4]}>
            <Button icon={<FilterOutlined />} aria-label="Bộ lọc" title="Bộ lọc" />
          </Badge>
        )
        : <Button icon={<FilterOutlined />}>Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</Button>}
    </Popover>
  )
}
