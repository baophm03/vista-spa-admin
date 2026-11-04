import type { WarrantyClaim } from '@/api/models/warrantyClaim'

export type ClaimRow = Omit<WarrantyClaim, 'customer_treatment' | 'session'> & {
  contract_file_id?: string | null
  customer_treatment?: {
    id: string
    branch_id?: string
    customer_profile_id?: string
    package_id?: string
    package_snapshot?: Record<string, unknown>
    finished_at?: string | null
    customer_profile?: { id?: string; customer_code?: string; full_name?: string; phone?: string }
    package?: { id?: string; name?: string }
    package_type?: { has_warranty?: boolean }
  }
  session?: { id?: string; status?: string; scheduled_at?: string | null; product_amount?: number }
}

export const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ duyệt', color: 'orange' },
  APPROVED: { label: 'Đã duyệt', color: 'green' },
  REJECTED: { label: 'Đã từ chối', color: 'red' },
}

export const STATUS_FILTER_OPTIONS = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
]

/** package_snapshot là object tự do — đọc has_warranty/name nếu BE trả kèm. */
export function snapshotField(row: { package_snapshot?: Record<string, unknown> } | undefined): { hasWarranty?: boolean; name?: string } {
  const snap = row?.package_snapshot as {
    has_warranty?: unknown
    name?: unknown
    package_type?: { has_warranty?: unknown }
  } | undefined
  const hasWarranty = typeof snap?.package_type?.has_warranty === 'boolean'
    ? snap.package_type.has_warranty
    : snap?.has_warranty
  return {
    hasWarranty: typeof hasWarranty === 'boolean' ? hasWarranty : undefined,
    name: typeof snap?.name === 'string' ? snap.name : undefined,
  }
}
