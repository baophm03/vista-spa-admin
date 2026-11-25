import PageTitle from '@/components/base/PageTitle'
import TreatmentPackageList from './components/TreatmentPackageList'
import './treatments.css'

export default function Treatments() {
  return (
    <div className="treatments-page">
      <PageTitle subtitle="Gói lẻ (theo số tiền), Gói buổi và Trọn đời — mỗi gói áp dụng cho 1 dịch vụ.">
        Gói liệu trình
      </PageTitle>
      <TreatmentPackageList kind="PACKAGE" />
    </div>
  )
}
