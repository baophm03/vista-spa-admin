import {type ReactNode} from 'react'
import dayjs from 'dayjs';
import { STATUS_META, rowCustomer, rowTime, type MergedRow, rowStatus } from '../page';

export type SessionTone = 'pending' | 'completed' | 'progress' | 'waiting'

export interface SessionPackageCardProps {
    rows: MergedRow[];
    renderAction?: (row:MergedRow) => ReactNode
    imageUrl?:string
    className?: string
}

export interface SessionGroup{
    key: string;
    rows: MergedRow[];
}

export function groupRows(rows: MergedRow[]): SessionGroup[] {
  const groups = new Map<string, SessionGroup>()
  for (const row of rows) {
    const customer = rowCustomer(row)
    const key = row.kind === 'service'
      ? `service-${customer?.customer_code ?? customer?.full_name ?? 'unknown'}`
      : `treatment-${row.customer_treatment_id}`
    const group = groups.get(key) ?? { key, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  }
  const sessionNo = (row: MergedRow) => (row.kind === 'treatment' ? row.session_no : 999)
  for (const g of groups.values()) g.rows.sort((a, b) => sessionNo(a) - sessionNo(b))
  return [...groups.values()]
}

const STATUS_CLASS: Record<string, string> = {
  scheduled: 'bg-[#F1EDF2] text-[#5E5563]',
  in_progress: 'bg-[#E6F0FF] text-[#1D5FD1]',
  done: 'bg-[#FFF1E0] text-[#B45309]',
  completed: 'bg-[#EAF8E8] text-[#2F7A12]',
}

function formatSchedule(value?: string | null) {
  if (!value) return 'Chưa xếp lịch'
  const hasTime = value.includes('T') && !value.endsWith('T00:00')
  return dayjs(value).format(hasTime ? 'DD/MM/YYYY · HH:mm' : 'DD/MM/YYYY')
}

function rowLabel(row: MergedRow) {
  if (row.kind === 'service') return row.service?.title || 'Dịch vụ lẻ'
  return row.is_warranty ? 'Bảo hành' : `Buổi ${row.session_no}`
}

export function SessionPackageCard({ rows, renderAction, imageUrl, className = '' }: SessionPackageCardProps) {
  const first = rows[0]
  if (!first) return null
 
  const isService = first.kind === 'service'
  const customer = rowCustomer(first)
  const customerCode = customer?.customer_code || customer?.phone
  const title = first.kind === 'service' ? 'Dịch vụ lẻ' : first.customer_treatment?.package?.name || '—'
 
  // Counts only the sessions assigned to this technician (the API doesn't return the package total)
  const finished = rows.filter((r) => ['done', 'completed'].includes(rowStatus(r))).length
  const percent = Math.round((finished / rows.length) * 100)
 
  return (
    <article
      className={`flex w-full flex-col gap-4 rounded-[28px] border border-[#F0DCEE] bg-white px-4 pb-2 pt-4 text-[#1E1A1F] ${className}`}
    >
      {imageUrl && (
        <div className="h-28 overflow-hidden rounded-lg bg-gradient-to-br from-[#F6E3F3] to-[#E5E1F7]">
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
 
      <div className="flex flex-col gap-2.5 px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 text-xl font-bold leading-[1.3] tracking-tight">{title}</h2>
            <p className="mt-0.5 truncate text-sm text-[#6B6270]">
              {customer?.full_name || 'Khách hàng'}
              {customerCode ? ` · ${customerCode}` : ''}
            </p>
          </div>
          {!isService && (
            <span className="shrink-0 text-[13px] font-bold leading-[22px] text-[#A0148F]">
              {finished}/{rows.length} đã làm
            </span>
          )}
        </div>
        {!isService && (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[#F0DCEE]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={rows.length}
            aria-valuenow={finished}
            aria-label="Tiến độ các buổi được giao"
          >
            <div className="h-full rounded-full bg-[#A0148F]" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
 
      <ul className="m-0 flex list-none flex-col p-0 px-1">
        {rows.map((row) => {
          const status = rowStatus(row)
          const info = STATUS_META[status] ?? { label: status || '—', color: 'default' }
          return (
            <li key={row.id} className="flex min-h-[60px] items-center gap-3 border-t border-[#F0DCEE] px-1 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{rowLabel(row)}</div>
                <div className="truncate text-[13px] text-[#6B6270]">{formatSchedule(rowTime(row))}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className={`rounded-full px-2.5 text-xs font-semibold leading-5 ${STATUS_CLASS[status] ?? STATUS_CLASS.scheduled}`}
                >
                  {info.label}
                </span>
                {renderAction?.(row)}
              </div>
            </li>
          )
        })}
      </ul>
    </article>
  )
}
 