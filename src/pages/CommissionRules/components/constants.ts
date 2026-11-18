import type { CommissionRule } from '@/api/models'

/** Người nhận quy tắc — nối với bảng roles qua payee_role_id, phân biệt bằng role code. */
export const PAYEE_META: Record<string, { label: string; color: string }> = {
  ktv: { label: 'Kỹ thuật viên', color: 'blue' },
  customer: { label: 'Khách hàng cũ', color: 'geekblue' },
}

/** Điều kiện kích hoạt của quy tắc — mỗi rule gắn đúng 1 điều kiện. */
export type RuleTaskType = 'REFERRAL' | 'SESSION'

export const RULE_TYPE_META: Record<RuleTaskType, { label: string; description: string; color: string }> = {
  REFERRAL: {
    label: 'Khi phát sinh thanh toán',
    description: 'Phát sinh khi khách mới được ghi nhận thanh toán gói liệu trình',
    color: 'cyan',
  },
  SESSION: {
    label: 'Hoàn thành buổi điều trị',
    description: 'Phát sinh khi buổi điều trị được Lễ tân/Admin xác nhận Hoàn thành (KTV bấm "Xong" không tính)',
    color: 'purple',
  },
}

/** Điều kiện kích hoạt → role code của người nhận (cố định, khớp BE TYPE_ROLE_CODE). */
export const TYPE_ROLE_CODE: Record<RuleTaskType, string> = {
  REFERRAL: 'customer',
  SESSION: 'ktv',
}

export const ruleTypeMeta = (type?: string | null) =>
  RULE_TYPE_META[(type ?? '') as RuleTaskType] ?? null

/** CommissionRule model gen chưa có `type`/`payee_role_id`/`payee_role` (migration 109+112) — mở rộng cục bộ. */
export type RuleRow = CommissionRule & {
  type?: string
  payee_role_id?: string
  payee_role?: { id?: string; code?: string | null; role_name?: string | null } | null
}
