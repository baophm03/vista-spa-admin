import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login/page'
import Dashboard from './pages/Dashboard/page'
import Users from './pages/Users/page'
import Vouchers from './pages/Vouchers/page'
import Services from './pages/services/page'
import Appointments from './pages/Appointments/page'
import Treatments from './pages/Treatments/page'
import TreatmentCustomers from './pages/TreatmentCustomers/page'
import MySessions from './pages/MySessions/page'
import Payments from './pages/Payments/page'
import Staffs from './pages/Staffs/page'
import Notifications from './pages/Notifications/page'
import NotificationTemplates from './pages/NotificationTemplates/page'
import Products from './pages/Products/page'
import Points from './pages/Points/page'
import PointRedemption from './pages/PointRedemption/page'
import HealthRecords from './pages/HealthRecords/page'
import Roles from './pages/Roles/page'
import Orders from './pages/Orders/page'
import StaffSchedule from './pages/StaffSchedule/page'
import ScheduleErrorBoundary from './pages/schedule/ScheduleErrorBoundary'
import LuckyWheel from './pages/LuckyWheel/page'
import Branches from './pages/Branches/page'
import LookupLists from './pages/LookupLists/page'
import BrandSettings from './pages/BrandSettings/page'
import IntegrationSettings from './pages/IntegrationSettings/page'
import SystemSettings from './pages/SystemSettings/page'
import CustomerDataConfig from './pages/CustomerDataConfig/page'
import Rewards from './pages/Rewards/page'
import AcademyCourses from './pages/AcademyCourses/page'
import AccessLogs from './pages/AccessLogs/page'
import WarrantyClaims from './pages/WarrantyClaims/page'
import CommissionRules from './pages/CommissionRules/page'
import Commissions from './pages/Commissions/page'
import Collaborators from './pages/Collaborators/page'
import Referrals from './pages/Referrals/page'
import DiscountRules from './pages/DiscountRules/page'
import ContentPosts from './pages/ContentPosts/page'
import AcademyRegistrations from './pages/AcademyRegistrations/page'
import Imports from './pages/Imports/page'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/vouchers" element={<Vouchers />} />
          <Route path="/services" element={<Services />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/treatments" element={<Treatments />} />
          <Route path="/academy/courses" element={<AcademyCourses />} />
          <Route path="/academy/registrations" element={<AcademyRegistrations />} />
          <Route path="/treatment-customers" element={<TreatmentCustomers />} />
          <Route path="/my-sessions" element={<MySessions />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/staffs" element={<Staffs />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/notification-templates" element={<NotificationTemplates />} />
          <Route path="/access-logs" element={<AccessLogs />} />
          <Route path="/products" element={<Products />} />
          <Route path="/content-posts" element={<ContentPosts />} />
          <Route path="/points" element={<Points />} />
          <Route path="/points-redemption" element={<PointRedemption />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/schedule" element={<ScheduleErrorBoundary><StaffSchedule /></ScheduleErrorBoundary>} />
          <Route path="/luckywheel" element={<LuckyWheel />} />
          <Route path="/health-records" element={<HealthRecords />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/warranty-claims" element={<WarrantyClaims />} />
          <Route path="/card-ranks" element={<Navigate to="/points" replace />} />
          <Route path="/commission-rules" element={<CommissionRules />} />
          <Route path="/commissions" element={<Commissions />} />
          <Route path="/collaborators" element={<Collaborators />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/discount-rules" element={<DiscountRules />} />
          <Route path="/branches" element={<Branches />} />
          <Route path="/imports" element={<Imports />} />
          <Route path="/customer-data-config" element={<CustomerDataConfig />} />
          <Route path="/settings/lookups" element={<LookupLists />} />
          <Route path="/settings/brand" element={<BrandSettings />} />
          <Route path="/settings/system" element={<SystemSettings />} />
          <Route path="/settings/integrations" element={<IntegrationSettings />} />
          <Route path="/roles" element={<Roles />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
