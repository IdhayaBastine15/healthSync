export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  given_name: string
  family_name: string
  roles: string[]
  department?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface JwtPayload {
  sub: string
  roles: string[]
  jti: string
  iat: number
  exp: number
}
