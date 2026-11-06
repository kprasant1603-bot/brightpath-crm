import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from './authContext'

const signInFailureMessage = 'Sign-in failed. Check your email and password.'

function ConfigurationError() {
  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="section-kicker">BRIGHTPATH CRM</span>
        <h1 id="auth-title">Workspace configuration needed</h1>
        <p role="alert">
          Supabase configuration is missing or invalid. Configure
          VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the app.
          No CRM data is displayed.
        </p>
      </section>
    </main>
  )
}

function SignInForm() {
  const { signIn } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    form.reset()
    setHasFailed(false)
    setIsSubmitting(true)

    try {
      if (!(await signIn(email, password))) {
        setHasFailed(true)
      }
    } catch {
      setHasFailed(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="section-kicker">BRIGHTPATH CRM</span>
        <h1 id="auth-title">Welcome back</h1>
        <p>Sign in to continue to your workspace.</p>
        <form autoComplete="off" className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email</label>
          <input
            autoComplete="off"
            autoCapitalize="none"
            id="auth-email"
            name="email"
            required
            type="email"
          />
          <label htmlFor="auth-password">Password</label>
          <input
            autoComplete="off"
            id="auth-password"
            name="password"
            required
            type="password"
          />
          {hasFailed && <p role="alert">{signInFailureMessage}</p>}
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

function AuthStatus({ message }: { message: string }) {
  const { signOut } = useAuth()
  const [signOutFailed, setSignOutFailed] = useState(false)

  async function handleSignOut() {
    try {
      setSignOutFailed(!(await signOut()))
    } catch {
      setSignOutFailed(true)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="section-kicker">BRIGHTPATH CRM</span>
        <h1 id="auth-title">Workspace access unavailable</h1>
        <p role="alert">{message}</p>
        <button className="auth-secondary-button" onClick={handleSignOut} type="button">
          Sign out
        </button>
        {signOutFailed && <p role="alert">Sign-out failed. Try again.</p>}
      </section>
    </main>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useAuth()

  switch (state.status) {
    case 'configuration-error':
      return <ConfigurationError />
    case 'loading':
      return (
        <main className="auth-screen" aria-live="polite">
          <p>Checking your workspace…</p>
        </main>
      )
    case 'signed-out':
      return <SignInForm />
    case 'profile-unavailable':
      return (
        <AuthStatus message="Your profile is unavailable. Contact an administrator." />
      )
    case 'profile-error':
      return (
        <AuthStatus message="Your profile could not be loaded. Try again or contact an administrator." />
      )
    case 'inactive':
      return (
        <AuthStatus message="This account is inactive. Contact an administrator." />
      )
    case 'invalid-role':
      return (
        <AuthStatus message="This account has an unsupported role. Contact an administrator." />
      )
    case 'ready':
      return children
  }
}
