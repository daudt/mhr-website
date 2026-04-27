import { test, expect } from '@playwright/test';
import {
  mockGoogleSignIn,
  mockApiSuccess,
  createMockJwt,
  triggerCredentialResponse,
  triggerPromptNotDisplayed,
  loginViaGSI,
} from './fixtures/auth';

const DRAFT_KEY = 'mhr_draft';

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/**
 * Helper: build a draft object that restoreDraft() can parse.
 */
function buildDraft(overrides: Record<string, any> = {}) {
  return {
    chatHistory: [],
    workouts: [
      {
        date: futureDate(2),
        time: '6:00 AM',
        location_name: '',
        description: 'Tempo run 5 miles',
      },
    ],
    emailSubject: '',
    emailBody: '',
    emailVisible: false,
    savedAt: Date.now(),
    ...overrides,
  };
}

test.describe('Admin Draft Persistence', () => {
  test('draft auto-saves on workout description input', async ({ page }) => {
    await loginViaGSI(page);

    // Type into the first workout description
    const desc = page.locator('textarea[id^="desc-"]').first();
    await desc.fill('Hill repeats at Cheesman Park');

    // Wait for debounce (500ms) + margin
    await page.waitForTimeout(700);

    const draft = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, DRAFT_KEY);

    expect(draft).not.toBeNull();
    expect(draft.workouts).toBeDefined();
  });

  test('draft auto-saves immediately on select change', async ({ page }) => {
    await loginViaGSI(page);

    // Change the time select on the first workout card
    const timeSelect = page.locator('select[id^="time-"]').first();
    await timeSelect.selectOption('7:00 AM');

    // Small delay for the synchronous change handler
    await page.waitForTimeout(100);

    const draft = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, DRAFT_KEY);

    expect(draft).not.toBeNull();
  });

  test('draft restores workout cards on page reload', async ({ page }) => {
    await mockGoogleSignIn(page);
    await mockApiSuccess(page);

    // First visit: log in and set a draft in localStorage
    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);

    const jwt = createMockJwt();
    const draft = buildDraft({
      workouts: [
        { date: futureDate(2), time: '5:30 AM', location_name: '', description: 'Long run 10 miles' },
        { date: futureDate(4), time: '6:00 AM', location_name: '', description: 'Intervals 8x400m' },
      ],
    });

    // Set draft and auth in localStorage
    await page.evaluate(({ draftKey, draftData, token }) => {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      localStorage.setItem('mhr_auth', JSON.stringify({
        token, name: 'Test User', picture: '', email: 'test@example.com',
      }));
    }, { draftKey: DRAFT_KEY, draftData: draft, token: jwt });

    // Reload to trigger stored session + draft restore
    await page.reload();
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);
    await page.waitForSelector('#admin-main.visible', { timeout: 5000 });

    // Verify workout cards are restored
    const cards = page.locator('.workout-card');
    await expect(cards).toHaveCount(2);

    // Verify content of first card
    const firstDesc = page.locator('textarea[id^="desc-"]').first();
    await expect(firstDesc).toHaveValue('Long run 10 miles');

    // Verify toast
    const toast = page.locator('.toast.success');
    await expect(toast).toContainText('Draft restored');
  });

  test('chat history persists and restores', async ({ page }) => {
    await mockGoogleSignIn(page);
    await mockApiSuccess(page);
    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);

    const jwt = createMockJwt();
    const draft = buildDraft({
      chatHistory: [
        { role: 'user', content: 'Create a tempo run workout' },
        { role: 'assistant', content: 'Here is a tempo run plan...' },
      ],
    });

    await page.evaluate(({ draftKey, draftData, token }) => {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      localStorage.setItem('mhr_auth', JSON.stringify({
        token, name: 'Test User', picture: '', email: 'test@example.com',
      }));
    }, { draftKey: DRAFT_KEY, draftData: draft, token: jwt });

    await page.reload();
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);
    await page.waitForSelector('#admin-main.visible', { timeout: 5000 });

    // Verify chat bubbles are rendered
    const chatMessages = page.locator('#chat-messages .chat-bubble');
    await expect(chatMessages).toHaveCount(2);
  });

  test('email preview state persists', async ({ page }) => {
    await mockGoogleSignIn(page);
    await mockApiSuccess(page);
    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);

    const jwt = createMockJwt();
    const draft = buildDraft({
      emailVisible: true,
      emailSubject: 'Weekly Workouts',
      emailBody: '<p>Here are your workouts</p>',
    });

    await page.evaluate(({ draftKey, draftData, token }) => {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      localStorage.setItem('mhr_auth', JSON.stringify({
        token, name: 'Test User', picture: '', email: 'test@example.com',
      }));
    }, { draftKey: DRAFT_KEY, draftData: draft, token: jwt });

    await page.reload();
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);
    await page.waitForSelector('#admin-main.visible', { timeout: 5000 });

    // Email preview should be visible with restored content
    await expect(page.locator('#email-preview')).toHaveClass(/visible/);
    await expect(page.locator('#email-subject')).toHaveValue('Weekly Workouts');
  });

  test('7-day-old draft is discarded', async ({ page }) => {
    await mockGoogleSignIn(page);
    await mockApiSuccess(page);
    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);

    const jwt = createMockJwt();
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const draft = buildDraft({
      savedAt: eightDaysAgo,
      workouts: [
        { date: '2026-04-10', time: '6:00 AM', location_name: '', description: 'Old workout' },
      ],
    });

    await page.evaluate(({ draftKey, draftData, token }) => {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      localStorage.setItem('mhr_auth', JSON.stringify({
        token, name: 'Test User', picture: '', email: 'test@example.com',
      }));
    }, { draftKey: DRAFT_KEY, draftData: draft, token: jwt });

    await page.reload();
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);
    await page.waitForSelector('#admin-main.visible', { timeout: 5000 });

    // Should show default 2 blank cards, not the expired draft
    const cards = page.locator('.workout-card');
    await expect(cards).toHaveCount(2);

    // Draft should be removed from localStorage
    const remaining = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
    expect(remaining).toBeNull();
  });

  test('draft is cleared on sign-out', async ({ page }) => {
    await loginViaGSI(page);

    // Type something to trigger a draft save
    const desc = page.locator('textarea[id^="desc-"]').first();
    await desc.fill('Test workout for sign-out');
    await page.waitForTimeout(700); // debounce

    // Verify draft exists
    let draft = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
    expect(draft).not.toBeNull();

    // Sign out
    await page.click('#sign-out-btn');

    // Draft should be cleared
    draft = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
    expect(draft).toBeNull();
  });

  test('draft is cleared after successful email send', async ({ page }) => {
    await mockGoogleSignIn(page);
    // Mock API with successful email send
    await page.route('**/mhr-admin-api/**', (route) => {
      const url = route.request().url();
      if (url.includes('/send-email')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'sent', recipient: 'team@test.com' }),
        });
      }
      if (url.includes('/workouts') && route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok' }),
        });
      }
      if (url.includes('/workouts')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
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

    await page.goto('/admin.html');
    await page.waitForFunction(() => (window as any).__gsi_mock?.initialized === true);
    await triggerPromptNotDisplayed(page);
    await triggerCredentialResponse(page);
    await page.waitForSelector('#admin-main.visible', { timeout: 5000 });

    // Fill in a workout and trigger draft save
    const desc = page.locator('textarea[id^="desc-"]').first();
    await desc.fill('Workout before email send');
    const dateInput = page.locator('input[id^="date-"]').first();
    await dateInput.fill(futureDate(3));
    await page.waitForTimeout(700);

    // Compose email — make the email preview visible and fill content
    await page.evaluate(() => {
      document.getElementById('email-preview')!.classList.add('visible');
    });
    await page.locator('#email-subject').fill('Test Subject');
    await page.locator('#email-body').fill('Test email body content');

    // Verify draft exists before send
    let draft = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
    expect(draft).not.toBeNull();

    // Click send
    await page.click('[onclick="sendEmail()"]');

    // Wait for the send to complete
    await page.waitForSelector('.send-status.success', { timeout: 5000 });

    // Draft should be cleared
    draft = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
    expect(draft).toBeNull();
  });
});
