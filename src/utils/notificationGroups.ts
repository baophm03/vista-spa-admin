export interface NotificationLike {
  id: string
  user_id?: string | null
  event_key: string
  title?: string
  body?: string
  is_read?: boolean
  sent_at?: string
  channel?: string
}

export type NotificationGroup<T extends NotificationLike = NotificationLike> = T & {
  /** Row đại diện (bản ghi đầu tiên của nhóm) — các field của group cũng chính là field của rep */
  rep: T
  members: T[]
  /** id các bản ghi chưa đọc trong nhóm */
  unreadIds: string[]
  /** user_id của từng người nhận (null = broadcast) */
  userIds: (string | null | undefined)[]
}

/**
 * Gộp các bản ghi notification của cùng 1 sự kiện gửi nhiều người thành 1 nhóm.
 * Backend tạo 1 row/người nhận → key = event_key + title + body + phút gửi.
 */
export function groupNotifications<T extends NotificationLike>(rows: T[]): NotificationGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = `${row.event_key}|${row.title ?? ''}|${row.body ?? ''}|${(row.sent_at ?? '').slice(0, 16)}`
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  return [...map.values()].map((members) => ({
    ...members[0],
    rep: members[0],
    members,
    unreadIds: members.filter((m) => !m.is_read).map((m) => m.id),
    userIds: members.map((m) => m.user_id),
  }))
}
