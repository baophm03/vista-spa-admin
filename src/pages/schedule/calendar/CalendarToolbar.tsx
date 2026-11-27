import { Button, Dropdown, Popover, Segmented, Select, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import type { ReactNode } from 'react'
import { CalendarOutlined, DownOutlined, FilterOutlined, LeftOutlined, MoreOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import type { Branch } from '@/api/models/branch'

export type CalendarView = 'day' | 'week' | 'month'

const VIEW_LABEL: Record<CalendarView, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng' }
const VIEW_OPTIONS: CalendarView[] = ['day', 'week', 'month']

interface Props {
  compact?: boolean
  labeledActions?: boolean
  hidePeriodNavigation?: boolean
  roster?: { selected: boolean; onSelect: () => void }
  panelLabel?: string
  extra?: ReactNode
  activeFilterCount?: number
  periodLabel?: string
  anchor: Dayjs
  onAnchorChange: (date: Dayjs) => void
  view: CalendarView
  onViewChange: (view: CalendarView) => void
  /** Lọc cơ sở (chỉ admin) — hiện trong popover phễu. */
  branches: Branch[]
  branchFilter?: string
  onBranchChange: (branchId?: string) => void
  onRefresh: () => void
  refreshing?: boolean
  leftPanelOpen: boolean
  onToggleLeftPanel: () => void
}

/** Toolbar kiểu Google Calendar / Notion Calendar: "Hôm nay" + mũi tên + nhãn kỳ ở trái,
 *  chuyển Ngày/Tuần/Tháng dạng segmented + lọc ở phải. */
export default function CalendarToolbar({
  compact = false, labeledActions = false, hidePeriodNavigation = false, roster, panelLabel, extra, activeFilterCount = 0, anchor, onAnchorChange, view, onViewChange, periodLabel,
  branches, branchFilter, onBranchChange, onRefresh, refreshing = false,
  leftPanelOpen, onToggleLeftPanel,
}: Props) {
  const moreItems: MenuProps['items'] = [
    { key: 'refresh', icon: <ReloadOutlined />, label: 'Làm mới dữ liệu' },
    ...(!compact ? [{ key: 'panel', icon: <CalendarOutlined />, label: leftPanelOpen ? 'Ẩn bảng điều khiển trái' : 'Hiện bảng điều khiển trái' }] : []),
  ]
  // Mọi control trên toolbar theo chiều cao chuẩn của theme (40px desktop, 44px <1024px) — không tự đặt height
  const shift = (amount: number) =>
    onAnchorChange(anchor.add(amount, view === 'day' ? 'day' : view === 'week' ? 'week' : 'month'))
  const branchName = branches.find((branch) => branch.id === branchFilter)?.name
  const viewOptions = VIEW_OPTIONS.map((option) => ({ value: option, label: VIEW_LABEL[option] }))
  const compactTextButton = 'shrink-0 rounded-lg! px-2.5! text-[13px]! text-[var(--brand-primary)]! hover:bg-[var(--brand-tint)]!'

  return (
    <div className={`flex w-full flex-wrap items-center justify-between gap-x-4 ${compact ? 'gap-y-2 py-1.5' : 'gap-y-2 px-3 py-2.5 sm:px-4'}`}>
      {/* Nhóm trái: Hôm nay · ◀ ▶ · nhãn kỳ */}
      {!hidePeriodNavigation && <div className={`flex min-w-0 items-center ${compact ? 'gap-1' : 'gap-0.5'}`}>
        <Button
          type="text"
          onClick={() => onAnchorChange(dayjs())}
          className={compact ? compactTextButton : 'shrink-0 rounded-lg! px-3! text-[var(--brand-primary)]! hover:bg-[var(--brand-tint)]!'}
        >
          Hôm nay
        </Button>
        <Tooltip title="Kỳ trước">
          <Button
            type="text"
            shape="circle"
            aria-label="Khoảng thời gian trước"
            icon={<LeftOutlined />}
            onClick={() => shift(-1)}
            className={`shrink-0 text-neutral-600!`}
          />
        </Tooltip>
        <Tooltip title="Kỳ sau">
          <Button
            type="text"
            shape="circle"
            aria-label="Khoảng thời gian sau"
            icon={<RightOutlined />}
            onClick={() => shift(1)}
            className={`shrink-0 text-neutral-600!`}
          />
        </Tooltip>
        <span className={`min-w-0 text-neutral-800 ${compact ? 'ml-1 text-[13px] font-semibold leading-5 tabular-nums sm:ml-2' : 'ml-2 truncate text-[19px] font-medium tracking-tight sm:text-[21px]'}`}>
          {periodLabel ?? `Tháng ${anchor.format('M, YYYY')}`}
        </span>
      </div>}

      {/* Nhóm phải: chuyển chế độ xem + bộ lọc + menu thêm */}
      <div className={`flex items-center ${compact ? 'flex-wrap gap-1' : 'gap-1.5'} ${hidePeriodNavigation ? 'ml-auto' : ''}`}>
        {compact ? (
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            overlayClassName="[&_.ant-dropdown-menu]:min-w-24! [&_.ant-dropdown-menu]:rounded-lg! [&_.ant-dropdown-menu]:p-1! [&_.ant-dropdown-menu-item]:rounded-md! [&_.ant-dropdown-menu-item]:px-2.5! [&_.ant-dropdown-menu-item]:py-1! [&_.ant-dropdown-menu-item]:text-sm! [&_.ant-dropdown-menu-item-selected]:bg-[var(--brand-tint)]! [&_.ant-dropdown-menu-item-selected]:text-[var(--brand-primary)]!"
            menu={{
              items: [
                ...viewOptions.map(({ value, label }) => ({ key: value, label })),
                ...(roster ? [{ type: 'divider' as const }, { key: 'roster', label: 'Bảng phân ca' }] : []),
              ],
              selectable: true,
              selectedKeys: [roster?.selected ? 'roster' : view],
              onClick: ({ key }) => key === 'roster' ? roster?.onSelect() : onViewChange(key as CalendarView),
            }}
          >
            <Button type={labeledActions ? 'default' : 'text'} aria-haspopup="menu" aria-label={'Chế độ xem: ' + (roster?.selected ? 'Bảng phân ca' : VIEW_LABEL[view])} className={labeledActions ? 'min-w-24 justify-between! rounded-lg! px-3! shadow-none!' : `${compactTextButton} gap-1.5!`}>
              {roster?.selected ? 'Bảng phân ca' : VIEW_LABEL[view]}
              <DownOutlined aria-hidden className="text-sm!" />
            </Button>
          </Dropdown>
        ) : (
          <Segmented
            aria-label="Chế độ xem"
            value={view}
            onChange={(value) => onViewChange(value as CalendarView)}
            options={viewOptions}
            className="[&_.ant-segmented-item]:font-medium"
          />
        )}
        {compact && (
          <Tooltip title={activeFilterCount > 0 ? `Đang áp dụng ${activeFilterCount} bộ lọc` : (panelLabel ?? 'Ngày và bộ lọc')}>
            <Button
              type="text"
              icon={<FilterOutlined />}
              aria-label={activeFilterCount > 0 ? `Mở bộ lọc lịch hẹn, ${activeFilterCount} bộ lọc đang áp dụng` : (panelLabel ?? 'Mở bộ lọc lịch hẹn')}
              aria-expanded={leftPanelOpen}
              onClick={onToggleLeftPanel}
              className={activeFilterCount > 0
                ? 'gap-1.5! bg-[var(--brand-tint)]! px-2! text-[var(--brand-dark)]!'
                : `${labeledActions ? 'px-2!' : ''} text-neutral-600!`}
            >
              {labeledActions && 'Bộ lọc'}
              {activeFilterCount > 0 && (
                <span aria-hidden className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-semibold leading-none text-[var(--brand-on-primary)]">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </Tooltip>
        )}
        {!!branches.length && (
          <Popover
            trigger="click"
            placement="bottomRight"
            content={
              <div className="w-60">
                <div className="mb-2 text-[13px] font-semibold text-neutral-800">Lọc theo cơ sở</div>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tất cả cơ sở"
                  className="w-full"
                  value={branchFilter}
                  onChange={(value) => onBranchChange(value)}
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </div>
            }
          >
            <Tooltip title={branchName ? `Cơ sở: ${branchName}` : 'Lọc cơ sở'}>
              <Button
                aria-label="Lọc cơ sở"
                type="text"
                shape="circle"
                icon={<FilterOutlined />}
                className={`${branchFilter ? 'bg-[var(--brand-tint)]! text-[var(--brand-primary)]!' : 'text-neutral-600!'}`}
              />
            </Tooltip>
          </Popover>
        )}
        {compact ? (
          <div className="flex items-center gap-1.5">
            <Tooltip title={refreshing ? undefined : 'Làm mới dữ liệu'}>
              <Button
                aria-label="Làm mới dữ liệu"
                type="text"
                shape={labeledActions ? 'default' : 'circle'}
                icon={<ReloadOutlined />}
                loading={refreshing}
                onClick={onRefresh}
                className={`${labeledActions ? 'px-2!' : ''} shrink-0 text-neutral-600!`}
              >
                {labeledActions && 'Tải lại'}
              </Button>
            </Tooltip>
            <span role="status" className="text-xs text-neutral-600">
              {refreshing ? 'Đang cập nhật dữ liệu' : ''}
            </span>
          </div>
        ) : (
          <Dropdown menu={{ items: moreItems, onClick: ({ key }) => (key === 'refresh' ? onRefresh() : onToggleLeftPanel()) }} trigger={['click']}>
            <Button aria-label="Thêm tùy chọn" type="text" shape="circle" icon={<MoreOutlined />} className={`shrink-0 text-neutral-600!`} />
          </Dropdown>
        )}
        {extra && <div className="ml-2 shrink-0">{extra}</div>}
      </div>
    </div>
  )
}
