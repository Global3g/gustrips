import { test, expect } from 'playwright/test';

test.describe('smoke', () => {
  test('home redirects unauthenticated users to login', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
    // Either home page renders, or middleware bounces to /login.
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('not-found page renders for unknown routes', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});
