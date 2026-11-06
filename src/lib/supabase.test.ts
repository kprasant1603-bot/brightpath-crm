import { describe, expect, it } from 'vitest'
import { readSupabaseConfiguration, supabaseAuthOptions } from './supabase'

describe('Supabase Auth options', () => {
  it('persists and refreshes sessions without reading tokens from the URL', () => {
    expect(supabaseAuthOptions).toEqual({
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    })
    expect(supabaseAuthOptions).not.toHaveProperty('storage')
  })
})

describe('readSupabaseConfiguration', () => {
  it('rejects missing configuration without returning any values', () => {
    expect(readSupabaseConfiguration({})).toEqual({ configured: false })
    expect(
      readSupabaseConfiguration({
        VITE_SUPABASE_URL: 'https://project.example.test',
      }),
    ).toEqual({ configured: false })
    expect(
      readSupabaseConfiguration({
        VITE_SUPABASE_ANON_KEY: 'fictional-public-key',
      }),
    ).toEqual({ configured: false })
  })

  it('accepts a secure project URL with a public client key', () => {
    const configuration = readSupabaseConfiguration({
      VITE_SUPABASE_URL: 'https://project.example.test',
      VITE_SUPABASE_ANON_KEY: 'fictional-public-key',
    })

    expect(configuration.configured).toBe(true)
  })

  it('allows local HTTP URLs and rejects insecure remote URLs', () => {
    expect(
      readSupabaseConfiguration({
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'fictional-public-key',
      }).configured,
    ).toBe(true)

    expect(
      readSupabaseConfiguration({
        VITE_SUPABASE_URL: 'http://project.example.test',
        VITE_SUPABASE_ANON_KEY: 'fictional-public-key',
      }).configured,
    ).toBe(false)
  })

  it('rejects URLs containing credentials, query strings, or fragments', () => {
    for (const url of [
      'https://user:pass@project.example.test',
      'https://project.example.test?mode=fictional',
      'https://project.example.test#section',
    ]) {
      expect(
        readSupabaseConfiguration({
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_ANON_KEY: 'fictional-public-key',
        }).configured,
      ).toBe(false)
    }
  })
})
