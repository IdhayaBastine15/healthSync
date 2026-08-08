import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'
import type { TokenResponse } from '../types/auth'

// Empty locally -> relative path -> Vite dev-server proxy (vite.config.ts)
// forwards /api to the local gateway. Set as a build-time env var on Render's
// static site in prod (Vite inlines import.meta.env.* at build time).
const API_BASE = import.meta.env.VITE_API_GATEWAY_URL || ''

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) throw new Error('No refresh token available')

  const response = await axios.post<TokenResponse>(`${API_BASE}/api/v1/auth/refresh`, {
    refresh_token: refreshToken,
  })
  useAuthStore.getState().setTokens(response.data)
  return response.data.access_token
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null
        })
        const newToken = await refreshPromise
        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch {
        useAuthStore.getState().clear()
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

export interface ApiErrorBody {
  error: { code: string; message: string }
}

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined
    if (body?.error?.message) return body.error.message
    if (error.message) return error.message
  }
  return 'An unexpected error occurred'
}
