import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { login as loginRequest, logout as logoutRequest } from '../services/auth'
import { api } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'
import type { LoginRequest, TokenResponse } from '../types/auth'

export function useAuth() {
  const navigate = useNavigate()
  const { accessToken, refreshToken, expiresAt, userId, roles, setTokens, clear, isAuthenticated } =
    useAuthStore()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefresh = useCallback(
    (expiresInMs: number) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      const delay = Math.max(expiresInMs - 60_000, 5_000) // refresh 60s before expiry
      refreshTimer.current = setTimeout(async () => {
        try {
          const { data } = await api.post<TokenResponse>('/auth/refresh', {
            refresh_token: useAuthStore.getState().refreshToken,
          })
          setTokens(data)
          scheduleRefresh(data.expires_in * 1000)
        } catch {
          clear()
        }
      }, delay)
    },
    [setTokens, clear],
  )

  useEffect(() => {
    if (accessToken && expiresAt) {
      scheduleRefresh(expiresAt - Date.now())
      connectSocket(accessToken)
    }
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const tokens = await loginRequest(credentials)
      setTokens(tokens)
      navigate('/dashboard')
    },
    [setTokens, navigate],
  )

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // best-effort - clear local state regardless
    }
    disconnectSocket()
    clear()
    navigate('/login')
  }, [clear, navigate])

  return {
    accessToken,
    refreshToken,
    userId,
    roles,
    isAuthenticated: isAuthenticated(),
    login,
    logout,
  }
}
