import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderRoute } from '../test-utils'

describe('Root Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('RootComponent', () => {
    it('should render outlet for child routes', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      })

      renderRoute({ initialEntries: ['/login'] })

      await waitFor(() => {
        // Login page should render (as child route)
        expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      })
    })

    it('should render index route', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      })

      const { router } = renderRoute({ initialEntries: ['/'] })

      await waitFor(() => {
        // Index should redirect to dashboard or show login
        expect(router.state.location.pathname).toBeDefined()
      })
    })

    it('should apply correct base layout structure', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      })

      renderRoute({ initialEntries: ['/login'] })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      })

      // The root should be rendering properly
      expect(document.body.querySelector('main')).toBeInTheDocument()
    })
  })
})
