import axios from 'axios'

export const TOKEN_KEY = 'admin_access_token'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1.0',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
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
