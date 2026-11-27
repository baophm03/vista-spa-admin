import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { usePostAuthLogin } from '@/api/endpoints/auth'
import { pickData, errorMessage } from '../../api/helpers'
import { useAuthStore } from '../../stores/auth-store'
import { useProfileStore, type AdminProfile } from '../../stores/profile-store'
import { useBrandRuntime } from '../../themeRuntime'
import links from '../../configs/links'
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

export default function Login() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const brand = useBrandRuntime()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
  const [alert, setAlert] = useState('')
  const loginMutation = usePostAuthLogin()

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
    try {
      const response = await loginMutation.mutateAsync({ data: { identifier: identifier.trim(), password } })
      const loginData = pickData<Record<string, any>>(response)
      const tokens = loginData as { accessToken?: string; refreshToken?: string } | undefined
      if (!tokens?.accessToken || !tokens?.refreshToken) throw new Error('Phản hồi đăng nhập không hợp lệ')
      // Query keys do OpenAPI sinh không gắn theo user; xóa cache trước khi đổi tài khoản.
      queryClient.removeQueries()
      useProfileStore.getState().clear()
      useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken)
      // Login response giờ kèm user (roles + permissions [{module, action}] như meu)
      // → set profile sớm để CASL rules sẵn sàng trước khi getMyInfo refresh lại
      if (loginData?.user) useProfileStore.getState().setProfile(loginData.user as AdminProfile)
      navigate('/', { replace: true })
    } catch (err) {
      setAlert(errorMessage(err, 'Đăng nhập thất bại, vui lòng thử lại'))
    }
  }

  const inputWrapClass =
    'relative flex items-center [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:left-4 [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:text-[#b3adbd]'
  const inputClass =
    'h-12 w-full rounded-lg border-[1.5px] border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 pl-11 text-sm text-[#292331] outline-none transition placeholder:text-[#b3adbd] focus:border-[var(--brand-primary)] focus:bg-white focus:shadow-[0_0_0_4px_rgba(var(--brand-rgb),0.1)]'
  const labelClass = 'mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-[#6f6880]'
  const errorClass = 'mt-1.5 text-xs text-[#d4385f]'

  return (
    <div className="relative min-h-screen overflow-hidden bg-cover bg-center font-sans max-[720px]:flex max-[720px]:min-h-[100dvh] max-[720px]:items-center max-[720px]:justify-center max-[720px]:overflow-y-auto max-[720px]:p-4">
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/login.png')" }}
      />
      {/* Scrim nhẹ góc dưới-trái cho tagline */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(41,35,49,0.55)] to-transparent [background-size:100%_55vh] [background-repeat:no-repeat] [background-position:bottom]" />

      {/* Tagline góc dưới-trái */}
      <div className="absolute bottom-12 left-14 z-[1] hidden max-w-[460px] max-[720px]:hidden">
        <div className="mb-[18px] h-[3px] w-14 rounded-full bg-[var(--brand-tertiary)]" />
        <h2 className="m-0 mb-2.5 text-[30px] font-semibold leading-[1.35] text-white drop-shadow-[0_2px_16px_rgba(41,35,49,0.5)]">
          Nâng tầm giá trị — Tự tin tỏa sáng
        </h2>
        <p className="m-0 text-sm leading-relaxed text-white/90 drop-shadow-[0_1px_8px_rgba(41,35,49,0.45)]">
          Hệ thống quản trị thành viên, dịch vụ & chương trình ưu đãi của {brand.name}.
        </p>
      </div>

      {/* Panel form bên phải */}
      {/* Mobile (<720px): bỏ fixed-center (màn thấp bị cắt, không cuộn được) →
          panel nằm trong flow, flex cha canh giữa, dư thì cuộn tự nhiên */}
      <aside className="fixed top-1/2 right-12 z-[2] w-[min(420px,calc(100vw-48px))] -translate-y-1/2 rounded-lg bg-white p-11 pb-8 shadow-[0_32px_80px_rgba(var(--brand-dark-rgb),0.28),0_4px_16px_rgba(var(--brand-dark-rgb),0.12)] max-[720px]:static max-[720px]:my-6 max-[720px]:w-full max-[720px]:max-w-[420px]! max-[720px]:translate-y-0 max-[720px]:rounded-lg max-[720px]:px-6 max-[720px]:py-8">
        <div className="mb-9 text-center max-[720px]:mb-6">
          {brand.logoUrl && (
            <img
              src={`${links.imageEndpoint}${brand.logoUrl}`}
              alt={brand.name}
              className="mx-auto mb-3 block h-14 max-w-[160px] object-contain"
            />
          )}
          <div className="text-2xl font-bold tracking-[0.08em] text-[var(--brand-dark)] uppercase">{brand.name}</div>
          <div className="mt-1.5 text-[11px] font-medium tracking-[0.32em] text-[var(--brand-tertiary)] uppercase">
            Học viện Spa
          </div>
          <div className="mx-auto mt-[18px] h-0.5 w-10 bg-[var(--brand-tertiary)]" />
        </div>

        {alert && (
          <div className="mb-[18px] rounded-lg border border-[#f5c6d4] bg-[#fdf0f3] px-3.5 py-2.5 text-[13px] text-[#d4385f]">
            {alert}
          </div>
        )}

        <form onSubmit={onSubmit} noValidate>
          <div className="mb-[18px]">
            <label htmlFor="identifier" className={labelClass}>
              Tài khoản
            </label>
            <div className={inputWrapClass}>
              <UserIcon />
              <input
                id="identifier"
                className={inputClass}
                type="text"
                placeholder="Email / Số điện thoại"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
            {errors.identifier && <div className={errorClass}>{errors.identifier}</div>}
          </div>

          <div className="mb-[18px]">
            <label htmlFor="password" className={labelClass}>
              Mật khẩu
            </label>
            <div className={inputWrapClass}>
              <LockIcon />
              <input
                id="password"
                className={`${inputClass} pr-11 [&::-ms-reveal]:hidden`}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute top-1/2 right-3 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[#8a8494] transition-colors hover:bg-[rgba(var(--brand-rgb),0.08)] hover:text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
              >
                {showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </button>
            </div>
            {errors.password && <div className={errorClass}>{errors.password}</div>}
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="mt-1.5 h-[50px] w-full cursor-pointer rounded-lg border-0 bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-dark))] text-[15px] font-semibold tracking-[0.02em] text-white transition hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {loginMutation.isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="mt-7 border-t border-[var(--brand-border-soft)] pt-5 text-center text-[11px] text-[#b3adbd]">
          © 2026 {brand.name} - CTCP Việt Phụng
        </div>
      </aside>
    </div>
  )
}
