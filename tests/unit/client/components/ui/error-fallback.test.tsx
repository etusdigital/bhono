// src/client/components/ui/__tests__/error-fallback.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorFallback, NotFound, Unauthorized } from '../error-fallback'

describe('ErrorFallback', () => {
  it('renders with default props', () => {
    render(<ErrorFallback />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument()
  })

  it('renders with custom title and message', () => {
    render(<ErrorFallback title="Custom Title" message="Custom message" />)

    expect(screen.getByText('Custom Title')).toBeInTheDocument()
    expect(screen.getByText('Custom message')).toBeInTheDocument()
  })

  it('shows error details in development mode', () => {
    const error = new Error('Detailed error message')

    render(<ErrorFallback error={error} showDetails={true} />)

    expect(screen.getByText('Error details:')).toBeInTheDocument()
    expect(screen.getByText(/Detailed error message/)).toBeInTheDocument()
  })

  it('hides error details when showDetails is false', () => {
    const error = new Error('Detailed error message')

    render(<ErrorFallback error={error} showDetails={false} />)

    expect(screen.queryByText('Detailed error message')).not.toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()

    render(<ErrorFallback onRetry={onRetry} />)

    fireEvent.click(screen.getByText('Try again'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('calls onGoBack when go back button is clicked', () => {
    const onGoBack = vi.fn()

    render(<ErrorFallback onGoBack={onGoBack} />)

    fireEvent.click(screen.getByText('Go back'))
    expect(onGoBack).toHaveBeenCalledTimes(1)
  })

  it('calls onGoHome when go home button is clicked', () => {
    const onGoHome = vi.fn()

    render(<ErrorFallback onGoHome={onGoHome} />)

    fireEvent.click(screen.getByText('Go home'))
    expect(onGoHome).toHaveBeenCalledTimes(1)
  })

  it('does not render buttons when callbacks are not provided', () => {
    render(<ErrorFallback />)

    expect(screen.queryByText('Try again')).not.toBeInTheDocument()
    expect(screen.queryByText('Go back')).not.toBeInTheDocument()
    expect(screen.queryByText('Go home')).not.toBeInTheDocument()
  })
})

describe('NotFound', () => {
  it('renders with default props', () => {
    render(<NotFound />)

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('Page not found')).toBeInTheDocument()
    expect(
      screen.getByText("The page you're looking for doesn't exist or has been moved.")
    ).toBeInTheDocument()
  })

  it('renders with custom title and message', () => {
    render(<NotFound title="Custom 404" message="Custom not found message" />)

    expect(screen.getByText('Custom 404')).toBeInTheDocument()
    expect(screen.getByText('Custom not found message')).toBeInTheDocument()
  })

  it('calls onGoBack when go back button is clicked', () => {
    const onGoBack = vi.fn()

    render(<NotFound onGoBack={onGoBack} />)

    fireEvent.click(screen.getByText('Go back'))
    expect(onGoBack).toHaveBeenCalledTimes(1)
  })

  it('calls onGoHome when go home button is clicked', () => {
    const onGoHome = vi.fn()

    render(<NotFound onGoHome={onGoHome} />)

    fireEvent.click(screen.getByText('Go home'))
    expect(onGoHome).toHaveBeenCalledTimes(1)
  })
})

describe('Unauthorized', () => {
  it('renders with default props', () => {
    render(<Unauthorized />)

    expect(screen.getByText('Access denied')).toBeInTheDocument()
    expect(
      screen.getByText("You don't have permission to access this page.")
    ).toBeInTheDocument()
  })

  it('renders with custom title and message', () => {
    render(<Unauthorized title="Custom 403" message="Custom unauthorized message" />)

    expect(screen.getByText('Custom 403')).toBeInTheDocument()
    expect(screen.getByText('Custom unauthorized message')).toBeInTheDocument()
  })

  it('calls onLogin when sign in button is clicked', () => {
    const onLogin = vi.fn()

    render(<Unauthorized onLogin={onLogin} />)

    fireEvent.click(screen.getByText('Sign in'))
    expect(onLogin).toHaveBeenCalledTimes(1)
  })

  it('calls onGoBack when go back button is clicked', () => {
    const onGoBack = vi.fn()

    render(<Unauthorized onGoBack={onGoBack} />)

    fireEvent.click(screen.getByText('Go back'))
    expect(onGoBack).toHaveBeenCalledTimes(1)
  })
})
