import { expect, test, type Page } from '@playwright/test';

const gotoApp = async (page: Page) => {
  await page.goto('/?e2e=1');
  await expect(page.getByText('Gemini Tutor')).toBeVisible();
};

test('browser control skill persists through refresh', async ({ page }) => {
  await gotoApp(page);
  await page.getByTestId('settings-button').click();
  await page.getByText('Browser Control Skill').waitFor();
  const toggle = page.getByTestId('browser-skill-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByTestId('settings-button').click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
});

test('browser task confirmation is gated by control state', async ({ page }) => {
  await gotoApp(page);
  await page.getByTestId('start-session').click();
  await page.getByTestId('screen-share-toggle').click();
  await page.getByTestId('settings-button').click();
  const skillToggle = page.getByTestId('browser-skill-toggle');
  await skillToggle.click();
  await page.keyboard.press('Escape');
  const browserToggle = page.getByTestId('browser-control-toggle');
  await expect(browserToggle).toBeEnabled();
  await browserToggle.click();
  await expect(browserToggle).toHaveAttribute('aria-pressed', 'true');

  const input = page.getByPlaceholder('Type a message...');
  await input.fill('go to wikipedia.org');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText('Use Browser Control?')).toBeVisible();
  await page.getByTestId('browser-task-cancel').click();
  await expect(page.getByText('Use Browser Control?')).toBeHidden();

  await page.getByTestId('browser-control-toggle').click();
  await input.fill('open example.com in the browser');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText('Use Browser Control?')).toBeHidden();
});

test('bridge offline state disables browser control action', async ({ page }) => {
  await gotoApp(page);
  await page.getByTestId('start-session').click();
  await page.getByTestId('settings-button').click();
  await expect(page.getByText(/Bridge (ready|offline)/)).toBeVisible();
  await page.keyboard.press('Escape');
  const browserControlButton = page.getByTestId('browser-control-toggle');
  await expect(browserControlButton).toBeVisible();
});
