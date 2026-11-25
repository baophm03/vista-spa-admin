import TreatmentCustomers from '@/pages/TreatmentCustomers/page'

/** Dịch vụ lẻ KH — khách đăng ký gói Dịch vụ lẻ (tạo ở trang /standalone-services). Dùng chung /treatment-customers với kind=SINGLE. */
export default function StandaloneServiceCustomers() {
  return <TreatmentCustomers kind="SINGLE" />
}
