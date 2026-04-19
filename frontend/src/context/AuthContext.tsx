import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api'

export type UserRole =
  | 'APPLICANT' | 'PSO' | 'SW' | 'TO' | 'PHI' | 'HO'
  | 'RDA' | 'GJS' | 'UDA' | 'CHAIRMAN' | 'ADMIN'

export interface AuthUser {
  user_id: string
  email: string
  role: UserRole
  emailVerified: boolean
  full_name?: string
  phone?: string
  applicant_id?: string
  officer_id?: string
  status?: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  loading: boolean
  needsOTP: boolean
  login: (email: string, password: string) => Promise<{ needsEmailVerification: boolean }>
  logout: () => Promise<void>
  verifyOTP: (code: string) => Promise<void>
  sendOTP: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)
  const [needsOTP, setNeedsOTP] = useState(false)

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me()
      const u = res.data.data
      setUser(u)
      localStorage.setItem('user', JSON.stringify(u))
    } catch {
      setUser(null)
      setToken(null)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }, [])

  useEffect(() => {
    if (token) {
      refreshUser().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, []) // eslint-disable-line

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password })
    const { token: t, user: u, needsEmailVerification } = res.data
    setToken(t)
    localStorage.setItem('token', t)
    setUser(u)
    localStorage.setItem('user', JSON.stringify(u))
    if (needsEmailVerification) {
      setNeedsOTP(true)
    }
    return { needsEmailVerification }
  }

  const logout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    setUser(null)
    setToken(null)
    setNeedsOTP(false)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const verifyOTP = async (code: string) => {
    const res = await authApi.verifyOTP(code)
    const { token: t } = res.data
    if (t) {
      setToken(t)
      localStorage.setItem('token', t)
    }
    setNeedsOTP(false)
    await refreshUser()
  }

  const sendOTP = async () => {
    await authApi.sendOTP()
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, needsOTP, login, logout, verifyOTP, sendOTP, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
