import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthGate } from './AuthGate'

const authMock = vi.hoisted(() => ({
  state: {
    status: 'signed-out' as 'signed-out' | 'configuration-error',
  },
  signIn: vi.fn(async () => false),
  signOut: vi.fn(async () => true),
}))

vi.mock('./authContext', () => ({
  useAuth: () => authMock,
}))

describe('AuthGate', () => {
  beforeEach(() => {
    authMock.state.status = 'signed-out'
    authMock.signIn.mockReset()
    authMock.signIn.mockResolvedValue(false)
  })

  it('shows a configuration message without CRM data when setup is incomplete', () => {
    authMock.state.status = 'configuration-error'
    render(
      <AuthGate>
        <p>CRM content</p>
      </AuthGate>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Supabase configuration is missing or invalid.',
    )
    expect(screen.queryByText('CRM content')).not.toBeInTheDocument()
  })

  it('shows one generic sign-in error and clears submitted fields', async () => {
    render(
      <AuthGate>
        <p>CRM content</p>
      </AuthGate>,
    )

    const email = screen.getByLabelText('Email')
    const password = screen.getByLabelText('Password')
    fireEvent.change(email, { target: { value: 'phase3-counsellor@example.test' } })
    fireEvent.change(password, { target: { value: String(Date.now()) } })
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign-in failed. Check your email and password.',
    )
    expect(email).toHaveValue('')
    expect(password).toHaveValue('')
    expect(screen.queryByText(/sign up|forgot password/i)).not.toBeInTheDocument()
    expect(screen.queryByText('CRM content')).not.toBeInTheDocument()
    await waitFor(() => expect(authMock.signIn).toHaveBeenCalledTimes(1))
  })
})
