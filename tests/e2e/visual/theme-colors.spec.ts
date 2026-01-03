import { test, expect, isAuthenticated } from '../fixtures'

/**
 * Theme Color Verification Tests
 *
 * These tests verify that dark and light mode themes apply
 * the correct color values from the Seven Design System.
 *
 * Tests use computed styles to verify actual CSS values.
 *
 * @tags @visual @theme @colors
 */

// Helper to convert OKLCH to approximate RGB for comparison
// Since browsers compute OKLCH differently, we check ranges
function isColorInRange(
  actual: string,
  expectedRgb: { r: number; g: number; b: number },
  tolerance = 15
): boolean {
  // Parse rgb(r, g, b) or rgba(r, g, b, a)
  const match = actual.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return false

  const [, r, g, b] = match.map(Number)
  return (
    Math.abs(r - expectedRgb.r) <= tolerance &&
    Math.abs(g - expectedRgb.g) <= tolerance &&
    Math.abs(b - expectedRgb.b) <= tolerance
  )
}

test.describe('Dark Mode Colors @visual @theme', () => {
  test.beforeEach(async ({ page }) => {
    // Enable dark mode via system preference
    await page.emulateMedia({ colorScheme: 'dark' })
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('background uses dark color scheme', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    const bgColor = await body.evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )

    // Dark mode background should be very dark (oklch 12.94% lightness)
    // Approximately rgb(18-30, 18-30, 25-35) range
    expect(isColorInRange(bgColor, { r: 24, g: 24, b: 31 }, 20)).toBe(true)
  })

  test('foreground text uses light color in dark mode', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const heading = page.locator('h1').first()
    const textColor = await heading.evaluate((el) =>
      getComputedStyle(el).color
    )

    // Dark mode foreground should be very light (oklch 98.51% lightness)
    // Approximately rgb(250, 250, 250) range
    expect(isColorInRange(textColor, { r: 250, g: 250, b: 250 }, 10)).toBe(true)
  })

  test('cards have dark background in dark mode', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Find a card element
    const card = page.locator('[class*="rounded-lg"][class*="border"]').first()
    if (await card.count() === 0) {
      test.skip(true, 'No card elements found on dashboard')
      return
    }

    const cardBgColor = await card.evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )

    // Card should NOT be white in dark mode
    expect(cardBgColor).not.toMatch(/rgb\(255,\s*255,\s*255\)/)
  })

  test('primary button uses green in dark mode', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const primaryButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    if (await primaryButton.count() === 0) {
      test.skip(true, 'No primary button found')
      return
    }

    const buttonBgColor = await primaryButton.evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )

    // Primary should be vibrant green (oklch 81.06% lightness, high chroma)
    // Approximately rgb(77, 222, 152) - bright green range
    expect(isColorInRange(buttonBgColor, { r: 77, g: 222, b: 152 }, 40)).toBe(true)
  })

  test('muted text has reduced contrast in dark mode', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Look for muted text (usually descriptions or secondary text)
    const mutedText = page.locator('.text-muted-foreground').first()
    if (await mutedText.count() === 0) {
      test.skip(true, 'No muted text found')
      return
    }

    const color = await mutedText.evaluate((el) =>
      getComputedStyle(el).color
    )

    // Muted foreground in dark mode is oklch 70.7% - medium gray
    // Should be lighter than foreground but not as bright
    expect(isColorInRange(color, { r: 160, g: 160, b: 160 }, 40)).toBe(true)
  })
})

test.describe('Light Mode Colors @visual @theme', () => {
  test.beforeEach(async ({ page }) => {
    // Enable light mode via system preference
    await page.emulateMedia({ colorScheme: 'light' })
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')
  })

  test('background uses light color scheme', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    const bgColor = await body.evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )

    // Light mode background should be white (oklch 100% lightness)
    expect(isColorInRange(bgColor, { r: 255, g: 255, b: 255 }, 5)).toBe(true)
  })

  test('foreground text uses dark color in light mode', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const heading = page.locator('h1').first()
    const textColor = await heading.evaluate((el) =>
      getComputedStyle(el).color
    )

    // Light mode foreground should be dark (oklch 20.79% lightness)
    // Approximately rgb(30-50, 30-50, 50-70) range
    expect(isColorInRange(textColor, { r: 38, g: 38, b: 56 }, 25)).toBe(true)
  })

  test('cards have white background in light mode', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const card = page.locator('[class*="rounded-lg"][class*="border"]').first()
    if (await card.count() === 0) {
      test.skip(true, 'No card elements found on dashboard')
      return
    }

    const cardBgColor = await card.evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )

    // Card should be white in light mode
    expect(isColorInRange(cardBgColor, { r: 255, g: 255, b: 255 }, 5)).toBe(true)
  })

  test('primary button uses green in light mode', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const primaryButton = page.locator('button').filter({ hasText: 'Invite Member' }).first()
    if (await primaryButton.count() === 0) {
      test.skip(true, 'No primary button found')
      return
    }

    const buttonBgColor = await primaryButton.evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )

    // Primary should be vibrant green (same as dark mode)
    expect(isColorInRange(buttonBgColor, { r: 77, g: 222, b: 152 }, 40)).toBe(true)
  })

  test('border color uses light gray in light mode', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const card = page.locator('[class*="rounded-lg"][class*="border"]').first()
    if (await card.count() === 0) {
      test.skip(true, 'No bordered elements found')
      return
    }

    const borderColor = await card.evaluate((el) =>
      getComputedStyle(el).borderColor
    )

    // Border in light mode is oklch 92.2% - very light gray
    expect(isColorInRange(borderColor, { r: 229, g: 229, b: 229 }, 20)).toBe(true)
  })
})

test.describe('Theme Toggle Persistence @visual @theme', () => {
  test('theme persists across page navigation', async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')

    // Set dark mode
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Get initial background
    const initialBg = await page.locator('body').evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )

    // Navigate to another page
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    // Background should still be dark
    const afterNavBg = await page.locator('body').evaluate((el) =>
      getComputedStyle(el).backgroundColor
    )

    // Both should be dark backgrounds
    expect(initialBg).toBe(afterNavBg)
  })
})

test.describe('Color Scheme Media Query @visual @theme', () => {
  test('respects system dark mode preference', async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')

    // Emulate dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Check if dark class is applied or color-scheme meta is set
    const colorScheme = await page.evaluate(() => {
      const html = document.documentElement
      return {
        hasDarkClass: html.classList.contains('dark'),
        colorScheme: getComputedStyle(html).colorScheme,
      }
    })

    // Either dark class should be present or color-scheme should be dark
    expect(
      colorScheme.hasDarkClass ||
      colorScheme.colorScheme.includes('dark')
    ).toBe(true)
  })

  test('respects system light mode preference', async ({ page }) => {
    const authenticated = await isAuthenticated(page)
    test.skip(!authenticated, 'No authenticated session available')

    // Emulate light mode preference
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const colorScheme = await page.evaluate(() => {
      const html = document.documentElement
      return {
        hasDarkClass: html.classList.contains('dark'),
        colorScheme: getComputedStyle(html).colorScheme,
      }
    })

    // Dark class should NOT be present in light mode
    expect(colorScheme.hasDarkClass).toBe(false)
  })
})
