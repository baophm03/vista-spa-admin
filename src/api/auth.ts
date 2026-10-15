import { api, unwrap } from './client'

export interface LoginResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export const login = (identifier: string, password: string) =>
  unwrap<LoginResult>(api.post('/auth/login', { identifier, password }))

export const getMyInfo = () => unwrap(api.get('/users/getMyInfo'))
