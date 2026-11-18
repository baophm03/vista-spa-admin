import { Button, ConfigProvider, Divider, Dropdown, Popover, Select, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { CalendarOutlined, CheckOutlined, DownOutlined, FilterOutlined, LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import type { Branch } from '@/api/models/branch'

export type CalendarView = 'day' | 'week' | 'month'

const VIEW_LABEL: Record<CalendarView, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng' }
const VIEW_OPTIONS: CalendarView[] = ['day', 'week', 'month']

interface Props {
  anchor: Dayjs
  onAnchorChange: (date: Dayjs) => void
  view: CalendarView
  onViewChange: (view: CalendarView) => void
  /** Lọc cơ sở (chỉ admin) — hiện trong popover phễu. */
  branches: Branch[]
  branchFilter?: string
  onBranchChange: (branchId?: string) => void
  onRefresh: () => void
  leftPanelOpen: boolean
  onToggleLeftPanel: () => void
}

/** Toolbar kiểu Google Calendar: Ngày/Tuần/Tháng + lọc. (Tạo ca nằm ở panel trái; chọn ngày qua mini calendar.) */
export default function CalendarToolbar({
  anchor, onAnchorChange, view, onViewChange,
  branches, branchFilter, onBranchChange, onRefresh,
  leftPanelOpen, onToggleLeftPanel,
}: Props) {
  const moreItems: MenuProps['items'] = [
    { key: 'refresh', icon: <ReloadOutlined />, label: 'Làm mới dữ liệu' },
    { key: 'panel', icon: <CalendarOutlined />, label: leftPanelOpen ? 'Ẩn bảng điều khiển trái' : 'Hiện bảng điều khiển trái' },
  ]

  return (
    // Nằm trong hàng header trang lịch (portal vào slot giữa title và tabs):
    // Ngày / lùi / tiến / tháng ở trái — chế độ xem và bộ lọc ở phải.
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', width: '100%', paddingTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button
          size="middle"
          onClick={() => onAnchorChange(dayjs())}
          style={{ height: 40, borderRadius: 20, paddingInline: 18, fontSize: 14, fontWeight: 500 }}
        >
          Hôm nay
        </Button>
        <Button
          type="text"
          size="middle"
          aria-label="Khoảng thời gian trước"
          icon={<LeftOutlined style={{ fontSize: 14, color: '#3C4043' }} />}
          onClick={() => onAnchorChange(anchor.subtract(1, view === 'day' ? 'day' : view === 'week' ? 'week' : 'month'))}
          style={{ width: 36, height: 40, padding: 0 }}
        />
        <Button
          type="text"
          size="middle"
          aria-label="Khoảng thời gian sau"
          icon={<RightOutlined style={{ fontSize: 14, color: '#3C4043' }} />}
          onClick={() => onAnchorChange(anchor.add(1, view === 'day' ? 'day' : view === 'week' ? 'week' : 'month'))}
          style={{ width: 36, height: 40, padding: 0 }}
        />
        <Typography.Text style={{ fontSize: 18, fontWeight: 500, color: '#1F1F1F', marginLeft: 8, whiteSpace: 'nowrap' }}>
          Tháng {anchor.format('M, YYYY')}
        </Typography.Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <ConfigProvider theme={{ components: { Menu: { itemHeight: 34, itemBorderRadius: 6, itemSelectedBg: 'var(--brand-tint)', itemSelectedColor: 'var(--brand-primary)' } } }}>
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: VIEW_OPTIONS.map((option) => ({
              key: option,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minWidth: 96 }}>
                  {VIEW_LABEL[option]}
                  {option === view && <CheckOutlined aria-hidden style={{ fontSize: 12 }} />}
                </span>
              ),
            })),
            selectable: true,
            selectedKeys: [view],
            onClick: ({ key }) => onViewChange(key as CalendarView),
          }}
        >
          <Button aria-label={`Chế độ xem: ${VIEW_LABEL[view]}`} aria-haspopup="menu" icon={<CalendarOutlined />} style={{ height: 36, borderRadius: 8, boxShadow: 'none', fontWeight: 500 }}>
            {VIEW_LABEL[view]}
            <DownOutlined style={{ fontSize: 10, color: '#5F6368' }} />
          </Button>
        </Dropdown>
        </ConfigProvider>
        {!!branches.length && (
          <Popover
            trigger="click"
            placement="bottomRight"
            content={
              <div style={{ width: 240 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Lọc theo cơ sở</div>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tất cả cơ sở"
                  style={{ width: '100%' }}
                  value={branchFilter}
                  onChange={(value) => onBranchChange(value)}
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </div>
            }
          >
            <Button
              aria-label="Lọc cơ sở"
              type="text"
              icon={<FilterOutlined />}
              data-branch-active={branchFilter ? 'true' : undefined}
              style={branchFilter ? { color: 'var(--brand-primary)' } : undefined}
            />
          </Popover>
        )}
        <Divider type="vertical" />
        <Dropdown
          menu={{ items: moreItems, onClick: ({ key }) => (key === 'refresh' ? onRefresh() : onToggleLeftPanel()) }}
          trigger={['click']}
        >
          <Button aria-label="Thêm tùy chọn" type="text" icon={<span style={{ fontWeight: 700, letterSpacing: 1 }}>⋮</span>} />
        </Dropdown>
      </div>
    </div>
  )
}
