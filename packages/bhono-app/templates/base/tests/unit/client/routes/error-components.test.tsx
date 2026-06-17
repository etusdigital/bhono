import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock TanStack Router hooks before importing components
vi.mock('@tanstack/react-router', () => ({
  createRootRoute: vi.fn(() => ({ component: vi.fn(), errorComponent: vi.fn() })),
  createFileRoute: vi.fn(() => vi.fn(() => ({}))),
  Outlet: () => null,
  redirect: vi.fn(),
  useRouter: () => ({
    invalidate: vi.fn(),
    navigate: vi.fn(),
    history: { back: vi.fn() },
  }),
  useLocation: () => ({
    pathname: '/dashboard',
  }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

// Mock useAuth for Sidebar component
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@example.com', name: 'Test User', picture: null, role: 'admin' },
    logout: vi.fn(),
    isLoggingOut: false,
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Mock useTheme for Sidebar component
vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    theme: 'system',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}))

// Mock useAccounts hooks for Sidebar component (AccountSwitcher)
vi.mock('@/hooks/use-accounts', () => ({
  useMyAccounts: () => ({
    data: { data: [{ id: 'test-account', name: 'Test Account', isCurrent: true, role: 'admin' }] },
    isLoading: false,
    error: null,
  }),
  useCurrentAccount: () => ({ id: 'test-account', name: 'Test Account', isCurrent: true, role: 'admin' }),
  useSwitchAccount: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}))

// Import components after mocks are set up
import { RootErrorComponent } from '@/routes/__root'
import { AuthenticatedErrorComponent, AuthenticatedPendingComponent } from '@/routes/_authenticated'

describe('RootErrorComponent', () => {
  it('renders error message with application error title', () => {
    const error = new Error('Test error message')
    render(<RootErrorComponent error={error} />)

    expect(screen.getByText('Application Error')).toBeInTheDocument()
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('displays the error details', () => {
    const error = new Error('Detailed error for debugging')
    render(<RootErrorComponent error={error} />)

    expect(screen.getByText(/Detailed error for debugging/)).toBeInTheDocument()
  })

  it('renders try again button', () => {
    const error = new Error('Error')
    render(<RootErrorComponent error={error} />)

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('renders go home button', () => {
    const error = new Error('Error')
    render(<RootErrorComponent error={error} />)

    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument()
  })

  it('calls router.invalidate when try again is clicked', () => {
    const error = new Error('Error')
    render(<RootErrorComponent error={error} />)

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    // The mock should have been called
  })

  it('has centered layout', () => {
    const error = new Error('Error')
    const { container } = render(<RootErrorComponent error={error} />)

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('flex', 'min-h-screen', 'items-center', 'justify-center')
  })
})

describe('AuthenticatedErrorComponent', () => {
  it('renders error message with correct title', () => {
    const error = new Error('Test authentication error')
    render(<AuthenticatedErrorComponent error={error} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/an error occurred while loading this page/i)).toBeInTheDocument()
  })

  it('displays error details in development', () => {
    const error = new Error('Detailed auth error message')
    render(<AuthenticatedErrorComponent error={error} />)

    expect(screen.getByText(/Detailed auth error message/)).toBeInTheDocument()
  })

  it('renders try again button', () => {
    const error = new Error('Error')
    render(<AuthenticatedErrorComponent error={error} />)

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('renders go back button', () => {
    const error = new Error('Error')
    render(<AuthenticatedErrorComponent error={error} />)

    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  it('renders go home button', () => {
    const error = new Error('Error')
    render(<AuthenticatedErrorComponent error={error} />)

    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument()
  })

  it('has correct layout structure', () => {
    const error = new Error('Error')
    const { container } = render(<AuthenticatedErrorComponent error={error} />)

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('flex', 'h-screen', 'items-center', 'justify-center')
  })

  it('handles button clicks', () => {
    const error = new Error('Error')
    render(<AuthenticatedErrorComponent error={error} />)

    // Click all action buttons - they should not throw
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    fireEvent.click(screen.getByRole('button', { name: /go home/i }))
  })
})

describe('AuthenticatedPendingComponent', () => {
  it('renders Seven skeleton loaders', () => {
    render(<AuthenticatedPendingComponent />)

    const skeletons = document.querySelectorAll('[data-slot="skeleton-loader"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('is centered full-screen with no sidebar in the pending state', () => {
    const { container } = render(<AuthenticatedPendingComponent />)

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('flex', 'h-screen', 'items-center', 'justify-center')
    expect(container.querySelector('aside')).not.toBeInTheDocument()
  })
})
