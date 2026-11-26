import dayjs, { type Dayjs } from 'dayjs'

/** Thứ 2 đầu tuần của một ngày. */
export const mondayOf = (date: Dayjs) => date.startOf('day').subtract((date.day() + 6) % 7, 'day')

/** Ngày mặc định khi mở 1 tuần trên mobile: hôm nay nếu thuộc tuần đó, không thì thứ 2. */
export const todayInWeek = (weekStart: Dayjs) => {
  const today = dayjs().startOf('day')
  return today.isBefore(weekStart) || today.isAfter(weekStart.add(6, 'day')) ? weekStart : today
}
