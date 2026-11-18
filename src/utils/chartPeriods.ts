import dayjs, { type Dayjs } from 'dayjs'

export type PeriodGroupBy = 'day' | 'week' | 'month'

/**
 * BE report API chỉ trả về các kỳ (period) có phát sinh dữ liệu, nên chart
 * thiếu trục thời gian khi chỉ có 1 kỳ ("cần ít nhất 2 kỳ" mới vẽ được).
 * Helper sinh đủ danh sách kỳ theo group_by trong khoảng [from, to], cộng dồn
 * giá trị từ rows của BE và fill 0 cho kỳ không có phát sinh — chart luôn
 * hiển thị đủ trục thời gian thay vì rơi vào empty state.
 */
export function fillPeriodBuckets(
  from: string | Dayjs,
  to: string | Dayjs,
  groupBy: PeriodGroupBy,
  rows: Array<Record<string, any>>,
  valueKeys: string[] = ['revenue'],
): Array<{ period: string; [key: string]: any }> {
  const fmt = groupBy === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'
  const start = dayjs(from)
  const end = dayjs(to)

  // Bucket đầu tiên chứa `from`. Week bắt đầu Thứ 2 để khớp date_trunc('week') của PG.
  let cursor =
    groupBy === 'month'
      ? start.startOf('month')
      : groupBy === 'week'
        ? start.subtract((start.day() + 6) % 7, 'day')
        : start.startOf('day')

  const totals = new Map<string, { period: string; [key: string]: any }>()
  for (const r of rows) {
    const bucket: { period: string; [key: string]: any } = totals.get(r.period) ?? { period: r.period }
    for (const key of valueKeys) bucket[key] = (bucket[key] ?? 0) + Number(r[key] ?? 0)
    totals.set(r.period, bucket)
  }

  const buckets: Array<{ period: string; [key: string]: any }> = []
  // Giới hạn an toàn để range tự do + group_by=day không sinh quá nhiều bucket.
  for (let i = 0; (cursor.isBefore(end) || cursor.isSame(end, 'day')) && i < 2000; i++) {
    const period = cursor.format(fmt)
    buckets.push(totals.get(period) ?? { period, ...Object.fromEntries(valueKeys.map((k) => [k, 0])) })
    cursor = groupBy === 'month' ? cursor.add(1, 'month') : cursor.add(groupBy === 'week' ? 7 : 1, 'day')
  }

  return buckets
}
