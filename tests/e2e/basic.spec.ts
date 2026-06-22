import { test, expect } from '@playwright/test';

test.describe('Gemini Tutor Basic E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Open the app in simulated E2E mode
    await page.goto('/?e2e=true');
    // Clear localStorage to ensure complete test isolation
    await page.evaluate(() => localStorage.clear());
    // Reload to apply clean state
    await page.reload();
  });

  test('should load the home page with correct elements', async ({ page }) => {
    // Check that the main title exists
    await expect(page.locator('text=Gemini Tutor')).toBeVisible();

    // Check that the start session button exists in the main area
    const startBtn = page.getByTestId('start-session');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toHaveText('Start Session');

    // Check that the chat input is present
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await expect(chatInput).toBeVisible();
  });

  test('should support selecting Claude Code Tutor', async ({ page }) => {
    // Select Claude Code Tutor in the dropdown
    await page.selectOption('select', 'claude-code-tutor');

    // Verify the placeholder or UI reflects the tutor selection
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await expect(chatInput).toBeVisible();
  });

  test('should toggle sidebar collapse state', async ({ page }) => {
    // Sidebar should start expanded (showing Gemini Tutor text)
    await expect(page.locator('text=Gemini Tutor')).toBeVisible();

    // Click collapse button
    await page.click('button[title="Collapse sidebar"]');

    // Gemini Tutor text should not be visible now
    await expect(page.locator('text=Gemini Tutor')).not.toBeVisible();

    // Click expand button
    await page.click('button[title="Expand sidebar"]');

    // Gemini Tutor text should be visible again
    await expect(page.locator('text=Gemini Tutor')).toBeVisible();
  });

  test('should open and close Settings panel', async ({ page }) => {
    // Settings panel should not be visible initially
    await expect(page.locator('text=Choose Tutor')).not.toBeVisible();

    // Click settings button in sidebar
    await page.click('[data-testid="settings-button"]');

    // Settings panel should open
    await expect(page.locator('text=Choose Tutor')).toBeVisible();

    // Close using settings panel toggle/close button (or escape key)
    await page.keyboard.press('Escape');

    // Settings panel should close
    await expect(page.locator('text=Choose Tutor')).not.toBeVisible();
  });

  test('should start and end a session successfully', async ({ page }) => {
    // Initially the session is IDLE and the start button shows "Start Session"
    const startBtn = page.getByTestId('start-session');
    await expect(startBtn).toHaveText('Start Session');

    // Click Start Session
    await startBtn.click();

    // In E2E mode, the session should immediately become ACTIVE, and the button changes to "End Session"
    const endBtn = page.getByTestId('end-session');
    await expect(endBtn).toBeVisible();
    await expect(endBtn).toHaveText('End Session');

    // Click End Session
    await endBtn.click();

    // Should return to IDLE state
    await expect(page.getByTestId('start-session')).toBeVisible();
  });

  test('should send a chat message, receive a reply, and copy/download markdown', async ({ page }) => {
    // Select the Claude Code Tutor
    await page.selectOption('select', 'claude-code-tutor');

    // Start session
    await page.getByTestId('start-session').click();

    // Locate the chat input and type a message
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await chatInput.fill('How do I run Claude Code in CI?');

    // Click Send
    await page.getByTestId('chat-send').click();

    // The transcription list should now show the message we just sent
    await expect(page.locator('text=How do I run Claude Code in CI?')).toBeVisible();

    // Wait for the simulated tutor response to appear
    await expect(page.locator('text=CI/CD pipeline')).toBeVisible();

    // Verify Copy Markdown button and click it
    const copyBtn = page.locator('text=Copy Markdown');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Verify the copy button visual feedback "Copied!" displays
    await expect(page.locator('text=Copied!')).toBeVisible();

    // Verify Download MD button is visible
    await expect(page.locator('text=Download MD')).toBeVisible();
  });

  test('should generate and display Interview Performance Report for AI Interviewer mode', async ({ page }) => {
    // Select AI Interviewer tutor
    await page.selectOption('select', 'ai-interviewer');

    // Start session
    await page.getByTestId('start-session').click();

    // Send a message to prompt the mock feedback report
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await chatInput.fill('Wrap up the interview please');
    await page.getByTestId('chat-send').click();

    // Wait for the mock report transcript to be written by the mock AI
    await expect(page.locator('text=Here is the mock interview wrap-up report')).toBeVisible();

    // End session to trigger evaluation dashboard view
    await page.getByTestId('end-session').click();

    // The Interview Performance Evaluation card should render in the UI
    await expect(page.locator('text=Interview Performance Evaluation')).toBeVisible();
    await expect(page.locator('.glass-card').locator('text=Overall Score')).toBeVisible();
    await expect(page.locator('.glass-card').locator('text=85/100')).toBeVisible();
    await expect(page.locator('.glass-card').locator('text=Hiring Signal')).toBeVisible();
    await expect(page.locator('.glass-card').locator('text=Strong Yes')).toBeVisible();
    await expect(page.locator('text=Key Strengths')).toBeVisible();
    await expect(page.locator('text=Gaps & Risks')).toBeVisible();
    await expect(page.locator('text=Suggestions for Improvement')).toBeVisible();
  });

  test('should support toggling screen share in E2E mode', async ({ page }) => {
    // Start session
    await page.getByTestId('start-session').click();

    // Verify screen share video container is not initially visible
    await expect(page.locator('video')).not.toBeVisible();

    // Click the share screen button in ChatInput
    await page.getByTestId('screen-share-toggle').click();

    // Verify screen share video container is visible in E2E mode
    await expect(page.locator('video')).toBeVisible();

    // Click the toggle again to stop screen sharing
    await page.getByTestId('screen-share-toggle').click();

    // Verify screen share video container is hidden again
    await expect(page.locator('video')).not.toBeVisible();
  });

  test('should support selecting ADHD Mock Specialist and chatting', async ({ page }) => {
    // Select ADHD Mock Specialist in the dropdown
    await page.selectOption('select', 'adhd-tutor');

    // Start session
    await page.getByTestId('start-session').click();

    // Send a message
    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await chatInput.fill('How is ADHD diagnosed?');
    await page.getByTestId('chat-send').click();

    // Expect the user message to be visible
    await expect(page.locator('.rounded-br-xl', { hasText: 'How is ADHD diagnosed?' })).toBeVisible();

    // Wait for the simulated ADHD tutor response
    await expect(page.locator('text=Hello, I am your ADHD Mock Specialist doctor')).toBeVisible();
    await expect(page.locator('text=suspect you might have ADHD')).toBeVisible();
  });
});
