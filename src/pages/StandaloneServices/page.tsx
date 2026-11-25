import PageTitle from '@/components/base/PageTitle'
import TreatmentPackageList from '@/pages/Treatments/components/TreatmentPackageList'
import '@/pages/Treatments/treatments.css'

/**
 * Dịch vụ lẻ = gói loại SINGLE_SESSION (1 buổi, gắn 1 dịch vụ). Dùng chung API /treatment-packages với kind=SINGLE;
 * khách đăng ký ở trang /standalone-service-customers — xem vista-spa-be/docs/nghiep-vu/dich-vu-le-single-session.md.
 */
export default function StandaloneServices() {
  return (
    <div className="treatments-page">
      <PageTitle subtitle="Mỗi dịch vụ lẻ gắn 1 dịch vụ, khách làm 1 buổi — giá niêm yết mặc định lấy từ giá dịch vụ.">
        Dịch vụ lẻ
      </PageTitle>
      <TreatmentPackageList kind="SINGLE" />
    </div>
  )
}
