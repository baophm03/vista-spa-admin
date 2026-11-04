export interface VoucherRow {
  id: string
  title: string
  required_points?: number
  type?: number
  start_date?: string
  end_date?: string
  is_active?: boolean
}

/** type theo contract BE: hạng thẻ được áp dụng (0=Tất cả, 1=Silver, 2=Gold, 3=Diamond, 4=VIP) */
export const TYPE_LABEL: Record<number, string> = {
  0: 'Tất cả hạng',
  1: 'Silver',
  2: 'Gold',
  3: 'Diamond',
  4: 'VIP',
}
