import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Capture the theme prop Seven's Toaster receives.
vi.mock('@etus/seven-react', () => ({
  Toaster: ({ theme }: { theme?: string }) => <div data-testid="toaster" data-theme={theme} />,
}))
vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ resolvedTheme: 'dark', theme: 'dark', setTheme: vi.fn() }),
}))

import { AppToaster } from '@/components/app-toaster'

describe('AppToaster', () => {
  it("forwards the app's resolved theme to Seven's Toaster", () => {
    const { getByTestId } = render(<AppToaster />)

    // Guards the theme wiring: if AppToaster stops forwarding resolvedTheme,
    // the toaster renders with the wrong (or no) theme.
    expect(getByTestId('toaster')).toHaveAttribute('data-theme', 'dark')
  })
})
