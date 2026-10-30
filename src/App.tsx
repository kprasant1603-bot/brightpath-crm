import type { ReactNode } from 'react'
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import './App.css'

const navigation = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'grid',
    group: 'Workspace',
    path: '/',
  },
  {
    id: 'leads',
    label: 'Leads',
    icon: 'users',
    group: 'Workspace',
    path: '/leads',
  },
  {
    id: 'followups',
    label: 'Follow-ups',
    icon: 'calendar',
    group: 'Workspace',
    path: '/follow-ups',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: 'chart',
    group: 'Insights',
    path: '/reports',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    group: 'Insights',
    path: '/settings',
  },
] as const

type PageId = (typeof navigation)[number]['id']
type IconName =
  | 'grid'
  | 'users'
  | 'calendar'
  | 'chart'
  | 'settings'
  | 'arrow'
  | 'spark'
  | 'clock'

type PageDetails = {
  eyebrow: string
  title: string
  description: string
}

const pageDetails = {
  overview: {
    eyebrow: 'YOUR WORKSPACE',
    title: 'A better rhythm for every enquiry.',
    description:
      'A thoughtful home for the conversations that bring a student closer to their next step.',
  },
  leads: {
    eyebrow: 'RELATIONSHIPS',
    title: 'Every student story starts somewhere.',
    description:
      'Keep the details, context, and next conversation together as your team gets started.',
  },
  followups: {
    eyebrow: 'THE NEXT STEP',
    title: 'Good conversations deserve a follow-through.',
    description:
      'A clear place for the check-ins and next steps that keep every enquiry moving.',
  },
  reports: {
    eyebrow: 'A CLEARER PICTURE',
    title: 'Understand what is moving forward.',
    description:
      'Meaningful team insights will take shape here once your workspace is connected.',
  },
  settings: {
    eyebrow: 'YOUR WORKSPACE',
    title: 'Make BrightPath work for your team.',
    description:
      'Your profile and workspace preferences will live here as they become available.',
  },
} satisfies Record<PageId, PageDetails>

const iconPaths = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 18.4V20" />
      <circle cx="10" cy="7.5" r="3.5" />
      <path d="M16 4.2a3.5 3.5 0 0 1 0 6.7M20 20v-1.6a3.4 3.4 0 0 0-2.5-3.3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M7.5 3v4M16.5 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20.5h16M6.5 17v-5M12 17V5M17.5 17V9" />
      <circle cx="6.5" cy="10" r="1" />
      <circle cx="12" cy="3.5" r="1" />
      <circle cx="17.5" cy="7.5" r="1" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  spark: (
    <>
      <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" />
      <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
} satisfies Record<IconName, ReactNode>

type IconProps = {
  name: IconName
  className?: string
}

function Icon({ name, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.65"
      viewBox="0 0 24 24"
    >
      {iconPaths[name]}
    </svg>
  )
}

type BrandProps = {
  compact?: boolean
}

function Brand({ compact = false }: BrandProps) {
  return (
    <div className={`brand${compact ? ' brand--compact' : ''}`}>
      <span className="brand__mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand__wordmark">
        brightpath<span className="brand__period">.</span>
        <span className="brand__descriptor">ACADEMY CRM</span>
      </span>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar__top">
        <Brand />
        <span className="sidebar__edition">WORKSPACE</span>
      </div>

      <nav className="sidebar__nav" aria-label="Main menu">
        {(['Workspace', 'Insights'] as const).map((group) => (
          <div className="nav-group" key={group}>
            <p className="nav-group__label">{group}</p>
            {navigation
              .filter((item) => item.group === group)
              .map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' nav-link--active' : ''}`
                  }
                  end={item.id === 'overview'}
                  key={item.id}
                  to={item.path}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="nav-link__icon" name={item.icon} />
                      <span>{item.label}</span>
                      {isActive && (
                        <span
                          className="nav-link__indicator"
                          aria-hidden="true"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <div className="sidebar-note">
          <span className="sidebar-note__icon">
            <Icon name="spark" />
          </span>
          <p>Made for the moments that move students forward.</p>
        </div>
        <div className="sidebar__foot">
          <span>BRIGHTPATH ACADEMY</span>
          <span>WORKSPACE PREVIEW</span>
        </div>
      </div>
    </aside>
  )
}

function MobileNavigation() {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navigation.map((item) => (
        <NavLink
          className={({ isActive }) =>
            `mobile-nav__item${isActive ? ' mobile-nav__item--active' : ''}`
          }
          end={item.id === 'overview'}
          key={item.id}
          to={item.path}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function JourneyCard() {
  return (
    <section className="journey-card" aria-labelledby="journey-title">
      <div className="journey-card__copy">
        <span className="section-kicker">A MORE HUMAN KIND OF CRM</span>
        <h2 id="journey-title">
          Keep the person
          <br />
          <em>in every process.</em>
        </h2>
        <p>
          From the first hello to the next big step, give every conversation
          the care and clarity it deserves.
        </p>
        <span className="journey-card__note">
          Your workspace is being prepared
          <Icon name="arrow" />
        </span>
      </div>

      <div className="journey-art" aria-hidden="true">
        <div className="journey-art__orbit journey-art__orbit--outer" />
        <div className="journey-art__orbit journey-art__orbit--inner" />
        <div className="journey-art__sun" />
        <div className="journey-art__line journey-art__line--one" />
        <div className="journey-art__line journey-art__line--two" />
        <div className="journey-art__node journey-art__node--one">
          <span>01</span>
        </div>
        <div className="journey-art__node journey-art__node--two">
          <span>02</span>
        </div>
        <div className="journey-art__node journey-art__node--three">
          <span>03</span>
        </div>
        <span className="journey-art__caption journey-art__caption--top">
          A FIRST CONVERSATION
        </span>
        <span className="journey-art__caption journey-art__caption--bottom">
          A FUTURE TAKING SHAPE
        </span>
      </div>
      <span className="journey-card__index" aria-hidden="true">
        BP — 01
      </span>
    </section>
  )
}

type SetupStep = {
  number: string
  label: string
  icon: IconName
}

function SetupCard() {
  const steps: SetupStep[] = [
    { number: '01', label: 'Connect your workspace', icon: 'grid' },
    { number: '02', label: 'Set up your team', icon: 'users' },
    { number: '03', label: 'Welcome your first enquiry', icon: 'arrow' },
  ]

  return (
    <section className="setup-card" aria-labelledby="setup-title">
      <div className="setup-card__heading">
        <div>
          <span className="section-kicker">A FEW THOUGHTFUL STEPS</span>
          <h2 id="setup-title">Getting started</h2>
        </div>
        <span className="setup-card__counter">
          01 <i>/</i> 03
        </span>
      </div>
      <ol className="setup-list">
        {steps.map((step, index) => (
          <li className="setup-step" key={step.number}>
            <span className="setup-step__number">{step.number}</span>
            <span className="setup-step__label">{step.label}</span>
            <Icon
              className={`setup-step__icon${index === 0 ? ' setup-step__icon--current' : ''}`}
              name={step.icon}
            />
          </li>
        ))}
      </ol>
      <p className="setup-card__footnote">
        Setup actions will be available as each feature is connected.
      </p>
    </section>
  )
}

type FeaturePageId = Exclude<PageId, 'overview'>

const featureNames = {
  leads: 'Your lead list will live here.',
  followups: 'Your follow-up schedule will live here.',
  reports: 'Your team insights will live here.',
  settings: 'Your workspace preferences will live here.',
} satisfies Record<FeaturePageId, string>

function EmptyFeature({ page }: { page: FeaturePageId }) {
  const navigationItem = navigation.find((item) => item.id === page)

  if (!navigationItem) {
    throw new Error(`Missing navigation entry for page "${page}".`)
  }

  return (
    <section className="feature-empty" aria-labelledby="feature-empty-title">
      <span className="feature-empty__icon">
        <Icon name={navigationItem.icon} />
      </span>
      <span className="section-kicker">COMING INTO FOCUS</span>
      <h2 id="feature-empty-title">{featureNames[page]}</h2>
      <p>
        This part of BrightPath will take shape in a later development phase.
        Nothing is connected or stored yet.
      </p>
      <span className="feature-empty__status">
        <span />
        Planned for a later phase
      </span>
    </section>
  )
}

function OverviewPage() {
  return (
    <>
      <JourneyCard />
      <div className="overview-lower">
        <SetupCard />
        <section className="activity-card" aria-labelledby="activity-title">
          <div className="activity-card__heading">
            <div>
              <span className="section-kicker">A LIVING TIMELINE</span>
              <h2 id="activity-title">Recent activity</h2>
            </div>
            <Icon name="clock" />
          </div>
          <div className="activity-empty">
            <span className="activity-empty__rule" />
            <p>
              The meaningful moments will show up here once your workspace is
              connected.
            </p>
            <span>NO ACTIVITY TO SHOW YET</span>
          </div>
        </section>
      </div>
      <footer className="page-footer">
        <span>BRIGHTPATH CRM</span>
        <span>A clearer path, together.</span>
      </footer>
    </>
  )
}

const pageByPath: Record<string, PageId> = {
  '/': 'overview',
  '/leads': 'leads',
  '/follow-ups': 'followups',
  '/reports': 'reports',
  '/settings': 'settings',
}

function PageView({ pageId }: { pageId: PageId }) {
  const page = pageDetails[pageId]

  return (
    <>
      <section className="page-intro">
        <span className="section-kicker">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      {pageId === 'overview' ? (
        <OverviewPage />
      ) : (
        <>
          <EmptyFeature page={pageId} />
          <footer className="page-footer">
            <span>BRIGHTPATH CRM</span>
            <span>A clearer path, together.</span>
          </footer>
        </>
      )}
    </>
  )
}

function AppLayout() {
  const location = useLocation()
  const activePage = pageByPath[location.pathname] ?? 'overview'
  const activeNavigation = navigation.find((item) => item.id === activePage)

  if (!activeNavigation) {
    throw new Error(`Missing navigation entry for page "${activePage}".`)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <header className="topbar">
          <div className="topbar__mobile-brand">
            <Brand compact />
          </div>
          <div className="breadcrumb" aria-label="Breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb__slash">/</span>
            <span className="breadcrumb__current">
              {activeNavigation.label}
            </span>
          </div>
          <div className="topbar__status">
            <span className="status-dot" />
            <span>PREVIEW MODE</span>
          </div>
        </header>

        <div className="page-content" key={activePage}>
          <Outlet />
        </div>
      </main>
      <MobileNavigation />
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route element={<PageView pageId="overview" />} index />
        <Route element={<PageView pageId="leads" />} path="leads" />
        <Route element={<PageView pageId="followups" />} path="follow-ups" />
        <Route element={<PageView pageId="reports" />} path="reports" />
        <Route element={<PageView pageId="settings" />} path="settings" />
      </Route>
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  )
}

export default App
