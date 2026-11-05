import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabaseClient, supabaseConfigured } from '../../lib/supabase'
import { AuthContext, type AuthState } from './authContext'

function isAppRole(role: string) {
  return role === 'admin' || role === 'manager' || role === 'counsellor'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    supabaseConfigured ? { status: 'loading' } : { status: 'configuration-error' },
  )

  useEffect(() => {
    if (!supabaseClient) {
      return
    }
    const client = supabaseClient

    let active = true
    let sessionVersion = 0
    const pendingLookups = new Set<ReturnType<typeof setTimeout>>()

    const loadProfile = async (user: User, version: number) => {
      try {
        const { data, error } = await client
          .from('profiles')
          .select('id, display_name, is_active, role')
          .eq('id', user.id)
          .maybeSingle()

        if (!active || version !== sessionVersion) {
          return
        }

        if (error) {
          setState({ status: 'profile-error' })
          return
        }

        if (!data) {
          setState({ status: 'profile-unavailable' })
          return
        }

        if (data.id !== user.id) {
          setState({ status: 'profile-error' })
          return
        }

        if (!data.is_active) {
          setState({ status: 'inactive' })
          return
        }

        if (!isAppRole(data.role)) {
          setState({ status: 'invalid-role' })
          return
        }

        setState({
          status: 'ready',
          profile: data,
          user,
        })
      } catch {
        if (active && version === sessionVersion) {
          setState({ status: 'profile-error' })
        }
      }
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      const version = ++sessionVersion

      if (!session) {
        setState({ status: 'signed-out' })
        return
      }

      setState({ status: 'loading' })
      const lookup = setTimeout(() => {
        pendingLookups.delete(lookup)
        void loadProfile(session.user, version)
      }, 0)
      pendingLookups.add(lookup)
    })

    return () => {
      active = false
      sessionVersion += 1
      pendingLookups.forEach(clearTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabaseClient) {
        return false
      }

      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      })

      return !error
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (!supabaseClient) {
      return false
    }

    const { error } = await supabaseClient.auth.signOut()
    return !error
  }, [])

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
