import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { TOKEN_KEY } from '../api/client'
import './login.css'

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
      navigate('/', { replace: true })
    } catch (err: any) {
      setAlert(err?.response?.data?.message || err.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-scrim" />

      <div className="login-tagline">
        <div className="login-tagline-rule" />
        <h2>Nâng tầm giá trị — Tự tin tỏa sáng</h2>
        <p>Hệ thống quản trị thành viên, dịch vụ & chương trình ưu đãi của NewSky Vista.</p>
      </div>

      <aside className="login-panel">
        <div className="login-brand">
          <div className="login-brand-name">NewSky Vista</div>
          <div className="login-brand-sub">Học viện Spa</div>
          <div className="login-brand-divider" />
        </div>

        <div className="login-heading">
          <h1>Đăng nhập quản trị</h1>
          <p>Dùng email hoặc số điện thoại đã đăng ký với hệ thống.</p>
        </div>

        {alert && <div className="login-alert">{alert}</div>}

        <form onSubmit={onSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="identifier">Tài khoản</label>
            <div className="login-input-wrap">
              <UserIcon />
              <input
                id="identifier"
                className="login-input"
                type="text"
                placeholder="Email / Số điện thoại"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
            {errors.identifier && <div className="login-error">{errors.identifier}</div>}
          </div>

          <div className="login-field">
            <label htmlFor="password">Mật khẩu</label>
            <div className="login-input-wrap">
              <LockIcon />
              <input
                id="password"
                className="login-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {errors.password && <div className="login-error">{errors.password}</div>}
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="login-footer">© 2026 NewSky Vista — CTCP Việt Phụng</div>
      </aside>
    </div>
  )
}
