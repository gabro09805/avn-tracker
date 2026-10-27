import { test, expect } from '@playwright/test'
import { cleanupE2EGames } from './helpers'

const CARD = '[data-testid="discover-card"]'
// Discover makes real VNDB API calls — allow generous timeouts.
const API_TIMEOUT = 20_000

test.describe('Discover page', () => {
  test.afterEach(async ({ request }) => {
    await cleanupE2EGames(request)
  })

  // ── Page structure ────────────────────────────────────────────────────────

  test('loads and shows heading', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible()
  })

  test('shows search input', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByPlaceholder(/Search visual novels/)).toBeVisible()
  })

  test('nav bar visible on discover page', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Discover' })).toBeVisible()
  })

  // ── Results ───────────────────────────────────────────────────────────────

  test('shows cards on load (popular VNs)', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.locator(CARD).first()).toBeVisible({ timeout: API_TIMEOUT })
  })

  test('search updates results', async ({ page }) => {
    await page.goto('/discover')
    await page.locator(CARD).first().waitFor({ timeout: API_TIMEOUT })

    await page.getByPlaceholder(/Search visual novels/).fill('fate')
    // Wait for debounce + API response.
    await page.locator(CARD).first().waitFor({ state: 'attached', timeout: API_TIMEOUT })
    await expect(page.locator(CARD).first()).toBeVisible()
  })

  // ── Filters ───────────────────────────────────────────────────────────────

  test('filter panel opens on button click', async ({ page }) => {
    await page.goto('/discover')
    await page.getByRole('button', { name: /Filters/ }).click()
    await expect(page.getByText(/Adult only/)).toBeVisible()
  })

  test('adult filter toggle visible in panel', async ({ page }) => {
    await page.goto('/discover')
    await page.getByRole('button', { name: /Filters/ }).click()
    // Panel contains the toggle label.
    await expect(page.getByText('Adult only (18+)')).toBeVisible()
  })

  // ── Pagination ────────────────────────────────────────────────────────────

  test('pagination bar appears when results exceed one page', async ({ page }) => {
    await page.goto('/discover')
    await page.locator(CARD).first().waitFor({ timeout: API_TIMEOUT })
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible({ timeout: API_TIMEOUT })
  })

  test('next button advances to page 2', async ({ page }) => {
    await page.goto('/discover')
    await page.locator(CARD).first().waitFor({ timeout: API_TIMEOUT })

    // Wait for pagination to appear, then click page 2 directly
    await page.getByRole('button', { name: '1', exact: true }).waitFor({ timeout: API_TIMEOUT })
    await page.getByRole('button', { name: '2', exact: true }).click()

    // Page 2 button becomes active (gets amber bg, loses stone border)
    await expect(page.getByRole('button', { name: '2', exact: true })).toHaveClass(/bg-amber-600/, { timeout: 5_000 })
  })

  // ── Card interaction ──────────────────────────────────────────────────────

  test('clicking a card navigates to VNDB detail page', async ({ page }) => {
    await page.goto('/discover')
    await page.locator(CARD).first().waitFor({ timeout: API_TIMEOUT })

    await page.locator(CARD).first().click()

    await expect(page).toHaveURL(/\/discover\/game\/v/, { timeout: 5_000 })
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()
  })

  test('VNDB detail page shows title and Add to Library button', async ({ page }) => {
    await page.goto('/discover')
    await page.locator(CARD).first().waitFor({ timeout: API_TIMEOUT })
    await page.locator(CARD).first().click()

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: API_TIMEOUT })
    await expect(page.getByRole('button', { name: 'Add to Library' })).toBeVisible()
  })

  // ── Tab switching ─────────────────────────────────────────────────────────

  test('VNDB and F95Zone tabs are visible', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('button', { name: 'VNDB' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'F95Zone' })).toBeVisible()
  })

  test('VNDB tab is active by default', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByPlaceholder(/Search visual novels/)).toBeVisible()
  })

  test('switching to F95Zone tab shows F95 search input', async ({ page }) => {
    await page.goto('/discover')
    await page.getByRole('button', { name: 'F95Zone' }).click()
    await expect(page.getByPlaceholder(/Search games on F95Zone/)).toBeVisible()
  })

  test('F95Zone tab shows empty state before search', async ({ page }) => {
    await page.goto('/discover')
    await page.getByRole('button', { name: 'F95Zone' }).click()
    await expect(page.getByText('Type to search F95Zone games')).toBeVisible()
  })

  test('F95 search cards load their cover from game details', async ({ page }) => {
    const coverUrl = 'https://img.test/f95-cover.gif'
    await page.route('https://img.test/**', route => route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64'),
    }))
    await page.route('**/graphql', async route => {
      const { operationName } = route.request().postDataJSON()
      if (operationName === 'SearchF95') {
        await route.fulfill({
          json: {
            data: {
              searchF95: {
                results: [{
                  threadId: '12345',
                  threadUrl: 'https://f95zone.to/threads/test-game.12345/',
                  title: 'Test Game',
                  version: '1.0',
                  engine: 'RenPy',
                  tags: [],
                }],
                totalPages: 1,
              },
            },
          },
        })
      } else if (operationName === 'GetF95Game') {
        await route.fulfill({
          json: {
            data: {
              getF95Game: {
                threadId: '12345',
                threadUrl: 'https://f95zone.to/threads/test-game.12345/',
                title: 'Test Game',
                developer: '',
                version: '1.0',
                coverUrl,
                description: '',
                tags: [],
                engine: 'RenPy',
                f95Status: 'Ongoing',
                screenshots: [],
              },
            },
          },
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/discover?tab=f95')
    await page.getByPlaceholder(/Search games on F95Zone/).fill('test game')

    const card = page.getByTestId('f95-card')
    const cover = card.getByTestId('f95-cover')
    await expect(cover).toBeVisible({ timeout: 10_000 })
    await expect(cover).toHaveAttribute('src', coverUrl)
    await expect(cover).toHaveAttribute('referrerpolicy', 'no-referrer')
  })

  test('switching back to VNDB tab shows VNDB search', async ({ page }) => {
    await page.goto('/discover')
    await page.getByRole('button', { name: 'F95Zone' }).click()
    await page.getByRole('button', { name: 'VNDB' }).click()
    await expect(page.getByPlaceholder(/Search visual novels/)).toBeVisible()
  })

  test('tab selection is preserved in URL params', async ({ page }) => {
    await page.goto('/discover')
    await page.getByRole('button', { name: 'F95Zone' }).click()
    await expect(page).toHaveURL(/tab=f95/)
  })

  // ── VNDB cards — no hover add button ─────────────────────────────────────

  test('VNDB cards have no hover add-to-library button', async ({ page }) => {
    await page.goto('/discover')
    const card = page.locator(CARD).first()
    await card.waitFor({ timeout: API_TIMEOUT })

    await card.hover()
    await page.waitForTimeout(300)

    await expect(card.getByTitle('Add to library')).not.toBeVisible()
  })
})
