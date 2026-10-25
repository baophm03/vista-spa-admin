import axios, { type AxiosRequestConfig } from 'axios'
import links from '@/configs/links'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'

export const apiClient = axios.create({
  baseURL: `${links.apiEndpoint}/api/v1.0`,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Đổi refreshToken lấy accessToken mới. Single-flight: nhiều request 401 cùng lúc chỉ gọi 1 lần. */
let refreshing: Promise<string> | null = null
async function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    const { refreshToken } = useAuthStore.getState()
    if (!refreshToken) return Promise.reject(new Error('No refresh token'))
    refreshing = apiClient
      .post<{ responseData?: { accessToken: string } }>('/auth/genNewAccessToken', { refreshToken })
      .then((res) => {
        const token = res.data?.responseData?.accessToken
        if (!token) throw new Error('Refresh failed')
        useAuthStore.getState().setTokens(token, refreshToken)
        return token
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

export function clearAuth() {
  useAuthStore.getState().clear()
  useProfileStore.getState().clear()
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const isAuthCall = String(original?.url ?? '').includes('/auth/')
    // 401 + request chưa retry + không phải call auth → thử refresh rồi gọi lại
    if (err.response?.status === 401 && !original?._retry && !isAuthCall) {
      original._retry = true
      try {
        await refreshAccessToken()
        return apiClient(original)
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

export async function customInstance<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  const response = await apiClient(config)
  return response.data as T
}
