import { test, expect } from '@playwright/test';

const FEED_URL = 'https://milehighrunners.com/calendar.ics';

test.describe('Calendar subscribe bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar.html');
  });

  test('offers a webcal:// link for one-click Apple subscription', async ({ page }) => {
    const apple = page.locator('.calendar-subscribe-bar a.apple-btn');
    await expect(apple).toBeVisible();
    await expect(apple).toHaveAttribute('href', 'webcal://milehighrunners.com/calendar.ics');
  });

  test('hands Google a URL-encoded https feed address, not webcal', async ({ page }) => {
    const google = page.locator('.calendar-subscribe-bar a.google-btn');
    const href = await google.getAttribute('href');

    expect(href).toBe(
      'https://calendar.google.com/calendar/r?cid=https%3A%2F%2Fmilehighrunners.com%2Fcalendar.ics'
    );
    // Google's add-by-URL flow needs an encoded https URL; webcal:// silently fails.
    expect(href).not.toContain('webcal');
    expect(new URL(href!).searchParams.get('cid')).toBe(FEED_URL);
  });

  test('offers a direct download of the feed', async ({ page }) => {
    const download = page.locator('.calendar-subscribe-bar a.ics-btn');
    await expect(download).toHaveAttribute('href', 'calendar.ics');
    await expect(download).toHaveAttribute('download', 'mhr-training.ics');
  });

  test('copies the feed URL to the clipboard and confirms', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const button = page.locator('#copy-feed-btn');
    await expect(button).toContainText('Copy feed URL');
    await button.click();

    await expect(button).toContainText('Copied!');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(FEED_URL);

    // Label returns to its original state
    await expect(button).toContainText('Copy feed URL', { timeout: 5000 });
  });

  test('shows the feed URL as selectable text and explains Google refresh lag', async ({ page }) => {
    const help = page.locator('.subscribe-help');
    await expect(help.locator('code.feed-url')).toHaveText(FEED_URL);

    await help.locator('summary').click();
    await expect(help).toContainText('Google');
    await expect(help).toContainText('own schedule');
    await expect(help).toContainText('Outlook');
  });

  test('serves the feed itself as a valid calendar', async ({ page }) => {
    const response = await page.request.get('/calendar.ics');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('X-WR-CALNAME:Mile High Runners Training');
    expect(body).toContain('TZID:America/Denver');
    expect(body).toContain('END:VCALENDAR');
  });
});

test.describe('Races subscribe bar', () => {
  test('hands Google a URL-encoded https feed address', async ({ page }) => {
    await page.goto('/races.html');

    const href = await page.locator('.calendar-subscribe-bar a.google-btn').getAttribute('href');
    expect(href).not.toContain('webcal');
    expect(new URL(href!).searchParams.get('cid')).toBe(
      'https://milehighrunners.com/data/races.ics'
    );
  });
});
