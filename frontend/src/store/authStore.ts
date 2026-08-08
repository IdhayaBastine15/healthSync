import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { jwtDecode } from 'jwt-decode'
import type { JwtPayload, TokenResponse } from '../types/auth'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null // epoch ms
  userId: string | null
  roles: string[]
  setTokens: (tokens: TokenResponse) => void
  clear: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      userId: null,
      roles: [],

      setTokens: (tokens) => {
        const payload = jwtDecode<JwtPayload>(tokens.access_token)
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          userId: payload.sub,
          roles: payload.roles ?? [],
        })
      },

      clear: () => {
        set({ accessToken: null, refreshToken: null, expiresAt: null, userId: null, roles: [] })
      },

      isAuthenticated: () => {
        const { accessToken, expiresAt } = get()
        return Boolean(accessToken) && Boolean(expiresAt) && expiresAt! > Date.now()
      },
    }),
    { name: 'healthsync-auth' },
  ),
)
