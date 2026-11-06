import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

type PublicSupabaseEnvironment = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

type SupabaseConfiguration =
  | { configured: true; url: string; anonKey: string }
  | { configured: false }

export function readSupabaseConfiguration(
  environment: PublicSupabaseEnvironment,
): SupabaseConfiguration {
  const url = environment.VITE_SUPABASE_URL?.trim()
  const anonKey = environment.VITE_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    return { configured: false }
  }

  try {
    const parsedUrl = new URL(url)
    const isLocalHttp =
      parsedUrl.protocol === 'http:' &&
      (parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1' ||
        parsedUrl.hostname === '[::1]')
    const isSecureHttp = parsedUrl.protocol === 'https:'

    if (
      (!isSecureHttp && !isLocalHttp) ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      return { configured: false }
    }
  } catch {
    return { configured: false }
  }

  return { configured: true, url, anonKey }
}

const configuration = readSupabaseConfiguration({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
})

export const supabaseConfigured = configuration.configured

export const supabaseAuthOptions = {
  autoRefreshToken: true,
  detectSessionInUrl: false,
  persistSession: true,
} as const

export const supabaseClient = configuration.configured
  ? createClient<Database>(configuration.url, configuration.anonKey, {
      auth: supabaseAuthOptions,
    })
  : null
