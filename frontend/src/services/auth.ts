import { api } from './api'
import type { LoginRequest, TokenResponse } from '../types/auth'

export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', credentials)
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}
