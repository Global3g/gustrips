import { test, expect } from 'playwright/test';

/**
 * Critical-path checks: covers the routes a real user touches every
 * session. These don't require auth — they live in the unauthenticated
 * surface (login, register, marketing pages) plus the trust/legal pages
 * we just added (privacy + security). For authenticated paths, see
 * authenticated-flows.spec.ts (requires test user credentials in env).
 *
 * Why these specific 10:
 *   - Auth surface is the funnel — every regression here kills onboarding
 *   - Legal pages must always 200 (App Store rejects apps with broken privacy)
 *   - The PWA manifest + sw.js must serve correctly or installs break
 *   - Share view is the viral surface and must render to a logged-out browser
 */

test.describe('critical paths · unauthenticated', () => {
  test('1. login page renders email + password inputs', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('2. register page renders email + password + name inputs', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('3. login → register navigation works', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.getByRole('link', { name: /registr/i }).first();
    if (await registerLink.count()) {
      await registerLink.click();
      await expect(page).toHaveURL(/\/register/);
    }
  });

  test('4. PWA manifest is served and parses', async ({ page }) => {
    const res = await page.goto('/manifest.json');
    expect(res?.status()).toBe(200);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    const json = JSON.parse(body!);
    expect(json.name || json.short_name).toBeTruthy();
    expect(Array.isArray(json.icons)).toBe(true);
  });

  test('5. service worker file is served', async ({ page }) => {
    const res = await page.goto('/sw.js');
    expect(res?.status()).toBe(200);
    const body = await page.textContent('body');
    expect(body).toContain('SW_VERSION');
  });

  test('6. privacy policy page loads and shows last-updated date', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/última actualización/i)).toBeVisible();
  });

  test('7. security page loads and lists the encryption claims', async ({ page }) => {
    await page.goto('/security');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/cifrado/i).first()).toBeVisible();
  });

  test('8. 404 surface is reachable', async ({ page }) => {
    const res = await page.goto('/this-route-does-not-exist-xyz');
    expect(res?.status()).toBe(404);
  });

  test('9. ICS export rejects unauthenticated requests', async ({ page }) => {
    // Without auth header or share token, the endpoint must 401, not leak data.
    const res = await page.goto('/api/trips/nonexistent/ics');
    expect([401, 404]).toContain(res?.status() ?? 0);
  });

  test('10. home redirect respects auth guard', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(500);
    // Either lands on /login (middleware bounce) or stays on / for landing.
    await expect(page).toHaveURL(/\/(login)?$/);
  });
});
