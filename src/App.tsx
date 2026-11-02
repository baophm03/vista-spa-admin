import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Vouchers from './pages/Vouchers'
import Services from './pages/Services'
import Appointments from './pages/Appointments'
import Treatments from './pages/Treatments'
import TreatmentCustomers from './pages/TreatmentCustomers'
import MySessions from './pages/MySessions'
import Payments from './pages/Payments'
import Staffs from './pages/Staffs'
import Notifications from './pages/Notifications'
import Products from './pages/Products'
import Points from './pages/Points'
import HealthRecords from './pages/HealthRecords'
import Roles from './pages/Roles'
import Orders from './pages/Orders'
import StaffSchedule from './pages/StaffSchedule'
import ScheduleErrorBoundary from './pages/schedule/ScheduleErrorBoundary'
import LuckyWheel from './pages/LuckyWheel'
import Branches from './pages/Branches'
import LookupLists from './pages/LookupLists'
import BrandSettings from './pages/BrandSettings'
import IntegrationSettings from './pages/IntegrationSettings'
import SystemSettings from './pages/SystemSettings'
import CustomerDataConfig from './pages/CustomerDataConfig'
import Rewards from './pages/Rewards'
import AcademyCourses from './pages/AcademyCourses'
import AccessLogs from './pages/AccessLogs'
import WarrantyClaims from './pages/WarrantyClaims'
import CardRanks from './pages/CardRanks'
import CommissionRules from './pages/CommissionRules'
import Commissions from './pages/Commissions'
import Collaborators from './pages/Collaborators'
import Referrals from './pages/Referrals'
import DiscountRules from './pages/DiscountRules'
import ContentPosts from './pages/ContentPosts'
import AcademyRegistrations from './pages/AcademyRegistrations'
import Imports from './pages/Imports'

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
          <Route path="/access-logs" element={<AccessLogs />} />
          <Route path="/products" element={<Products />} />
          <Route path="/content-posts" element={<ContentPosts />} />
          <Route path="/points" element={<Points />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/schedule" element={<ScheduleErrorBoundary><StaffSchedule /></ScheduleErrorBoundary>} />
          <Route path="/luckywheel" element={<LuckyWheel />} />
          <Route path="/health-records" element={<HealthRecords />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/warranty-claims" element={<WarrantyClaims />} />
          <Route path="/card-ranks" element={<CardRanks />} />
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
