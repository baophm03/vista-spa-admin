import { Button, DatePicker, Space } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

/** Thanh chuyển kỳ dạng [<] [khoảng ngày] [>] — dùng chung cho các trang có lọc theo tuần/ngày
 *  (Lịch hẹn, Lịch làm việc...). Nút trái/phải do trang tự quyết định bước nhảy (±1 ngày/±1 tuần). */
export default function PeriodNavigator({
  value,
  onChange,
  onPrev,
  onNext,
  format = 'DD/MM',
  width = 170,
  prevLabel = 'Kỳ trước',
  nextLabel = 'Kỳ sau',
}: {
  value: [dayjs.Dayjs, dayjs.Dayjs]
  onChange: (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => void
  onPrev: () => void
  onNext: () => void
  format?: string
  width?: number
  prevLabel?: string
  nextLabel?: string
}) {
  return (
    <Space.Compact>
      <Button icon={<LeftOutlined />} aria-label={prevLabel} onClick={onPrev} />
      <DatePicker.RangePicker
        allowClear={false}
        format={format}
        style={{ width }}
        value={value}
        onChange={(value) => onChange(value as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
      />
      <Button icon={<RightOutlined />} aria-label={nextLabel} onClick={onNext} />
    </Space.Compact>
  )
}
