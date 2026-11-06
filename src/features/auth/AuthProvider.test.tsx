import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './authContext'

const mocks = vi.hoisted(() => ({
  authCallback: null as
    | ((
        event: string,
        session: { user: { id: string } } | null,
      ) => void)
    | null,
  restoreSessionOnSubscribe: false,
  persistedSession: null as { user: { id: string } } | null,
  profileResponse: {
    data: {
      id: 'fictional-user-id',
      display_name: 'Fictional Test Manager',
      is_active: true,
      role: 'manager',
    },
    error: null,
  } as {
    data: {
      id: string
      display_name: string | null
      is_active: boolean
      role: string
    } | null
    error: unknown | null
  },
  profileRows: null as
    | Array<{
        id: string
        display_name: string | null
        is_active: boolean
        role: string
      }>
    | null,
  profileIdFilters: [] as Array<{ column: string; value: string }>,
  signInWithPassword: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  unsubscribe: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabaseConfigured: true,
  supabaseClient: {
    auth: {
      onAuthStateChange: (
        callback: NonNullable<typeof mocks.authCallback>,
      ) => {
        mocks.authCallback = callback
        if (mocks.restoreSessionOnSubscribe) {
          queueMicrotask(() => callback('INITIAL_SESSION', mocks.persistedSession))
        }
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }
      },
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
    from: () => ({
      select: () => {
        let filteredId: string | null = null

        return {
          eq: (column: string, value: string) => {
            mocks.profileIdFilters.push({ column, value })
            if (column === 'id') {
              filteredId = value
            }
            return {
              maybeSingle: async () => {
                if (!mocks.profileRows) {
                  return mocks.profileResponse
                }

                const rows = filteredId
                  ? mocks.profileRows.filter((profile) => profile.id === filteredId)
                  : mocks.profileRows
                if (rows.length > 1) {
                  return {
                    data: null,
                    error: new Error('multiple profile rows returned'),
                  }
                }

                return { data: rows[0] ?? null, error: null }
              },
            }
          },
        }
      },
    }),
  },
}))

function StateProbe() {
  const { state } = useAuth()

  return (
    <output>
      {state.status}
      {state.status === 'ready' ? `:${state.profile.role}` : ''}
    </output>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <StateProbe />
    </AuthProvider>,
  )
}

function sendSession() {
  act(() => {
    mocks.authCallback?.('SIGNED_IN', { user: { id: 'fictional-user-id' } })
  })
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mocks.authCallback = null
    mocks.restoreSessionOnSubscribe = false
    mocks.persistedSession = null
    mocks.profileRows = null
    mocks.profileIdFilters = []
    mocks.profileResponse = {
      data: {
        id: 'fictional-user-id',
        display_name: 'Fictional Test Manager',
        is_active: true,
        role: 'manager',
      },
      error: null,
    }
    mocks.signInWithPassword.mockReset()
    mocks.signInWithPassword.mockResolvedValue({ error: null })
    mocks.signOut.mockReset()
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.unsubscribe.mockReset()
  })

  it('moves to signed-out when Auth has no active session', () => {
    renderProvider()

    act(() => {
      mocks.authCallback?.('INITIAL_SESSION', null)
    })

    expect(screen.getByText('signed-out')).toBeInTheDocument()
  })

  it('loads the signed-in user profile and accepts a supported role', async () => {
    renderProvider()
    sendSession()

    expect(await screen.findByText('ready:manager')).toBeInTheDocument()
  })

  it.each([
    { role: 'manager', email: 'phase3-manager@example.test' },
    { role: 'admin', email: 'phase3-admin@example.test' },
  ])(
    'selects the signed-in $role profile among multiple visible profiles',
    async ({ role }) => {
      mocks.profileRows = [
        {
          id: 'fictional-counsellor-id',
          display_name: 'Fictional Counsellor',
          is_active: true,
          role: 'counsellor',
        },
        {
          id: 'fictional-user-id',
          display_name: `Fictional ${role}`,
          is_active: true,
          role,
        },
      ]

      renderProvider()
      sendSession()

      expect(await screen.findByText(`ready:${role}`)).toBeInTheDocument()
      expect(mocks.profileIdFilters).toContainEqual({
        column: 'id',
        value: 'fictional-user-id',
      })
    },
  )

  it('denies access when multiple rows match the authenticated user id', async () => {
    mocks.profileRows = [
      {
        id: 'fictional-user-id',
        display_name: 'Fictional Manager',
        is_active: true,
        role: 'manager',
      },
      {
        id: 'fictional-user-id',
        display_name: 'Fictional Counsellor',
        is_active: true,
        role: 'counsellor',
      },
    ]

    renderProvider()
    sendSession()

    expect(await screen.findByText('profile-error')).toBeInTheDocument()
  })

  it('restores a persisted session and profile after reload', async () => {
    const firstLoad = renderProvider()
    mocks.persistedSession = { user: { id: 'fictional-user-id' } }
    sendSession()

    expect(await screen.findByText('ready:manager')).toBeInTheDocument()
    firstLoad.unmount()

    mocks.restoreSessionOnSubscribe = true
    renderProvider()

    expect(await screen.findByText('ready:manager')).toBeInTheDocument()
  })

  it('denies access to inactive, missing, errored, and unsupported profiles', async () => {
    const cases = [
      {
        response: {
          data: {
            id: 'fictional-user-id',
            display_name: null,
            is_active: false,
            role: 'counsellor',
          },
          error: null,
        },
        status: 'inactive',
      },
      {
        response: { data: null, error: null },
        status: 'profile-unavailable',
      },
      {
        response: { data: null, error: new Error('fictional query failure') },
        status: 'profile-error',
      },
      {
        response: {
          data: {
            id: 'fictional-user-id',
            display_name: null,
            is_active: true,
            role: 'unrecognized',
          },
          error: null,
        },
        status: 'invalid-role',
      },
    ]

    for (const testCase of cases) {
      mocks.profileResponse = testCase.response
      const { unmount } = renderProvider()
      sendSession()
      await waitFor(() =>
        expect(screen.getByText(testCase.status)).toBeInTheDocument(),
      )
      unmount()
    }
  })
})
