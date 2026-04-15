import { test, expect } from '@playwright/test';
import {
  mockGoogleSignIn,
  mockApiSuccess,
  mockApiForbidden,
  createMockJwt,
  triggerCredentialResponse,
  triggerPromptDismissed,
  triggerPromptNotDisplayed,
  loginViaGSI,
} from './fixtures/auth';

test.describe('Admin Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockGoogleSignIn(page);
    await mockApiSuccess(page);
  });

  test('sign-in button is hidden while One Tap prompt is active', async ({ page }) => {
    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);

    // After renderButton + prompt(), the button should be hidden
    // (the code hides it immediately after renderButton and before prompt callback fires)
    const button = page.locator('#g_id_signin');
    await expect(button).toHaveCSS('display', 'none');
  });

  test('sign-in button appears when One Tap is dismissed', async ({ page }) => {
    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);

    await triggerPromptDismissed(page);

    const button = page.locator('#g_id_signin');
    await expect(button).toHaveCSS('display', 'flex');
  });

  test('sign-in button appears when One Tap is not displayed', async ({ page }) => {
    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);

    await triggerPromptNotDisplayed(page);

    const button = page.locator('#g_id_signin');
    await expect(button).toHaveCSS('display', 'flex');
  });

  test('loading spinner shows during credential verification', async ({ page }) => {
    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);
    await triggerPromptNotDisplayed(page);

    // Delay API response to observe spinner
    await page.unroute('**');
    await page.route('**/accounts.google.com/gsi/**', (route) => {
      if (route.request().resourceType() === 'script') {
        // GSI already loaded, just continue
        return route.continue();
      }
      return route.continue();
    });

    // Use a delayed API to keep spinner visible
    let resolveApi: (() => void) | null = null;
    const apiPromise = new Promise<void>((r) => { resolveApi = r; });
    await page.route('**/mhr-admin-api/workouts', async (route) => {
      await apiPromise;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/mhr-admin-api/locations', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    await triggerCredentialResponse(page);

    // Spinner should be visible, sign-in button hidden
    await expect(page.locator('#auth-spinner')).toHaveCSS('display', 'flex');
    await expect(page.locator('#g_id_signin')).toHaveCSS('display', 'none');

    // Release the API
    resolveApi!();
  });

  test('spinner hides and admin UI shows after successful auth', async ({ page }) => {
    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);
    await triggerPromptNotDisplayed(page);

    await triggerCredentialResponse(page);

    // Wait for admin to be visible
    await page.waitForSelector('#admin-main.visible', { timeout: 5000 });

    await expect(page.locator('#auth-gate')).toHaveCSS('display', 'none');
    // Spinner is inside auth-gate, so it's hidden when auth-gate is hidden
    await expect(page.locator('#auth-spinner')).not.toBeVisible();
  });

  test('google.accounts.id.cancel() is called on successful login', async ({ page }) => {
    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);
    await triggerPromptNotDisplayed(page);

    await triggerCredentialResponse(page);
    await page.waitForSelector('#admin-main.visible', { timeout: 5000 });

    const cancelCalled = await page.evaluate(() => (window as any).__gsi_mock.cancelCalled);
    expect(cancelCalled).toBe(true);
  });

  test('403 from API shows auth error and signs out', async ({ page }) => {
    // Override API to return 403
    await page.unroute('**/mhr-admin-api/**');
    await mockApiForbidden(page);

    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);
    await triggerPromptNotDisplayed(page);

    await triggerCredentialResponse(page);

    // Wait for error to appear
    const errorEl = page.locator('#auth-error');
    await expect(errorEl).toHaveCSS('display', 'block');
    await expect(errorEl).toContainText('not authorized');

    // Should be signed out — auth gate visible
    await expect(page.locator('#auth-gate')).toBeVisible();
  });

  test('stored session shows spinner and auto-verifies', async ({ page }) => {
    const jwt = createMockJwt({ name: 'Stored User', email: 'stored@test.com' });

    // Pre-set localStorage before navigating
    await page.goto('/admin.html');
    await page.evaluate((token) => {
      localStorage.setItem('mhr_auth', JSON.stringify({
        token, name: 'Stored User', picture: '', email: 'stored@test.com',
      }));
    }, jwt);

    // Reload to trigger stored session path
    await page.reload();
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);

    // Should end up in the admin UI
    await page.waitForSelector('#admin-main.visible', { timeout: 5000 });
    await expect(page.locator('#user-name')).toHaveText('Stored User');
  });

  test('sign-out resets all UI state', async ({ page }) => {
    // Login first
    await loginViaGSI(page, { name: 'Sign Out Test' });

    // Verify we're logged in
    await expect(page.locator('#admin-main')).toHaveClass(/visible/);

    // Click sign out
    await page.click('#sign-out-btn');

    // Verify UI is reset
    await expect(page.locator('#auth-gate')).toBeVisible();
    await expect(page.locator('#admin-main')).not.toHaveClass(/visible/);
    await expect(page.locator('#auth-spinner')).toHaveCSS('display', 'none');
    await expect(page.locator('#sign-out-btn')).toHaveCSS('display', 'none');

    // localStorage should be cleared
    const authData = await page.evaluate(() => localStorage.getItem('mhr_auth'));
    expect(authData).toBeNull();
  });
});
