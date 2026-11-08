// Mock data cho Web Admin — thay bằng API BE khi nối backend

export const DASHBOARD = {
  totalCustomers: 1248,
  totalMembers: 386,
  todayAppointments: 12,
  monthRevenue: 245000000,
  activeVouchers: 8,
  activeServices: 14,
}

export const MONTHLY_REVENUE = [
  { month: 'T5', value: 156 },
  { month: 'T6', value: 178 },
  { month: 'T7', value: 210 },
  { month: 'T8', value: 189 },
  { month: 'T9', value: 232 },
  { month: 'T10', value: 245 },
]

export type Rank = 'Vista' | 'VIP' | 'Kim Cương'

export interface Customer {
  id: string
  code: string
  name: string
  phone: string
  email?: string
  rank: Rank
  points: number
  expiry: string
  created_at: string
}

export const CUSTOMERS: Customer[] = [
  { id: '1', code: 'KH-0001', name: 'Nguyễn Thu Hà', phone: '0901 234 568', email: 'hanguyen@gmail.com', rank: 'VIP', points: 1250, expiry: '31/12/2026', created_at: '12/03/2025' },
  { id: '2', code: 'KH-0002', name: 'Trần Minh Anh', phone: '0912 345 678', email: 'minhanh@gmail.com', rank: 'Vista', points: 320, expiry: '31/12/2026', created_at: '05/06/2025' },
  { id: '3', code: 'KH-0003', name: 'Lê Thu Thảo', phone: '0935 111 222', rank: 'Kim Cương', points: 5240, expiry: '30/06/2027', created_at: '18/01/2024' },
  { id: '4', code: 'KH-0004', name: 'Phạm Khánh Linh', phone: '0987 654 321', email: 'khanhlinh@gmail.com', rank: 'VIP', points: 2180, expiry: '31/12/2026', created_at: '22/09/2024' },
  { id: '5', code: 'KH-0005', name: 'Đỗ Hải Yến', phone: '0909 888 777', rank: 'Vista', points: 85, expiry: '31/12/2026', created_at: '14/08/2026' },
  { id: '6', code: 'KH-0006', name: 'Vũ Ngọc Mai', phone: '0966 333 999', email: 'ngocmai@gmail.com', rank: 'VIP', points: 1640, expiry: '31/12/2026', created_at: '30/11/2024' },
  { id: '7', code: 'KH-0007', name: 'Bùi Gia Bảo', phone: '0977 222 111', rank: 'Vista', points: 510, expiry: '31/12/2026', created_at: '09/02/2026' },
  { id: '8', code: 'KH-0008', name: 'Hoàng Mỹ Duyên', phone: '0938 444 555', email: 'myduyen@gmail.com', rank: 'Kim Cương', points: 4870, expiry: '30/06/2027', created_at: '07/05/2024' },
]

export type AppointmentStatus = 'pending' | 'confirmed' | 'done' | 'cancelled'

export interface Appointment {
  id: string
  code: string
  customer: string
  phone: string
  service: string
  staff: string
  datetime: string
  status: AppointmentStatus
}

export const APPOINTMENTS: Appointment[] = [
  { id: '1', code: 'LH-1041', customer: 'Nguyễn Thu Hà', phone: '0901 234 568', service: 'Chăm sóc da cơ bản', staff: 'Trần Hoa', datetime: '16/10/2026 09:00', status: 'confirmed' },
  { id: '2', code: 'LH-1042', customer: 'Trần Minh Anh', phone: '0912 345 678', service: 'Peel da chuyên sâu', staff: 'Nguyệt Cát', datetime: '16/10/2026 10:30', status: 'pending' },
  { id: '3', code: 'LH-1043', customer: 'Lê Thu Thảo', phone: '0935 111 222', service: 'Gội đầu thư giãn', staff: 'Trần Hoa', datetime: '16/10/2026 14:00', status: 'confirmed' },
  { id: '4', code: 'LH-1044', customer: 'Phạm Khánh Linh', phone: '0987 654 321', service: 'Trị mụn chuyên sâu', staff: 'Minh Tâm', datetime: '17/10/2026 08:30', status: 'pending' },
  { id: '5', code: 'LH-1039', customer: 'Đỗ Hải Yến', phone: '0909 888 777', service: 'Chăm sóc da cơ bản', staff: 'Nguyệt Cát', datetime: '15/10/2026 09:00', status: 'done' },
  { id: '6', code: 'LH-1038', customer: 'Vũ Ngọc Mai', phone: '0966 333 999', service: 'Nâng cơ vàng 24K', staff: 'Minh Tâm', datetime: '14/10/2026 15:00', status: 'done' },
  { id: '7', code: 'LH-1037', customer: 'Bùi Gia Bảo', phone: '0977 222 111', service: 'Peel da chuyên sâu', staff: 'Trần Hoa', datetime: '13/10/2026 11:00', status: 'cancelled' },
]

export interface Service {
  id: string
  name: string
  category: string
  price: number
  duration: number
  description: string
  image: string
  is_active: boolean
}

export const SERVICES: Service[] = [
  { id: '1', name: 'Chăm sóc da cơ bản', category: 'Chăm sóc da', price: 350000, duration: 60, description: 'Làm sạch, cấp ẩm và massage mặt thư giãn.', image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '2', name: 'Peel da chuyên sâu', category: 'Chăm sóc da', price: 550000, duration: 45, description: 'Peel acid điều tiết da, cải thiện thâm mụn.', image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '3', name: 'Trị mụn chuyên sâu', category: 'Trị liệu', price: 480000, duration: 60, description: 'Lấy nhân mụn chuẩn y khoa kết hợp ánh sáng sinh học.', image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '4', name: 'Nâng cơ vàng 24K', category: 'Trị liệu', price: 890000, duration: 75, description: 'Kết hợp tinh chất vàng 24K và kỹ thuật nâng cơ.', image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '5', name: 'Gội đầu thư giãn', category: 'Thư giãn', price: 250000, duration: 45, description: 'Gội đầu thảo dược, massage vai gáy.', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '6', name: 'Xông hơi mặt thảo dược', category: 'Thư giãn', price: 180000, duration: 30, description: 'Xông hơi kết hợp tinh dầu thiên nhiên.', image: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&q=80&auto=format&fit=crop', is_active: false },
]

export interface Voucher {
  id: string
  code: string
  title: string
  value: string
  condition: string
  start_date: string
  end_date: string
  is_active: boolean
  used_count: number
}

export const VOUCHERS: Voucher[] = [
  { id: '1', code: 'VISTA50', title: 'Giảm 50k cho hóa đơn đầu', value: '50.000đ', condition: 'Đơn từ 300.000đ', start_date: '01/10/2026', end_date: '31/10/2026', is_active: true, used_count: 124 },
  { id: '2', code: 'FREESHIP', title: 'Miễn phí vận chuyển', value: 'Freeship', condition: 'Đơn từ 200.000đ', start_date: '01/10/2026', end_date: '30/11/2026', is_active: true, used_count: 89 },
  { id: '3', code: 'VIP20', title: 'Giảm 20% cho thành viên VIP', value: '20%', condition: 'Hạng VIP trở lên', start_date: '15/09/2026', end_date: '15/12/2026', is_active: true, used_count: 56 },
  { id: '4', code: 'TET2027', title: 'Ưu đãi Tết — Giảm 100k', value: '100.000đ', condition: 'Đơn từ 500.000đ', start_date: '01/01/2027', end_date: '28/02/2027', is_active: false, used_count: 0 },
  { id: '5', code: 'BIRTHDAY', title: 'Quà sinh nhật — 1 buổi chăm da', value: '1 buổi', condition: 'Sinh nhật trong tháng', start_date: '01/01/2026', end_date: '31/12/2026', is_active: true, used_count: 32 },
]

export const STAFFS = ['Trần Hoa', 'Nguyệt Cát', 'Minh Tâm']
export const SERVICE_CATEGORIES = ['Chăm sóc da', 'Trị liệu', 'Thư giãn']
export const PRODUCT_CATEGORIES = ['Sữa rửa mặt', 'Tinh chất', 'Kem dưỡng', 'Kem chống nắng', 'Mặt nạ', 'Nước hoa hồng']

export interface TreatmentCatalogItem {
  id: string
  name: string
  description: string
  sessions: number
  price: number
  duration: number
  image: string
  is_active: boolean
}

export const TREATMENT_CATALOG: TreatmentCatalogItem[] = [
  { id: '1', name: 'Chăm sóc da cơ bản', description: 'Làm sạch, tẩy tế bào chết, massage mặt, đắp mặt nạ', sessions: 4, price: 800000, duration: 60, image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '2', name: 'Peel Acne chuyên sâu', description: 'Peel hóa học trị mụn, thu nhỏ lỗ chân lông, 6 buổi/1 liệu trình', sessions: 6, price: 2400000, duration: 75, image: 'https://images.unsplash.com/photo-1616394584738-fc6e312d2b34?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '3', name: 'Glow Skin duy trì', description: 'Đánh sáng da, cấp ẩm chuyên sâu cho da xỉn màu', sessions: 4, price: 1600000, duration: 60, image: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '4', name: 'Nâng cơ vàng 24K', description: 'Nâng cơ, trẻ hóa bằng công nghệ vàng 24K', sessions: 5, price: 3500000, duration: 90, image: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '5', name: 'Trị mụn chuyên sâu', description: 'Lấy nhân mụn, điện di thuốc, kết hợp ánh sáng sinh học', sessions: 8, price: 3200000, duration: 75, image: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&q=80&auto=format&fit=crop', is_active: false },
]

export interface TreatmentAssignment {
  id: string
  code: string
  customer: string
  treatment: string
  total_sessions: number
  done_sessions: number
  start_date: string
  staff: string
  status: 'ongoing' | 'done'
}

export const TREATMENT_ASSIGNMENTS: TreatmentAssignment[] = [
  { id: '1', code: 'LT-0231', customer: 'Nguyễn Thu Hà', treatment: 'Peel Acne chuyên sâu', total_sessions: 6, done_sessions: 3, start_date: '24/09/2026', staff: 'Trần Hoa', status: 'ongoing' },
  { id: '2', code: 'LT-0228', customer: 'Lê Thu Thảo', treatment: 'Glow Skin duy trì', total_sessions: 4, done_sessions: 4, start_date: '05/09/2026', staff: 'Nguyệt Cát', status: 'done' },
  { id: '3', code: 'LT-0235', customer: 'Phạm Khánh Linh', treatment: 'Trị mụn chuyên sâu', total_sessions: 8, done_sessions: 2, start_date: '01/10/2026', staff: 'Minh Tâm', status: 'ongoing' },
  { id: '4', code: 'LT-0236', customer: 'Vũ Ngọc Mai', treatment: 'Nâng cơ vàng 24K', total_sessions: 5, done_sessions: 1, start_date: '10/10/2026', staff: 'Trần Hoa', status: 'ongoing' },
  { id: '5', code: 'LT-0219', customer: 'Trần Minh Anh', treatment: 'Chăm sóc da cơ bản', total_sessions: 4, done_sessions: 4, start_date: '12/08/2026', staff: 'Nguyệt Cát', status: 'done' },
  { id: '6', code: 'LT-0238', customer: 'Nguyễn Thu Hà', treatment: 'Glow Skin duy trì', total_sessions: 4, done_sessions: 1, start_date: '12/10/2026', staff: 'Nguyệt Cát', status: 'ongoing' },
]

export interface Redemption {
  id: string
  code: string
  customer: string
  item: string
  points: number
  date: string
  status: 'pending' | 'done'
}

export const REDEMPTIONS: Redemption[] = [
  { id: '1', code: 'DQ-0121', customer: 'Lê Thu Thảo', item: 'Gội đầu thư giãn', points: 50, date: '28/09/2026', status: 'done' },
  { id: '2', code: 'DQ-0124', customer: 'Vũ Ngọc Mai', item: 'Voucher 100k', points: 200, date: '02/09/2026', status: 'done' },
  { id: '3', code: 'DQ-0130', customer: 'Nguyễn Thu Hà', item: 'Mặt nạ dưỡng trắng (hộp 10)', points: 250, date: '14/10/2026', status: 'pending' },
  { id: '4', code: 'DQ-0131', customer: 'Trần Minh Anh', item: '1 buổi chăm sóc da cơ bản', points: 800, date: '15/10/2026', status: 'pending' },
]

export interface OrderItem {
  name: string
  image: string
  price: number
  qty: number
}

export interface Order {
  id: string
  code: string
  customer: string
  phone: string
  address: string
  payment: 'COD' | 'ZaloPay' | 'Chuyển khoản'
  items: OrderItem[]
  date: string
  status: 'pending' | 'confirmed' | 'shipping' | 'done' | 'cancelled'
  note?: string
}

export const ORDERS: Order[] = [
  {
    id: '1', code: 'HD-10238', customer: 'Nguyễn Thu Hà', phone: '0901 234 568',
    address: '45 Lê Văn Lương, Q.7, TP.HCM', payment: 'COD', date: '06/10/2026', status: 'done',
    items: [
      { name: 'Kahanna Kem dưỡng ẩm chuyên sâu', image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=200&q=80&auto=format&fit=crop', price: 540000, qty: 1 },
    ],
  },
  {
    id: '2', code: 'HD-10241', customer: 'Phạm Khánh Linh', phone: '0903 456 123',
    address: '12 Nguyễn Hữu Cảnh, Q. Bình Thạnh, TP.HCM', payment: 'ZaloPay', date: '08/10/2026', status: 'shipping',
    items: [
      { name: 'Kahanna Tinh chất vàng 24K phục hồi da', image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=200&q=80&auto=format&fit=crop', price: 890000, qty: 1 },
      { name: 'Kahanna Mặt nạ dưỡng trắng (hộp 10)', image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=200&q=80&auto=format&fit=crop', price: 250000, qty: 1 },
    ],
  },
  {
    id: '3', code: 'HD-10245', customer: 'Trần Minh Anh', phone: '0905 678 910',
    address: '78 Hoàng Văn Thụ, Q. Phú Nhuận, TP.HCM', payment: 'COD', date: '12/10/2026', status: 'confirmed',
    note: 'Giao giờ hành chính',
    items: [
      { name: 'Kahanna Mặt nạ dưỡng trắng (hộp 10)', image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=200&q=80&auto=format&fit=crop', price: 250000, qty: 2 },
    ],
  },
  {
    id: '4', code: 'HD-10247', customer: 'Lê Thu Thảo', phone: '0902 345 678',
    address: '9 Phan Xích Long, Q. Phú Nhuận, TP.HCM', payment: 'Chuyển khoản', date: '14/10/2026', status: 'cancelled',
    items: [
      { name: 'Lurcin Kem chống nắng SPF 50+ PA++++', image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=200&q=80&auto=format&fit=crop', price: 420000, qty: 1 },
    ],
  },
  {
    id: '5', code: 'HD-10249', customer: 'Vũ Ngọc Mai', phone: '0904 567 890',
    address: '23 Trương Định, Q.3, TP.HCM', payment: 'COD', date: '16/10/2026', status: 'pending',
    items: [
      { name: 'Kahanna Nước hoa hồng cân bằng trà xanh', image: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=200&q=80&auto=format&fit=crop', price: 260000, qty: 1 },
      { name: 'Kahanna Micellar Cleansing Nước tẩy trang', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&q=80&auto=format&fit=crop', price: 285000, qty: 1 },
    ],
  },
]

export interface Shift {
  id: string
  staff: string
  date: string
  shift: 'morning' | 'afternoon' | 'evening'
}

export const SHIFTS: Shift[] = [
  { id: '1', staff: 'Trần Hoa', date: '16/10/2026', shift: 'morning' },
  { id: '2', staff: 'Trần Hoa', date: '16/10/2026', shift: 'evening' },
  { id: '3', staff: 'Nguyệt Cát', date: '16/10/2026', shift: 'afternoon' },
  { id: '4', staff: 'Minh Tâm', date: '17/10/2026', shift: 'morning' },
  { id: '5', staff: 'Minh Tâm', date: '17/10/2026', shift: 'afternoon' },
  { id: '6', staff: 'Nguyệt Cát', date: '18/10/2026', shift: 'morning' },
]

export interface WheelPrize {
  id: string
  name: string
  type: 'voucher' | 'service' | 'points' | 'none'
  weight: number
  quantity: number
  is_active: boolean
}

export const WHEEL_PRIZES: WheelPrize[] = [
  { id: '1', name: 'Voucher 50k', type: 'voucher', weight: 15, quantity: 100, is_active: true },
  { id: '2', name: 'Gội đầu thư giãn', type: 'service', weight: 10, quantity: 30, is_active: true },
  { id: '3', name: '50 điểm', type: 'points', weight: 25, quantity: 0, is_active: true },
  { id: '4', name: 'Voucher Freeship', type: 'voucher', weight: 20, quantity: 200, is_active: true },
  { id: '5', name: 'Chúc bạn may mắn lần sau', type: 'none', weight: 30, quantity: 0, is_active: true },
]

export interface WheelSpin {
  id: string
  customer: string
  prize: string
  date: string
}

export const WHEEL_SPINS: WheelSpin[] = [
  { id: '1', customer: 'Nguyễn Thu Hà', prize: 'Voucher 50k', date: '15/10/2026 20:15' },
  { id: '2', customer: 'Trần Minh Anh', prize: '50 điểm', date: '15/10/2026 19:40' },
  { id: '3', customer: 'Lê Thu Thảo', prize: 'Chúc bạn may mắn lần sau', date: '15/10/2026 18:22' },
  { id: '4', customer: 'Phạm Khánh Linh', prize: 'Gội đầu thư giãn', date: '14/10/2026 21:03' },
]

export const WHEEL_CONFIG = {
  spins_per_customer: 1,
  min_order_for_spin: 300000,
  is_enabled: true,
}

export interface HealthRecord {
  id: string
  customer: string
  skin_type: string
  condition: string
  allergies: string
  checked_by: string
  date: string
}

export const HEALTH_RECORDS: HealthRecord[] = [
  { id: '1', customer: 'Nguyễn Thu Hà', skin_type: 'Da dầu', condition: 'Mụn viêm vùng cằm, thâm nhẹ', allergies: 'Không', checked_by: 'Trần Hoa', date: '24/09/2026' },
  { id: '2', customer: 'Lê Thu Thảo', skin_type: 'Da hỗn hợp', condition: 'Da xỉn màu, thiếu ẩm', allergies: 'Cồn khô', checked_by: 'Nguyệt Cát', date: '05/09/2026' },
  { id: '3', customer: 'Phạm Khánh Linh', skin_type: 'Da nhạy cảm', condition: 'Mụn đầu đen vùng trán', allergies: 'Tinh dầu tràm', checked_by: 'Minh Tâm', date: '01/10/2026' },
  { id: '4', customer: 'Vũ Ngọc Mai', skin_type: 'Da khô', condition: 'Nếp nhăn nhẹ vùng mắt', allergies: 'Không', checked_by: 'Trần Hoa', date: '10/10/2026' },
]

export const SITE_CONFIG = {
  spa_name: 'NewSky Vista® — Học viện Spa',
  hotline: '0987 654 321',
  address: '123 Nguyễn Văn Trỗi, Q. Phú Nhuận, TP.HCM',
  open_hours: '08:00 - 21:00',
  hero_banner: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=1200&q=80&auto=format&fit=crop',
  marquee: 'Ưu đãi tháng 10: Giảm 50k cho hóa đơn đầu tiên — mã VISTA50',
  zalo_oa: 'https://zalo.me/123456789',
  maintenance: false,
}

export interface Role {
  id: string
  name: string
  members: number
  permissions: {
    dashboard: boolean
    customers: boolean
    appointments: boolean
    treatments: boolean
    vouchers: boolean
    products: boolean
    staffs: boolean
    settings: boolean
  }
}

export const ROLES: Role[] = [
  { id: '1', name: 'Admin', members: 1, permissions: { dashboard: true, customers: true, appointments: true, treatments: true, vouchers: true, products: true, staffs: true, settings: true } },
  { id: '2', name: 'Quản lý', members: 2, permissions: { dashboard: true, customers: true, appointments: true, treatments: true, vouchers: true, products: true, staffs: true, settings: false } },
  { id: '3', name: 'KTV', members: 4, permissions: { dashboard: true, customers: true, appointments: true, treatments: true, vouchers: false, products: false, staffs: false, settings: false } },
  { id: '4', name: 'Thu ngân', members: 2, permissions: { dashboard: true, customers: true, appointments: false, treatments: false, vouchers: true, products: true, staffs: false, settings: false } },
]

export interface Account {
  id: string
  name: string
  email: string
  role: string
  last_login: string
  is_active: boolean
}

export const ACCOUNTS: Account[] = [
  { id: '1', name: 'Nguyễn Quản Lý', email: 'admin@newskyvista.vn', role: 'Admin', last_login: '16/10/2026 08:02', is_active: true },
  { id: '2', name: 'Trần Thu Ngân', email: 'thungan@newskyvista.vn', role: 'Thu ngân', last_login: '15/10/2026 17:45', is_active: true },
  { id: '3', name: 'Lê Tiếp Tân', email: 'tieptan@newskyvista.vn', role: 'Quản lý', last_login: '15/10/2026 09:10', is_active: true },
  { id: '4', name: 'Phạm Cũ', email: 'pham.cu@newskyvista.vn', role: 'KTV', last_login: '01/09/2026 10:00', is_active: false },
]

export interface Treatment {
  id: string
  code: string
  customer: string
  name: string
  total_sessions: number
  done_sessions: number
  start_date: string
  staff: string
  status: 'ongoing' | 'done'
}

export const TREATMENTS: Treatment[] = [
  { id: '1', code: 'LT-0231', customer: 'Nguyễn Thu Hà', name: 'Peel Acne chuyên sâu', total_sessions: 6, done_sessions: 3, start_date: '24/09/2026', staff: 'Trần Hoa', status: 'ongoing' },
  { id: '2', code: 'LT-0228', customer: 'Lê Thu Thảo', name: 'Glow Skin duy trì', total_sessions: 4, done_sessions: 4, start_date: '05/09/2026', staff: 'Nguyệt Cát', status: 'done' },
  { id: '3', code: 'LT-0235', customer: 'Phạm Khánh Linh', name: 'Trị mụn chuyên sâu', total_sessions: 8, done_sessions: 2, start_date: '01/10/2026', staff: 'Minh Tâm', status: 'ongoing' },
  { id: '4', code: 'LT-0236', customer: 'Vũ Ngọc Mai', name: 'Nâng cơ vàng 24K', total_sessions: 5, done_sessions: 1, start_date: '10/10/2026', staff: 'Trần Hoa', status: 'ongoing' },
  { id: '5', code: 'LT-0219', customer: 'Trần Minh Anh', name: 'Chăm sóc da cơ bản', total_sessions: 4, done_sessions: 4, start_date: '12/08/2026', staff: 'Nguyệt Cát', status: 'done' },
]

export interface Staff {
  id: string
  name: string
  avatar: string
  specialty: string
  services: string[]
  phone: string
  is_active: boolean
}

export const STAFF_LIST: Staff[] = [
  { id: '1', name: 'Trần Hoa', avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80&auto=format&fit=crop', specialty: 'Chăm sóc da', services: ['Chăm sóc da cơ bản', 'Peel da chuyên sâu', 'Gội đầu thư giãn'], phone: '0901 111 222', is_active: true },
  { id: '2', name: 'Nguyệt Cát', avatar: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&q=80&auto=format&fit=crop', specialty: 'Trị liệu da', services: ['Glow Skin duy trì', 'Chăm sóc da cơ bản'], phone: '0902 333 444', is_active: true },
  { id: '3', name: 'Minh Tâm', avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&q=80&auto=format&fit=crop', specialty: 'Trị mụn - Nâng cơ', services: ['Trị mụn chuyên sâu', 'Nâng cơ vàng 24K'], phone: '0903 555 666', is_active: true },
  { id: '4', name: 'Lê Bảo Trân', avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&q=80&auto=format&fit=crop', specialty: 'Thư giãn', services: ['Gội đầu thư giãn', 'Xông hơi mặt thảo dược'], phone: '0904 777 888', is_active: false },
]

export interface Notification {
  id: string
  title: string
  body: string
  type: 'appointment' | 'promo' | 'treatment' | 'birthday'
  audience: string
  sent_at: string
  status: 'sent' | 'scheduled'
}

export const NOTIFICATIONS: Notification[] = [
  { id: '1', title: 'Nhắc lịch hẹn D-1', body: 'Bạn có lịch hẹn chăm sóc da vào 09:00 ngày mai. Đừng quên nhé!', type: 'appointment', audience: 'Nguyễn Thu Hà', sent_at: '15/10/2026 18:00', status: 'sent' },
  { id: '2', title: 'Ưu đãi tháng 10', body: 'Giảm 50k cho hóa đơn đầu tiên trong tháng — mã VISTA50.', type: 'promo', audience: 'Tất cả khách hàng', sent_at: '01/10/2026 09:00', status: 'sent' },
  { id: '3', title: 'Liệu trình sắp hoàn tất', body: 'Bạn còn 1 buổi nữa là hoàn tất liệu trình Glow Skin. Đặt lịch ngay!', type: 'treatment', audience: 'Lê Thu Thảo', sent_at: '12/10/2026 10:30', status: 'sent' },
  { id: '4', title: 'Chúc mừng sinh nhật 🎂', body: 'NewSky Vista tặng bạn 1 buổi chăm da cơ bản trong tháng sinh nhật.', type: 'birthday', audience: 'Khách sinh nhật tháng 10', sent_at: '01/11/2026 08:00', status: 'scheduled' },
]

export interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  image: string
  is_active: boolean
}

export const PRODUCTS: Product[] = [
  { id: '1', name: 'Kahanna Micellar Cleansing Nước tẩy trang', category: 'Sữa rửa mặt', price: 285000, stock: 42, image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '2', name: 'Kahanna Tinh chất vàng 24K phục hồi da', category: 'Tinh chất', price: 890000, stock: 15, image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '3', name: 'Kahanna Kem dưỡng ẩm chuyên sâu', category: 'Kem dưỡng', price: 540000, stock: 28, image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '4', name: 'Lurcin Kem chống nắng SPF 50+ PA++++', category: 'Kem chống nắng', price: 420000, stock: 0, image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '5', name: 'Kahanna Mặt nạ dưỡng trắng (hộp 10)', category: 'Mặt nạ', price: 250000, stock: 63, image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400&q=80&auto=format&fit=crop', is_active: true },
  { id: '6', name: 'Kahanna Nước hoa hồng cân bằng trà xanh', category: 'Nước hoa hồng', price: 260000, stock: 35, image: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&q=80&auto=format&fit=crop', is_active: false },
]

export const POINTS_POLICY = [
  { rank: 'Vista' as Rank, min_points: 0, earn_rate: '1.000đ = 1 điểm', benefit: 'Tích điểm cơ bản, nhận voucher tháng sinh nhật' },
  { rank: 'VIP' as Rank, min_points: 1000, earn_rate: '1.000đ = 1.2 điểm', benefit: 'Ưu tiên đặt lịch, kiểm tra da định kỳ miễn phí' },
  { rank: 'Kim Cương' as Rank, min_points: 4000, earn_rate: '1.000đ = 1.5 điểm', benefit: 'Ưu đãi riêng theo tháng, quà tặng quý' },
]

export interface PointTransaction {
  id: string
  customer: string
  type: 'earn' | 'redeem'
  points: number
  note: string
  date: string
}

export const POINT_TRANSACTIONS: PointTransaction[] = [
  { id: '1', customer: 'Nguyễn Thu Hà', type: 'earn', points: 120, note: 'Hóa đơn #10238', date: '06/10/2026' },
  { id: '2', customer: 'Lê Thu Thảo', type: 'redeem', points: -50, note: 'Đổi quà — Gội đầu thư giãn', date: '28/09/2026' },
  { id: '3', customer: 'Nguyễn Thu Hà', type: 'earn', points: 85, note: 'Hóa đơn #10190', date: '14/09/2026' },
  { id: '4', customer: 'Phạm Khánh Linh', type: 'earn', points: 210, note: 'Hóa đơn #10188', date: '10/09/2026' },
  { id: '5', customer: 'Vũ Ngọc Mai', type: 'redeem', points: -200, note: 'Đổi voucher 100k', date: '02/09/2026' },
  { id: '6', customer: 'Trần Minh Anh', type: 'earn', points: 45, note: 'Hóa đơn #10175', date: '28/08/2026' },
]
