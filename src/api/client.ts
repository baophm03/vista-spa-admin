import axios from 'axios'

export const TOKEN_KEY = 'admin_access_token'
export const REFRESH_KEY = 'admin_refresh_token'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1.0',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Đổi refreshToken lấy accessToken mới. Single-flight: nhiều request 401 cùng lúc chỉ gọi 1 lần. */
let refreshing: Promise<string> | null = null
async function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    const refreshToken = localStorage.getItem(REFRESH_KEY)
    if (!refreshToken) return Promise.reject(new Error('No refresh token'))
    refreshing = api
      .post<{ responseData?: { accessToken: string } }>('/auth/genNewAccessToken', { refreshToken })
      .then((res) => {
        const token = res.data?.responseData?.accessToken
        if (!token) throw new Error('Refresh failed')
        localStorage.setItem(TOKEN_KEY, token)
        return token
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const isAuthCall = String(original?.url ?? '').includes('/auth/')
    // 401 + request chưa retry + không phải call auth → thử refresh rồi gọi lại
    if (err.response?.status === 401 && !original?._retry && !isAuthCall) {
      original._retry = true
      try {
        await refreshAccessToken()
        return api(original)
      } catch {
        clearAuth()
        if (!location.pathname.startsWith('/login')) location.href = '/login'
      }
    }
    if (err.response?.status === 401 && (original?._retry || isAuthCall)) {
      clearAuth()
      if (!location.pathname.startsWith('/login')) location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export async function unwrap<T = unknown>(promise: Promise<{ data: unknown }>): Promise<T> {
  const body: any = (await promise).data
  if (body?.status === 'fail') throw new Error(body.message || 'Request failed')
  return (body?.responseData ?? body) as T
}
