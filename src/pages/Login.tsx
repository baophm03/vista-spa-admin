import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { REFRESH_KEY, TOKEN_KEY } from '../api/client'
import { login } from '../api/auth'

const UserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="pointer-events-none absolute left-4 h-[18px] w-[18px] text-[#b3adbd]"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="pointer-events-none absolute left-4 h-[18px] w-[18px] text-[#b3adbd]"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const inputClassName =
  'box-border h-12 w-full appearance-none rounded-xl border-[1.5px] border-[var(--brand-border)] bg-[#faf7f3] py-0 pr-4 pl-11 text-sm text-[#292331] outline-none transition-[border-color,background-color,box-shadow] duration-200 [font-family:inherit] placeholder:text-[#b3adbd] focus:border-[var(--brand-primary)] focus:bg-white focus:shadow-[0_0_0_4px_rgba(var(--brand-rgb),0.1)]'

export default function Login() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('admin@newskyvista.vn')
  const [password, setPassword] = useState('Admin@2026')
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
  const [alert, setAlert] = useState('')
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const next: typeof errors = {}
    if (!identifier.trim()) next.identifier = 'Nhập email hoặc số điện thoại'
    if (!password) next.password = 'Nhập mật khẩu'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAlert('')
    if (!validate()) return
    setLoading(true)
    try {
      const result = await login(identifier.trim(), password)
      localStorage.setItem(TOKEN_KEY, result.accessToken)
      localStorage.setItem(REFRESH_KEY, result.refreshToken)
      navigate('/', { replace: true })
    } catch (err: any) {
      setAlert(err?.response?.data?.message ?? 'Đăng nhập thất bại, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[url('/login.png')] bg-cover bg-center">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(41,35,49,0.55)_0%,rgba(41,35,49,0.18)_28%,transparent_55%)]" />

      <div className="absolute bottom-12 left-14 z-[1] max-w-[460px] max-[720px]:hidden">
        <div className="mb-[18px] h-[3px] w-14 rounded-xl bg-[var(--brand-accent)]" />
        <h2 className="mt-0 mb-2.5 text-[30px] leading-[1.35] font-semibold text-white [text-shadow:0_2px_16px_rgba(41,35,49,0.5)]">
          Nâng tầm giá trị — Tự tin tỏa sáng
        </h2>
        <p className="m-0 text-sm leading-[1.6] text-[rgba(255,255,255,0.92)] [text-shadow:0_1px_8px_rgba(41,35,49,0.45)]">
          Hệ thống quản trị thành viên, dịch vụ & chương trình ưu đãi của NewSky Vista.
        </p>
      </div>

      <aside className="absolute top-1/2 right-[clamp(48px,10vw,140px)] z-[2] box-border w-[min(420px,calc(100vw-48px))] -translate-y-1/2 rounded-xl bg-white p-12 px-11 pb-8 shadow-[0_32px_80px_rgba(var(--brand-dark-rgb),0.28),0_4px_16px_rgba(var(--brand-dark-rgb),0.12)] max-[720px]:right-1/2 max-[720px]:translate-x-1/2 max-[720px]:p-10 max-[720px]:px-7 max-[720px]:pb-6">
        <div className="mb-9 text-center">
          <div className="text-2xl font-bold tracking-[0.08em] text-[var(--brand-dark)] uppercase">NewSky Vista</div>
          <div className="mt-1.5 text-[11px] font-medium tracking-[0.32em] text-[var(--brand-accent)] uppercase">
            Học viện Spa
          </div>
          <div className="mx-auto mt-[18px] h-0.5 w-10 bg-[var(--brand-accent)]" />
        </div>

        <div>
          <h1 className="mt-0 mb-1.5 text-[22px] font-semibold text-[#292331]">Đăng nhập quản trị</h1>
          <p className="mt-0 mb-7 text-[13px] text-[#8a8494]">Dùng email hoặc số điện thoại đã đăng ký với hệ thống.</p>
        </div>

        {alert && (
          <div className="mb-[18px] rounded-xl border border-[#f5c6d4] bg-[#fdf0f3] px-3.5 py-2.5 text-[13px] text-[#d4385f]">
            {alert}
          </div>
        )}

        <form onSubmit={onSubmit} noValidate>
          <div className="mb-[18px]">
            <label
              htmlFor="identifier"
              className="mb-2 block text-xs font-semibold tracking-[0.06em] text-[#6f6880] uppercase"
            >
              Tài khoản
            </label>
            <div className="relative flex items-center">
              <UserIcon />
              <input
                id="identifier"
                className={inputClassName}
                type="text"
                placeholder="Email / Số điện thoại"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
            {errors.identifier && <div className="mt-1.5 text-xs text-[#d4385f]">{errors.identifier}</div>}
          </div>

          <div className="mb-[18px]">
            <label
              htmlFor="password"
              className="mb-2 block text-xs font-semibold tracking-[0.06em] text-[#6f6880] uppercase"
            >
              Mật khẩu
            </label>
            <div className="relative flex items-center">
              <LockIcon />
              <input
                id="password"
                className={inputClassName}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {errors.password && <div className="mt-1.5 text-xs text-[#d4385f]">{errors.password}</div>}
          </div>

          <button
            type="submit"
            className="mt-1.5 box-border h-[50px] w-full cursor-pointer rounded-xl border-none bg-[linear-gradient(135deg,var(--brand-primary)_0%,var(--brand-dark)_100%)] p-0 text-[15px] font-semibold tracking-[0.02em] text-white shadow-[0_8px_20px_rgba(var(--brand-dark-rgb),0.35)] transition-[transform,box-shadow,opacity] duration-150 [font-family:inherit] enabled:hover:-translate-y-px enabled:hover:shadow-[0_10px_24px_rgba(var(--brand-dark-rgb),0.45)] enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65"
            disabled={loading}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="mt-7 border-t border-[var(--brand-border-soft)] pt-5 text-center text-[11px] text-[#b3adbd]">
          © 2026 NewSky Vista — CTCP Việt Phụng
        </div>
      </aside>
    </div>
  )
}
