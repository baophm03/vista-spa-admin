export function isPastScheduleDate(date: string) {
  return date < new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

export function hasShiftStarted(date: string, startTime: string) {
  return Date.parse(`${date}T${startTime.slice(0, 5)}:00+07:00`) <= Date.now()
}
