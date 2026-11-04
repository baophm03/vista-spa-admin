import type { DiscountRuleAudience } from '@/api/models'

export const AUDIENCE_META: Record<DiscountRuleAudience, { label: string; color: string }> = {
  RANK: { label: 'Theo hạng thẻ', color: 'blue' },
  RETURNING_MEMBER: { label: 'Khách quay lại', color: 'green' },
  NEW_BY_REFERRAL: { label: 'Khách mới được giới thiệu', color: 'purple' },
  UPSELL: { label: 'Upsell', color: 'orange' },
}

export const APPLIES_TO_OPTIONS = [
  { value: 'PACKAGE', label: 'Gói liệu trình' },
  { value: 'SERVICE', label: 'Dịch vụ' },
  { value: 'ALL', label: 'Tất cả' },
]
