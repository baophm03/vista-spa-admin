import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './layout/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Vouchers from './pages/Vouchers'
import Services from './pages/Services'
import Appointments from './pages/Appointments'
import Treatments from './pages/Treatments'
import TreatmentCustomers from './pages/TreatmentCustomers'
import Staffs from './pages/Staffs'
import Notifications from './pages/Notifications'
import Products from './pages/Products'
import Points from './pages/Points'
import HealthRecords from './pages/HealthRecords'
import SiteConfig from './pages/SiteConfig'
import Roles from './pages/Roles'
import Redemptions from './pages/Redemptions'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import StaffSchedule from './pages/StaffSchedule'
import LuckyWheel from './pages/LuckyWheel'

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
          <Route path="/treatment-customers" element={<TreatmentCustomers />} />
          <Route path="/staffs" element={<Staffs />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/products" element={<Products />} />
          <Route path="/points" element={<Points />} />
          <Route path="/redemptions" element={<Redemptions />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/schedule" element={<StaffSchedule />} />
          <Route path="/luckywheel" element={<LuckyWheel />} />
          <Route path="/health-records" element={<HealthRecords />} />
          <Route path="/site-config" element={<SiteConfig />} />
          <Route path="/roles" element={<Roles />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
