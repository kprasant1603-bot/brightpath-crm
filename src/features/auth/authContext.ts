import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'

type Profile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'display_name' | 'is_active' | 'role'
>

export type AppRole = 'admin' | 'manager' | 'counsellor'

export type AuthState =
  | { status: 'configuration-error' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'profile-unavailable' }
  | { status: 'profile-error' }
  | { status: 'inactive' }
  | { status: 'invalid-role' }
  | { status: 'ready'; profile: Profile; user: User }

export type AuthContextValue = {
  state: AuthState
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<boolean>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }

  return context
}
