import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  )
}

describe('application routes', () => {
  it('renders the overview and navigates to each workspace view', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'A better rhythm for every enquiry.',
      }),
    ).toBeInTheDocument()

    const mainNavigation = within(
      screen.getByRole('navigation', { name: 'Main menu' }),
    )

    const views = [
      {
        label: 'Leads',
        path: '/leads',
        heading: 'Every student story starts somewhere.',
      },
      {
        label: 'Follow-ups',
        path: '/follow-ups',
        heading: 'Good conversations deserve a follow-through.',
      },
      {
        label: 'Reports',
        path: '/reports',
        heading: 'Understand what is moving forward.',
      },
      {
        label: 'Settings',
        path: '/settings',
        heading: 'Make BrightPath work for your team.',
      },
      {
        label: 'Overview',
        path: '/',
        heading: 'A better rhythm for every enquiry.',
      },
    ]

    for (const view of views) {
      const link = mainNavigation.getByRole('link', { name: view.label })

      expect(link).toHaveAttribute('href', view.path)
      await user.click(link)
      expect(
        screen.getByRole('heading', { level: 1, name: view.heading }),
      ).toBeInTheDocument()
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('renders the selected view when its URL is opened directly', () => {
    renderApp('/follow-ups')

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Good conversations deserve a follow-through.',
      }),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('navigation', { name: 'Main menu' }),
      ).getByRole('link', { name: 'Follow-ups' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('redirects unknown routes to the overview', () => {
    renderApp('/not-a-page')

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'A better rhythm for every enquiry.',
      }),
    ).toBeInTheDocument()
  })
})
