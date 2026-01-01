// src/client/components/ui/error-fallback.tsx
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react'
import { Button } from './button'

interface ErrorFallbackProps {
  error?: Error
  title?: string
  message?: string
  showDetails?: boolean
  onRetry?: () => void
  onGoBack?: () => void
  onGoHome?: () => void
}

/**
 * Generic error fallback UI component.
 * Used for displaying errors in a user-friendly way.
 */
export function ErrorFallback({
  error,
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  showDetails = import.meta.env.DEV,
  onRetry,
  onGoBack,
  onGoHome,
}: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="mx-auto max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="mt-6 text-2xl font-bold text-gray-900">{title}</h1>

        {/* Message */}
        <p className="mt-3 text-gray-600">{message}</p>

        {/* Error details (dev only) */}
        {showDetails && error && (
          <div className="mt-4 rounded-lg bg-gray-100 p-4 text-left">
            <p className="text-xs font-medium text-gray-500">Error details:</p>
            <pre className="mt-1 overflow-auto text-xs text-gray-700">
              {error.message}
              {error.stack && (
                <>
                  {'\n\n'}
                  {error.stack}
                </>
              )}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {onRetry && (
            <Button onClick={onRetry} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          )}
          {onGoBack && (
            <Button onClick={onGoBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go back
            </Button>
          )}
          {onGoHome && (
            <Button onClick={onGoHome} variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Go home
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

interface NotFoundProps {
  title?: string
  message?: string
  onGoBack?: () => void
  onGoHome?: () => void
}

/**
 * 404 Not Found error component.
 */
export function NotFound({
  title = 'Page not found',
  message = "The page you're looking for doesn't exist or has been moved.",
  onGoBack,
  onGoHome,
}: NotFoundProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="mx-auto max-w-md text-center">
        {/* 404 Text */}
        <p className="text-7xl font-bold text-gray-200">404</p>

        {/* Title */}
        <h1 className="mt-4 text-2xl font-bold text-gray-900">{title}</h1>

        {/* Message */}
        <p className="mt-3 text-gray-600">{message}</p>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {onGoBack && (
            <Button onClick={onGoBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go back
            </Button>
          )}
          {onGoHome && (
            <Button onClick={onGoHome} variant="default">
              <Home className="mr-2 h-4 w-4" />
              Go home
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

interface UnauthorizedProps {
  title?: string
  message?: string
  onLogin?: () => void
  onGoBack?: () => void
}

/**
 * 401/403 Unauthorized/Forbidden error component.
 */
export function Unauthorized({
  title = 'Access denied',
  message = "You don't have permission to access this page.",
  onLogin,
  onGoBack,
}: UnauthorizedProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="mx-auto max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          <AlertTriangle className="h-8 w-8 text-yellow-600" />
        </div>

        {/* Title */}
        <h1 className="mt-6 text-2xl font-bold text-gray-900">{title}</h1>

        {/* Message */}
        <p className="mt-3 text-gray-600">{message}</p>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {onLogin && (
            <Button onClick={onLogin} variant="default">
              Sign in
            </Button>
          )}
          {onGoBack && (
            <Button onClick={onGoBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go back
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
