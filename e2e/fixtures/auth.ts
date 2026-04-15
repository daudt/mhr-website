import { type Page } from '@playwright/test';

const API_ORIGIN = 'https://us-central1-mhr-processor.cloudfunctions.net';
const API_BASE = `${API_ORIGIN}/mhr-admin-api`;

// ── Mock JWT ──────────────────────────────────────────────────

export function createMockJwt(payload: {
  name?: string;
  email?: string;
  picture?: string;
} = {}): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const body = {
    name: payload.name ?? 'Test User',
    email: payload.email ?? 'test@example.com',
    picture: payload.picture ?? '',
    iss: 'https://accounts.google.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode(header)}.${encode(body)}.fake-signature`;
}

// ── Mock Google Sign-In (GSI) ─────────────────────────────────

/**
 * Intercepts the Google GSI script and injects a controllable mock.
 * Returns helpers to trigger auth callbacks from tests.
 */
export async function mockGoogleSignIn(page: Page) {
  // Block real GSI script
  await page.route('**/accounts.google.com/gsi/**', (route) => {
    if (route.request().resourceType() === 'script') {
      // Serve our mock instead
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
          window.__gsi_mock = {
            initialized: false,
            callback: null,
            promptCallback: null,
            cancelCalled: false,
            disableAutoSelectCalled: false,
            renderButtonCalled: false,
          };
          window.google = {
            accounts: {
              id: {
                initialize: function(config) {
                  window.__gsi_mock.initialized = true;
                  window.__gsi_mock.callback = config.callback;
                },
                renderButton: function(element, options) {
                  window.__gsi_mock.renderButtonCalled = true;
                },
                prompt: function(cb) {
                  window.__gsi_mock.promptCallback = cb;
                },
                cancel: function() {
                  window.__gsi_mock.cancelCalled = true;
                },
                disableAutoSelect: function() {
                  window.__gsi_mock.disableAutoSelectCalled = true;
                },
              },
            },
          };
        `,
      });
    }
    return route.continue();
  });
}

// ── Prompt notification helpers ───────────────────────────────

/** Simulate One Tap being dismissed by the user */
export async function triggerPromptDismissed(page: Page) {
  await page.evaluate(() => {
    (window as any).__gsi_mock.promptCallback({
      isNotDisplayed: () => false,
      isSkippedMoment: () => false,
      isDismissedMoment: () => true,
    });
  });
}

/** Simulate One Tap not displayed (e.g., browser blocked it) */
export async function triggerPromptNotDisplayed(page: Page) {
  await page.evaluate(() => {
    (window as any).__gsi_mock.promptCallback({
      isNotDisplayed: () => true,
      isSkippedMoment: () => false,
      isDismissedMoment: () => false,
    });
  });
}

/** Simulate One Tap being skipped */
export async function triggerPromptSkipped(page: Page) {
  await page.evaluate(() => {
    (window as any).__gsi_mock.promptCallback({
      isNotDisplayed: () => false,
      isSkippedMoment: () => true,
      isDismissedMoment: () => false,
    });
  });
}

// ── Trigger credential callback (login) ──────────────────────

export async function triggerCredentialResponse(page: Page, jwt?: string) {
  const token = jwt ?? createMockJwt();
  await page.evaluate((t) => {
    (window as any).__gsi_mock.callback({ credential: t });
  }, token);
}

// ── API mocking ──────────────────────────────────────────────

export async function mockApiSuccess(page: Page) {
  await page.route(`${API_BASE}/**`, (route) => {
    const url = route.request().url();
    if (url.includes('/locations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          'Washington Park': { address: '123 Main St', maps_url: '' },
          'Cheesman Park': { address: '456 Oak Ave', maps_url: '' },
        }),
      });
    }
    if (url.includes('/workouts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    return route.fulfill({ status: 200, body: '{}' });
  });
}

export async function mockApiForbidden(page: Page) {
  await page.route(`${API_BASE}/**`, (route) => {
    const url = route.request().url();
    if (url.includes('/workouts')) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'You are not authorized to access this page.' }),
      });
    }
    if (url.includes('/locations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
    return route.fulfill({ status: 200, body: '{}' });
  });
}

// ── Full login helper ────────────────────────────────────────

/**
 * Performs a complete mock login: sets up GSI mock + API mock,
 * navigates to admin.html, triggers One Tap dismiss so button shows,
 * triggers credential callback, and waits for admin UI to appear.
 */
export async function loginViaGSI(page: Page, opts?: { name?: string; email?: string }) {
  await mockGoogleSignIn(page);
  await mockApiSuccess(page);
  await page.goto('/admin.html');
  await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);

  // Trigger the prompt callback so UI settles
  await triggerPromptNotDisplayed(page);

  // Trigger login
  const jwt = createMockJwt({ name: opts?.name, email: opts?.email });
  await triggerCredentialResponse(page, jwt);

  // Wait for admin interface to be visible
  await page.waitForSelector('#admin-main.visible', { timeout: 5000 });
}
