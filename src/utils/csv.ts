/**
 * CSV client-side: tạo chuỗi CSV (có BOM UTF-8 để Excel đọc đúng tiếng Việt)
 * và tải về trình duyệt.
 */

export type CsvColumn<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',')
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(','))
  return '\uFEFF' + [head, ...body].join('\r\n')
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
